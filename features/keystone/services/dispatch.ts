import { createHash } from 'node:crypto'
import { authorizeOperation, recordAgentAction, recordAgentRead } from '../lib/agentGate'
import { actorAgentId, actorUserId, can, type Actor } from '../lib/actor'
import { advisoryLock, type Db, type Tx } from '../lib/db'
import { auditCreate, casUpdate, transition } from '../lib/cas'
import { canonicalJson } from '../lib/canonical'
import { command } from '../lib/command'
import { localDate } from '../lib/calendar'
import { decSum, toScale } from '../lib/decimal'
import { DomainError, Codes } from '../lib/errors'
import type { UnitOfWork } from '../lib/unitOfWork'
import { evaluateEligibility, type CrewMember, type EligibilityResult, type LicensingRules } from '../domain/eligibility'
import { DISPATCH_FEATURES, DISPATCH_MODEL, driveMinutes, rankCandidates, type Candidate } from '../domain/dispatch'
import { resolvePolicyFromDb } from '../domain/policy'
import { assertCanStartWork } from './cancellation'

/*
 * Dispatch (SM§4, I-D1..I-D4). Assignment is a CAS on visit.version plus a tech-day advisory lock per
 * assigned tech, so two dispatchers (or a dispatcher and the agent) can't both win, and a tech's day
 * is checked for overlaps under a lock. Eligibility is evaluated against the bound licensing
 * PolicyVersion and stored per tech; an ineligible crew is refused with findings.
 */

const ACTIVE_VISIT = ['scheduled', 'dispatched', 'en_route', 'on_site', 'working', 'paused']

type VisitContext = Awaited<ReturnType<typeof loadVisitContext>>

async function loadVisitContext(db: Tx | Db, visitId: string) {
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true, ref: true, status: true, version: true, plannedStart: true, plannedDurationMinutes: true, capacityHours: true, windowId: true,
      window: { select: { startsAt: true, endsAt: true, label: true, date: true } },
      assignments: { where: { active: true }, select: { id: true, employeeId: true, role: true } },
      job: { select: { id: true, ref: true, customerId: true, businessUnitId: true, status: true, version: true, location: { select: { id: true, lat: true, lng: true, state: true, postalCode: true, city: true, county: true, timeZone: true } }, jobType: { select: { id: true, name: true, requirements: { select: { licensingTags: true, requiredCredentialKinds: true, requiresSupervisorOnJob: true, maxCoolingTons: true, skills: { select: { id: true } } } } } } } },
    },
  })
  if (!visit) throw new DomainError(Codes.NOT_FOUND, 'Visit not found.')
  return visit
}

const requirementOf = (ctx: VisitContext) => {
  const r = ctx.job?.jobType?.requirements
  return {
    licensingTags: (r?.licensingTags as string[] | null) ?? [],
    requiredCredentialKinds: (r?.requiredCredentialKinds as string[] | null) ?? [],
    requiresSupervisorOnJob: r?.requiresSupervisorOnJob ?? false,
    maxCoolingTons: r?.maxCoolingTons?.toString() ?? null,
    skillIds: r?.skills.map(s => s.id) ?? [],
  }
}

const placeOf = (ctx: VisitContext) => {
  const loc = ctx.job?.location
  const state = loc?.state ? `US-${loc.state}` : 'US-TX'
  return { state, zip: loc?.postalCode ?? null, city: loc?.city ? `${state}-${loc.city.toUpperCase().replace(/\s+/g, '-')}` : null }
}

async function loadCrew(db: Tx | Db, employeeIds: string[]) {
  const rows = await db.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, displayName: true, status: true, dispatchable: true, lat: true, lng: true, user: { select: { id: true } }, skills: { select: { id: true } }, credentials: { select: { kind: true, trade: true, licenseClass: true, epaType: true, status: true, expiresOn: true } } },
  })
  return rows
}

type CrewRow = Awaited<ReturnType<typeof loadCrew>>[number]

const toMember = (e: CrewRow, role: CrewMember['role']): CrewMember => ({
  employeeId: e.id, role, status: e.status,
  credentials: e.credentials.map(c => ({ kind: c.kind, trade: c.trade, licenseClass: c.licenseClass, epaType: c.epaType, status: c.status, expiresOn: c.expiresOn ? c.expiresOn.toISOString().slice(0, 10) : null })),
})

async function licensingFor(db: Tx | Db, ctx: VisitContext, date: string) {
  try {
    const resolved = await resolvePolicyFromDb<LicensingRules>(db as never, 'licensing', placeOf(ctx), date)
    return { rules: resolved.rules, versionId: resolved.versionId }
  } catch (error) {
    if (error instanceof DomainError && (error.code === Codes.POLICY_MISSING || error.code === Codes.POLICY_AMBIGUOUS)) return { rules: null, versionId: null }
    throw error
  }
}

