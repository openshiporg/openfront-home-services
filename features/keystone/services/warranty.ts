import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import { addDays } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { Permission } from '../access'
import { requestApproval, consumeApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { asDate, companyToday, dayOf } from './billingShared'
import { decimal } from './inventory'
import { createHash } from 'node:crypto'

/*
 * Equipment and warranty (STATE-MACHINES §11). Nothing is sent to a manufacturer. A registration is a deadline with a packet staff copy
 * into the maker's portal; the confirmation number comes back by hand. A claim is drafted, checked, then submitted by a person who
 * holds canSubmitWarrantyClaims, and the maker's claim number is recorded by hand. A registration that passes its deadline becomes
 * `overdue` when any page or command next looks (advanceWarrantyStates, plugged into runMaintenancePass); it stays on the list until
 * it is submitted, and the database refuses to delete or reset it (I-W1).
 */

const EQUIP: Permission[] = ['canManageEquipment']
const CLAIM: Permission[] = ['canSubmitWarrantyClaims']
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')
const addYears = (day: string, years: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + years); return d.toISOString().slice(0, 10) }
const str = (v: unknown, field: string, max = 200, required = false) => {
  const s = String(v ?? '').trim()
  if (required && !s) throw new DomainError(Codes.INVALID_INPUT, `${field} is needed.`, { field })
  if (s.length > max) throw new DomainError(Codes.INVALID_INPUT, `${field} is too long.`, { field })
  return s
}
const day = (v: unknown, field: string) => {
  if (v == null || v === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new DomainError(Codes.INVALID_INPUT, `${field} is a date (YYYY-MM-DD).`, { field })
  return String(v)
}

// ── Equipment ────────────────────────────────────────────────────────────────────────────────────────────────────

export type EquipmentInput = {
  locationId: string; manufacturer: string; modelNumber: string; serialNumber: string; kind?: string; applianceClass?: string
  tonnage?: string | null; refrigerantType?: string | null; refrigerantChargeLb?: string | null; installDate?: string | null; manufactureDate?: string | null
  locationInHome?: string | null; installedByJobId?: string | null; source?: string
}

/** A technician records equipment only at a home of one of their own jobs; the office records it anywhere. */
async function requireEquipmentAccess(tx: Tx, actor: Actor, locationId: string) {
  if (actor.kind !== 'user') return
  if (actor.permissions.has('canManageEquipment') || actor.permissions.has('canDispatch')) return
  if (actor.permissions.has('canWorkVisits')) {
    const mine = await tx.job.count({ where: { locationId, visits: { some: { assignments: { some: { active: true, employee: { userId: actor.userId } } } } } } })
    if (mine) return
  }
  throw new DomainError(Codes.NOT_AUTHORIZED, 'That is not a home you are working at.')
}

export async function recordEquipment(db: Db, actor: Actor, args: EquipmentInput & { idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'equipment.record', [...EQUIP, 'canWorkVisits'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'equipment.record', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    await requireEquipmentAccess(tx, actor, args.locationId)
    const loc = await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true } })
    if (!loc) throw new DomainError(Codes.NOT_FOUND, 'That service location does not exist.')
    const serial = str(args.serialNumber, 'serialNumber', 80, true)
    const manufacturer = str(args.manufacturer, 'manufacturer', 80, true)
    const dup = await tx.installedEquipment.findFirst({ where: { manufacturer: { equals: manufacturer, mode: 'insensitive' }, serialNumber: serial, status: 'active' }, select: { id: true, locationId: true } })
    if (dup) throw new DomainError(Codes.GUARD_FAILED, 'That serial number is already recorded on active equipment.', { reason: 'duplicate_serial', equipmentId: dup.id })
    const ref = await nextReference(tx, 'EQP', uow.now)
    const charge = args.refrigerantChargeLb ? decimal(args.refrigerantChargeLb, 'refrigerantChargeLb', { positive: true }) : null
    const row = await tx.installedEquipment.create({
      data: {
        ref, locationId: args.locationId, manufacturer, modelNumber: str(args.modelNumber, 'modelNumber', 80, true), serialNumber: serial, kind: args.kind ?? 'other', applianceClass: args.applianceClass ?? 'residential_ac',
        tonnage: args.tonnage ? decimal(args.tonnage, 'tonnage', { positive: true }) : null, refrigerantType: str(args.refrigerantType, 'refrigerantType', 40), refrigerantChargeLb: charge,
        installDate: args.installDate ? asDate(day(args.installDate, 'installDate')!) : null, manufactureDate: args.manufactureDate ? asDate(day(args.manufactureDate, 'manufactureDate')!) : null,
        locationInHome: str(args.locationInHome, 'locationInHome', 120), installedById: args.installedByJobId ?? null, source: args.source ?? 'recorded_on_visit', status: 'active',
      },
      select: { id: true },
    })
    auditCreate(uow, actor, 'InstalledEquipment', row.id, 'equipment.recorded', { ref, manufacturer, serial })
    const registration = args.installDate ? await ensureRegistration(uow, actor, row.id) : null
    return { equipmentId: row.id, ref, registrationId: registration }
  })
  return { replay: result.replay, ...result.value }
}

