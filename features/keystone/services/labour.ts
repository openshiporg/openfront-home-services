import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, can, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import { addDays, localDate } from '../lib/calendar'
import { payloadHash } from '../lib/canonical'
import { dec, ZERO } from '../lib/decimal'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { allocateMinor, roundMinor } from '../lib/money'
import { consumeApproval, requestApproval } from '../lib/approval'
import { nextReference } from '../lib/sequence'
import type { Permission } from '../access'
import { asDate, dayOf } from './billingShared'
import * as payExport from '../domain/payExport'
import {
  MAX_DAY_HOURS, clawbackAmount, findOverlap, hourlyLines, hoursBetween, isWorked, poolRoles, proposeSegments, ruleFor, rulePool, sharesAddUp,
  shareAmount, sheetHours, spiffAmount, spiffRole, workweekStart, type CommissionPlan, type HourlyPlan, type PaySegment,
} from '../domain/pay'

/*
 * Timesheets, pay plans, attribution and pay periods (STATE-MACHINES §16, SCHEMA §14).
 * Time is proposed from visit status events and approved by someone other than the person who worked it. A pay plan version is published
 * through an approval and never edited afterwards. A pay period is calculated from approved time and from invoice, payment, refund,
 * dispute, recall and membership facts; the same inputs give the same lines and the same hash. Approval is a second person's decision;
 * an exported period is locked, and anything that turns up late is paid in the next period. Nothing here sends anything anywhere:
 * the export is a file a person takes to payroll.
 */

const TIME_APPROVE: Permission[] = ['canApproveTimesheets']
const WORKER: Permission[] = ['canWorkVisits', 'canApproveTimesheets', 'canRunPayroll']
const PLANS: Permission[] = ['canManagePayPlans']
const ATTRIBUTE: Permission[] = ['canManagePayPlans', 'canRunPayroll']
const PAYROLL: Permission[] = ['canRunPayroll']
const PERIOD_APPROVE_RUN: Permission[] = ['canRunPayroll', 'canApprovePayPeriods']