async function companyLicenses(db: Tx | Db, date: string) {
  const rows = await db.contractorLicense.findMany({ select: { issuer: true, licenseClass: true, endorsements: true, trade: true, expiresOn: true } })
  return rows.map(l => ({ issuer: l.issuer, licenseClass: l.licenseClass, endorsements: (l.endorsements as string[]) ?? [], trade: l.trade, expiresOn: l.expiresOn ? l.expiresOn.toISOString().slice(0, 10) : null })).filter(l => !l.expiresOn || l.expiresOn >= date)
}

const visitDate = (ctx: VisitContext) => (ctx.window?.date ? ctx.window.date.toISOString().slice(0, 10) : localDate({ timeZone: ctx.job?.location?.timeZone || 'America/Chicago' }, ctx.plannedStart ?? new Date()))

/** Eligibility of a proposed crew for a visit (pure evaluation over loaded facts). */
export async function evaluateCrew(db: Tx | Db, ctx: VisitContext, crew: { employeeId: string; role: CrewMember['role'] }[]) {
  const date = visitDate(ctx)
  const [rows, licensing, licenses] = await Promise.all([loadCrew(db, crew.map(c => c.employeeId)), licensingFor(db, ctx, date), companyLicenses(db, date)])
  const missing = crew.filter(c => !rows.some(r => r.id === c.employeeId))
  if (missing.length) throw new DomainError(Codes.NOT_FOUND, 'A selected technician was not found.', { field: 'employeeIds' })
  const members = crew.map(c => toMember(rows.find(r => r.id === c.employeeId)!, c.role))
  const req = requirementOf(ctx)
  const result = evaluateEligibility({ date, requirement: { ...req, jobCoolingTons: null }, rules: licensing.rules, companyLicenses: licenses, crew: members })
  return { result, policyVersionId: licensing.versionId, rows, date }
}

const findingCodes = (result: EligibilityResult, employeeId?: string) =>
  [...result.crewFindings, ...(employeeId ? result.perEmployee[employeeId]?.findings ?? [] : Object.values(result.perEmployee).flatMap(e => e.findings))].map(f => f.code)

/** Overlap check for one tech's day, under `tech-day:{employee}:{date}` (I-D2). */
async function overlapsFor(tx: Tx | Db, employeeId: string, visitId: string, startsAt: Date, endsAt: Date) {
  const others = await tx.visitAssignment.findMany({
    where: { employeeId, active: true, visitId: { not: visitId }, visit: { status: { in: ACTIVE_VISIT }, window: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } } },
    select: { visit: { select: { id: true, ref: true, status: true } } },
  })
  return others.map(o => o.visit!)
}

export type AssignArgs = { visitId: string; expectedVersion: number; employeeIds: string[]; leadEmployeeId?: string | null; recommendationId?: string | null; overrideReason?: string | null; idempotencyKey: string; now?: Date }

