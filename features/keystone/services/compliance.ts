import { Prisma } from '@prisma/client'
import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow, transition } from '../lib/cas'
import { command } from '../lib/command'
import { addDays } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { Permission } from '../access'
import { resolvePolicyFromDb } from '../domain/policy'
import { asDate, companyToday } from './billingShared'
import { placeOfLocation } from './salesShared'
import { applyMovement, decimal, requireLocationAccess } from './inventory'

/*
 * Permits, inspections, refrigerant records and lien clocks (STATE-MACHINES §14, §15, SCHEMA §13).
 * A job is not completed while a permit is open or an inspection has not passed (completeJob here, and the database trigger
 * hs_job_permit_gate behind it). Refrigerant entries are immutable and each names the technician's own verified, unexpired EPA 608
 * credential (database trigger hs_refrigerant_credential behind the check here). Lien dates come from the lien policy pack's
 * month-based clock and are worked out when read; nothing is filed or sent.
 */

const PERMIT: Permission[] = ['canManagePermits']
const REFRIG: Permission[] = ['canManageRefrigerant']
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')
const str = (v: unknown, field: string, max = 200, required = false) => {
  const s = String(v ?? '').trim()
  if (required && !s) throw new DomainError(Codes.INVALID_INPUT, `${field} is needed.`, { field })
  if (s.length > max) throw new DomainError(Codes.INVALID_INPUT, `${field} is too long.`, { field })
  return s
}

// ── Permits and inspections ──────────────────────────────────────────────────────────────────────────────────────

export async function openPermit(db: Db, actor: Actor, args: { jobId: string; ahj: string; permitType: string; feeMinor?: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'permit.open', PERMIT, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'permit.open', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'That job does not exist.')
    if (['cancelled', 'closed', 'completed'].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: 'job_closed' })
    const fee = args.feeMinor ? BigInt(/^\d{1,9}$/.test(String(args.feeMinor)) ? args.feeMinor : '-1') : 0n
    if (fee < 0n) throw new DomainError(Codes.INVALID_INPUT, 'The fee is whole cents.', { field: 'feeMinor' })
    const ref = await nextReference(tx, 'PRM', uow.now)
    const row = await tx.permit.create({ data: { ref, jobId: job.id, ahj: str(args.ahj, 'ahj', 120, true), permitType: str(args.permitType, 'permitType', 80, true), status: 'needed', feeMinor: fee }, select: { id: true } })
    auditCreate(uow, actor, 'Permit', row.id, 'permit.opened', { ref, jobId: job.id })
    await tx.task.upsert({ where: { dedupeKey: `permit.apply:${row.id}` }, update: {}, create: { kind: 'permit.apply', title: `Apply for the ${args.permitType} permit (${ref})`, subjectType: 'Permit', subjectId: row.id, status: 'open', priority: 'normal', dedupeKey: `permit.apply:${row.id}` } })
    return { permitId: row.id, ref }
  })
  return { replay: result.replay, ...result.value }
}

const PERMIT_NEXT: Record<string, string[]> = { needed: ['applied', 'not_required'], applied: ['issued', 'rejected', 'not_required'], rejected: ['needed'], issued: ['closed'] }

