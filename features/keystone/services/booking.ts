import { Prisma } from '@prisma/client'
import { authorizeOperation, recordAgentAction, recordAgentRead } from '../lib/agentGate'
import { actorAgentId, actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate } from '../lib/cas'
import { command } from '../lib/command'
import { addDays, FEDERAL_HOLIDAYS, isBusinessDay, localDate, US_FEDERAL, weekday, zonedInstant, type CalendarSpec } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { dec, toScale } from '../lib/decimal'
import { DomainError, Codes } from '../lib/errors'
import { nextReference, publicCode } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import { dateRange, holdExpiry, windowsForDate, type WindowTemplate } from '../domain/capacity'
import { geocoder } from '../../integrations/maps'
import { contactHash, normalizeEmail, normalizePhone } from '../domain/contact'

/*
 * Booking (SM§2, SM§3 draft → booked, I-B1). Capacity is reserved by one conditional UPDATE on the
 * window row: `bookedHours + h <= capacityHours`. Postgres re-checks the condition after waiting for
 * the row lock, so parallel holds can never oversell a window, and a losing request does not queue
 * behind the winners once the window is full. bookedHours is the authoritative counter; CapacityUsage
 * rows are its itemised ledger (they always sum to it, tested).
 */

type WindowRow = { id: string; businessUnit: string; date: Date; startsAt: Date; endsAt: Date; label: string; capacityHours: Prisma.Decimal; bookedHours: Prisma.Decimal }

async function reserve(tx: Tx, windowId: string, hours: string): Promise<WindowRow | null> {
  const rows = await tx.$queryRaw<WindowRow[]>`
    UPDATE "ArrivalWindow" SET "bookedHours" = "bookedHours" + ${hours}::numeric, version = version + 1, "updatedAt" = now()
    WHERE id = ${windowId} AND NOT closed AND "bookedHours" + ${hours}::numeric <= "capacityHours"
    RETURNING id, "businessUnit", date, "startsAt", "endsAt", label, "capacityHours", "bookedHours"`
  return rows[0] ?? null
}

async function unreserve(tx: Tx, windowId: string, hours: string) {
  await tx.$executeRaw`UPDATE "ArrivalWindow" SET "bookedHours" = GREATEST(0, "bookedHours" - ${hours}::numeric), version = version + 1, "updatedAt" = now() WHERE id = ${windowId}`
}

/** Expire this window's lapsed holds now (the timer may not have run yet) and give their hours back. */
async function sweepExpiredHolds(uow: UnitOfWork, actor: Actor, windowId: string) {
  const expired = await uow.tx.$queryRaw<{ id: string; hours: Prisma.Decimal; version: number }[]>`
    UPDATE "BookingHold" SET status = 'expired', version = version + 1, "updatedAt" = now()
    WHERE "window" = ${windowId} AND status = 'held' AND "expiresAt" <= ${uow.now}
    RETURNING id, hours, version`
  if (!expired.length) return 0
  const total = expired.reduce((sum, h) => sum.plus(h.hours.toString()), dec(0))
  await unreserve(uow.tx, windowId, toScale(total, 'qty'))
  await uow.tx.capacityUsage.deleteMany({ where: { holdId: { in: expired.map(h => h.id) } } })
  for (const h of expired) uow.audit({ eventType: 'booking_hold.expired', entityType: 'BookingHold', entityId: h.id, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), before: { status: 'held', version: h.version - 1 }, after: { status: 'expired', version: h.version } })
  return expired.length
}

async function loadJobType(tx: Tx | Db, jobTypeId: string) {
  const jobType = await tx.jobType.findUnique({ where: { id: jobTypeId }, select: { id: true, code: true, name: true, active: true, capacityHours: true, businessUnitId: true, priority: true, defaultDurationMinutes: true, bookableByAi: true, bookableOnline: true } })
  if (!jobType || !jobType.active) throw new DomainError(Codes.NOT_FOUND, 'That job type is not offered.', { field: 'jobTypeId' })
  return jobType
}

function assertSourceAllowed(actor: Actor, jobType: { bookableByAi: boolean; bookableOnline: boolean; name: string }, source: string) {
  if (actor.kind === 'agent' && !jobType.bookableByAi) throw new DomainError(Codes.GUARD_FAILED, `${jobType.name} is booked by a person, not the AI receptionist. Hand the call off.`, { reason: 'not_bookable_by_ai' })
  if (source === 'online' && !jobType.bookableOnline) throw new DomainError(Codes.GUARD_FAILED, `${jobType.name} can't be booked online.`, { reason: 'not_bookable_online' })
}