const bad = (message: string, field?: string) => new DomainError(Codes.INVALID_INPUT, message, field ? { field } : {})
const guard = (message: string) => new DomainError(Codes.GUARD_FAILED, message)
const str = (v: unknown, field: string, max = 300, required = false) => {
  const s = String(v ?? '').trim()
  if (required && !s) throw bad(`${field} is needed.`, field)
  if (s.length > max) throw bad(`${field} is too long.`, field)
  return s
}
const DAY = /^\d{4}-\d{2}-\d{2}$/
const day = (v: unknown, field: string) => {
  const s = String(v ?? '').trim()
  if (!DAY.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`)) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) throw bad(`${field} must be a date like 2026-11-09.`, field)
  return s
}
const when = (v: unknown, field: string) => {
  const d = new Date(String(v ?? ''))
  if (Number.isNaN(d.getTime())) throw bad(`${field} must be a date and time.`, field)
  return d
}
const minor = (v: unknown, field: string) => {
  const s = String(v ?? '').trim()
  if (!/^-?\d{1,12}$/.test(s)) throw bad(`${field} must be a whole number of cents.`, field)
  return BigInt(s)
}
const homeZone = async (tx: Tx) => (await tx.companySettings.findFirst({ select: { homeTimeZone: true } }))?.homeTimeZone || 'America/Chicago'
const iso = (d: Date) => d.toISOString().slice(0, 10)

export const SEGMENT_KINDS_ALLOWED = ['job', 'drive', 'shop', 'supply_run', 'break_unpaid', 'break_paid', 'on_call_standby', 'training', 'pto'] as const

const selfEmployee = (tx: Tx, actor: Actor) => {
  const userId = actorUserId(actor)
  return userId ? tx.employee.findFirst({ where: { userId }, select: { id: true, userId: true, displayName: true } }) : Promise.resolve(null)
}

/** Who may act on a sheet: its owner, or a timesheet approver. Anyone else gets "not found", not a hint that it exists. */
async function sheetFor(tx: Tx, actor: Actor, id: string, owner: boolean) {
  const sheet = await tx.timesheet.findUnique({ where: { id }, include: { employee: { select: { id: true, userId: true, displayName: true } } } })
  if (!sheet) throw new DomainError(Codes.NOT_FOUND, 'That timesheet does not exist.')
  const mine = !!sheet.employee?.userId && sheet.employee.userId === actorUserId(actor)
  if (owner ? !(mine || can(actor, 'canApproveTimesheets')) : !can(actor, 'canApproveTimesheets')) throw new DomainError(Codes.NOT_FOUND, 'That timesheet does not exist.')
  return { sheet, mine }
}

async function recomputeTotal(tx: Tx, timesheetId: string) {
  const segs = await tx.timeSegment.findMany({ where: { timesheetId }, select: { kind: true, hours: true } })
  const total = sheetHours(segs.map(s => ({ kind: s.kind, hours: s.hours?.toString() ?? '0' })))
  await tx.timesheet.update({ where: { id: timesheetId }, data: { totalHours: total.toFixed(4) } })
  return total
}

// ── Timesheets ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Open (or refresh) one person's sheet for a day and propose its time from the visit status events. Safe to repeat. */
export async function proposeTimesheet(db: Db, actor: Actor, args: { employeeId?: string; workDate: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.propose', WORKER, args)
  const { idempotencyKey, now: _n, ...params } = args
  const workDate = day(args.workDate, 'workDate')
  const result = await command(db, { name: 'timesheet.propose', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const me = await selfEmployee(tx, actor)
    const employeeId = args.employeeId || me?.id
    if (!employeeId) throw bad('Say whose time this is.', 'employeeId')
    if (employeeId !== me?.id && !can(actor, 'canApproveTimesheets') && !can(actor, 'canRunPayroll')) throw new DomainError(Codes.NOT_AUTHORIZED, 'You can open only your own timesheet.')
    const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
    if (!employee) throw new DomainError(Codes.NOT_FOUND, 'That person does not exist.')
    if (workDate > (await todayLocal(tx, uow.now))) throw guard('A timesheet cannot be opened for a day that has not happened.')
    let sheet = await tx.timesheet.findUnique({ where: { employeeId_workDate: { employeeId, workDate: asDate(workDate) } } })
    let created = false
    if (!sheet) {
      sheet = await tx.timesheet.create({ data: { employeeId, workDate: asDate(workDate), workweekStart: asDate(workweekStart(workDate)), status: 'open' } })
      auditCreate(uow, actor, 'Timesheet', sheet.id, 'timesheet.opened', { employeeId, workDate })
      created = true
    }
    if (sheet.status !== 'open') return { id: sheet.id, status: sheet.status, added: 0, created }
    const zone = await homeZone(tx)
    // The status screen records who moved a visit as a user, so the person's events are theirs by employee or by their sign-in on a visit they are on.
    const person = await tx.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { userId: true } })
    const events = await tx.visitStatusEvent.findMany({
      where: { OR: [{ employeeId }, ...(person.userId ? [{ actorUserId: person.userId, visit: { assignments: { some: { employeeId } } } }] : [])], occurredAt: { gte: new Date(asDate(workDate).getTime() - 86_400_000), lt: new Date(asDate(workDate).getTime() + 3 * 86_400_000) } },
      select: { id: true, visitId: true, toStatus: true, occurredAt: true }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    })
    const proposed = proposeSegments(events.filter(e => !!e.visitId).map(e => ({ id: e.id, visitId: e.visitId as string, toStatus: e.toStatus, occurredAt: e.occurredAt })))
      .filter(p => localDate({ timeZone: zone }, p.startsAt) === workDate)
    let added = 0
    for (const p of proposed) {
      const exists = await tx.timeSegment.findUnique({ where: { timesheetId_sourceKey: { timesheetId: sheet.id, sourceKey: p.sourceKey } }, select: { id: true } })
      if (exists) continue
      await tx.timeSegment.create({ data: { timesheetId: sheet.id, kind: p.kind, startsAt: p.startsAt, endsAt: p.endsAt, hours: hoursBetween(p.startsAt, p.endsAt).toFixed(4), visitId: p.visitId, source: 'status_event', sourceKey: p.sourceKey, createdById: actorUserId(actor) } })
      added += 1
    }
    await recomputeTotal(tx, sheet.id)
    return { id: sheet.id, status: 'open', added, created }
  })
  return { replay: result.replay, ...result.value }
}

async function todayLocal(tx: Tx, now: Date) {
  return localDate({ timeZone: await homeZone(tx) }, now)
}

/** Time the person records themselves (a shop day, a supply run, a break, training). Only on an open sheet, never overlapping. */
export async function addSegment(db: Db, actor: Actor, args: { timesheetId: string; kind: string; startsAt: string; endsAt: string; note?: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.add_segment', WORKER, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.add_segment', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const { sheet } = await sheetFor(tx, actor, args.timesheetId, true)
    if (sheet.status !== 'open') throw guard('This timesheet is already sent in. Ask for it to be sent back, or add an adjustment once it is approved.')
    if (!(SEGMENT_KINDS_ALLOWED as readonly string[]).includes(args.kind)) throw bad('Pick a kind of time.', 'kind')
    const startsAt = when(args.startsAt, 'startsAt'); const endsAt = when(args.endsAt, 'endsAt')
    if (endsAt <= startsAt) throw bad('The end must be after the start.', 'endsAt')
    const hours = hoursBetween(startsAt, endsAt)
    if (hours.greaterThan(MAX_DAY_HOURS)) throw bad(`One entry cannot be longer than ${MAX_DAY_HOURS} hours.`, 'endsAt')
    if (startsAt.getTime() > uow.now.getTime() + 60_000 || endsAt.getTime() > uow.now.getTime() + 60_000) throw bad('Time cannot be in the future.', 'endsAt')
    const zone = await homeZone(tx)
    if (localDate({ timeZone: zone }, startsAt) !== iso(sheet.workDate)) throw bad('That time starts on a different day than this sheet.', 'startsAt')
    const existing = await tx.timeSegment.findMany({ where: { timesheetId: sheet.id }, select: { kind: true, startsAt: true, endsAt: true } })
    if (findOverlap([...existing, { kind: args.kind, startsAt, endsAt }])) throw guard('That overlaps time already on this sheet.')
    const seg = await tx.timeSegment.create({ data: { timesheetId: sheet.id, kind: args.kind, startsAt, endsAt, hours: hours.toFixed(4), source: 'manual', sourceKey: `manual:${idempotencyKey}`, note: str(args.note, 'note', 300), createdById: actorUserId(actor) } })
    auditCreate(uow, actor, 'TimeSegment', seg.id, 'timesheet.segment_added', { timesheetId: sheet.id, kind: args.kind, hours: hours.toFixed(4) })
    await recomputeTotal(tx, sheet.id)
    return { id: seg.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Remove a segment the person added by hand (proposed time is corrected by an approver's adjustment, never erased). */
export async function removeSegment(db: Db, actor: Actor, args: { segmentId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.remove_segment', WORKER, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.remove_segment', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const seg = await tx.timeSegment.findUnique({ where: { id: args.segmentId }, select: { id: true, timesheetId: true, source: true } })
    if (!seg?.timesheetId) throw new DomainError(Codes.NOT_FOUND, 'That entry does not exist.')
    const { sheet } = await sheetFor(tx, actor, seg.timesheetId, true)
    if (sheet.status !== 'open') throw guard('This timesheet is already sent in.')
    if (seg.source !== 'manual') throw guard('Time taken from the visit record is corrected with an adjustment, not removed.')
    await tx.timeSegment.delete({ where: { id: seg.id } })
    uow.audit({ eventType: 'timesheet.segment_removed', entityType: 'TimeSegment', entityId: seg.id, actorUserId: actorUserId(actor), after: { timesheetId: sheet.id } })
    await recomputeTotal(tx, sheet.id)
    return { removed: true }
  })
  return { replay: result.replay, ...result.value }
}

/** The owner sends the day in. It must not overlap itself, and a day is at most 16 hours. */
export async function submitTimesheet(db: Db, actor: Actor, args: { timesheetId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.submit', WORKER, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const { sheet } = await sheetFor(tx, actor, args.timesheetId, true)
    const segs = await tx.timeSegment.findMany({ where: { timesheetId: sheet.id }, select: { kind: true, startsAt: true, endsAt: true, hours: true } })
    if (segs.length === 0) throw guard('There is no time on this sheet yet.')
    const clash = findOverlap(segs)
    if (clash) throw guard('Two entries cover the same time. Fix that before sending the day in.')
    const total = sheetHours(segs.map(s => ({ kind: s.kind, hours: s.hours?.toString() ?? '0' })))
    if (total.greaterThan(MAX_DAY_HOURS)) throw guard(`A day is at most ${MAX_DAY_HOURS} hours. Check the entries.`)
    await tx.timesheet.update({ where: { id: sheet.id }, data: { totalHours: total.toFixed(4) } })
    const v = await casUpdate(uow, { model: 'Timesheet', id: sheet.id, version: args.expectedVersion, from: ['open'], to: 'submitted', actor, eventType: 'timesheet.submitted', data: { submittedAt: uow.now, rejectReason: '' } })
    return { status: 'submitted', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Someone else approves the day. You cannot approve your own time (separation of duties), whatever your role. */
export async function approveTimesheet(db: Db, actor: Actor, args: { timesheetId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.approve', TIME_APPROVE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.approve', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const { sheet, mine } = await sheetFor(tx, actor, args.timesheetId, false)
    if (mine) throw new DomainError(Codes.NOT_AUTHORIZED, 'You cannot approve your own time. Someone else has to.', { reason: 'separation_of_duties' })
    const v = await casUpdate(uow, { model: 'Timesheet', id: sheet.id, version: args.expectedVersion, from: ['submitted'], to: 'approved', actor, eventType: 'timesheet.approved', approverId: actorUserId(actor), data: { approvedById: actorUserId(actor), approvedAt: uow.now } })
    return { status: 'approved', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function rejectTimesheet(db: Db, actor: Actor, args: { timesheetId: string; reason: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.reject', TIME_APPROVE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.reject', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const { sheet, mine } = await sheetFor(tx, actor, args.timesheetId, false)
    if (mine) throw new DomainError(Codes.NOT_AUTHORIZED, 'You cannot decide on your own time.', { reason: 'separation_of_duties' })
    const reason = str(args.reason, 'reason', 300, true)
    const v = await casUpdate(uow, { model: 'Timesheet', id: sheet.id, version: args.expectedVersion, from: ['submitted'], to: 'open', actor, eventType: 'timesheet.rejected', reason, data: { rejectReason: reason } })
    return { status: 'open', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** After approval an approver adds time that was missed. It is new time with a reason, paid in the next pay run that has not locked it. */
export async function adjustTimesheet(db: Db, actor: Actor, args: { timesheetId: string; kind: string; startsAt: string; endsAt: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'timesheet.adjust', TIME_APPROVE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'timesheet.adjust', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const { sheet, mine } = await sheetFor(tx, actor, args.timesheetId, false)
    if (mine) throw new DomainError(Codes.NOT_AUTHORIZED, 'You cannot adjust your own time.', { reason: 'separation_of_duties' })
    if (sheet.status === 'locked') throw guard('This day was paid in an exported pay period and is locked. Add a pay adjustment to the next period instead.')
    if (sheet.status !== 'approved') throw guard('Only an approved timesheet takes an adjustment. Send it back instead.')
    if (!(SEGMENT_KINDS_ALLOWED as readonly string[]).includes(args.kind)) throw bad('Pick a kind of time.', 'kind')
    const startsAt = when(args.startsAt, 'startsAt'); const endsAt = when(args.endsAt, 'endsAt')
    if (endsAt <= startsAt) throw bad('The end must be after the start.', 'endsAt')
    const hours = hoursBetween(startsAt, endsAt)
    if (hours.greaterThan(MAX_DAY_HOURS)) throw bad(`One entry cannot be longer than ${MAX_DAY_HOURS} hours.`, 'endsAt')
    const existing = await tx.timeSegment.findMany({ where: { timesheetId: sheet.id }, select: { kind: true, startsAt: true, endsAt: true } })
    if (findOverlap([...existing, { kind: args.kind, startsAt, endsAt }])) throw guard('That overlaps time already on this sheet.')
    const seg = await tx.timeSegment.create({ data: { timesheetId: sheet.id, kind: args.kind, startsAt, endsAt, hours: hours.toFixed(4), source: 'adjustment', sourceKey: `adj:${idempotencyKey}`, note: str(args.reason, 'reason', 300, true), createdById: actorUserId(actor) } })
    auditCreate(uow, actor, 'TimeSegment', seg.id, 'timesheet.adjusted', { timesheetId: sheet.id, kind: args.kind, hours: hours.toFixed(4) }, { reason: args.reason })
    await recomputeTotal(tx, sheet.id)
    return { id: seg.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Pay plans ───────────────────────────────────────────────────────────────────────────────────────────────────

export type PlanTerms = { hourlyRates: Record<string, string>; overtime: { weeklyThresholdHours: string; multiplier: string }; commission: CommissionPlan; spiffs: Record<string, string>; clawbacks: { windowDays: number; refund: boolean; chargeback: boolean; recallPercent: string; membershipCancel: boolean } }

/** Check the terms of a plan version and return them in the one canonical shape that is stored and hashed. */
export function normalizeTerms(input: Record<string, unknown>): PlanTerms {
  const rates = (input.hourlyRates ?? {}) as Record<string, unknown>
  const hourlyRates: Record<string, string> = {}
  for (const [k, v] of Object.entries(rates)) {
    const s = String(v ?? '').trim()
    if (!/^\d{1,7}$/.test(s)) throw bad(`The hourly rate for ${k} must be whole cents.`, 'hourlyRates')
    hourlyRates[k] = s
  }
  if (!hourlyRates.default) throw bad('Set a default hourly rate.', 'hourlyRates')
  const ot = (input.overtime ?? {}) as Record<string, unknown>
  const threshold = dec(String(ot.weeklyThresholdHours ?? '40')); const mult = dec(String(ot.multiplier ?? '1.5'))
  if (threshold.lessThanOrEqualTo(0) || threshold.greaterThan(168)) throw bad('The weekly overtime threshold is hours between 1 and 168.', 'overtime')
  if (mult.lessThan(1) || mult.greaterThan(4)) throw bad('The overtime multiplier is between 1 and 4.', 'overtime')
  const c = (input.commission ?? { basis: 'invoice_posted', rules: [] }) as { basis?: string; rules?: Record<string, unknown>[] }
  const basis = c.basis === 'payment_received' ? 'payment_received' : 'invoice_posted'
  const rules = (c.rules ?? []).map(r => {
    const kind = r.kind === 'fixed_per_task' ? 'fixed_per_task' : r.kind === 'percent_of_sold' ? 'percent_of_sold' : null
    if (!kind) throw bad('A commission rule is a percent of the sale or a fixed amount per task.', 'commission')
    const value = String(r.value ?? '').trim()
    if (kind === 'percent_of_sold' ? !(dec(value || '-1').greaterThanOrEqualTo(0) && dec(value || '-1').lessThanOrEqualTo(100)) : !/^\d{1,9}$/.test(value)) throw bad(kind === 'percent_of_sold' ? 'A commission percent is between 0 and 100.' : 'A fixed commission is whole cents.', 'commission')
    const splitBasis = String(r.splitBasis ?? 'sold_by'); poolRoles(splitBasis)
    return { scope: str(r.scope, 'scope', 80, true), kind, value, splitBasis } as CommissionPlan['rules'][number]
  })
  if (new Set(rules.map(r => r.scope)).size !== rules.length) throw bad('Each commission scope can have only one rule.', 'commission')
  const spiffs: Record<string, string> = {}
  for (const [k, v] of Object.entries((input.spiffs ?? {}) as Record<string, unknown>)) {
    if (!['tgl', 'membership', 'financing'].includes(k)) throw bad(`Unknown spiff "${k}": use tgl, membership or financing.`, 'spiffs')
    if (!/^\d{1,9}$/.test(String(v))) throw bad(`The ${k} spiff is whole cents.`, 'spiffs')
    spiffs[k] = String(v)
  }
  const cb = (input.clawbacks ?? {}) as Record<string, unknown>
  const windowDays = Number(cb.windowDays ?? 90)
  if (!Number.isInteger(windowDays) || windowDays < 0 || windowDays > 730) throw bad('The clawback window is 0 to 730 days.', 'clawbacks')
  const recallPercent = String(cb.recallPercent ?? '0')
  if (dec(recallPercent).lessThan(0) || dec(recallPercent).greaterThan(100)) throw bad('The recall clawback is a percent from 0 to 100.', 'clawbacks')
  return {
    hourlyRates, overtime: { weeklyThresholdHours: threshold.toFixed(), multiplier: mult.toFixed() }, commission: { basis, rules }, spiffs,
    clawbacks: { windowDays, refund: cb.refund !== false, chargeback: cb.chargeback !== false, recallPercent: dec(recallPercent).toFixed(), membershipCancel: cb.membershipCancel !== false },
  }
}

const contentOf = (t: PlanTerms) => payloadHash({ h: t.hourlyRates, o: t.overtime, c: t.commission, s: t.spiffs, k: t.clawbacks })
const termData = (t: PlanTerms) => ({ hourlyRates: t.hourlyRates, overtime: t.overtime, commission: t.commission, spiffs: t.spiffs, clawbacks: t.clawbacks, laterEngine: { tiers: false, regularRate: false, pieceRate: false, prevailingWage: false } })

export async function createPayPlan(db: Db, actor: Actor, args: { name: string; terms: Record<string, unknown>; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_plan.create', PLANS, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_plan.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const name = str(args.name, 'name', 120, true)
    if (await tx.payPlan.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })) throw guard('A pay plan with that name exists. Add a version to it instead.')
    const terms = normalizeTerms(args.terms ?? {})
    const plan = await tx.payPlan.create({ data: { name, active: true } })
    const v = await tx.payPlanVersion.create({ data: { planId: plan.id, versionNumber: 1, status: 'draft', contentHash: contentOf(terms), ...termData(terms) } as never })
    auditCreate(uow, actor, 'PayPlan', plan.id, 'pay_plan.created', { name })
    auditCreate(uow, actor, 'PayPlanVersion', v.id, 'pay_plan.version_drafted', { planId: plan.id, versionNumber: 1, contentHash: contentOf(terms) })
    return { planId: plan.id, versionId: v.id }
  })
  return { replay: result.replay, ...result.value }
}

/** A new draft version of a plan, or new terms for the draft that is already open (one draft at a time). */
export async function savePayPlanDraft(db: Db, actor: Actor, args: { planId: string; terms: Record<string, unknown>; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_plan.draft', PLANS, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_plan.draft', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const plan = await tx.payPlan.findUnique({ where: { id: args.planId }, select: { id: true } })
    if (!plan) throw new DomainError(Codes.NOT_FOUND, 'That pay plan does not exist.')
    const terms = normalizeTerms(args.terms ?? {})
    const open = await tx.payPlanVersion.findFirst({ where: { planId: plan.id, status: { in: ['draft', 'pending_approval'] } } })
    if (open?.status === 'pending_approval') throw guard('A version is waiting for approval. Decide on it first.')
    if (open) {
      await tx.payPlanVersion.update({ where: { id: open.id }, data: { contentHash: contentOf(terms), ...termData(terms), version: { increment: 1 } } as never })
      return { versionId: open.id }
    }
    const last = await tx.payPlanVersion.findFirst({ where: { planId: plan.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } })
    const v = await tx.payPlanVersion.create({ data: { planId: plan.id, versionNumber: (last?.versionNumber ?? 0) + 1, status: 'draft', contentHash: contentOf(terms), ...termData(terms) } as never })
    auditCreate(uow, actor, 'PayPlanVersion', v.id, 'pay_plan.version_drafted', { planId: plan.id, versionNumber: v.versionNumber })
    return { versionId: v.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function requestPayPlanPublish(db: Db, actor: Actor, args: { versionId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_plan.request_publish', PLANS, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_plan.request_publish', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const v = await tx.payPlanVersion.findUnique({ where: { id: args.versionId }, include: { plan: { select: { name: true } } } })
    if (!v) throw new DomainError(Codes.NOT_FOUND, 'That version does not exist.')
    if (v.status !== 'draft') throw guard('Only a draft version is sent for approval.')
    const approval = await requestApproval(uow, actor, { action: 'pay_plan.publish', targetList: 'PayPlanVersion', targetId: v.id, payload: { versionId: v.id, contentHash: v.contentHash }, requiredPermission: 'canApprovePayPlans', summary: `Publish ${v.plan?.name ?? 'pay plan'} version ${v.versionNumber}` })
    const ver = await casUpdate(uow, { model: 'PayPlanVersion', id: v.id, version: v.version, from: ['draft'], to: 'pending_approval', actor, eventType: 'pay_plan.publish_requested', data: { approvalId: approval.id } })
    return { requestId: approval.id, version: ver }
  })
  return { replay: result.replay, ...result.value }
}

/** Publish with the approved request. The previous active version of the plan is retired; people on it move over when assigned. */
export async function publishPayPlanVersion(db: Db, actor: Actor, args: { versionId: string; requestId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_plan.publish', PLANS, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_plan.publish', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const v = await tx.payPlanVersion.findUnique({ where: { id: args.versionId } })
    if (!v) throw new DomainError(Codes.NOT_FOUND, 'That version does not exist.')
    if (v.status !== 'pending_approval' || v.approvalId !== args.requestId) throw guard('This version is not waiting on that approval.')
    const { approverId } = await consumeApproval(uow, { requestId: args.requestId, action: 'pay_plan.publish', targetList: 'PayPlanVersion', targetId: v.id, payload: { versionId: v.id, contentHash: v.contentHash } })
    const ver = await casUpdate(uow, { model: 'PayPlanVersion', id: v.id, version: v.version, from: ['pending_approval'], to: 'active', actor, eventType: 'pay_plan.published', approverId, data: { activatedAt: uow.now } })
    const previous = await tx.payPlanVersion.findMany({ where: { planId: v.planId, status: 'active', id: { not: v.id } }, select: { id: true, version: true } })
    for (const p of previous) await casUpdate(uow, { model: 'PayPlanVersion', id: p.id, version: p.version, from: ['active'], to: 'retired', actor, eventType: 'pay_plan.retired' })
    return { status: 'active', version: ver }
  })
  return { replay: result.replay, ...result.value }
}

/** Put a person on an active plan version from a date. Their previous assignment ends the day before. */
export async function assignPayPlan(db: Db, actor: Actor, args: { employeeId: string; planVersionId: string; from: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_plan.assign', PLANS, args)
  const { idempotencyKey, now: _n, ...params } = args
  const from = day(args.from, 'from')
  const result = await command(db, { name: 'pay_plan.assign', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const [employee, v] = await Promise.all([tx.employee.findUnique({ where: { id: args.employeeId }, select: { id: true } }), tx.payPlanVersion.findUnique({ where: { id: args.planVersionId }, select: { id: true, status: true } })])
    if (!employee) throw new DomainError(Codes.NOT_FOUND, 'That person does not exist.')
    if (!v || v.status !== 'active') throw guard('A person can be put only on an active plan version.')
    const open = await tx.payPlanAssignment.findFirst({ where: { employeeId: employee.id, to: null }, orderBy: { from: 'desc' } })
    if (open) {
      if (iso(open.from) >= from) throw guard('The new plan must start after the one they are on now.')
      await tx.payPlanAssignment.update({ where: { id: open.id }, data: { to: asDate(addDays(from, -1)) } })
    }
    const later = await tx.payPlanAssignment.findFirst({ where: { employeeId: employee.id, from: { gte: asDate(from) } }, select: { id: true } })
    if (later) throw guard('They already have a plan that starts on or after that date.')
    const a = await tx.payPlanAssignment.create({ data: { employeeId: employee.id, planVersionId: v.id, from: asDate(from), createdById: actorUserId(actor) } })
    auditCreate(uow, actor, 'PayPlanAssignment', a.id, 'pay_plan.assigned', { employeeId: employee.id, planVersionId: v.id, from })
    return { id: a.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Attribution ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Who gets credit for a sale, as shares of one role that add up to exactly 100. Replaces the earlier split until something was paid on it. */
export async function setAttribution(db: Db, actor: Actor, args: { workLineId?: string; membershipId?: string; financingApplicationId?: string; role: string; shares: { employeeId: string; sharePct: string }[]; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'attribution.set', ATTRIBUTE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'attribution.set', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const given = [args.workLineId, args.membershipId, args.financingApplicationId].filter(Boolean)
    if (given.length !== 1) throw bad('Name exactly one thing to give credit for: a work line, a membership or a financing application.')
    if (!['sold_by', 'performed_by', 'lead_generated_by'].includes(args.role)) throw bad('Pick a role.', 'role')
    const shares = (args.shares ?? []).map(s => ({ employeeId: String(s.employeeId), sharePct: dec(String(s.sharePct)) }))
    if (!sharesAddUp(shares.map(s => s.sharePct))) throw bad('The shares must each be above 0 and add up to exactly 100.', 'shares')
    if (new Set(shares.map(s => s.employeeId)).size !== shares.length) throw bad('Each person appears once per role.', 'shares')
    const people = await tx.employee.findMany({ where: { id: { in: shares.map(s => s.employeeId) } }, select: { id: true } })
    if (people.length !== shares.length) throw new DomainError(Codes.NOT_FOUND, 'One of those people does not exist.')
    const subject = { workLineId: args.workLineId ?? null, membershipId: args.membershipId ?? null, financingApplicationId: args.financingApplicationId ?? null }
    const basisId = args.workLineId ? (await tx.invoiceLine.findMany({ where: { workLineId: args.workLineId }, select: { id: true } })).map(l => l.id) : [(args.membershipId ?? args.financingApplicationId) as string]
    if (basisId.length) {
      const paid = await tx.earningLine.findFirst({ where: { basisId: { in: basisId }, kind: { in: ['commission', 'spiff'] }, lineKey: { endsWith: `:${args.role}` } }, select: { id: true } })
      if (paid) throw guard('Pay has already been worked out on this sale. Add a pay adjustment to a pay period instead of changing the split.')
    }
    await tx.commissionAttribution.deleteMany({ where: { ...subject, role: args.role } })
    for (const s of shares) await tx.commissionAttribution.create({ data: { ...subject, role: args.role, employeeId: s.employeeId, sharePct: s.sharePct.toFixed(6), createdById: actorUserId(actor) } })
    uow.audit({ eventType: 'attribution.set', entityType: 'CommissionAttribution', entityId: (args.workLineId ?? args.membershipId ?? args.financingApplicationId) as string, actorUserId: actorUserId(actor), after: { role: args.role, shares: shares.map(s => ({ employeeId: s.employeeId, sharePct: s.sharePct.toFixed() })) } })
    return { count: shares.length }
  })
  return { replay: result.replay, ...result.value }
}

// ── Pay periods ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A pay period is whole workweeks (Monday to Sunday), after the one before it, with no gap. */
export async function openPayPeriod(db: Db, actor: Actor, args: { startsOn: string; endsOn: string; payDate: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.open', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const startsOn = day(args.startsOn, 'startsOn'); const endsOn = day(args.endsOn, 'endsOn'); const payDate = day(args.payDate, 'payDate')
  const result = await command(db, { name: 'pay_period.open', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (workweekStart(startsOn) !== startsOn) throw bad('A pay period starts on a Monday.', 'startsOn')
    if (endsOn < startsOn || ((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 + 1) % 7 !== 0) throw bad('A pay period is whole weeks, ending on a Sunday.', 'endsOn')
    if (payDate < endsOn) throw bad('The pay date is on or after the last day of the period.', 'payDate')
    const clash = await tx.payPeriod.findFirst({ where: { startsOn: { lte: asDate(endsOn) }, endsOn: { gte: asDate(startsOn) } }, select: { id: true } })
    if (clash) throw guard('That overlaps another pay period.')
    const last = await tx.payPeriod.findFirst({ orderBy: { endsOn: 'desc' }, select: { endsOn: true } })
    if (last && addDays(iso(last.endsOn), 1) !== startsOn) throw guard(`The next pay period starts on ${addDays(iso(last.endsOn), 1)}, the day after the last one ends.`)
    const p = await tx.payPeriod.create({ data: { startsOn: asDate(startsOn), endsOn: asDate(endsOn), payDate: asDate(payDate), status: 'open' } })
    auditCreate(uow, actor, 'PayPeriod', p.id, 'pay_period.opened', { startsOn, endsOn, payDate })
    return { id: p.id }
  })
  return { replay: result.replay, ...result.value }
}

type LineDraft = {
  employeeId: string; workweekStart: string; kind: string; hours: string | null; rateMinor: bigint; amountMinor: bigint; basisType: string; basisId: string
  planVersionId: string | null; earningCode: string; lineKey: string; note: string; regularRateReview?: boolean; reversesKey?: string
}

type PlanRow = { id: string; employeeId: string; from: string; to: string | null; terms: PlanTerms }

const planAt = (plans: PlanRow[], employeeId: string, date: string) => plans.find(p => p.employeeId === employeeId && p.from <= date && (p.to === null || p.to >= date)) ?? null

const lineHash = (lines: { lineKey: string; employeeId: string | null; kind: string; hours: unknown; rateMinor: bigint; amountMinor: bigint; reversesKey: string; regularRateReview: boolean; planVersionId: string | null }[]) =>
  payloadHash([...lines].sort((a, b) => (a.lineKey < b.lineKey ? -1 : 1)).map(l => [l.lineKey, l.employeeId, l.kind, l.hours === null || l.hours === undefined ? null : dec(l.hours as never).toFixed(4), l.rateMinor, l.amountMinor, l.reversesKey, l.regularRateReview, l.planVersionId]))

/**
 * Work out every line of the period from the facts. Run it again and the same facts give the same lines and the same hash.
 * Earlier periods must be approved first, so a fact is paid in exactly one period.
 */
export async function calculatePayPeriod(db: Db, actor: Actor, args: { payPeriodId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.calculate', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.calculate', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const period = await lockRow<Record<string, any>>(tx, 'PayPeriod', args.payPeriodId)
    if (!['open', 'review'].includes(period.status)) throw guard('This pay period is approved. Send it back to review to change it, or add the late item to the next period.')
    const startsOn = iso(period.startsOn); const endsOn = iso(period.endsOn)
    const before = await tx.payPeriod.findMany({ where: { startsOn: { lt: period.startsOn }, status: { in: ['open', 'review', 'calculating'] } }, select: { startsOn: true } })
    if (before.length) throw guard(`Approve the pay period starting ${iso(before[0].startsOn)} first, so nothing is paid twice.`)
    const out = await buildLines(uow.tx, period.id, startsOn, endsOn)
    return finishCalculation(uow, actor, period.id, period.version, out)
  })
  return { replay: result.replay, ...result.value }
}

async function buildLines(tx: Tx, periodId: string, startsOn: string, endsOn: string) {
  const zone = await homeZone(tx)
  const local = (d: Date) => localDate({ timeZone: zone }, d)
  const inPeriod = (d: Date | null | undefined) => !!d && local(d) <= endsOn
  const warnings: { code: string; text: string; ref?: string }[] = []
  const drafts: LineDraft[] = []
  const nameOf = new Map((await tx.employee.findMany({ select: { id: true, displayName: true } })).map(e => [e.id, e.displayName]))
  const who = (id: string) => nameOf.get(id) ?? 'Unknown person'

  // Plans, by person and date.
  const assignments = await tx.payPlanAssignment.findMany({ include: { planVersion: true } })
  const plans: PlanRow[] = assignments.filter(a => a.employeeId && a.planVersion).map(a => ({
    id: a.planVersion!.id, employeeId: a.employeeId as string, from: iso(a.from), to: a.to ? iso(a.to) : null,
    terms: { hourlyRates: a.planVersion!.hourlyRates as never, overtime: a.planVersion!.overtime as never, commission: a.planVersion!.commission as never, spiffs: a.planVersion!.spiffs as never, clawbacks: a.planVersion!.clawbacks as never },
  })).sort((a, b) => (a.from < b.from ? -1 : 1))
  const noPlan = new Set<string>()
  const planFor = (employeeId: string, date: string) => {
    const p = planAt(plans, employeeId, date)
    if (!p) noPlan.add(employeeId)
    return p
  }

  // Hours: approved sheets up to the end of the period whose time no earlier period has paid.
  const sheets = await tx.timesheet.findMany({ where: { status: { in: ['approved', 'locked'] }, workDate: { lte: asDate(endsOn) } }, select: { id: true, employeeId: true, workDate: true, workweekStart: true } })
  const weeks = new Set(sheets.map(s => iso(s.workweekStart)))
  const wkSheets = weeks.size ? await tx.timesheet.findMany({ where: { status: { in: ['approved', 'locked'] }, workweekStart: { in: [...weeks].map(asDate) } }, select: { id: true, employeeId: true, workweekStart: true } }) : []
  const sheetById = new Map(wkSheets.map(s => [s.id, s]))
  const segments = wkSheets.length ? await tx.timeSegment.findMany({ where: { timesheetId: { in: wkSheets.map(s => s.id) } }, select: { id: true, timesheetId: true, kind: true, startsAt: true, hours: true, payPeriodId: true } }) : []
  const byEmployee = new Map<string, PaySegment[]>()
  for (const s of segments) {
    const sheet = sheetById.get(s.timesheetId as string)
    if (!sheet?.employeeId) continue
    const list = byEmployee.get(sheet.employeeId) ?? []
    list.push({ id: s.id, kind: s.kind, startsAt: s.startsAt, hours: s.hours?.toString() ?? '0', workweekStart: iso(sheet.workweekStart), payable: s.payPeriodId === null || s.payPeriodId === periodId })
    byEmployee.set(sheet.employeeId, list)
  }
  const payableSegmentIds: string[] = []
  const hourWeeks = new Map<string, Set<string>>()
  for (const [employeeId, segs] of [...byEmployee.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!segs.some(s => s.payable)) continue
    const byPlan = new Map<string, { plan: PlanRow; segs: PaySegment[] }>()
    for (const s of segs) {
      const plan = planFor(employeeId, s.workweekStart)
      if (!plan) continue
      const entry = byPlan.get(plan.id) ?? { plan, segs: [] }
      entry.segs.push(s); byPlan.set(plan.id, entry)
    }
    for (const { plan, segs: list } of byPlan.values()) {
      for (const l of hourlyLines(employeeId, list, { hourlyRates: plan.terms.hourlyRates, overtime: plan.terms.overtime } as HourlyPlan)) {
        drafts.push({ employeeId, workweekStart: l.workweekStart, kind: l.kind, hours: l.hours, rateMinor: l.rateMinor, amountMinor: l.amountMinor, basisType: 'timesheet_segments', basisId: `${employeeId}:${l.workweekStart}`, planVersionId: plan.id, earningCode: l.kind === 'overtime' ? 'OT' : l.kind === 'pto' ? 'PTO' : 'REG', lineKey: `${l.lineKey}:${periodId}`, note: l.segmentKind.replaceAll('_', ' ') })
        payableSegmentIds.push(...l.segmentIds)
        hourWeeks.set(employeeId, (hourWeeks.get(employeeId) ?? new Set()).add(l.workweekStart))
      }
    }
  }

  // Commission and spiffs on invoiced or paid work.
  const bound = new Date(asDate(endsOn).getTime() + 2 * 86_400_000)
  const attrib = await tx.commissionAttribution.findMany({ select: { workLineId: true, membershipId: true, financingApplicationId: true, employeeId: true, role: true, sharePct: true } })
  const forWorkLine = new Map<string, typeof attrib>()
  for (const a of attrib) if (a.workLineId) forWorkLine.set(a.workLineId, [...(forWorkLine.get(a.workLineId) ?? []), a])
  const basisOf = (employeeId: string, date: string) => planFor(employeeId, date)?.terms.commission.basis ?? 'invoice_posted'
  const lineInclude = { lines: { where: { workLineId: { not: null } }, include: { workLine: { include: { estimateLine: { include: { pricebookItem: { select: { commissionCode: true, spiffCode: true, categoryKey: true } } } } } } } } } as const
  type Fact = { at: Date; basis: 'invoice_posted' | 'payment_received'; invoiceId: string; line: any; portion: string; keyBase: string }
  const facts: Fact[] = []
  const invoices = await tx.invoice.findMany({ where: { postedAt: { not: null, lt: bound }, status: { in: ['posted', 'partially_paid', 'paid'] } }, include: lineInclude })
  for (const inv of invoices) for (const line of inv.lines) facts.push({ at: inv.postedAt as Date, basis: 'invoice_posted', invoiceId: inv.id, line, portion: '1', keyBase: `il:${line.id}` })
  const allocs = await tx.paymentAllocation.findMany({ where: { kind: 'apply', createdAt: { lt: bound }, invoice: { status: { in: ['posted', 'partially_paid', 'paid'] } } }, include: { invoice: { include: lineInclude } } })
  for (const al of allocs) {
    const inv = al.invoice
    if (!inv || inv.totalMinor <= 0n) continue
    const portion = dec(al.amountMinor).div(dec(inv.totalMinor)).toFixed(12)
    for (const line of inv.lines) facts.push({ at: al.createdAt, basis: 'payment_received', invoiceId: inv.id, line, portion, keyBase: `il:${line.id}:pa:${al.id}` })
  }
  const unattributed = new Set<string>()
  for (const f of facts) {
    // A line written by hand has no price-book item: only a rule for every sale applies to it, and it earns no spiff.
    const item = f.line.workLine?.estimateLine?.pricebookItem ?? { commissionCode: '', spiffCode: '', categoryKey: '' }
    if (!f.line.workLineId) continue
    const attrs = forWorkLine.get(f.line.workLineId) ?? []
    const net: bigint = BigInt(f.line.amountMinor) - BigInt(f.line.discountMinor)
    const date = local(f.at)
    if (!inPeriod(f.at)) continue
    let used = false
    for (const a of attrs) {
      if (!a.employeeId) continue
      const plan = planFor(a.employeeId, date)
      if (!plan || plan.terms.commission.basis !== f.basis) continue
      const rule = ruleFor(plan.terms.commission.rules, { commissionCode: item.commissionCode, categoryKey: item.categoryKey })
      const rolePct = rule ? poolRoles(rule.splitBasis).find(r => r.role === a.role)?.pct : undefined
      if (rule && rolePct) {
        const pool = rulePool(rule, net, f.portion, f.line.quantity.toString())
        const amount = shareAmount(pool, rolePct, a.sharePct.toString())
        used = true
        if (amount !== 0n) drafts.push({ employeeId: a.employeeId, workweekStart: workweekStart(date), kind: 'commission', hours: null, rateMinor: 0n, amountMinor: amount, basisType: 'invoice_line', basisId: f.line.id, planVersionId: plan.id, earningCode: item.commissionCode || rule.scope, lineKey: `com:${f.keyBase}:${a.employeeId}:${a.role}`, note: `${f.line.description}`.slice(0, 120) })
      }
      const spiff = item.spiffCode ? plan.terms.spiffs[item.spiffCode] : undefined
      if (spiff && spiffRole(item.spiffCode) === a.role) {
        used = true
        const amount = spiffAmount(BigInt(spiff), a.sharePct.toString(), f.portion, f.line.quantity.toString())
        if (amount !== 0n) drafts.push({ employeeId: a.employeeId, workweekStart: workweekStart(date), kind: 'spiff', hours: null, rateMinor: 0n, amountMinor: amount, basisType: 'invoice_line', basisId: f.line.id, planVersionId: plan.id, earningCode: `SPIFF-${item.spiffCode.toUpperCase()}`, lineKey: `spf:${f.keyBase}:${a.employeeId}:${a.role}`, note: `${item.spiffCode.toUpperCase()} spiff` })
      }
    }
    if (!used && !attrs.length) unattributed.add(f.line.workLineId)
  }
  const unattributedCount = unattributed.size

  // Membership and financing spiffs.
  const memberships = await tx.membership.findMany({ where: { startsOn: { not: null, lt: bound }, status: { not: 'pending_payment' } }, select: { id: true, ref: true, startsOn: true, soldById: true } })
  const memAttr = new Map<string, typeof attrib>()
  for (const a of attrib) if (a.membershipId) memAttr.set(a.membershipId, [...(memAttr.get(a.membershipId) ?? []), a])
  for (const m of memberships) {
    if (!inPeriod(m.startsOn)) continue
    let rows = memAttr.get(m.id) ?? []
    if (!rows.length && m.soldById) {
      const seller = await tx.employee.findFirst({ where: { userId: m.soldById }, select: { id: true } })
      if (seller) rows = [{ workLineId: null, membershipId: m.id, financingApplicationId: null, employeeId: seller.id, role: 'sold_by', sharePct: '100' as never }]
    }
    for (const a of rows) {
      if (!a.employeeId || a.role !== 'sold_by') continue
      const date = local(m.startsOn as Date); const plan = planFor(a.employeeId, date)
      const spiff = plan?.terms.spiffs.membership
      if (!plan || !spiff) continue
      const amount = spiffAmount(BigInt(spiff), a.sharePct.toString())
      if (amount !== 0n) drafts.push({ employeeId: a.employeeId, workweekStart: workweekStart(date), kind: 'spiff', hours: null, rateMinor: 0n, amountMinor: amount, basisType: 'membership', basisId: m.id, planVersionId: plan.id, earningCode: 'SPIFF-MEMBERSHIP', lineKey: `spf:mem:${m.id}:${a.employeeId}:${a.role}`, note: `Membership ${m.ref}` })
    }
  }
  const fundings = await tx.financingFunding.findMany({ where: { fundedAt: { lt: bound } }, select: { applicationId: true, fundedAt: true }, orderBy: { fundedAt: 'asc' } })
  const firstFunding = new Map<string, Date>()
  for (const f of fundings) if (f.applicationId && !firstFunding.has(f.applicationId)) firstFunding.set(f.applicationId, f.fundedAt)
  for (const a of attrib) {
    if (!a.financingApplicationId || !a.employeeId || a.role !== 'sold_by') continue
    const at = firstFunding.get(a.financingApplicationId)
    if (!at || !inPeriod(at)) continue
    const date = local(at); const plan = planFor(a.employeeId, date); const spiff = plan?.terms.spiffs.financing
    if (!plan || !spiff) continue
    const amount = spiffAmount(BigInt(spiff), a.sharePct.toString())
    if (amount !== 0n) drafts.push({ employeeId: a.employeeId, workweekStart: workweekStart(date), kind: 'spiff', hours: null, rateMinor: 0n, amountMinor: amount, basisType: 'financing_application', basisId: a.financingApplicationId, planVersionId: plan.id, earningCode: 'SPIFF-FINANCING', lineKey: `spf:fin:${a.financingApplicationId}:${a.employeeId}:${a.role}`, note: 'Financing funded' })
  }

  // Skip anything an earlier period already paid. Facts are paid once, in the first period that reaches them.
  const keys = drafts.map(d => d.lineKey)
  const taken = new Set((keys.length ? await tx.earningLine.findMany({ where: { lineKey: { in: keys }, payPeriodId: { not: periodId } }, select: { lineKey: true } }) : []).map(l => l.lineKey))
  const fresh = drafts.filter(d => !taken.has(d.lineKey))

  // Replace this period's calculated lines (adjustments a person added stay).
  await tx.earningLine.deleteMany({ where: { payPeriodId: periodId, kind: { not: 'adjustment' } } })
  await tx.timeSegment.updateMany({ where: { payPeriodId: periodId }, data: { payPeriodId: null } })
  for (const d of fresh) {
    await tx.earningLine.create({ data: { payPeriodId: periodId, employeeId: d.employeeId, workweekStart: asDate(d.workweekStart), kind: d.kind, hours: d.hours, rateMinor: d.rateMinor, amountMinor: d.amountMinor, basisType: d.basisType, basisId: d.basisId, payPlanVersionId: d.planVersionId, earningCode: d.earningCode, regularRateReview: false, lineKey: d.lineKey, note: d.note } })
  }

  // Clawbacks: a refund, a lost dispute, a recall or a cancelled membership takes back what was paid on it, as a negative line that names the original.
  const claws = await buildClawbacks(tx, periodId, startsOn, endsOn, local, bound, warnings)
  for (const c of claws) {
    await tx.earningLine.create({ data: { payPeriodId: periodId, employeeId: c.employeeId, workweekStart: asDate(c.workweekStart), kind: 'clawback', hours: null, rateMinor: 0n, amountMinor: c.amountMinor, basisType: c.basisType, basisId: c.basisId, payPlanVersionId: c.planVersionId, earningCode: c.earningCode, regularRateReview: false, reversesId: c.reversesId, lineKey: c.lineKey, note: c.note } })
  }

  // Segments paid by this period are stamped, so a later period never pays them again.
  if (payableSegmentIds.length) await tx.timeSegment.updateMany({ where: { id: { in: payableSegmentIds }, OR: [{ payPeriodId: null }, { payPeriodId: periodId }] }, data: { payPeriodId: periodId } })

  // Overtime in a week that also has commission or spiffs needs the regular-rate review (the engine itself is not switched on).
  const all = await tx.earningLine.findMany({ where: { payPeriodId: periodId }, select: { id: true, employeeId: true, workweekStart: true, kind: true } })
  const variable = new Set(all.filter(l => ['commission', 'spiff', 'clawback'].includes(l.kind)).map(l => `${l.employeeId}:${iso(l.workweekStart)}`))
  const reviewIds = all.filter(l => l.kind === 'overtime' && variable.has(`${l.employeeId}:${iso(l.workweekStart)}`)).map(l => l.id)
  if (reviewIds.length) await tx.earningLine.updateMany({ where: { id: { in: reviewIds } }, data: { regularRateReview: true } })

  for (const id of noPlan) warnings.push({ code: 'no_pay_plan', text: `${who(id)} has time or sales in this period but no pay plan for it.`, ref: id })
  if (unattributedCount) warnings.push({ code: 'unattributed', text: `${unattributedCount} sold line${unattributedCount === 1 ? ' has' : 's have'} no credit split yet, so no commission was worked out on ${unattributedCount === 1 ? 'it' : 'them'}.` })
  const pending = await tx.timesheet.count({ where: { status: 'submitted', workDate: { lte: asDate(endsOn) } } })
  if (pending) warnings.push({ code: 'timesheets_pending', text: `${pending} timesheet${pending === 1 ? ' is' : 's are'} sent in but not approved yet. ${pending === 1 ? 'It' : 'They'} will be paid in the next period.` })
  return { warnings, startsOn }
}

type ClawDraft = { employeeId: string; workweekStart: string; amountMinor: bigint; basisType: string; basisId: string; planVersionId: string | null; earningCode: string; reversesId: string; lineKey: string; note: string }

async function buildClawbacks(tx: Tx, periodId: string, _startsOn: string, endsOn: string, local: (d: Date) => string, bound: Date, _warnings: unknown[]): Promise<ClawDraft[]> {
  const out: ClawDraft[] = []
  // Everything paid in this period or before it that a clawback can name.
  const originals = await tx.earningLine.findMany({
    where: { kind: { in: ['commission', 'spiff'] }, amountMinor: { gt: 0n }, payPeriod: { startsOn: { lte: (await tx.payPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { startsOn: true } })).startsOn } } },
    select: { id: true, employeeId: true, amountMinor: true, basisType: true, basisId: true, lineKey: true, payPlanVersionId: true, earningCode: true, payPlanVersion: { select: { clawbacks: true } } },
  })
  const already = new Map<string, bigint>()
  for (const c of await tx.earningLine.findMany({ where: { kind: 'clawback', payPeriodId: { not: periodId }, reversesId: { in: originals.map(o => o.id) } }, select: { reversesId: true, amountMinor: true } })) {
    if (c.reversesId) already.set(c.reversesId, (already.get(c.reversesId) ?? 0n) - c.amountMinor)
  }
  const claimed = new Map<string, bigint>()
  const remaining = (o: (typeof originals)[number]) => o.amountMinor - (already.get(o.id) ?? 0n) - (claimed.get(o.id) ?? 0n)
  const policy = (o: (typeof originals)[number]) => ({ windowDays: 90, refund: true, chargeback: true, recallPercent: '0', membershipCancel: true, ...((o.payPlanVersion?.clawbacks as Record<string, unknown>) ?? {}) }) as { windowDays: number; refund: boolean; chargeback: boolean; recallPercent: string; membershipCancel: boolean }
  const push = (o: (typeof originals)[number], want: bigint, week: string, reason: string, factId: string, basisType: string, note: string) => {
    if (want >= 0n) return
    const take = -want > remaining(o) ? -remaining(o) : want
    if (take >= 0n) return
    claimed.set(o.id, (claimed.get(o.id) ?? 0n) - take)
    out.push({ employeeId: o.employeeId as string, workweekStart: week, amountMinor: take, basisType, basisId: factId, planVersionId: o.payPlanVersionId, earningCode: o.earningCode, reversesId: o.id, lineKey: `claw:${reason}:${factId}:${o.lineKey}`, note })
  }
  const lineIdsOfInvoice = new Map<string, string[]>()
  const invoiceInfo = new Map<string, { total: bigint; postedAt: Date | null }>()
  const loadInvoice = async (invoiceId: string) => {
    if (!lineIdsOfInvoice.has(invoiceId)) {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { totalMinor: true, postedAt: true, lines: { select: { id: true } } } })
      lineIdsOfInvoice.set(invoiceId, inv?.lines.map(l => l.id) ?? [])
      invoiceInfo.set(invoiceId, { total: inv?.totalMinor ?? 0n, postedAt: inv?.postedAt ?? null })
    }
    return { lineIds: lineIdsOfInvoice.get(invoiceId) as string[], ...(invoiceInfo.get(invoiceId) as { total: bigint; postedAt: Date | null }) }
  }
  const money = async (paymentId: string, amount: bigint) => {
    const applies = await tx.paymentAllocation.findMany({ where: { paymentId, kind: 'apply' }, select: { invoiceId: true, amountMinor: true }, orderBy: { id: 'asc' } })
    if (!applies.length) return []
    const parts = allocateMinor(amount, applies.map(a => a.amountMinor.toString()))
    return applies.map((a, i) => ({ invoiceId: a.invoiceId as string, returned: parts[i] })).filter(p => p.invoiceId && p.returned > 0n)
  }
  const sinceDays = (from: Date | null, to: Date) => (from ? Math.floor((Date.parse(local(to)) - Date.parse(local(from))) / 86_400_000) : 0)
  const forInvoice = async (invoiceId: string, returned: bigint, at: Date, reason: 'refund' | 'chargeback', factId: string, basisType: string, note: string) => {
    const info = await loadInvoice(invoiceId)
    for (const o of originals.filter(x => x.basisType === 'invoice_line' && info.lineIds.includes(x.basisId))) {
      const p = policy(o)
      if (!p[reason] || sinceDays(info.postedAt, at) > p.windowDays) continue
      push(o, clawbackAmount(o.amountMinor, returned, info.total), workweekStart(local(at)), reason, factId, basisType, note)
    }
  }
  const refunds = await tx.refund.findMany({ where: { refundedAt: { lt: bound } }, select: { id: true, ref: true, amountMinor: true, paymentId: true, refundedAt: true }, orderBy: { id: 'asc' } })
  for (const r of refunds) {
    if (!r.paymentId || local(r.refundedAt) > endsOn) continue
    for (const part of await money(r.paymentId, r.amountMinor)) await forInvoice(part.invoiceId, part.returned, r.refundedAt, 'refund', r.id, 'refund', `Refund ${r.ref}`)
  }
  const disputes = await tx.dispute.findMany({ where: { status: 'lost', updatedAt: { lt: bound } }, select: { id: true, amountMinor: true, paymentId: true, updatedAt: true }, orderBy: { id: 'asc' } })
  for (const d of disputes) {
    if (!d.paymentId || local(d.updatedAt) > endsOn) continue
    for (const part of await money(d.paymentId, d.amountMinor)) await forInvoice(part.invoiceId, part.returned, d.updatedAt, 'chargeback', d.id, 'dispute', 'Lost chargeback')
  }
  const recalls = await tx.job.findMany({ where: { recallOfId: { not: null }, createdAt: { lt: bound } }, select: { id: true, ref: true, recallOfId: true, createdAt: true }, orderBy: { id: 'asc' } })
  for (const j of recalls) {
    if (local(j.createdAt) > endsOn) continue
    const invs = await tx.invoice.findMany({ where: { jobId: j.recallOfId as string }, select: { id: true, postedAt: true, lines: { select: { id: true } } } })
    for (const inv of invs) for (const o of originals.filter(x => x.basisType === 'invoice_line' && inv.lines.some(l => l.id === x.basisId) && x.lineKey.endsWith(':performed_by'))) {
      const p = policy(o)
      if (dec(p.recallPercent).isZero() || sinceDays(inv.postedAt, j.createdAt) > p.windowDays) continue
      push(o, -roundMinor(dec(o.amountMinor).times(dec(p.recallPercent)).div(100)), workweekStart(local(j.createdAt)), 'recall', j.id, 'recall', `Recall ${j.ref}`)
    }
  }
  const cancelled = await tx.membership.findMany({ where: { cancelledAt: { not: null, lt: bound } }, select: { id: true, ref: true, startsOn: true, cancelledAt: true }, orderBy: { id: 'asc' } })
  for (const m of cancelled) {
    if (!m.cancelledAt || local(m.cancelledAt) > endsOn) continue
    for (const o of originals.filter(x => x.basisType === 'membership' && x.basisId === m.id)) {
      const p = policy(o)
      if (!p.membershipCancel || sinceDays(m.startsOn ?? m.cancelledAt, m.cancelledAt) > p.windowDays) continue
      push(o, -o.amountMinor, workweekStart(local(m.cancelledAt)), 'membership_cancel', m.id, 'membership_cancel', `Membership ${m.ref} cancelled`)
    }
  }
  // A clawback an earlier period already took is not taken again.
  const keys = out.map(c => c.lineKey)
  const done = new Set((keys.length ? await tx.earningLine.findMany({ where: { lineKey: { in: keys }, payPeriodId: { not: periodId } }, select: { lineKey: true } }) : []).map(l => l.lineKey))
  return out.filter(c => !done.has(c.lineKey))
}

async function finishCalculation(uow: { tx: Tx; now: Date; audit: (e: any) => void }, actor: Actor, periodId: string, version: number, out: { warnings: { code: string; text: string; ref?: string }[] }) {
  const { tx } = uow
  const lines = await tx.earningLine.findMany({ where: { payPeriodId: periodId }, include: { reverses: { select: { lineKey: true } } } })
  const inputsHash = lineHash(lines.map(l => ({ lineKey: l.lineKey, employeeId: l.employeeId, kind: l.kind, hours: l.hours, rateMinor: l.rateMinor, amountMinor: l.amountMinor, reversesKey: l.reverses?.lineKey ?? '', regularRateReview: l.regularRateReview, planVersionId: l.payPlanVersionId })))
  const byKind: Record<string, string> = {}
  let total = 0n
  const people = new Map<string, bigint>()
  for (const l of lines) {
    byKind[l.kind] = ((BigInt(byKind[l.kind] ?? '0')) + l.amountMinor).toString()
    total += l.amountMinor
    if (l.employeeId) people.set(l.employeeId, (people.get(l.employeeId) ?? 0n) + l.amountMinor)
  }
  const summary = { lineCount: lines.length, totalMinor: total.toString(), byKind, employees: people.size, reviewLines: lines.filter(l => l.regularRateReview).length, warnings: out.warnings }
  const current = await tx.payPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { status: true, version: true } })
  const v = await casUpdate(uow as never, { model: 'PayPeriod', id: periodId, version: current.version, from: [current.status], to: 'review', actor, eventType: 'pay_period.calculated', data: { inputsHash, summary: summary as never, calculatedAt: uow.now }, audit: { inputsHash, lineCount: lines.length, totalMinor: total.toString() } } as never)
  return { status: 'review', version: v, inputsHash, ...summary, previousVersion: version }
}

/** A person adds an amount to an open pay period (a correction, a bonus, or pay for a day that was locked earlier). It stays through recalculation. */
export async function addPayAdjustment(db: Db, actor: Actor, args: { payPeriodId: string; employeeId: string; amountMinor: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.adjust', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.adjust', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const period = await lockRow<Record<string, any>>(tx, 'PayPeriod', args.payPeriodId)
    if (!['open', 'review'].includes(period.status)) throw guard('Only a pay period that is not approved takes an adjustment. Use the next period.')
    const amount = minor(args.amountMinor, 'amountMinor')
    if (amount === 0n) throw bad('An adjustment is not zero.', 'amountMinor')
    if (amount > 10_000_000n || amount < -10_000_000n) throw bad('That adjustment is too large to enter here.', 'amountMinor')
    const employee = await tx.employee.findUnique({ where: { id: args.employeeId }, select: { id: true, userId: true } })
    if (!employee) throw new DomainError(Codes.NOT_FOUND, 'That person does not exist.')
    const reason = str(args.reason, 'reason', 300, true)
    const l = await tx.earningLine.create({ data: { payPeriodId: period.id, employeeId: employee.id, workweekStart: asDate(workweekStart(iso(period.endsOn))), kind: 'adjustment', rateMinor: 0n, amountMinor: amount, basisType: 'adjustment', basisId: idempotencyKey, earningCode: 'ADJ', lineKey: `adj:${idempotencyKey}`, note: reason } })
    auditCreate(uow, actor, 'EarningLine', l.id, 'pay_period.adjusted', { payPeriodId: period.id, employeeId: employee.id, amountMinor: amount.toString() }, { reason })
    return { id: l.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Ask for the second person's approval of the calculated period. The request names the exact total and hash it covers. */
export async function requestPayPeriodApproval(db: Db, actor: Actor, args: { payPeriodId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.request_approval', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.request_approval', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const period = await lockRow<Record<string, any>>(tx, 'PayPeriod', args.payPeriodId)
    if (period.status !== 'review') throw guard('Work the period out first, then ask for approval.')
    const current = await currentHash(tx, period.id)
    if (current.hash !== period.inputsHash) throw guard('The lines changed after they were calculated. Work the period out again.')
    const pending = await tx.approvalRequest.findFirst({ where: { action: 'pay_period.approve', targetId: period.id, status: 'pending' }, select: { id: true } })
    if (pending) throw guard('An approval is already waiting on this period.')
    const approval = await requestApproval(uow, actor, { action: 'pay_period.approve', targetList: 'PayPeriod', targetId: period.id, payload: { payPeriodId: period.id, inputsHash: period.inputsHash, totalMinor: current.total.toString() }, requiredPermission: 'canApprovePayPeriods', summary: `Approve pay period ${iso(period.startsOn)} to ${iso(period.endsOn)}` })
    await tx.payPeriod.update({ where: { id: period.id }, data: { approvalId: approval.id } })
    return { requestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

async function currentHash(tx: Tx, periodId: string) {
  const lines = await tx.earningLine.findMany({ where: { payPeriodId: periodId }, include: { reverses: { select: { lineKey: true } } } })
  return {
    total: lines.reduce((a, l) => a + l.amountMinor, 0n),
    hash: lineHash(lines.map(l => ({ lineKey: l.lineKey, employeeId: l.employeeId, kind: l.kind, hours: l.hours, rateMinor: l.rateMinor, amountMinor: l.amountMinor, reversesKey: l.reverses?.lineKey ?? '', regularRateReview: l.regularRateReview, planVersionId: l.payPlanVersionId }))),
  }
}

/** Approve with the approved request. The lines are the ones the approver saw: if they changed, the approval does not apply. */
export async function approvePayPeriod(db: Db, actor: Actor, args: { payPeriodId: string; requestId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.approve', PERIOD_APPROVE_RUN, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.approve', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const period = await lockRow<Record<string, any>>(tx, 'PayPeriod', args.payPeriodId)
    if (period.status !== 'review') throw guard('Only a period in review is approved.')
    const current = await currentHash(tx, period.id)
    if (current.hash !== period.inputsHash) throw guard('The lines changed after they were calculated. Work the period out again.')
    const { approverId } = await consumeApproval(uow, { requestId: args.requestId, action: 'pay_period.approve', targetList: 'PayPeriod', targetId: period.id, payload: { payPeriodId: period.id, inputsHash: period.inputsHash, totalMinor: current.total.toString() } })
    const v = await casUpdate(uow, { model: 'PayPeriod', id: period.id, version: args.expectedVersion, from: ['review'], to: 'approved', actor, eventType: 'pay_period.approved', approverId, data: { approvalId: args.requestId } })
    return { status: 'approved', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Send an approved (not yet exported) period back to review, for example to fix a line. Its approval is spent. */
export async function reopenPayPeriod(db: Db, actor: Actor, args: { payPeriodId: string; reason: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.reopen', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.reopen', actor, idempotencyKey, params, now: args.now }, async uow => {
    const period = await lockRow<Record<string, any>>(uow.tx, 'PayPeriod', args.payPeriodId)
    if (period.status === 'exported' || period.status === 'closed') throw guard('This period was exported and is locked. Anything late goes in the next period.')
    const v = await casUpdate(uow, { model: 'PayPeriod', id: period.id, version: args.expectedVersion, from: ['approved'], to: 'review', actor, eventType: 'pay_period.reopened', reason: str(args.reason, 'reason', 300, true) })
    return { status: 'review', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Build the export record for an approved period and lock it. The file is made from the locked lines; nothing is sent. */
export async function exportPayPeriod(db: Db, actor: Actor, args: { payPeriodId: string; target: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pay_period.export', PAYROLL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'pay_period.export', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (!['csv', 'gusto'].includes(args.target)) throw bad('Export as a CSV or in the Gusto format.', 'target')
    const period = await lockRow<Record<string, any>>(tx, 'PayPeriod', args.payPeriodId)
    if (!['approved', 'exported'].includes(period.status)) throw guard('Approve the pay period before exporting it.')
    const existing = await tx.payrollExportBatch.findUnique({ where: { payPeriodId_target: { payPeriodId: period.id, target: args.target } } })
    if (existing) return { id: existing.id, ref: existing.ref, sha256: existing.sha256, lineCount: existing.lineCount, totalMinor: existing.totalMinor.toString(), status: 'exported' }
    const { buildExport } = payExport
    const file = await buildExport(tx, period.id, args.target as 'csv' | 'gusto')
    const batch = await tx.payrollExportBatch.create({ data: { ref: await nextReference(tx, 'PAY', uow.now), payPeriodId: period.id, target: args.target, status: 'ready', lineCount: file.lineCount, totalMinor: file.totalMinor, sha256: file.sha256, createdById: actorUserId(actor) } })
    auditCreate(uow, actor, 'PayrollExportBatch', batch.id, 'pay_period.exported', { payPeriodId: period.id, target: args.target, sha256: file.sha256, lineCount: file.lineCount, totalMinor: file.totalMinor.toString() })
    if (period.status === 'approved') {
      await casUpdate(uow, { model: 'PayPeriod', id: period.id, version: period.version, from: ['approved'], to: 'exported', actor, eventType: 'pay_period.locked' })
      // The days this period paid are final.
      const paidSheets = await tx.timeSegment.findMany({ where: { payPeriodId: period.id }, select: { timesheetId: true }, distinct: ['timesheetId'] })
      const ids = paidSheets.map(s => s.timesheetId).filter(Boolean) as string[]
      if (ids.length) await tx.timesheet.updateMany({ where: { id: { in: ids }, status: 'approved' }, data: { status: 'locked', version: { increment: 1 } } })
    }
    return { id: batch.id, ref: batch.ref, sha256: file.sha256, lineCount: file.lineCount, totalMinor: file.totalMinor.toString(), status: 'exported' }
  })
  return { replay: result.replay, ...result.value }
}

export { ZERO, dayOf, isWorked }