export async function advancePermit(db: Db, actor: Actor, args: { permitId: string; to: string; externalNumber?: string; expiresOn?: string | null; note?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'permit.advance', PERMIT, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'permit.advance', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const p = await lockRow<{ id: string; status: string }>(tx, 'Permit', args.permitId)
    if (!(PERMIT_NEXT[p.status] ?? []).includes(args.to)) throw new DomainError(Codes.INVALID_TRANSITION, `A permit that is ${p.status.replaceAll('_', ' ')} cannot move to ${args.to.replaceAll('_', ' ')}.`)
    const data: Record<string, unknown> = { note: str(args.note, 'note', 300) }
    if (args.to === 'applied') data.appliedOn = asDate(await companyToday(tx, uow.now))
    if (args.to === 'issued') {
      data.externalNumber = str(args.externalNumber, 'externalNumber', 80, true)
      data.issuedOn = asDate(await companyToday(tx, uow.now))
      if (args.expiresOn) data.expiresOn = asDate(args.expiresOn)
    }
    if (args.to === 'closed') {
      const open = await tx.inspection.count({ where: { permitId: p.id, status: { not: 'passed' } } })
      const passed = await tx.inspection.count({ where: { permitId: p.id, status: 'passed' } })
      if (open || !passed) throw new DomainError(Codes.GUARD_FAILED, 'A permit closes when every inspection has passed.', { reason: 'inspections_open' })
    }
    const v = await casUpdate(uow, { model: 'Permit', id: p.id, version: args.expectedVersion, from: [p.status], to: args.to, actor, eventType: `permit.${args.to}`, data })
    return { status: args.to, version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function requestInspection(db: Db, actor: Actor, args: { permitId: string; kind: string; scheduledFor?: string | null; inspectorName?: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inspection.request', PERMIT, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inspection.request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const p = await uow.tx.permit.findUnique({ where: { id: args.permitId }, select: { id: true, status: true } })
    if (!p) throw new DomainError(Codes.NOT_FOUND, 'That permit does not exist.')
    if (p.status !== 'issued') throw new DomainError(Codes.GUARD_FAILED, 'Inspections are requested once the permit is issued.', { reason: 'permit_not_issued' })
    const when = args.scheduledFor ? new Date(args.scheduledFor) : null
    if (when && Number.isNaN(when.getTime())) throw new DomainError(Codes.INVALID_INPUT, 'That is not a date and time.', { field: 'scheduledFor' })
    const row = await uow.tx.inspection.create({ data: { permitId: p.id, kind: str(args.kind, 'kind', 80, true), status: when ? 'scheduled' : 'requested', scheduledFor: when, inspectorName: str(args.inspectorName, 'inspectorName', 80) }, select: { id: true } })
    auditCreate(uow, actor, 'Inspection', row.id, 'inspection.requested', { permitId: p.id, kind: args.kind })
    return { inspectionId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Record an inspection result. A failure makes a corrections Visit (unassigned) and keeps the job in awaiting_inspection. */
export async function recordInspectionResult(db: Db, actor: Actor, args: { inspectionId: string; result: 'passed' | 'failed'; notes?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inspection.result', PERMIT, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inspection.result', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (!['passed', 'failed'].includes(args.result)) throw new DomainError(Codes.INVALID_INPUT, 'Passed or failed.', { field: 'result' })
    const insp = await tx.inspection.findUnique({ where: { id: args.inspectionId }, select: { id: true, permit: { select: { id: true, ref: true, jobId: true } } } })
    if (!insp) throw new DomainError(Codes.NOT_FOUND, 'That inspection does not exist.')
    let correctionsVisitId: string | null = null
    if (args.result === 'failed' && insp.permit?.jobId) {
      const ref = await nextReference(tx, 'VIS', uow.now)
      const visit = await tx.visit.create({ data: { ref, jobId: insp.permit.jobId, status: 'unassigned', capacityHours: new Prisma.Decimal(1) }, select: { id: true } })
      correctionsVisitId = visit.id
      auditCreate(uow, actor, 'Visit', visit.id, 'visit.created', { ref, reason: 'inspection_corrections' })
    }
    const v = await casUpdate(uow, { model: 'Inspection', id: insp.id, version: args.expectedVersion, from: ['requested', 'scheduled'], to: args.result, actor, eventType: `inspection.${args.result}`, data: { result: { notes: str(args.notes, 'notes', 400), at: uow.now.toISOString() } as never, ...(correctionsVisitId ? { correctionsVisitId } : {}) } })
    return { status: args.result, version: v, correctionsVisitId }
  })
  return { replay: result.replay, ...result.value }
}

/** Failed inspection corrected: ask for it again. */
export async function reinspect(db: Db, actor: Actor, args: { inspectionId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inspection.reinspect', PERMIT, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inspection.reinspect', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'Inspection', id: args.inspectionId, version: args.expectedVersion, from: ['failed'], to: 'requested', actor, eventType: 'inspection.reinspect_requested' })
    return { status: 'requested', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** What stops a job being completed: open permits and inspections not yet passed. */
export async function completionBlockers(tx: Tx | Db, jobId: string) {
  const permits = await tx.permit.findMany({ where: { jobId, status: { in: ['needed', 'applied', 'issued', 'rejected'] } }, select: { ref: true, status: true } })
  const inspections = await tx.inspection.findMany({ where: { permit: { is: { jobId } }, status: { in: ['requested', 'scheduled', 'failed'] } }, select: { kind: true, status: true } })
  return { permits, inspections, blocked: permits.length + inspections.length > 0 }
}

/**
 * Finish a job: work_complete → completed, or → awaiting_inspection while a permit or inspection is open. Also runs the refrigerant
 * check (a job type that flags refrigerant work needs a log entry) and requires installed equipment to be recorded.
 */
export async function completeJob(db: Db, actor: Actor, args: { jobId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'job.complete', ['canDispatch', 'canManagePermits', 'canManageInvoices'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'job.complete', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const job = await lockRow<{ id: string; status: string; version: number; jobTypeId: string | null }>(tx, 'Job', args.jobId)
    if (!['work_complete', 'awaiting_inspection'].includes(job.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A job that is ${job.status.replaceAll('_', ' ')} is not completed from here.`)
    const type = job.jobTypeId ? await tx.jobType.findUnique({ where: { id: job.jobTypeId }, select: { refrigerantWork: true } }) : null
    if (type?.refrigerantWork && !(await tx.refrigerantLogEntry.count({ where: { jobId: job.id } }))) {
      throw new DomainError(Codes.GUARD_FAILED, 'This job handled refrigerant. Log it before completing.', { reason: 'refrigerant_log_missing' })
    }
    const blockers = await completionBlockers(tx, job.id)
    const to = blockers.blocked ? 'awaiting_inspection' : 'completed'
    if (to === job.status) throw new DomainError(Codes.GUARD_FAILED, 'Still waiting on a permit or inspection.', { reason: 'permit_open', permits: blockers.permits, inspections: blockers.inspections })
    const v = await casUpdate(uow, { model: 'Job', id: job.id, version: args.expectedVersion, from: [job.status], to, actor, eventType: to === 'completed' ? 'job.completed' : 'job.awaiting_inspection', data: to === 'completed' ? { completedAt: uow.now } : {} })
    return { status: to, version: v, blockers: blockers.blocked ? blockers : null }
  })
  return { replay: result.replay, ...result.value }
}

// ── Refrigerant ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The technician's own credential that clears them to log refrigerant on `day`: EPA 608, verified, unexpired. */
export async function epa608For(tx: Tx | Db, employeeId: string, day: string) {
  const creds = await tx.credential.findMany({ where: { employeeId, kind: 'epa_608', status: 'verified', epaType: { not: 'none' } }, orderBy: { expiresOn: 'desc' }, select: { id: true, epaType: true, expiresOn: true } })
  return creds.find(c => !c.expiresOn || ymd(c.expiresOn) >= day) ?? null
}

export async function saveCylinder(db: Db, actor: Actor, args: { serialOrTag: string; refrigerantType: string; kind?: string; locationId?: string | null; tareLb?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'refrigerant.cylinder_save', [...REFRIG, 'canManageInventory'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'refrigerant.cylinder_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const tag = str(args.serialOrTag, 'serialOrTag', 60, true)
    if (await uow.tx.refrigerantCylinder.findUnique({ where: { serialOrTag: tag }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'That cylinder is already recorded.', { reason: 'duplicate_cylinder' })
    if (args.locationId) await requireLocationAccess(uow.tx, actor, args.locationId)
    const row = await uow.tx.refrigerantCylinder.create({ data: { serialOrTag: tag, refrigerantType: str(args.refrigerantType, 'refrigerantType', 40, true), kind: args.kind ?? 'virgin', locationId: args.locationId ?? null, tareLb: args.tareLb ? decimal(args.tareLb, 'tareLb', { positive: true }) : null, status: 'in_service' }, select: { id: true } })
    auditCreate(uow, actor, 'RefrigerantCylinder', row.id, 'refrigerant_cylinder.created', { tag })
    return { cylinderId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Net refrigerant in a cylinder: charge entries draw down, recover entries add, per the log. */
export async function cylinderBalance(tx: Tx | Db, cylinderId: string) {
  const rows = await tx.refrigerantLogEntry.findMany({ where: { cylinderId }, select: { kind: true, quantityLb: true } })
  return rows.reduce((s, r) => (r.kind === 'recover' ? s.plus(r.quantityLb) : ['charge', 'transfer', 'reclaim_shipment'].includes(r.kind) ? s.minus(r.quantityLb) : s), new Prisma.Decimal(0))
}

export type RefrigerantEntryInput = { kind: string; equipmentId?: string | null; jobId?: string | null; cylinderId?: string | null; refrigerantType: string; quantityLb: string; technicianId: string; notes?: string; idempotencyKey: string; now?: Date }

/**
 * Add an entry to the refrigerant log. It is immutable. The technician must have a verified, unexpired EPA 608 credential of their own
 * (a technician logs only as themselves; the office may log for one of their technicians). A charge past the recorded charge of the
 * appliance adds to its leak-rate record, and a cylinder cannot be drawn below empty.
 */
export async function logRefrigerant(db: Db, actor: Actor, args: RefrigerantEntryInput) {
  await authorizeOperation(db, actor, 'refrigerant.log', [...REFRIG, 'canWorkVisits'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'refrigerant.log', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (!['charge', 'recover', 'transfer', 'reclaim_shipment', 'disposal_verification'].includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, 'Unknown entry kind.', { field: 'kind' })
    const qty = decimal(args.quantityLb, 'quantityLb', { positive: true })
    if (qty.decimalPlaces() > 2) throw new DomainError(Codes.INVALID_INPUT, 'Pounds are recorded to 0.01.', { field: 'quantityLb' })
    const tech = await tx.employee.findUnique({ where: { id: args.technicianId }, select: { id: true, userId: true } })
    if (!tech) throw new DomainError(Codes.NOT_FOUND, 'That technician does not exist.')
    if (actor.kind === 'user' && !actor.permissions.has('canManageRefrigerant') && tech.userId !== actor.userId) throw new DomainError(Codes.NOT_AUTHORIZED, 'You log refrigerant under your own name.')
    const day = (args.now ?? uow.now).toISOString().slice(0, 10)
    const cred = await epa608For(tx, tech.id, day)
    if (!cred) throw new DomainError(Codes.GUARD_FAILED, 'This technician has no verified, unexpired EPA 608 certification on file.', { reason: 'no_epa_608' })
    if (args.jobId) {
      const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true } })
      if (!job) throw new DomainError(Codes.NOT_FOUND, 'That job does not exist.')
    }
    if (args.cylinderId) {
      const cyl = await lockRow<{ id: string; status: string; refrigerantType: string; kind: string }>(tx, 'RefrigerantCylinder', args.cylinderId)
      if (['retired', 'sent_reclaim'].includes(cyl.status)) throw new DomainError(Codes.GUARD_FAILED, 'That cylinder is out of service.', { reason: 'cylinder_out' })
      if (cyl.refrigerantType.toLowerCase() !== args.refrigerantType.trim().toLowerCase() && args.kind !== 'recover') throw new DomainError(Codes.GUARD_FAILED, 'The cylinder holds a different refrigerant.', { reason: 'wrong_refrigerant' })
      // A virgin cylinder has no opening balance on the log (its fill is the supplier's), so only recovery cylinders are checked.
      if (cyl.kind !== 'virgin' && ['charge', 'transfer', 'reclaim_shipment'].includes(args.kind)) {
        const left = await cylinderBalance(tx, cyl.id)
        if (left.minus(qty).lt(-0.0001)) throw new DomainError(Codes.GUARD_FAILED, 'That is more than the cylinder holds on the log.', { reason: 'cylinder_overdraw', balance: left.toString() })
      }
    }
    const row = await tx.refrigerantLogEntry.create({
      data: { idempotencyKey: `rl:${idempotencyKey}`, kind: args.kind, equipmentId: args.equipmentId ?? null, jobId: args.jobId ?? null, cylinderId: args.cylinderId ?? null, refrigerantType: str(args.refrigerantType, 'refrigerantType', 40, true), quantityLb: qty, technicianId: tech.id, credentialId: cred.id, occurredAt: uow.now, notes: str(args.notes, 'notes', 300) },
      select: { id: true },
    })
    auditCreate(uow, actor, 'RefrigerantLogEntry', row.id, 'refrigerant.logged', { kind: args.kind, quantityLb: qty.toString(), jobId: args.jobId ?? null })
    let leak = null
    if (args.kind === 'charge' && args.equipmentId) leak = await evaluateLeakRate(uow, actor, args.equipmentId)
    return { entryId: row.id, leak }
  })
  return { replay: result.replay, ...result.value }
}

/** Per-class leak thresholds of 40 CFR 84.106 (the share of charge added in a rolling 12 months). Residential and light-commercial AC is excluded. */
export const LEAK_THRESHOLD_PCT: Record<string, string> = { commercial_refrigeration: '20', industrial_process: '30', comfort_cooling: '10' }

/** Work out the rolling-12-month leak rate for one appliance and keep one open record per appliance. Idempotent. */
export async function evaluateLeakRate(uow: { tx: Tx; now: Date; audit: (e: never) => void } & Record<string, any>, actor: Actor, equipmentId: string) {
  const { tx } = uow
  const eq = await tx.installedEquipment.findUnique({ where: { id: equipmentId }, select: { id: true, applianceClass: true, refrigerantChargeLb: true, location: { select: { state: true, postalCode: true, city: true } } } })
  if (!eq) return null
  const policy = await resolvePolicyFromDb<{ leakRepair: { minChargeLb: string; repairDays: number; excludedSubsectors: string[] } }>(tx, 'refrigerant', placeOfLocation(eq.location as never), ymd(uow.now))
  const rules = policy.rules.leakRepair
  const charge = eq.refrigerantChargeLb ? new Prisma.Decimal(eq.refrigerantChargeLb) : null
  const threshold = LEAK_THRESHOLD_PCT[eq.applianceClass]
  const open = await tx.leakRateEvaluation.findFirst({ where: { equipmentId, status: { in: ['open', 'repair_due'] } }, select: { id: true, version: true, status: true, repairDueBy: true } })
  if (!charge || charge.lt(rules.minChargeLb) || !threshold || rules.excludedSubsectors.includes(eq.applianceClass)) return { applicable: false }
  const since = new Date(uow.now.getTime() - 365 * 86_400_000)
  const added = (await tx.refrigerantLogEntry.findMany({ where: { equipmentId, kind: 'charge', occurredAt: { gte: since } }, select: { quantityLb: true } })).reduce((s, r) => s.plus(r.quantityLb), new Prisma.Decimal(0))
  const pct = added.div(charge).mul(100).toDecimalPlaces(2)
  const over = pct.gte(threshold)
  const base = { chargeLb: charge, addedLb: added, leakRatePct: pct, threshold: new Prisma.Decimal(threshold), policyVersionId: policy.versionId }
  if (open) {
    await tx.leakRateEvaluation.update({ where: { id: open.id }, data: { ...base, ...(over && open.status === 'open' ? { status: 'repair_due', repairDueBy: asDate(addDays(ymd(uow.now), rules.repairDays)), version: { increment: 1 } } : {}) } })
    return { applicable: true, evaluationId: open.id, leakRatePct: pct.toString(), over }
  }
  const row = await tx.leakRateEvaluation.create({ data: { equipmentId, ...base, status: over ? 'repair_due' : 'open', repairDueBy: over ? asDate(addDays(ymd(uow.now), rules.repairDays)) : null }, select: { id: true } })
  if (over) await tx.task.upsert({ where: { dedupeKey: `refrigerant.leak_repair:${row.id}` }, update: {}, create: { kind: 'refrigerant.leak_repair', title: `Leak rate ${pct}% is over the ${threshold}% limit: repair within ${rules.repairDays} days`, subjectType: 'LeakRateEvaluation', subjectId: row.id, status: 'open', priority: 'high', dedupeKey: `refrigerant.leak_repair:${row.id}` } })
  return { applicable: true, evaluationId: row.id, leakRatePct: pct.toString(), over }
}

export async function resolveLeak(db: Db, actor: Actor, args: { evaluationId: string; to: 'repaired_verified' | 'retrofit_plan' | 'retired'; note?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'refrigerant.leak_resolve', REFRIG, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'refrigerant.leak_resolve', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'LeakRateEvaluation', id: args.evaluationId, version: args.expectedVersion, from: ['open', 'repair_due'], to: args.to, actor, eventType: `leak_rate.${args.to}`, reason: str(args.note, 'note', 300, true) })
    await uow.tx.task.updateMany({ where: { dedupeKey: `refrigerant.leak_repair:${args.evaluationId}`, status: 'open' }, data: { status: 'done', closedAt: uow.now, resolution: args.to } })
    return { status: args.to, version: v }
  })
  return { replay: result.replay, ...result.value }
}

type InstallRule = { refrigerant: string; equipmentClass: string; allowed: boolean; condition: string }

/** I-R2: check an equipment model against the refrigerant policy for the place and date. Writes one immutable check. */
export async function checkRefrigerantInstall(db: Db, actor: Actor, args: { workLineId: string; equipmentModelId: string; stage: 'sold' | 'work_complete'; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'refrigerant.install_check', [...REFRIG, 'canSellEstimates', 'canDispatch'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'refrigerant.install_check', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const line = await tx.workLine.findUnique({ where: { id: args.workLineId }, select: { id: true, job: { select: { location: { select: { state: true, postalCode: true, city: true } } } } } })
    if (!line) throw new DomainError(Codes.NOT_FOUND, 'That work line does not exist.')
    const model = await tx.equipmentModel.findUnique({ where: { id: args.equipmentModelId }, select: { id: true, kind: true, refrigerantType: true, modelNumber: true } })
    if (!model) throw new DomainError(Codes.NOT_FOUND, 'That equipment model does not exist.')
    const policy = await resolvePolicyFromDb<{ installRules: InstallRule[] }>(tx, 'refrigerant', placeOfLocation(line.job?.location as never), ymd(uow.now))
    const klass = model.kind === 'water_heater_tank' || model.kind === 'ac_condenser' || model.kind === 'heat_pump' || model.kind === 'furnace' || model.kind === 'mini_split' ? 'residential_ac' : 'other'
    const hits = policy.rules.installRules.filter(r => r.refrigerant.toLowerCase() === (model.refrigerantType ?? '').toLowerCase() && (r.equipmentClass === klass || r.equipmentClass === 'any'))
    const blocked = hits.find(h => !h.allowed)
    const result = blocked ? 'blocked' : hits.length ? 'allowed' : model.refrigerantType ? 'warning' : 'allowed'
    const findings = blocked ? [{ refrigerant: blocked.refrigerant, note: blocked.condition }] : !hits.length && model.refrigerantType ? [{ refrigerant: model.refrigerantType, note: 'No install rule covers this refrigerant. Check it before selling.' }] : []
    const row = await tx.refrigerantInstallCheck.create({ data: { workLineId: line.id, equipmentModelId: model.id, stage: args.stage, policyVersionId: policy.versionId, result, findings: findings as never }, select: { id: true } })
    auditCreate(uow, actor, 'RefrigerantInstallCheck', row.id, 'refrigerant.install_checked', { result, stage: args.stage })
    if (blocked && args.stage === 'sold') throw new DomainError(Codes.GUARD_FAILED, `This refrigerant cannot be installed: ${blocked.condition}`, { reason: 'refrigerant_install_blocked', checkId: row.id })
    return { checkId: row.id, result, findings }
  })
  return { replay: result.replay, ...result.value }
}

// ── Liens (Texas, month-based clocks) ────────────────────────────────────────────────────────────────────────────

type LienClock = { party: string; projectClass: string; action: string; monthsAfter: number; dayOfMonth: number; from: string }

/** The Nth month after the month of `day`, on `dayOfMonth` (Tex. Prop. Code 53.052: the 15th day of the Nth month). */
export function nthMonthDay(day: string, monthsAfter: number, dayOfMonth: number) {
  const [y, m] = day.split('-').map(Number)
  const index = (y * 12 + (m - 1)) + monthsAfter
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
}

/** Open a lien record for an invoice's job. The affidavit clock is read from the lien pack on the day work was completed. */
export async function trackLien(db: Db, actor: Actor, args: { jobId: string; invoiceId?: string | null; projectClass?: 'residential' | 'other'; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lien.track', ['canManageInvoices', 'canManageAccounting'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'lien.track', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true, completedAt: true, location: { select: { state: true, postalCode: true, city: true } } } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'That job does not exist.')
    if (!['completed', 'closed'].includes(job.status) || !job.completedAt) throw new DomainError(Codes.GUARD_FAILED, 'A lien clock starts when the work is completed.', { reason: 'not_completed' })
    if (await tx.lienTrack.findFirst({ where: { jobId: job.id, status: { in: ['monitoring', 'notice_sent'] } }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'This job already has a lien record.', { reason: 'duplicate_lien' })
    const completed = ymd(job.completedAt)
    const policy = await resolvePolicyFromDb<{ clocks: LienClock[] }>(tx, 'lien', placeOfLocation(job.location as never), completed)
    const clock = policy.rules.clocks.find(c => c.party === 'original_contractor' && c.projectClass === (args.projectClass ?? 'residential') && c.action === 'file_affidavit')
    if (!clock) throw new DomainError(Codes.POLICY_MISSING, 'There is no lien clock for that kind of project.')
    const affidavit = nthMonthDay(completed, clock.monthsAfter, clock.dayOfMonth)
    const row = await tx.lienTrack.create({ data: { jobId: job.id, invoiceId: args.invoiceId ?? null, policyVersionId: policy.versionId, completionMonth: asDate(`${completed.slice(0, 7)}-01`), affidavitDueOn: asDate(affidavit), status: 'monitoring' }, select: { id: true } })
    auditCreate(uow, actor, 'LienTrack', row.id, 'lien.tracked', { affidavitDueOn: affidavit, policyVersion: policy.versionNumber })
    return { lienId: row.id, affidavitDueOn: affidavit }
  })
  return { replay: result.replay, ...result.value }
}

const LIEN_NEXT: Record<string, string[]> = { monitoring: ['notice_sent', 'affidavit_filed', 'released', 'abandoned'], notice_sent: ['affidavit_filed', 'released', 'abandoned'], affidavit_filed: ['released'] }
/** Staff filed or released it themselves; record it. Nothing is filed from here. */
export async function advanceLien(db: Db, actor: Actor, args: { lienId: string; to: string; note?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lien.advance', ['canManageInvoices', 'canManageAccounting'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'lien.advance', actor, idempotencyKey, params, now: args.now }, async uow => {
    const l = await lockRow<{ status: string }>(uow.tx, 'LienTrack', args.lienId)
    if (!(LIEN_NEXT[l.status] ?? []).includes(args.to)) throw new DomainError(Codes.INVALID_TRANSITION, `A lien that is ${l.status.replaceAll('_', ' ')} cannot move to ${args.to.replaceAll('_', ' ')}.`)
    const v = await casUpdate(uow, { model: 'LienTrack', id: args.lienId, version: args.expectedVersion, from: [l.status], to: args.to, actor, eventType: `lien.${args.to}`, data: { note: str(args.note, 'note', 300) } })
    return { status: args.to, version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Lien list with days left, worked out as of today. */
export async function lienList(db: Db, now = new Date()) {
  const today = await companyToday(db as never, now)
  const rows = await db.lienTrack.findMany({ where: { status: { in: ['monitoring', 'notice_sent', 'affidavit_filed'] } }, orderBy: { affidavitDueOn: 'asc' }, take: 300, select: { id: true, status: true, version: true, affidavitDueOn: true, completionMonth: true, job: { select: { id: true, ref: true } }, invoice: { select: { id: true, ref: true } } } })
  return rows.map(r => ({ ...r, affidavitDueOn: ymd(r.affidavitDueOn), completionMonth: ymd(r.completionMonth), daysLeft: Math.round((Date.parse(`${ymd(r.affidavitDueOn)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) }))
}

void applyMovement; void transition; void actorUserId