/** unassigned → scheduled, or a reassignment of a scheduled/dispatched visit (people only). */
export async function assignVisit(db: Db, actor: Actor, args: AssignArgs) {
  await authorizeOperation(db, actor, 'dispatch.apply', ['canDispatch'], args)
  const ids = [...new Set(args.employeeIds)]
  if (!ids.length || ids.length > 8) throw new DomainError(Codes.INVALID_INPUT, 'Assign between one and eight people.', { field: 'employeeIds' })
  const leadId = args.leadEmployeeId && ids.includes(args.leadEmployeeId) ? args.leadEmployeeId : ids[0]
  const { idempotencyKey, now: _now, ...params } = args

  const result = await command(db, { name: 'dispatch.assign', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const ctx = await loadVisitContext(tx, args.visitId)
    const reassign = ctx.status !== 'unassigned'
    // I-A2: an agent may only fill an unassigned visit; never move one a person already scheduled.
    if (actor.kind === 'agent' && reassign) throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents can only assign unassigned visits. Ask a dispatcher to reassign.', { currentStatus: ctx.status })
    if (!['unassigned', 'scheduled', 'dispatched'].includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status.replaceAll('_', ' ')} visit can't be reassigned.`, { currentStatus: ctx.status, currentVersion: ctx.version, to: 'scheduled' })
    if (ctx.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This visit changed since you loaded it. Reload and try again.', { currentStatus: ctx.status, currentVersion: ctx.version })
    const startsAt = ctx.window?.startsAt ?? ctx.plannedStart
    const endsAt = ctx.window?.endsAt ?? (ctx.plannedStart ? new Date(ctx.plannedStart.getTime() + (ctx.plannedDurationMinutes ?? 60) * 60_000) : null)
    if (!startsAt || !endsAt) throw new DomainError(Codes.GUARD_FAILED, 'This visit has no arrival window yet.', { reason: 'no_window' })

    // Lock each tech's day in a fixed order (no deadlocks between two multi-tech assignments).
    const date = visitDate(ctx)
    for (const id of [...ids].sort()) await advisoryLock(tx, `tech-day:${id}:${date}`)

    const crew = ids.map(id => ({ employeeId: id, role: (id === leadId ? 'lead' : 'helper') as CrewMember['role'] }))
    const { result: eligibility, policyVersionId, rows } = await evaluateCrew(tx, ctx, crew)
    for (const e of rows) if (!e.dispatchable) eligibility.perEmployee[e.id] = { eligible: false, findings: [...(eligibility.perEmployee[e.id]?.findings ?? []), { code: 'NOT_DISPATCHABLE', severity: 'block', employeeId: e.id, message: `${e.displayName} is not dispatchable.` }] }
    const evaluations = await tx.eligibilityEvaluation.createManyAndReturn({
      data: crew.map(c => ({ visitId: ctx.id, employeeId: c.employeeId, policyVersionId, result: eligibility.perEmployee[c.employeeId]?.eligible && !eligibility.crewFindings.length ? 'eligible' : 'ineligible', findings: { member: eligibility.perEmployee[c.employeeId]?.findings ?? [], crew: eligibility.crewFindings } as never, evaluatedAt: uow.now })),
      select: { id: true, employeeId: true, result: true },
    })
    const blocked = evaluations.filter(e => e.result !== 'eligible')
    if (blocked.length) {
      // The refusal is the answer: nothing else in this transaction commits.
      throw new DomainError(Codes.NOT_ELIGIBLE, `Not eligible: ${[...new Set(findingCodes({ ...eligibility, perEmployee: Object.fromEntries(Object.entries(eligibility.perEmployee).filter(([k]) => blocked.some(b => b.employeeId === k))) }))].join(', ')}`, { reason: 'eligibility', problems: [...eligibility.crewFindings, ...Object.values(eligibility.perEmployee).flatMap(e => e.findings)].map(f => f.message) })
    }

    // Overlaps: strict when the other visit is already rolling; otherwise refused unless a dispatcher overrides.
    for (const id of ids) {
      const clashes = await overlapsFor(tx, id, ctx.id, startsAt, endsAt)
      const rolling = clashes.filter(c => ['en_route', 'on_site', 'working', 'paused'].includes(c.status))
      if (rolling.length) throw new DomainError(Codes.SCHEDULE_CONFLICT, `${rows.find(r => r.id === id)?.displayName} is on another visit (${rolling[0].ref}).`, { reason: 'active_visit' })
      if (clashes.length && !args.overrideReason) throw new DomainError(Codes.SCHEDULE_CONFLICT, `${rows.find(r => r.id === id)?.displayName} already has ${clashes.map(c => c.ref).join(', ')} in this window. Give an override reason to double-book.`, { reason: 'overlap' })
    }

    // CAS: the visit moves (or is re-scheduled) only if nobody else changed it.
    const to = 'scheduled'
    await casUpdate(uow, { model: 'Visit', id: ctx.id, version: ctx.version, from: [ctx.status], to, actor, eventType: reassign ? 'visit.reassigned' : 'visit.assigned', reason: args.overrideReason ?? null, data: {}, audit: { employeeIds: ids, leadEmployeeId: leadId, recommendationId: args.recommendationId ?? null } })
    if (ctx.assignments.length) {
      await tx.visitAssignment.updateMany({ where: { visitId: ctx.id, active: true }, data: { active: false, endedAt: uow.now } })
    }
    await tx.visitAssignment.createMany({
      data: crew.map(c => ({ visitId: ctx.id, employeeId: c.employeeId, role: c.role, assignedAt: uow.now, assignedById: actorUserId(actor), assignedByAgentId: actorAgentId(actor), recommendationId: args.recommendationId ?? null, overrideReason: args.overrideReason ?? '', eligibilityId: evaluations.find(e => e.employeeId === c.employeeId)?.id ?? null, active: true })),
    })
    await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: actorUserId(actor), fromStatus: ctx.status, toStatus: to, kind: 'transition', occurredAt: uow.now, idempotencyKey: `server:${idempotencyKey}`, note: reassign ? 'reassigned' : 'assigned' } })

    // A recommendation used (or overridden) records the decision (I-D4).
    if (args.recommendationId) {
      const rec = await tx.dispatchRecommendation.findUnique({ where: { id: args.recommendationId }, select: { id: true, version: true, decision: true, rankedCandidates: true, visitId: true } })
      if (rec && rec.visitId === ctx.id && rec.decision === 'proposed') {
        const top = ((rec.rankedCandidates as { employeeId: string }[] | null) ?? [])[0]?.employeeId
        const decision = top === leadId ? 'applied' : 'overridden'
        await casUpdate(uow, { model: 'DispatchRecommendation', id: rec.id, version: rec.version, from: ['proposed'], to: decision, actor, eventType: `dispatch_recommendation.${decision}`, statusField: 'decision', reason: args.overrideReason ?? null, data: { decidedById: actorUserId(actor), decidedAt: uow.now } })
      }
    }

    // Job: booked → scheduled on its first scheduled visit.
    if (ctx.job && ctx.job.status === 'booked') {
      await casUpdate(uow, { model: 'Job', id: ctx.job.id, version: ctx.job.version, from: ['booked'], to: 'scheduled', actor, eventType: 'job.scheduled' })
    }
    const value = { visitId: ctx.id, status: to, version: ctx.version + 1, employeeIds: ids, leadEmployeeId: leadId, reassigned: reassign }
    await recordAgentAction(uow, actor, { tool: 'dispatch.apply', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

/** Take a visit off the board (scheduled/dispatched → unassigned). Dispatchers only. */
export async function unassignVisit(db: Db, actor: Actor, args: { visitId: string; expectedVersion: number; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'dispatch.unassign', ['canDispatch'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents cannot unassign visits.')
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Give a reason.', { field: 'reason' })
  const result = await command(db, { name: 'dispatch.unassign', actor, idempotencyKey: args.idempotencyKey, params: { visitId: args.visitId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Visit', id: args.visitId, from: ['scheduled', 'dispatched'], to: 'unassigned', expectedVersion: args.expectedVersion, actor, eventType: 'visit.unassigned', reason: args.reason })
    await uow.tx.visitAssignment.updateMany({ where: { visitId: args.visitId, active: true }, data: { active: false, endedAt: uow.now } })
    await uow.tx.visitStatusEvent.create({ data: { visitId: args.visitId, actorUserId: actorUserId(actor), fromStatus: 'scheduled', toStatus: 'unassigned', kind: 'transition', occurredAt: uow.now, idempotencyKey: `server:${args.idempotencyKey}`, note: args.reason } })
    return { visitId: args.visitId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

// ---------------------------------------------------------------------------------------------
// Status changes (dispatcher or the assigned tech's device)

const VISIT_MOVES: Record<string, { from: string[]; who: 'dispatcher' | 'tech' | 'either' }> = {
  dispatched: { from: ['scheduled'], who: 'dispatcher' },
  en_route: { from: ['dispatched', 'scheduled'], who: 'either' },
  on_site: { from: ['en_route'], who: 'either' },
  working: { from: ['on_site', 'paused'], who: 'either' },
  paused: { from: ['working'], who: 'either' },
  done: { from: ['working'], who: 'either' },
  no_access: { from: ['en_route', 'on_site'], who: 'either' },
  cancelled: { from: ['unassigned', 'scheduled', 'dispatched', 'en_route', 'on_site'], who: 'dispatcher' },
}

const ORDER = ['unassigned', 'scheduled', 'dispatched', 'en_route', 'on_site', 'working', 'paused', 'done']

export type VisitStatusArgs = { visitId: string; to: string; expectedVersion?: number | null; reason?: string | null; clientRecordedAt?: string | null; deviceEventKey?: string | null; lat?: string | null; lng?: string | null; idempotencyKey: string; now?: Date }

export async function setVisitStatus(db: Db, actor: Actor, args: VisitStatusArgs) {
  const move = VISIT_MOVES[args.to]
  if (!move) throw new DomainError(Codes.INVALID_INPUT, `Unknown visit status ${args.to}.`, { field: 'to' })
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not change visit status.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'visit.status', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const ctx = await loadVisitContext(tx, args.visitId)
    const dispatcher = can(actor, 'canDispatch')
    const userId = actorUserId(actor)
    const assigned = userId ? await tx.visitAssignment.count({ where: { visitId: ctx.id, active: true, employee: { user: { id: userId } } } }) : 0
    const isTech = assigned > 0 && can(actor, 'canWorkVisits')
    if (actor.kind === 'user' && !(dispatcher || (move.who !== 'dispatcher' && isTech))) throw new DomainError(Codes.NOT_AUTHORIZED, move.who === 'dispatcher' ? 'This needs a dispatcher.' : 'Only the assigned technician or a dispatcher can do this.')
    if (args.to === 'cancelled' && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Give a reason to cancel.', { field: 'reason' })
    if (args.to === 'no_access' && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say what you tried (knocked, called, texted).', { field: 'reason' })

    // An offline device event that arrives after the visit moved on is kept as a correction for review (I-D3).
    const deviceKey = args.deviceEventKey ? `device:${args.deviceEventKey}` : null
    if (deviceKey) {
      const seen = await tx.visitStatusEvent.findUnique({ where: { idempotencyKey: deviceKey }, select: { id: true } })
      if (seen) return { visitId: ctx.id, status: ctx.status, version: ctx.version, duplicate: true }
    }
    const clientAt = args.clientRecordedAt ? new Date(args.clientRecordedAt) : null
    if (clientAt && Number.isNaN(clientAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, 'clientRecordedAt is not a date.', { field: 'clientRecordedAt' })
    const outOfOrder = !move.from.includes(ctx.status) && deviceKey && ORDER.indexOf(ctx.status) >= ORDER.indexOf(args.to) && ORDER.indexOf(args.to) >= 0
    if (outOfOrder) {
      await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: userId, fromStatus: ctx.status, toStatus: args.to, kind: 'correction', occurredAt: uow.now, clientRecordedAt: clientAt, idempotencyKey: deviceKey!, lat: args.lat ?? null, lng: args.lng ?? null, note: 'Arrived out of order; kept for review.' } })
      await tx.visit.update({ where: { id: ctx.id }, data: { needsReview: true } })
      uow.audit({ eventType: 'visit.status_correction', entityType: 'Visit', entityId: ctx.id, actorUserId: userId, after: { reported: args.to, current: ctx.status, clientRecordedAt: args.clientRecordedAt ?? null } })
      return { visitId: ctx.id, status: ctx.status, version: ctx.version, correction: true }
    }
    if (args.expectedVersion !== undefined && args.expectedVersion !== null && args.expectedVersion !== ctx.version) throw new DomainError(Codes.STALE_STATE, 'This visit changed since you loaded it. Reload and try again.', { currentStatus: ctx.status, currentVersion: ctx.version })
    if (!move.from.includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status.replaceAll('_', ' ')} visit can't move to ${args.to.replaceAll('_', ' ')}.`, { currentStatus: ctx.status, currentVersion: ctx.version, to: args.to })
    if (['en_route', 'on_site'].includes(ctx.status) && args.to === 'cancelled' && !dispatcher) throw new DomainError(Codes.NOT_AUTHORIZED, 'Only a dispatcher can cancel a visit that is under way.')
    if (args.to === 'done') await assertChecklistsDone(tx, ctx.id)
    // I-E6: work the buyer can still cancel doesn't start inside the cooling-off window.
    if (args.to === 'working' && ctx.job) await assertCanStartWork(tx, ctx.job.id, uow.now)

    const data: Record<string, unknown> = {}
    if (args.to === 'on_site') data.actualArrivalAt = clientAt ?? uow.now
    if (args.to === 'done') data.actualDoneAt = clientAt ?? uow.now
    if (args.to === 'cancelled') data.cancelReason = args.reason
    const version = await casUpdate(uow, { model: 'Visit', id: ctx.id, version: ctx.version, from: [ctx.status], to: args.to, actor, eventType: `visit.${args.to}`, reason: args.reason ?? null, data })
    await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: userId, fromStatus: ctx.status, toStatus: args.to, kind: 'transition', occurredAt: uow.now, clientRecordedAt: clientAt, idempotencyKey: deviceKey ?? `server:${idempotencyKey}`, lat: args.lat ?? null, lng: args.lng ?? null, note: args.reason ?? '' } })

    if (args.to === 'cancelled') await freeVisitCapacity(uow, ctx)
    // The job follows its visits.
    if (ctx.job) await rollJob(uow, actor, ctx.job.id, args.to === 'no_access' ? 'access' : null)
    return { visitId: ctx.id, status: args.to, version }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * The assigned tech (or a dispatcher) records the job type's checklist for a visit. Every item needs an
 * answer; the template version is frozen on the response so later edits to the template don't rewrite it.
 */
export async function submitChecklist(db: Db, actor: Actor, args: { visitId: string; answers: Record<string, unknown>; idempotencyKey: string; now?: Date }) {
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not fill in visit checklists.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'visit.checklist', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const visit = await tx.visit.findUnique({ where: { id: args.visitId }, select: { id: true, status: true, job: { select: { jobType: { select: { checklistTemplate: { select: { id: true, name: true, items: true, templateVersion: true } } } } } } } })
    if (!visit) throw new DomainError(Codes.NOT_FOUND, 'Visit not found.')
    const userId = actorUserId(actor)
    const assigned = userId ? await tx.visitAssignment.count({ where: { visitId: visit.id, active: true, employee: { user: { id: userId } } } }) : 0
    if (!(can(actor, 'canDispatch') || (assigned > 0 && can(actor, 'canWorkVisits')))) throw new DomainError(Codes.NOT_AUTHORIZED, 'Only the assigned technician or a dispatcher can do this.')
    if (!['on_site', 'working', 'paused'].includes(visit.status)) throw new DomainError(Codes.INVALID_TRANSITION, 'Fill in the checklist on site.', { currentStatus: visit.status })
    const template = visit.job?.jobType?.checklistTemplate
    if (!template) throw new DomainError(Codes.INVALID_INPUT, 'This job type has no checklist.', { field: 'visitId' })
    const items = Array.isArray(template.items) ? (template.items as { key: string; label: string }[]) : []
    const answers: Record<string, string> = {}
    for (const item of items) {
      const value = args.answers?.[item.key]
      if (typeof value !== 'string' || !value.trim()) throw new DomainError(Codes.INVALID_INPUT, `Answer "${item.label}".`, { field: item.key })
      answers[item.key] = value.trim().slice(0, 500)
    }
    const row = await tx.checklistResponse.create({ data: { visitId: visit.id, templateId: template.id, templateVersion: template.templateVersion, answers, completedById: userId, completedAt: uow.now }, select: { id: true } })
    auditCreate(uow, actor, 'ChecklistResponse', row.id, 'visit.checklist_completed', { visitId: visit.id, templateId: template.id, templateVersion: template.templateVersion })
    return { checklistResponseId: row.id, visitId: visit.id }
  })
  return { replay: result.replay, ...result.value }
}

async function assertChecklistsDone(tx: Tx, visitId: string) {
  const visit = await tx.visit.findUnique({ where: { id: visitId }, select: { job: { select: { jobType: { select: { checklistTemplate: { select: { id: true, required: true, name: true } } } } } } } })
  const template = visit?.job?.jobType?.checklistTemplate
  if (!template?.required) return
  const done = await tx.checklistResponse.count({ where: { visitId, templateId: template.id } })
  if (!done) throw new DomainError(Codes.GUARD_FAILED, `Finish the ${template.name} checklist first.`, { reason: 'checklist_missing' })
}

async function freeVisitCapacity(uow: UnitOfWork, ctx: VisitContext) {
  if (!ctx.windowId) return
  const usage = await uow.tx.capacityUsage.findMany({ where: { visitId: ctx.id }, select: { id: true, hours: true } })
  if (!usage.length) return
  const total = toScale(decSum(usage.map(u => u.hours.toString())), 'qty')
  await uow.tx.$executeRaw`UPDATE "ArrivalWindow" SET "bookedHours" = GREATEST(0, "bookedHours" - ${total}::numeric), version = version + 1, "updatedAt" = now() WHERE id = ${ctx.windowId}`
  await uow.tx.capacityUsage.deleteMany({ where: { visitId: ctx.id } })
}

/** Job status follows its visits (SM§3): scheduled → in_progress on first work; on_hold(access) on no-access. */
async function rollJob(uow: UnitOfWork, actor: Actor, jobId: string, holdReason: string | null) {
  const job = await uow.tx.job.findUnique({ where: { id: jobId }, select: { id: true, status: true, version: true, visits: { select: { status: true } } } })
  if (!job) return
  const statuses = job.visits.map(v => v.status)
  if (holdReason && ['booked', 'scheduled', 'in_progress'].includes(job.status)) {
    await casUpdate(uow, { model: 'Job', id: job.id, version: job.version, from: [job.status], to: 'on_hold', actor, eventType: 'job.on_hold', reason: holdReason, data: { holdReason, statusBeforeHold: job.status } })
    await uow.tx.task.create({ data: { kind: 'job.no_access', title: `No access on ${job.id.slice(-6)}: call the customer and rebook`, subjectType: 'Job', subjectId: job.id, status: 'open', priority: 'high', dueAt: new Date(uow.now.getTime() + 4 * 3600_000), dedupeKey: `job.no_access:${job.id}:${job.version}` } })
    return
  }
  if (job.status === 'scheduled' && statuses.some(s => ['working', 'paused', 'done'].includes(s))) {
    await casUpdate(uow, { model: 'Job', id: job.id, version: job.version, from: ['scheduled'], to: 'in_progress', actor, eventType: 'job.in_progress' })
    return
  }
  if (job.status === 'booked' && statuses.some(s => s !== 'unassigned' && s !== 'cancelled')) {
    await casUpdate(uow, { model: 'Job', id: job.id, version: job.version, from: ['booked'], to: 'scheduled', actor, eventType: 'job.scheduled' })
  }
}

// ---------------------------------------------------------------------------------------------
// Job transitions

export async function holdJob(db: Db, actor: Actor, args: { jobId: string; expectedVersion: number; reason: string; followUpOn: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'job.hold', ['canDispatch', 'canBook'], args)
  const reasons = ['parts', 'customer_decision', 'financing', 'permit', 'authorization', 'access', 'other']
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Hold reason must be one of ${reasons.join(', ')}.`, { field: 'reason' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.followUpOn)) throw new DomainError(Codes.INVALID_INPUT, 'Pick a follow-up date.', { field: 'followUpOn' })
  const result = await command(db, { name: 'job.hold', actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion, reason: args.reason, followUpOn: args.followUpOn }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number; ref: string }>(uow, {
      model: 'Job', id: args.jobId, from: ['booked', 'scheduled', 'in_progress'], to: 'on_hold', expectedVersion: args.expectedVersion, actor, eventType: 'job.on_hold', reason: args.reason,
      data: row => ({ holdReason: args.reason, statusBeforeHold: row.status, holdFollowUpOn: new Date(`${args.followUpOn}T00:00:00Z`) }),
    })
    await uow.tx.task.create({ data: { kind: 'job.hold_follow_up', title: `Follow up on ${row.ref} (${args.reason.replaceAll('_', ' ')})`, subjectType: 'Job', subjectId: args.jobId, status: 'open', priority: 'normal', dueAt: new Date(`${args.followUpOn}T15:00:00Z`), dedupeKey: `job.hold:${args.jobId}:${row.version}` } })
    return { jobId: args.jobId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function releaseJobHold(db: Db, actor: Actor, args: { jobId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'job.release_hold', ['canDispatch', 'canBook'], args)
  const result = await command(db, { name: 'job.release_hold', actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const job = await uow.tx.job.findUnique({ where: { id: args.jobId }, select: { statusBeforeHold: true } })
    const back = job?.statusBeforeHold && ['booked', 'scheduled', 'in_progress'].includes(job.statusBeforeHold) ? job.statusBeforeHold : 'booked'
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Job', id: args.jobId, from: ['on_hold'], to: back, expectedVersion: args.expectedVersion, actor, eventType: 'job.hold_released', data: { holdReason: '', statusBeforeHold: '' } })
    return { jobId: args.jobId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function cancelJob(db: Db, actor: Actor, args: { jobId: string; expectedVersion: number; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'job.cancel', ['canDispatch', 'canBook'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not cancel jobs; hand the call to a person.')
  const reasons = ['customer_request', 'duplicate', 'no_access', 'out_of_area', 'scheduling', 'weather', 'other']
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Cancel reason must be one of ${reasons.join(', ')}.`, { field: 'reason' })
  const result = await command(db, { name: 'job.cancel', actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Job', id: args.jobId, from: ['draft', 'booked', 'scheduled', 'on_hold'], to: 'cancelled', expectedVersion: args.expectedVersion, actor, eventType: 'job.cancelled', reason: args.reason, data: { cancelReason: args.reason } })
    const visits = await uow.tx.visit.findMany({ where: { jobId: args.jobId, status: { notIn: ['done', 'cancelled', 'no_access'] } }, select: { id: true } })
    for (const v of visits) {
      const ctx = await loadVisitContext(uow.tx, v.id)
      if (['en_route', 'on_site', 'working', 'paused'].includes(ctx.status)) throw new DomainError(Codes.GUARD_FAILED, `Visit ${ctx.ref} is under way. Finish or cancel it from the board first.`, { reason: 'visit_active' })
      await casUpdate(uow, { model: 'Visit', id: ctx.id, version: ctx.version, from: [ctx.status], to: 'cancelled', actor, eventType: 'visit.cancelled', reason: args.reason, data: { cancelReason: args.reason } })
      await uow.tx.visitAssignment.updateMany({ where: { visitId: ctx.id, active: true }, data: { active: false, endedAt: uow.now } })
      await uow.tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: actorUserId(actor), fromStatus: ctx.status, toStatus: 'cancelled', kind: 'transition', occurredAt: uow.now, idempotencyKey: `server:${args.idempotencyKey}:${ctx.id}`, note: args.reason } })
      await freeVisitCapacity(uow, ctx)
    }
    return { jobId: args.jobId, status: row.status, version: row.version, visitsCancelled: visits.length }
  })
  return { replay: result.replay, ...result.value }
}

// ---------------------------------------------------------------------------------------------
// Recommendation

export async function recommendDispatch(db: Db, actor: Actor, args: { visitId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'dispatch.recommend', ['canDispatch', 'canViewBoard'], args)
  const ctx = await loadVisitContext(db, args.visitId)
  if (!['unassigned', 'scheduled'].includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status} visit is past recommending.`, { currentStatus: ctx.status })
  const date = visitDate(ctx)
  const startsAt = ctx.window?.startsAt ?? ctx.plannedStart ?? new Date()
  const endsAt = ctx.window?.endsAt ?? new Date(startsAt.getTime() + 2 * 3600_000)
  const req = requirementOf(ctx)
  const pool = await db.employee.findMany({
    where: { status: 'active', dispatchable: true, kind: { in: ['technician', 'apprentice'] }, ...(ctx.job?.businessUnitId ? { businessUnits: { some: { id: ctx.job.businessUnitId } } } : {}) },
    select: { id: true, displayName: true, lat: true, lng: true, skills: { select: { id: true } } },
    take: 40,
  })
  const ids = pool.map(p => p.id)
  const dayStart = new Date(`${date}T00:00:00Z`)
  const [shifts, assignments, history] = await Promise.all([
    db.shift.findMany({ where: { employeeId: { in: ids }, date: dayStart }, select: { employeeId: true, startsAt: true, endsAt: true } }),
    db.visitAssignment.findMany({ where: { employeeId: { in: ids }, active: true, visit: { window: { date: dayStart }, status: { in: ACTIVE_VISIT } } }, select: { employeeId: true, visit: { select: { id: true, capacityHours: true, window: { select: { startsAt: true, endsAt: true } } } } } }),
    ctx.job?.location?.id ? db.visitAssignment.findMany({ where: { employeeId: { in: ids }, visit: { status: 'done', job: { locationId: ctx.job.location.id } } }, select: { employeeId: true } }) : Promise.resolve([]),
  ])
  // Each candidate alone is evaluated for eligibility (a crew evaluation happens at assign time).
  const [licensing, licenses, crewRows] = await Promise.all([licensingFor(db, ctx, date), companyLicenses(db, date), loadCrew(db, ids)])
  const candidates: Candidate[] = pool.map(p => {
    const row = crewRows.find(r => r.id === p.id)!
    const solo = evaluateEligibility({ date, requirement: { ...req, jobCoolingTons: null }, rules: licensing.rules, companyLicenses: licenses, crew: [toMember(row, 'lead')] })
    const mine = assignments.filter(a => a.employeeId === p.id && a.visit?.id !== ctx.id)
    return {
      employeeId: p.id, name: p.displayName, eligible: solo.eligible, eligibilityCodes: [...new Set(findingCodes(solo))],
      driveMinutes: driveMinutes(p.lat ? { lat: p.lat.toString(), lng: p.lng?.toString() ?? null } : null, ctx.job?.location?.lat ? { lat: ctx.job.location.lat.toString(), lng: ctx.job.location.lng?.toString() ?? null } : null),
      skillsMatched: req.skillIds.filter(id => p.skills.some(s => s.id === id)).length, skillsRequired: req.skillIds.length,
      priorVisitsHere: history.filter(h => h.employeeId === p.id).length,
      assignedHoursToday: toScale(decSum(mine.map(a => a.visit?.capacityHours?.toString() ?? '0')), 'qty'),
      onShift: shifts.some(s => s.employeeId === p.id && s.startsAt <= startsAt && s.endsAt >= endsAt),
      overlaps: mine.filter(a => a.visit?.window && a.visit.window.startsAt < endsAt && a.visit.window.endsAt > startsAt).length,
    }
  })
  const ranked = rankCandidates(candidates).slice(0, 10)
  const features = { model: DISPATCH_MODEL, features: DISPATCH_FEATURES, date, window: ctx.window?.label ?? null, requirement: req, licensingVersionId: licensing.versionId }
  const inputsHash = createHash('sha256').update(canonicalJson({ visitId: ctx.id, visitVersion: ctx.version, candidates })).digest('hex')

  const result = await command(db, { name: 'dispatch.recommend', actor, idempotencyKey: args.idempotencyKey, params: { visitId: args.visitId }, now: args.now }, async uow => {
    const rec = await uow.tx.dispatchRecommendation.create({
      data: { visitId: ctx.id, rankedCandidates: ranked as never, inputsHash, features: features as never, modelRef: DISPATCH_MODEL, generatedById: actorAgentId(actor), requestedById: actorUserId(actor), decision: 'proposed' },
      select: { id: true, version: true },
    })
    auditCreate(uow, actor, 'DispatchRecommendation', rec.id, 'dispatch_recommendation.proposed', { visitId: ctx.id, top: ranked.slice(0, 3).map(r => ({ employeeId: r.employeeId, score: r.score, eligible: r.eligible })), inputsHash })
    const value = { recommendationId: rec.id, visitId: ctx.id, visitVersion: ctx.version, modelRef: DISPATCH_MODEL, candidates: ranked.map(r => ({ employeeId: r.employeeId, name: r.name, rank: r.rank, eligible: r.eligible, score: r.score, explanation: r.explanation })) }
    await recordAgentAction(uow, actor, { tool: 'dispatch.recommend', idempotencyKey: args.idempotencyKey, inputs: { visitId: args.visitId }, output: { recommendationId: rec.id } })
    return value
  })
  return { replay: result.replay, ...result.value }
}

/** Read-only eligibility check for the board (no state change). */
export async function checkEligibility(db: Db, actor: Actor, args: { visitId: string; employeeIds: string[] }) {
  await authorizeOperation(db, actor, 'dispatch.eligibility', ['canDispatch', 'canViewBoard'], args)
  const ctx = await loadVisitContext(db, args.visitId)
  const crew = args.employeeIds.map((id, i) => ({ employeeId: id, role: (i === 0 ? 'lead' : 'helper') as CrewMember['role'] }))
  const { result, policyVersionId, date } = await evaluateCrew(db, ctx, crew)
  await recordAgentRead(db, actor, { tool: 'dispatch.eligibility', inputs: args, output: { eligible: result.eligible } })
  return { eligible: result.eligible, date, policyVersionId, crewFindings: result.crewFindings, perEmployee: result.perEmployee }
}