/** Is a ZIP inside a service area that covers this business unit? */
export async function serviceAreaFor(db: Tx | Db, businessUnitId: string | null, postalCode: string) {
  const zip = postalCode.trim().slice(0, 5)
  const areas = await db.serviceArea.findMany({ where: { zips: { array_contains: [zip] }, ...(businessUnitId ? { businessUnits: { some: { id: businessUnitId } } } : {}) }, select: { id: true, name: true, travelZone: true } })
  return areas[0] ?? null
}

// ---------------------------------------------------------------------------------------------
// Window materialisation

async function branchCalendar(db: Tx | Db, branchId: string | null) {
  const branch = branchId ? await db.branch.findUnique({ where: { id: branchId }, select: { timeZone: true, calendar: { select: { code: true, weekendDays: true, coverageThrough: true, exceptions: { where: { kind: { in: ['holiday', 'closure'] } }, select: { date: true } } } } } }) : null
  const timeZone = branch?.timeZone || 'America/Chicago'
  const cal = branch?.calendar
  const spec: CalendarSpec = cal
    ? { code: cal.code, timeZone, weekendDays: (cal.weekendDays as number[] | null) ?? [0], holidays: new Set(cal.exceptions.map(e => e.date.toISOString().slice(0, 10))), coverageThrough: cal.coverageThrough ? cal.coverageThrough.toISOString().slice(0, 10) : US_FEDERAL.coverageThrough }
    : { code: 'DEFAULT', timeZone, weekendDays: [0], holidays: new Set(FEDERAL_HOLIDAYS.map(h => h.date)), coverageThrough: US_FEDERAL.coverageThrough }
  return { timeZone, isOpen: (date: string) => date <= spec.coverageThrough && isBusinessDay(spec, date) }
}

/**
 * Create the arrival windows for each business unit, and each technician's shifts from their weekly
 * templates, for `days` days from `from`. Idempotent by natural key (re-running adds only what's missing).
 */