export async function recordReading(db: Db, actor: Actor, args: { equipmentId: string; visitId?: string | null; kind: string; value: string; unit?: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'equipment.reading', [...EQUIP, 'canWorkVisits'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'equipment.reading', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const eq = await tx.installedEquipment.findUnique({ where: { id: args.equipmentId }, select: { id: true, locationId: true } })
    if (!eq?.locationId) throw new DomainError(Codes.NOT_FOUND, 'That equipment does not exist.')
    await requireEquipmentAccess(tx, actor, eq.locationId)
    const row = await tx.equipmentReading.create({ data: { equipmentId: eq.id, visitId: args.visitId ?? null, kind: str(args.kind, 'kind', 60, true), value: decimal(args.value, 'value'), unit: str(args.unit, 'unit', 20), recordedById: actorUserId(actor), recordedAt: uow.now }, select: { id: true } })
    return { readingId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Retire equipment. The new unit, if any, is named; the old record and its history stay. */
export async function replaceEquipment(db: Db, actor: Actor, args: { equipmentId: string; replacedById?: string | null; status: 'replaced' | 'removed' | 'decommissioned'; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'equipment.retire', EQUIP, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'equipment.retire', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'InstalledEquipment', id: args.equipmentId, version: args.expectedVersion, from: ['active'], to: args.status, actor, eventType: `equipment.${args.status}`, data: { replacedById: args.replacedById ?? null } })
    return { status: args.status, version: v }
  })
  return { replay: result.replay, ...result.value }
}

// ── Registrations ────────────────────────────────────────────────────────────────────────────────────────────────

async function ruleFor(tx: Tx, manufacturer: string | null) {
  const name = (manufacturer ?? '').trim()
  return name ? tx.warrantyRule.findFirst({ where: { manufacturer: { equals: name, mode: 'insensitive' } }, select: { id: true, registrationDeadlineDays: true } }) : null
}

/** Make sure installed equipment with a known install date and a known maker has one registration, due on the maker's deadline. */
async function ensureRegistration(uow: { tx: Tx; now: Date; audit: unknown } & Record<string, any>, actor: Actor, equipmentId: string) {
  const tx = uow.tx as Tx
  const eq = await tx.installedEquipment.findUnique({ where: { id: equipmentId }, select: { id: true, manufacturer: true, installDate: true } })
  if (!eq?.installDate) return null
  const rule = await ruleFor(tx, eq.manufacturer)
  if (!rule) return null
  const existing = await tx.warrantyRegistration.findFirst({ where: { equipmentId }, select: { id: true } })
  if (existing) return existing.id
  const deadline = addDays(ymd(eq.installDate), rule.registrationDeadlineDays ?? 90)
  const ref = await nextReference(tx, 'WRG', uow.now)
  const today = await companyToday(tx, uow.now)
  const row = await tx.warrantyRegistration.create({ data: { ref, equipmentId, ruleId: rule.id, deadline: asDate(deadline), status: deadline < today ? 'overdue' : 'due', overdueSince: deadline < today ? uow.now : null }, select: { id: true } })
  auditCreate(uow as never, actor, 'WarrantyRegistration', row.id, 'warranty_registration.created', { ref, deadline })
  if (deadline < today) await tx.task.upsert({ where: { dedupeKey: `warranty.registration_overdue:${row.id}` }, update: {}, create: { kind: 'warranty.registration_overdue', title: `Warranty registration is overdue (${ref})`, subjectType: 'WarrantyRegistration', subjectId: row.id, status: 'open', priority: 'high', dedupeKey: `warranty.registration_overdue:${row.id}` } })
  return row.id
}

/**
 * Time-based, no timer: any registration past its deadline and not yet submitted becomes overdue (with a Task), idempotently.
 * Plugged into runMaintenancePass and the staff Refresh button. Never deletes, never resets.
 */
export async function advanceWarrantyStates(db: Db, now: Date) {
  const today = await companyToday(db as never, now)
  const due = await db.warrantyRegistration.findMany({ where: { status: 'due', deadline: { lt: asDate(today) } }, select: { id: true, ref: true, version: true } })
  let overdue = 0
  for (const r of due) {
    const changed = await db.warrantyRegistration.updateMany({ where: { id: r.id, status: 'due', version: r.version }, data: { status: 'overdue', overdueSince: now, version: { increment: 1 } } })
    if (!changed.count) continue
    overdue += 1
    await db.task.upsert({ where: { dedupeKey: `warranty.registration_overdue:${r.id}` }, update: {}, create: { kind: 'warranty.registration_overdue', title: `Warranty registration is overdue (${r.ref})`, subjectType: 'WarrantyRegistration', subjectId: r.id, status: 'open', priority: 'high', dedupeKey: `warranty.registration_overdue:${r.id}` } })
  }
  return { overdue }
}

export async function ensureRegistrationFor(db: Db, actor: Actor, args: { equipmentId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.registration_ensure', [...EQUIP, ...CLAIM], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.registration_ensure', actor, idempotencyKey, params, now: args.now }, async uow => {
    const id = await ensureRegistration(uow as never, actor, args.equipmentId)
    if (!id) throw new DomainError(Codes.GUARD_FAILED, 'There is no warranty rule for this maker, or the install date is missing.', { reason: 'no_rule' })
    return { registrationId: id }
  })
  return { replay: result.replay, ...result.value }
}