export async function materializeWindows(db: Db, actor: Actor, args: { from: string; days: number; businessUnitIds?: string[] | null; idempotencyKey: string }) {
  await authorizeOperation(db, actor, 'capacity.materialize', ['canDispatch', 'canManageCompany'], args)
  if (!Number.isSafeInteger(args.days) || args.days < 1 || args.days > 120) throw new DomainError(Codes.INVALID_INPUT, 'Materialise between 1 and 120 days.', { field: 'days' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from)) throw new DomainError(Codes.INVALID_INPUT, 'Start date must be YYYY-MM-DD.', { field: 'from' })
  const dates = dateRange(args.from, args.days)
  const units = await db.businessUnit.findMany({ where: { active: true, capacityEnabled: true, ...(args.businessUnitIds?.length ? { id: { in: args.businessUnitIds } } : {}) }, select: { id: true, branchId: true } })
  const templates = await db.arrivalWindowTemplate.findMany({ where: { active: true, businessUnitId: { in: units.map(u => u.id) } } })
  const calendars = new Map<string, Awaited<ReturnType<typeof branchCalendar>>>()
  const calendarFor = async (branchId: string | null) => {
    const key = branchId ?? ''
    if (!calendars.has(key)) calendars.set(key, await branchCalendar(db, branchId))
    return calendars.get(key)!
  }
  const windows: Prisma.ArrivalWindowCreateManyInput[] = []
  for (const unit of units) {
    const cal = await calendarFor(unit.branchId)
    const specs: WindowTemplate[] = templates.filter(t => t.businessUnitId === unit.id).map(t => ({ id: t.id, businessUnitId: unit.id, weekday: t.weekday, startLocal: t.startLocal, endLocal: t.endLocal, label: t.label, capacityHours: t.capacityHours.toString(), capacityFactor: t.capacityFactor?.toString() ?? null, active: t.active }))
    for (const date of dates) {
      for (const w of windowsForDate(specs, date, cal.timeZone, cal.isOpen)) {
        windows.push({ businessUnitId: unit.id, templateId: w.templateId, date: new Date(`${date}T00:00:00Z`), startsAt: w.startsAt, endsAt: w.endsAt, label: w.label, capacityHours: w.capacityHours, bookedHours: '0' })
      }
    }
  }
  const shiftTemplates = await db.shiftTemplate.findMany({ where: { employee: { status: 'active' } }, select: { employeeId: true, weekday: true, startLocal: true, endLocal: true, employee: { select: { homeBranchId: true } } } })
  const shifts: Prisma.ShiftCreateManyInput[] = []
  for (const t of shiftTemplates) {
    const cal = await calendarFor(t.employee?.homeBranchId ?? null)
    for (const date of dates) {
      if (weekday(date) !== t.weekday || !cal.isOpen(date)) continue
      shifts.push({ employeeId: t.employeeId, date: new Date(`${date}T00:00:00Z`), startsAt: zonedInstant(cal.timeZone, date, t.startLocal), endsAt: zonedInstant(cal.timeZone, date, t.endLocal), kind: 'regular' })
    }
  }
  const result = await command(db, { name: 'capacity.materialize', actor, idempotencyKey: args.idempotencyKey, params: args }, async uow => {
    const createdWindows = windows.length ? await uow.tx.arrivalWindow.createMany({ data: windows, skipDuplicates: true }) : { count: 0 }
    const createdShifts = shifts.length ? await uow.tx.shift.createMany({ data: shifts, skipDuplicates: true }) : { count: 0 }
    uow.audit({ eventType: 'capacity.windows_materialized', entityType: 'ArrivalWindow', entityId: `${args.from}+${args.days}`, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { windows: createdWindows.count, shifts: createdShifts.count } })
    const value = { planned: windows.length, created: createdWindows.count, shifts: createdShifts.count }
    await recordAgentAction(uow, actor, { tool: 'capacity.materialize', idempotencyKey: args.idempotencyKey, inputs: args, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

// ---------------------------------------------------------------------------------------------
// Availability

export type AvailableWindow = { windowId: string; date: string; label: string; startsAt: string; endsAt: string; remainingHours: string; businessUnitId: string }

export async function availableWindows(db: Db, actor: Actor, args: { jobTypeId: string; postalCode: string; from: string; days?: number | null; now?: Date }) {
  await authorizeOperation(db, actor, 'capacity.windows', ['canBook', 'canDispatch'], args)
  const jobType = await loadJobType(db, args.jobTypeId)
  const area = await serviceAreaFor(db, jobType.businessUnitId, args.postalCode)
  if (!area) {
    const out = { inArea: false, serviceArea: null, jobType: { id: jobType.id, name: jobType.name, priority: jobType.priority }, windows: [] as AvailableWindow[] }
    await recordAgentRead(db, actor, { tool: 'capacity.windows', inputs: args, output: { inArea: false } })
    return out
  }
  const days = Math.min(Math.max(args.days ?? 7, 1), 31)
  const now = args.now ?? new Date()
  const rows = await db.arrivalWindow.findMany({
    where: { businessUnitId: jobType.businessUnitId, closed: false, date: { gte: new Date(`${args.from}T00:00:00Z`), lt: new Date(`${addDays(args.from, days)}T00:00:00Z`) }, startsAt: { gt: now } },
    orderBy: [{ startsAt: 'asc' }],
    select: { id: true, date: true, label: true, startsAt: true, endsAt: true, capacityHours: true, bookedHours: true, businessUnitId: true },
  })
  const need = dec(jobType.capacityHours.toString())
  const windows = rows
    .map(w => ({ windowId: w.id, date: w.date.toISOString().slice(0, 10), label: w.label, startsAt: w.startsAt.toISOString(), endsAt: w.endsAt.toISOString(), remainingHours: toScale(dec(w.capacityHours.toString()).minus(w.bookedHours.toString()), 'qty'), businessUnitId: w.businessUnitId! }))
    .filter(w => dec(w.remainingHours).gte(need))
  const out = { inArea: true, serviceArea: { id: area.id, name: area.name, travelZone: area.travelZone }, jobType: { id: jobType.id, name: jobType.name, priority: jobType.priority }, windows }
  await recordAgentRead(db, actor, { tool: 'capacity.windows', inputs: args, output: { inArea: true, windows: windows.length } })
  return out
}

// ---------------------------------------------------------------------------------------------
// Holds

export type HoldArgs = { windowId: string; jobTypeId: string; source: 'csr' | 'online' | 'ai_agent'; minutes?: number | null; customerDraft?: Record<string, unknown> | null; idempotencyKey: string; now?: Date }

export async function holdWindow(db: Db, actor: Actor, args: HoldArgs) {
  await authorizeOperation(db, actor, 'booking.hold', ['canBook'], args)
  const source = actor.kind === 'agent' ? 'ai_agent' : args.source
  const jobType = await loadJobType(db, args.jobTypeId)
  assertSourceAllowed(actor, jobType, source)
  const hours = toScale(jobType.capacityHours.toString(), 'qty')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'booking.hold', actor, idempotencyKey, params, now: args.now }, async uow => {
    let window = await reserve(uow.tx, args.windowId, hours)
    if (!window && (await sweepExpiredHolds(uow, actor, args.windowId))) window = await reserve(uow.tx, args.windowId, hours)
    if (!window) {
      const exists = await uow.tx.arrivalWindow.findUnique({ where: { id: args.windowId }, select: { id: true, closed: true, businessUnitId: true } })
      if (!exists) throw new DomainError(Codes.NOT_FOUND, 'That arrival window does not exist.', { field: 'windowId' })
      throw new DomainError(Codes.CAPACITY_FULL, exists.closed ? 'That window is closed.' : 'That window just filled up. Offer the next one.', { reason: exists.closed ? 'closed' : 'full' })
    }
    if (window.businessUnit !== jobType.businessUnitId) throw new DomainError(Codes.INVALID_INPUT, 'That window belongs to a different department.', { field: 'windowId' })
    const expiresAt = holdExpiry(uow.now, source, args.minutes)
    const code = publicCode('HLD')
    const hold = await uow.tx.bookingHold.create({
      data: { publicCode: code, windowId: window.id, jobTypeId: jobType.id, hours, source, heldByUserId: actorUserId(actor), heldByAgentId: actorAgentId(actor), customerDraft: (args.customerDraft ?? undefined) as never, expiresAt, status: 'held' },
      select: { id: true, version: true },
    })
    await uow.tx.capacityUsage.create({ data: { windowId: window.id, kind: 'hold', holdId: hold.id, hours } })
    auditCreate(uow, actor, 'BookingHold', hold.id, 'booking_hold.held', { windowId: window.id, jobTypeId: jobType.id, hours, source, expiresAt })
    const value = { holdId: hold.id, publicCode: code, version: hold.version, windowId: window.id, label: window.label, startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString(), expiresAt: expiresAt.toISOString(), hours }
    await recordAgentAction(uow, actor, { tool: 'booking.hold', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

export async function releaseHold(db: Db, actor: Actor, args: { holdId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'booking.release', ['canBook'], args)
  const result = await command(db, { name: 'booking.release', actor, idempotencyKey: args.idempotencyKey, params: { holdId: args.holdId }, now: args.now }, async uow => {
    const [hold] = await uow.tx.$queryRaw<{ id: string; status: string; version: number; window: string; hours: Prisma.Decimal; heldByAgent: string | null }[]>`SELECT id, status, version, "window", hours, "heldByAgent" FROM "BookingHold" WHERE id = ${args.holdId} FOR UPDATE`
    if (!hold) throw new DomainError(Codes.NOT_FOUND, 'Hold not found.')
    if (actor.kind === 'agent' && hold.heldByAgent !== actor.agentId) throw new DomainError(Codes.NOT_AUTHORIZED, 'An agent can release only its own holds.')
    if (hold.status !== 'held') return { holdId: hold.id, status: hold.status }
    await casUpdate(uow, { model: 'BookingHold', id: hold.id, version: hold.version, from: ['held'], to: 'released', actor, eventType: 'booking_hold.released' })
    await unreserve(uow.tx, hold.window, hold.hours.toString())
    await uow.tx.capacityUsage.deleteMany({ where: { holdId: hold.id } })
    await recordAgentAction(uow, actor, { tool: 'booking.release', idempotencyKey: args.idempotencyKey, inputs: { holdId: args.holdId }, output: { status: 'released' } })
    return { holdId: hold.id, status: 'released' }
  })
  return { replay: result.replay, ...result.value }
}

/** Timer: expire every lapsed hold (all windows). Safe to run from several workers at once. */
export async function expireHolds(db: Db, now = new Date()) {
  const lapsed = await db.bookingHold.findMany({ where: { status: 'held', expiresAt: { lte: now } }, select: { windowId: true }, distinct: ['windowId'], take: 500 })
  let expired = 0
  for (const { windowId } of lapsed) {
    if (!windowId) continue
    const actor: Actor = { kind: 'system', name: 'hold-expiry' }
    const r = await command(db, { name: 'booking.expire', actor, idempotencyKey: `hold-expiry:${windowId}:${now.toISOString()}`, params: { windowId }, now }, uow => sweepExpiredHolds(uow, actor, windowId))
    expired += Number(r.value)
  }
  return { expired }
}

// ---------------------------------------------------------------------------------------------
// Book a job

export type NewCustomer = { firstName?: string; lastName?: string; displayName?: string; organizationName?: string; kind?: 'residential' | 'commercial'; phone?: string; email?: string }
export type NewLocation = { address1: string; address2?: string; city: string; state?: string; postalCode: string; propertyType?: string }

export type BookArgs = {
  holdId?: string | null
  windowId?: string | null
  jobTypeId: string
  customerId?: string | null
  locationId?: string | null
  customer?: NewCustomer | null
  location?: NewLocation | null
  summary?: string | null
  source?: 'csr' | 'online' | 'ai_agent' | null
  leadId?: string | null
  /** The caller agreed to booking texts (on-the-way, confirmation): recorded as transactional SMS consent. */
  smsConsent?: boolean | null
  consentEvidence?: Record<string, unknown> | null
  idempotencyKey: string
  now?: Date
}

export async function bookJob(db: Db, actor: Actor, args: BookArgs) {
  await authorizeOperation(db, actor, 'booking.confirm', ['canBook'], args)
  const jobType = await loadJobType(db, args.jobTypeId)
  const source = actor.kind === 'agent' ? 'ai_agent' : args.source ?? 'csr'
  assertSourceAllowed(actor, jobType, source)
  if (!args.holdId && !args.windowId) throw new DomainError(Codes.INVALID_INPUT, 'Choose an arrival window (or a hold).', { field: 'windowId' })
  if (!args.customerId && !args.customer) throw new DomainError(Codes.INVALID_INPUT, 'Choose or create a customer.', { field: 'customer' })
  if (!args.locationId && !args.location) throw new DomainError(Codes.INVALID_INPUT, 'Choose or add a service address.', { field: 'location' })
  // Geocode outside the transaction: it may call a provider.
  const geo = args.location ? await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? 'TX', postalCode: args.location.postalCode }) : null
  const phone = args.customer?.phone ? normalizePhone(args.customer.phone) : null
  const email = args.customer?.email ? normalizeEmail(args.customer.email) : null
  const { idempotencyKey, now: _now, ...params } = args

  const result = await command(db, { name: 'booking.confirm', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const hours = toScale(jobType.capacityHours.toString(), 'qty')

    // 1. Capacity: convert the hold, or reserve now.
    let windowId: string
    let holdId: string | null = null
    if (args.holdId) {
      const [hold] = await tx.$queryRaw<{ id: string; status: string; version: number; window: string; jobType: string; expiresAt: Date; heldByAgent: string | null }[]>`SELECT id, status, version, "window", "jobType", "expiresAt", "heldByAgent" FROM "BookingHold" WHERE id = ${args.holdId} FOR UPDATE`
      if (!hold) throw new DomainError(Codes.NOT_FOUND, 'Hold not found.', { field: 'holdId' })
      if (hold.status !== 'held') throw new DomainError(Codes.INVALID_TRANSITION, `That hold is ${hold.status}.`, { currentStatus: hold.status, to: 'converted' })
      if (hold.expiresAt <= uow.now) throw new DomainError(Codes.HOLD_EXPIRED, 'The hold ran out. Check the window again.', { currentStatus: 'held', reason: 'expired' })
      if (hold.jobType !== jobType.id) throw new DomainError(Codes.INVALID_INPUT, 'The hold was for a different job type.', { field: 'jobTypeId' })
      if (actor.kind === 'agent' && hold.heldByAgent !== actor.agentId) throw new DomainError(Codes.NOT_AUTHORIZED, 'An agent can confirm only its own holds.')
      await casUpdate(uow, { model: 'BookingHold', id: hold.id, version: hold.version, from: ['held'], to: 'converted', actor, eventType: 'booking_hold.converted' })
      windowId = hold.window
      holdId = hold.id
    } else {
      const reserved = await reserve(tx, args.windowId!, hours)
      if (!reserved) throw new DomainError(Codes.CAPACITY_FULL, 'That window just filled up. Offer the next one.', { reason: 'full' })
      if (reserved.businessUnit !== jobType.businessUnitId) throw new DomainError(Codes.INVALID_INPUT, 'That window belongs to a different department.', { field: 'windowId' })
      windowId = reserved.id
    }
    const window = await tx.arrivalWindow.findUniqueOrThrow({ where: { id: windowId }, select: { id: true, startsAt: true, endsAt: true, label: true, date: true, businessUnitId: true } })

    // 2. Customer and location.
    const customer = args.customerId
      ? await tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true, displayName: true, doNotService: true } })
      : await createCustomerInTx(uow, actor, { ...args.customer!, phone, email }, { smsConsent: !!args.smsConsent, evidence: args.consentEvidence ?? { source } })
    if (!customer) throw new DomainError(Codes.NOT_FOUND, 'Customer not found.', { field: 'customerId' })
    if (customer.doNotService) throw new DomainError(Codes.GUARD_FAILED, 'This customer is marked do-not-service. A manager has to book it.', { reason: 'do_not_service' })
    const location = args.locationId
      ? await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, postalCode: true, customerId: true } })
      : await createLocationInTx(uow, actor, customer.id, args.location!, geo!)
    if (!location) throw new DomainError(Codes.NOT_FOUND, 'Service address not found.', { field: 'locationId' })
    const area = await serviceAreaFor(tx, jobType.businessUnitId, location.postalCode)
    if (!area) throw new DomainError(Codes.OUT_OF_AREA, `ZIP ${location.postalCode} is outside the service area for ${jobType.name}.`, { reason: 'out_of_area' })

    // 3. Job, visit, usage.
    const ref = await nextReference(tx, 'JOB', uow.now)
    const job = await tx.job.create({
      data: {
        ref, publicCode: publicCode('J'), customerId: customer.id, locationId: location.id, businessUnitId: jobType.businessUnitId, jobTypeId: jobType.id, priority: jobType.priority,
        status: 'booked', summary: args.summary ?? '', source, leadId: args.leadId ?? null, bookedById: actorUserId(actor), bookedByAgentId: actorAgentId(actor),
      },
      select: { id: true, ref: true, publicCode: true },
    })
    const visit = await tx.visit.create({
      data: { ref: `${ref}-V1`, jobId: job.id, windowId: window.id, plannedStart: window.startsAt, plannedDurationMinutes: jobType.defaultDurationMinutes, capacityHours: hours, status: 'unassigned' },
      select: { id: true, ref: true },
    })
    if (holdId) {
      await tx.capacityUsage.updateMany({ where: { holdId }, data: { kind: 'visit', visitId: visit.id } })
      await tx.bookingHold.update({ where: { id: holdId }, data: { jobId: job.id, visitId: visit.id } })
    } else {
      await tx.capacityUsage.create({ data: { windowId: window.id, kind: 'visit', visitId: visit.id, hours } })
    }
    auditCreate(uow, actor, 'Job', job.id, 'job.booked', { ref, customerId: customer.id, locationId: location.id, jobTypeId: jobType.id, windowId: window.id, source, holdId })
    auditCreate(uow, actor, 'Visit', visit.id, 'visit.created', { ref: visit.ref, windowId: window.id, status: 'unassigned' })

    // 4. Lead → booked.
    if (args.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: args.leadId }, select: { id: true, status: true, version: true } })
      if (lead && ['new', 'contacted', 'qualified'].includes(lead.status)) {
        await casUpdate(uow, { model: 'Lead', id: lead.id, version: lead.version, from: [lead.status], to: 'booked', actor, eventType: 'lead.booked', data: { jobId: job.id, customerId: customer.id, locationId: location.id } })
      }
    }

    const value = { jobId: job.id, ref: job.ref, publicCode: job.publicCode, visitId: visit.id, windowId: window.id, window: window.label, date: window.date.toISOString().slice(0, 10), startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString(), customerId: customer.id, locationId: location.id }
    await recordAgentAction(uow, actor, { tool: 'booking.confirm', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

// ---------------------------------------------------------------------------------------------
// Customers and locations (shared with the CRM commands)

export async function createCustomerInTx(uow: UnitOfWork, actor: Actor, input: Omit<NewCustomer, 'phone' | 'email'> & { phone: string | null; email: string | null }, consent: { smsConsent: boolean; evidence: Record<string, unknown> }) {
  const { tx } = uow
  const displayName = (input.displayName || [input.firstName, input.lastName].filter(Boolean).join(' ') || input.organizationName || '').trim()
  if (!displayName) throw new DomainError(Codes.INVALID_INPUT, 'A customer needs a name.', { field: 'customer' })
  const ref = await nextReference(tx, 'CUS', uow.now)
  const customer = await tx.customer.create({ data: { ref, kind: input.kind ?? 'residential', displayName, organizationName: input.organizationName ?? '' }, select: { id: true, displayName: true, doNotService: true } })
  const contact = await tx.contact.create({ data: { customerId: customer.id, firstName: input.firstName ?? '', lastName: input.lastName ?? '', role: 'owner' }, select: { id: true } })
  await tx.customer.update({ where: { id: customer.id }, data: { primaryContactId: contact.id } })
  const points: Prisma.ContactPointCreateManyInput[] = []
  if (input.phone) points.push({ contactId: contact.id, kind: 'mobile', value: input.phone, valueHash: contactHash(input.phone), isPrimary: true, carrierLineType: 'unknown' })
  if (input.email) points.push({ contactId: contact.id, kind: 'email', value: input.email, valueHash: contactHash(input.email), isPrimary: !input.phone, carrierLineType: 'unknown' })
  if (points.length) {
    const created = await tx.contactPoint.createManyAndReturn({ data: points, select: { id: true, kind: true } })
    const mobile = created.find(p => p.kind === 'mobile')
    if (mobile && consent.smsConsent) {
      await tx.consentRecord.create({ data: { contactPointId: mobile.id, purpose: 'transactional_sms', action: 'grant', channel: actor.kind === 'agent' ? 'phone' : 'phone', evidence: consent.evidence as never, wordingVersion: 'booking-texts-v1', recordedAt: uow.now, actorKind: actor.kind === 'agent' ? 'agent' : actor.kind === 'user' ? 'user' : 'system', actorId: actorAgentId(actor) ?? actorUserId(actor) ?? '' } })
    }
  }
  auditCreate(uow, actor, 'Customer', customer.id, 'customer.created', { ref, displayName, kind: input.kind ?? 'residential', contactPoints: points.length, smsConsent: consent.smsConsent })
  return customer
}

export async function createLocationInTx(uow: UnitOfWork, actor: Actor, customerId: string, input: NewLocation, geo: { lat: string | null; lng: string | null; quality: string; timeZone: string; postalCode: string }) {
  const { tx } = uow
  if (!/^\d{5}(-\d{4})?$/.test(input.postalCode.trim())) throw new DomainError(Codes.INVALID_INPUT, 'That ZIP code is not valid.', { field: 'postalCode' })
  const area = await serviceAreaFor(tx, null, input.postalCode)
  const ref = await nextReference(tx, 'LOC', uow.now)
  const location = await tx.serviceLocation.create({
    data: {
      ref, customerId, address1: input.address1.trim(), address2: input.address2?.trim() ?? '', city: input.city.trim(), state: (input.state ?? 'TX').toUpperCase(), postalCode: input.postalCode.trim(), country: 'US',
      lat: geo.lat, lng: geo.lng, geocodeQuality: geo.quality, timeZone: geo.timeZone, serviceAreaId: area?.id ?? null, propertyType: input.propertyType ?? 'single_family',
    },
    select: { id: true, postalCode: true, customerId: true },
  })
  await tx.locationOwnership.create({ data: { locationId: location.id, customerId, from: new Date(`${localDate({ timeZone: geo.timeZone }, uow.now)}T00:00:00Z`), reason: 'created' } })
  auditCreate(uow, actor, 'ServiceLocation', location.id, 'location.created', { ref, customerId, postalCode: location.postalCode, serviceAreaId: area?.id ?? null, geocodeQuality: geo.quality })
  return location
}