/** The packet staff copy into the manufacturer's registration portal. Nothing is sent. */
export async function registrationPacket(db: Db, registrationId: string) {
  const r = await db.warrantyRegistration.findUnique({
    where: { id: registrationId },
    select: { ref: true, deadline: true, status: true, rule: { select: { manufacturer: true, portalUrl: true } }, equipment: { select: { manufacturer: true, modelNumber: true, serialNumber: true, installDate: true, location: { select: { address1: true, city: true, state: true, postalCode: true, customer: { select: { displayName: true } } } } } } },
  })
  if (!r) return null
  const e = r.equipment
  return { ref: r.ref, status: r.status, deadline: ymd(r.deadline), portalUrl: r.rule?.portalUrl ?? '', manufacturer: r.rule?.manufacturer ?? e?.manufacturer ?? '', fields: [
    ['Model', e?.modelNumber ?? ''], ['Serial', e?.serialNumber ?? ''], ['Install date', ymd(e?.installDate)],
    ['Owner', (e?.location as any)?.customer?.displayName ?? ''], ['Address', [e?.location?.address1, e?.location?.city, e?.location?.state, e?.location?.postalCode].filter(Boolean).join(', ')],
  ] as [string, string][] }
}

/** Staff typed the packet into the portal; record it. A late submit from `overdue` is allowed and keeps overdueSince. */
export async function markRegistrationSubmitted(db: Db, actor: Actor, args: { registrationId: string; confirmationNumber?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.registration_submit', [...EQUIP, ...CLAIM], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.registration_submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const conf = str(args.confirmationNumber, 'confirmationNumber', 80)
    const v = await casUpdate(uow, { model: 'WarrantyRegistration', id: args.registrationId, version: args.expectedVersion, from: ['due', 'overdue'], to: conf ? 'confirmed' : 'submitted', actor, eventType: conf ? 'warranty_registration.confirmed' : 'warranty_registration.submitted', data: { confirmationNumber: conf, submittedById: actorUserId(actor), submittedAt: uow.now } })
    await uow.tx.task.updateMany({ where: { dedupeKey: `warranty.registration_overdue:${args.registrationId}`, status: 'open' }, data: { status: 'done', closedAt: uow.now, resolution: 'submitted' } })
    await writeCoverage(uow.tx, args.registrationId)
    return { status: conf ? 'confirmed' : 'submitted', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function confirmRegistration(db: Db, actor: Actor, args: { registrationId: string; confirmationNumber: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.registration_confirm', [...EQUIP, ...CLAIM], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.registration_confirm', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'WarrantyRegistration', id: args.registrationId, version: args.expectedVersion, from: ['submitted'], to: 'confirmed', actor, eventType: 'warranty_registration.confirmed', data: { confirmationNumber: str(args.confirmationNumber, 'confirmationNumber', 80, true) } })
    await writeCoverage(uow.tx, args.registrationId)
    return { status: 'confirmed', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Parts cover longer when registered in time; labour is the rule's labour years from install. */
async function writeCoverage(tx: Tx, registrationId: string) {
  const r = await tx.warrantyRegistration.findUnique({ where: { id: registrationId }, select: { id: true, equipmentId: true, deadline: true, submittedAt: true, rule: { select: { manufacturer: true, partsYearsRegistered: true, partsYearsUnregistered: true, laborYears: true } }, equipment: { select: { installDate: true } } } })
  if (!r?.equipmentId || !r.rule || !r.equipment?.installDate) return
  const install = ymd(r.equipment.installDate)
  const onTime = !!r.submittedAt && ymd(r.submittedAt) <= ymd(r.deadline)
  const parts = onTime ? r.rule.partsYearsRegistered : r.rule.partsYearsUnregistered
  const labor = r.rule.laborYears
  const have = new Set((await tx.warrantyCoverage.findMany({ where: { equipmentId: r.equipmentId, registrationId }, select: { kind: true } })).map(c => c.kind))
  if (!have.has('manufacturer_parts')) await tx.warrantyCoverage.create({ data: { equipmentId: r.equipmentId, kind: 'manufacturer_parts', startsOn: asDate(install), endsOn: asDate(addYears(install, parts ?? 5)), provider: r.rule.manufacturer, registrationId } })
  if (!have.has('manufacturer_labor') && (labor ?? 0) > 0) await tx.warrantyCoverage.create({ data: { equipmentId: r.equipmentId, kind: 'manufacturer_labor', startsOn: asDate(install), endsOn: asDate(addYears(install, labor ?? 1)), provider: r.rule.manufacturer, registrationId } })
}

// ── Claims ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type ClaimDraft = { failedPart?: string; failureDate?: string | null; replacementSerial?: string; laborHours?: string | null; claimedMinor?: string; claimant?: 'manufacturer' | 'distributor'; distributorId?: string | null; replacementItemId?: string | null }

export async function openClaim(db: Db, actor: Actor, args: { equipmentId: string; jobId?: string | null; draft?: ClaimDraft; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_open', [...CLAIM, 'canManageEquipment'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_open', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const eq = await tx.installedEquipment.findUnique({ where: { id: args.equipmentId }, select: { id: true, manufacturer: true } })
    if (!eq) throw new DomainError(Codes.NOT_FOUND, 'That equipment does not exist.')
    const rule = await ruleFor(tx, eq.manufacturer)
    const ref = await nextReference(tx, 'WCL', uow.now)
    const d = args.draft ?? {}
    const row = await tx.warrantyClaim.create({
      data: { ref, equipmentId: eq.id, jobId: args.jobId ?? null, ruleId: rule?.id ?? null, status: 'draft', draftedById: actor.kind === 'user' ? actor.userId : null, draftedByAgentId: actor.kind === 'agent' ? actor.agentId : null, ...claimData(d) },
      select: { id: true },
    })
    auditCreate(uow, actor, 'WarrantyClaim', row.id, 'warranty_claim.opened', { ref, equipmentId: eq.id })
    return { claimId: row.id, ref }
  })
  return { replay: result.replay, ...result.value }
}

function claimData(d: ClaimDraft) {
  const data: Record<string, unknown> = {}
  if (d.failedPart !== undefined) data.failedPart = str(d.failedPart, 'failedPart', 160)
  if (d.failureDate !== undefined) data.failureDate = d.failureDate ? asDate(day(d.failureDate, 'failureDate')!) : null
  if (d.replacementSerial !== undefined) data.replacementSerial = str(d.replacementSerial, 'replacementSerial', 80)
  if (d.laborHours !== undefined) data.laborHours = d.laborHours ? decimal(d.laborHours, 'laborHours', { positive: true }) : null
  if (d.claimedMinor !== undefined) { if (!/^\d{1,10}$/.test(String(d.claimedMinor))) throw new DomainError(Codes.INVALID_INPUT, 'The claimed amount is whole cents.', { field: 'claimedMinor' }); data.claimedMinor = BigInt(d.claimedMinor) }
  if (d.claimant) data.claimant = d.claimant
  if (d.distributorId !== undefined) data.distributorId = d.distributorId
  if (d.replacementItemId !== undefined) data.replacementItemId = d.replacementItemId
  return data
}

export async function saveClaimDraft(db: Db, actor: Actor, args: { claimId: string; draft: ClaimDraft; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_save', [...CLAIM, 'canManageEquipment'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from: ['draft', 'ready', 'info_requested'], to: 'draft', actor, eventType: 'warranty_claim.saved', data: claimData(args.draft), audit: { fields: Object.keys(args.draft) } })
    return { version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** What a claim still lacks before it can be submitted (SM §11.3 guard). */
export async function claimGaps(tx: Tx | Db, claimId: string, today: string) {
  const c = await tx.warrantyClaim.findUnique({ where: { id: claimId }, select: { failedPart: true, failureDate: true, replacementSerial: true, laborHours: true, claimedMinor: true, equipment: { select: { serialNumber: true, modelNumber: true, installDate: true, from_WarrantyRegistration_equipment: { select: { status: true } }, from_WarrantyCoverage_equipment: { select: { kind: true, endsOn: true } } } }, evidence: { select: { id: true } } } })
  if (!c) throw new DomainError(Codes.NOT_FOUND, 'That claim does not exist.')
  const gaps: string[] = []
  if (!c.equipment?.serialNumber) gaps.push('Equipment serial number')
  if (!c.equipment?.modelNumber) gaps.push('Equipment model number')
  if (!c.equipment?.installDate) gaps.push('Install date')
  if (!c.failureDate) gaps.push('Failure date')
  if (!c.failedPart) gaps.push('Failed part')
  if (!c.replacementSerial) gaps.push('Replacement part serial number')
  if (!c.laborHours) gaps.push('Labour hours')
  if (!c.evidence.length) gaps.push('At least one photo')
  if (!c.equipment?.from_WarrantyRegistration_equipment.length) gaps.push('Warranty registration status')
  const covered = (c.equipment?.from_WarrantyCoverage_equipment ?? []).some(k => k.endsOn && ymd(k.endsOn) >= (c.failureDate ? ymd(c.failureDate) : today))
  return { gaps, covered, uncoveredNote: covered ? '' : 'No coverage on file for the failure date. The claim may be denied.' }
}

export async function markClaimReady(db: Db, actor: Actor, args: { claimId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_ready', [...CLAIM, 'canManageEquipment'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_ready', actor, idempotencyKey, params, now: args.now }, async uow => {
    const today = await companyToday(uow.tx, uow.now)
    const { gaps } = await claimGaps(uow.tx, args.claimId, today)
    if (gaps.length) throw new DomainError(Codes.GUARD_FAILED, `Still needed: ${gaps.join(', ')}.`, { reason: 'claim_incomplete', gaps })
    const claim = await uow.tx.warrantyClaim.findUnique({ where: { id: args.claimId }, select: { failureDate: true, rule: { select: { claimDeadlineDays: true } } } })
    const deadline = claim?.failureDate && claim.rule ? addDays(ymd(claim.failureDate), claim.rule.claimDeadlineDays ?? 60) : null
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from: ['draft', 'info_requested'], to: 'ready', actor, eventType: 'warranty_claim.ready', data: { deadline: deadline ? asDate(deadline) : null } })
    return { status: 'ready', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * Submit. A person holding canSubmitWarrantyClaims does this (an agent only drafts). Nothing leaves the system: this records that the
 * packet was entered in the portal, with a Task if it is not yet confirmed. Past the maker's deadline it is refused unless a reason is given.
 */
export async function submitClaim(db: Db, actor: Actor, args: { claimId: string; externalClaimNumber?: string | null; lateReason?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_submit', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const claim = await lockRow<{ id: string; deadline: Date | null; status: string }>(tx, 'WarrantyClaim', args.claimId)
    const today = await companyToday(tx, uow.now)
    const late = !!claim.deadline && ymd(claim.deadline) < today
    if (late && !str(args.lateReason, 'lateReason', 300)) throw new DomainError(Codes.GUARD_FAILED, 'The claim deadline has passed. Give a reason to submit anyway.', { reason: 'claim_deadline_passed', deadline: ymd(claim.deadline) })
    const number = str(args.externalClaimNumber, 'externalClaimNumber', 80)
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: claim.id, version: args.expectedVersion, from: ['ready'], to: 'submitted', actor, eventType: 'warranty_claim.submitted', reason: late ? args.lateReason : null, data: { submittedById: actorUserId(actor), externalClaimNumber: number }, metadata: { late } })
    if (!number) await tx.task.upsert({ where: { dedupeKey: `warranty.claim_number:${claim.id}` }, update: {}, create: { kind: 'warranty.claim_number', title: 'Enter the manufacturer\'s claim number once the portal gives it', subjectType: 'WarrantyClaim', subjectId: claim.id, status: 'open', priority: 'normal', dedupeKey: `warranty.claim_number:${claim.id}` } })
    return { status: 'submitted', version: v, late }
  })
  return { replay: result.replay, ...result.value }
}

export async function recordClaimNumber(db: Db, actor: Actor, args: { claimId: string; externalClaimNumber: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_number', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_number', actor, idempotencyKey, params, now: args.now }, async uow => {
    const n = str(args.externalClaimNumber, 'externalClaimNumber', 80, true)
    const c = await uow.tx.warrantyClaim.updateMany({ where: { id: args.claimId, status: { in: ['submitted', 'info_requested', 'approved', 'partially_approved'] } }, data: { externalClaimNumber: n } })
    if (!c.count) throw new DomainError(Codes.INVALID_TRANSITION, 'This claim is not with the manufacturer.')
    await uow.tx.task.updateMany({ where: { dedupeKey: `warranty.claim_number:${args.claimId}`, status: 'open' }, data: { status: 'done', closedAt: uow.now, resolution: 'recorded' } })
    uow.audit({ eventType: 'warranty_claim.number_recorded', entityType: 'WarrantyClaim', entityId: args.claimId, actorUserId: actorUserId(actor), after: { externalClaimNumber: n } })
    return { externalClaimNumber: n }
  })
  return { replay: result.replay, ...result.value }
}

const DECISIONS = { info_requested: ['submitted'], approved: ['submitted', 'info_requested'], partially_approved: ['submitted', 'info_requested'], denied: ['submitted', 'info_requested'] } as const

/** Record what the manufacturer decided. `recoveredMinor` is the amount they will pay; never more than was claimed. */
export async function recordClaimDecision(db: Db, actor: Actor, args: { claimId: string; decision: keyof typeof DECISIONS; recoveredMinor?: string; note?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_decision', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_decision', actor, idempotencyKey, params, now: args.now }, async uow => {
    const from = DECISIONS[args.decision]
    if (!from) throw new DomainError(Codes.INVALID_INPUT, 'Unknown decision.', { field: 'decision' })
    const claim = await uow.tx.warrantyClaim.findUnique({ where: { id: args.claimId }, select: { claimedMinor: true } })
    const rec = args.recoveredMinor ? BigInt(/^\d{1,10}$/.test(String(args.recoveredMinor)) ? args.recoveredMinor : '-1') : 0n
    if (rec < 0n) throw new DomainError(Codes.INVALID_INPUT, 'The amount is whole cents.', { field: 'recoveredMinor' })
    if (['approved', 'partially_approved'].includes(args.decision) && rec <= 0n) throw new DomainError(Codes.INVALID_INPUT, 'Enter the amount they will pay.', { field: 'recoveredMinor' })
    if (rec > (claim?.claimedMinor ?? 0n)) throw new DomainError(Codes.GUARD_FAILED, 'The manufacturer cannot pay more than was claimed.', { reason: 'over_recovery' })
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from, to: args.decision, actor, eventType: `warranty_claim.${args.decision}`, data: { recoveredMinor: rec, decisionNote: str(args.note, 'note', 300) } })
    return { status: args.decision, version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Settled: the distributor's credit memo or the maker's payment was seen. Closes the loop; a settled claim holds its RMA. */
export async function settleClaim(db: Db, actor: Actor, args: { claimId: string; evidence: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_settle', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_settle', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from: ['approved', 'partially_approved'], to: 'settled', actor, eventType: 'warranty_claim.settled', reason: str(args.evidence, 'evidence', 300, true) })
    return { status: 'settled', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function closeClaim(db: Db, actor: Actor, args: { claimId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_close', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_close', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from: ['settled'], to: 'closed', actor, eventType: 'warranty_claim.closed' })
    return { status: 'closed', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function appealClaim(db: Db, actor: Actor, args: { claimId: string; note: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_appeal', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_appeal', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: args.claimId, version: args.expectedVersion, from: ['denied'], to: 'submitted', actor, eventType: 'warranty_claim.appealed', reason: str(args.note, 'note', 300, true) })
    return { status: 'submitted', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** A denial that will not be appealed is written off. A second person (canApproveWarrantyWriteOff) approves it. */
export async function requestClaimWriteOff(db: Db, actor: Actor, args: { claimId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_writeoff_request', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_writeoff_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const c = await uow.tx.warrantyClaim.findUnique({ where: { id: args.claimId }, select: { id: true, status: true, claimedMinor: true, ref: true } })
    if (!c || c.status !== 'denied') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a denied claim is written off.')
    const req = await requestApproval(uow, actor, { action: 'warranty.write_off', targetList: 'WarrantyClaim', targetId: c.id, payload: { claimId: c.id, claimedMinor: String(c.claimedMinor), reason: str(args.reason, 'reason', 300, true) }, requiredPermission: 'canApproveWarrantyWriteOff', summary: `Write off ${c.ref}` })
    return { requestId: req.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function writeOffClaim(db: Db, actor: Actor, args: { claimId: string; requestId: string; reason: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'warranty.claim_writeoff', CLAIM, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'warranty.claim_writeoff', actor, idempotencyKey, params, now: args.now }, async uow => {
    const c = await uow.tx.warrantyClaim.findUnique({ where: { id: args.claimId }, select: { id: true, claimedMinor: true } })
    if (!c) throw new DomainError(Codes.NOT_FOUND, 'That claim does not exist.')
    const { approverId } = await consumeApproval(uow, { requestId: args.requestId, action: 'warranty.write_off', targetList: 'WarrantyClaim', targetId: c.id, payload: { claimId: c.id, claimedMinor: String(c.claimedMinor), reason: str(args.reason, 'reason', 300, true) } })
    const v = await casUpdate(uow, { model: 'WarrantyClaim', id: c.id, version: args.expectedVersion, from: ['denied'], to: 'closed', actor, eventType: 'warranty_claim.written_off', reason: args.reason, approverId })
    return { status: 'closed', version: v }
  })
  return { replay: result.replay, ...result.value }
}
registerApplier('warranty.write_off', async () => ({ ok: true }), { applyOnApprove: false })

// ── Home-warranty dispatches (a third-party payer; SM §11.4) ─────────────────────────────────────────────────────

export async function receiveHomeWarrantyDispatch(db: Db, actor: Actor, args: { payerId: string; externalDispatchNumber: string; jobId?: string | null; serviceFeeMinor?: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'home_warranty.receive', ['canManageInvoices', 'canDispatch', 'canBook'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'home_warranty.receive', actor, idempotencyKey, params, now: args.now }, async uow => {
    const n = str(args.externalDispatchNumber, 'externalDispatchNumber', 80, true)
    const prior = await uow.tx.homeWarrantyDispatch.findUnique({ where: { externalDispatchNumber: n }, select: { id: true } })
    if (prior) throw new DomainError(Codes.GUARD_FAILED, 'That dispatch number is already recorded.', { reason: 'duplicate_dispatch', dispatchId: prior.id })
    const fee = args.serviceFeeMinor ? BigInt(/^\d{1,9}$/.test(String(args.serviceFeeMinor)) ? args.serviceFeeMinor : '-1') : 0n
    if (fee < 0n) throw new DomainError(Codes.INVALID_INPUT, 'The service fee is whole cents.', { field: 'serviceFeeMinor' })
    const payer = await uow.tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true } })
    if (!payer) throw new DomainError(Codes.NOT_FOUND, 'That payer does not exist.')
    const row = await uow.tx.homeWarrantyDispatch.create({ data: { payerId: args.payerId, externalDispatchNumber: n, jobId: args.jobId ?? null, serviceFeeMinor: fee, status: 'dispatch_received' }, select: { id: true } })
    auditCreate(uow, actor, 'HomeWarrantyDispatch', row.id, 'home_warranty.received', { externalDispatchNumber: n })
    return { dispatchId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

const HW_NEXT: Record<string, string[]> = { dispatch_received: ['accepted', 'declined'], accepted: ['auth_requested'], auth_requested: ['authorized', 'cash_out_offered', 'denied'], authorized: ['invoiced'], cash_out_offered: ['invoiced', 'denied'], invoiced: ['paid'] }
export async function advanceHomeWarranty(db: Db, actor: Actor, args: { dispatchId: string; to: string; authorizedMinor?: string; note?: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'home_warranty.advance', ['canManageInvoices', 'canDispatch', 'canBook'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'home_warranty.advance', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockRow<{ status: string }>(uow.tx, 'HomeWarrantyDispatch', args.dispatchId)
    if (!(HW_NEXT[row.status] ?? []).includes(args.to)) throw new DomainError(Codes.INVALID_TRANSITION, `A dispatch that is ${row.status.replaceAll('_', ' ')} cannot move to ${args.to.replaceAll('_', ' ')}.`)
    const data: Record<string, unknown> = { note: str(args.note, 'note', 300) }
    if (args.to === 'authorized') {
      if (!args.authorizedMinor || !/^\d{1,9}$/.test(String(args.authorizedMinor))) throw new DomainError(Codes.INVALID_INPUT, 'Enter the authorised amount in cents.', { field: 'authorizedMinor' })
      data.authorizedMinor = BigInt(args.authorizedMinor)
    }
    const v = await casUpdate(uow, { model: 'HomeWarrantyDispatch', id: args.dispatchId, version: args.expectedVersion, from: [row.status], to: args.to, actor, eventType: `home_warranty.${args.to}`, data })
    return { status: args.to, version: v }
  })
  return { replay: result.replay, ...result.value }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Registrations with the overdue state worked out as of today, even if no pass has run: an overdue one never drops off. */
export async function registrationList(db: Db, now = new Date()) {
  const today = await companyToday(db as never, now)
  const rows = await db.warrantyRegistration.findMany({
    where: { status: { in: ['due', 'overdue', 'submitted'] } }, orderBy: { deadline: 'asc' }, take: 300,
    select: { id: true, ref: true, status: true, deadline: true, version: true, equipment: { select: { id: true, ref: true, manufacturer: true, modelNumber: true, serialNumber: true, location: { select: { address1: true, city: true } } } } },
  })
  return rows.map(r => ({ ...r, deadline: ymd(r.deadline), effectiveStatus: r.status === 'due' && ymd(r.deadline) < today ? 'overdue' : r.status, daysLeft: Math.round((Date.parse(`${ymd(r.deadline)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) }))
}

void dayOf


// ── Photo evidence ───────────────────────────────────────────────────────────────────────────────────────────────

export const CLAIM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
export const CLAIM_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/** A technician's own claims: ones they started, or on a job they are assigned to. */
export const ownClaimWhere = (userId: string) => ({ OR: [{ draftedById: userId }, { job: { visits: { some: { assignments: { some: { employee: { userId } } } } } } }] })

/** Office (claims, dispatch or billing roles) may see any claim; a technician (equipment permission) only a claim they started or on a job they are assigned to. */
export async function mayUseClaimPhotos(db: Db | Tx, actor: Actor, claimId: string) {
  if (actor.kind !== 'user') return false
  if (actor.permissions.has('canSubmitWarrantyClaims') || actor.permissions.has('canDispatch') || actor.permissions.has('canManageInvoices')) return true
  if (!actor.permissions.has('canManageEquipment')) return false
  const own = await (db as Db).warrantyClaim.count({ where: { id: claimId, ...ownClaimWhere(actor.userId) } })
  return own > 0
}

/** Attach one photo to a claim. The same photo sent twice is attached once. Only a draft or info-requested claim takes photos. */
export async function attachClaimPhoto(db: Db, actor: Actor, args: { claimId: string; filename: string; mimeType: string; bytes: Buffer; now?: Date }) {
  if (actor.kind !== 'user') throw new DomainError(Codes.NOT_AUTHORIZED, 'Photos are attached by a person.')
  if (!(await mayUseClaimPhotos(db, actor, args.claimId))) throw new DomainError(Codes.NOT_AUTHORIZED, 'You can attach photos to claims on your own jobs.')
  if (!(CLAIM_PHOTO_TYPES as readonly string[]).includes(args.mimeType)) throw new DomainError(Codes.INVALID_INPUT, 'A photo is a JPEG, PNG, WebP or HEIC file.', { field: 'file' })
  if (!args.bytes.length) throw new DomainError(Codes.INVALID_INPUT, 'That file is empty.', { field: 'file' })
  if (args.bytes.length > CLAIM_PHOTO_MAX_BYTES) throw new DomainError(Codes.INVALID_INPUT, 'That photo is over 5 MB. Send a smaller one.', { field: 'file' })
  const sha = createHash('sha256').update(args.bytes).digest('hex')
  const idempotencyKey = `claim-photo:${args.claimId}:${sha}`
  const result = await command(db, { name: 'warranty.claim_photo', actor, idempotencyKey, params: { claimId: args.claimId, sha256: sha, mimeType: args.mimeType }, now: args.now }, async uow => {
    const claim = await uow.tx.warrantyClaim.findUnique({ where: { id: args.claimId }, select: { id: true, status: true } })
    if (!claim) throw new DomainError(Codes.NOT_FOUND, 'That claim does not exist.')
    if (!['draft', 'info_requested'].includes(claim.status)) throw new DomainError(Codes.GUARD_FAILED, `This claim is ${claim.status}; photos are added before it is ready.`)
    const media = await uow.tx.media.create({
      data: { subjectType: 'WarrantyClaim', subjectId: claim.id, kind: 'photo', storageKey: `claims/${claim.id}/${sha.slice(0, 16)}-${args.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60)}`, sha256: sha, mimeType: args.mimeType, content: args.bytes.toString('base64'), capturedAt: uow.now, capturedById: actor.userId, visibility: 'internal' },
      select: { id: true },
    })
    await uow.tx.warrantyClaim.update({ where: { id: claim.id }, data: { evidence: { connect: { id: media.id } } } })
    auditCreate(uow, actor, 'WarrantyClaim', claim.id, 'warranty_claim.photo_attached', { mediaId: media.id, sha256: sha, bytes: args.bytes.length })
    return { mediaId: media.id }
  })
  return { replay: result.replay, ...result.value }
}
