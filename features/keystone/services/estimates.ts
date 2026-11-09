import { authorizeOperation, recordAgentAction, recordAgentRead } from '../lib/agentGate'
import { actorAgentId, actorUserId, can, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { auditCreate, casUpdate } from '../lib/cas'
import { command } from '../lib/command'
import { addDays, localDate, zonedInstant } from '../lib/calendar'
import { keyedPayloadHash, payloadHash } from '../lib/canonical'
import type { Db, Tx } from '../lib/db'
import { DomainError, Codes } from '../lib/errors'
import { nextReference, publicCode } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { OFFICE_READ } from '../models/scope'
import { DECLINE_REASONS, SALE_LOCATIONS } from '../models/sales'
import { resolvePolicyFromDb } from '../domain/policy'
import { PricingError, depositCap, estimateSalesTax, optionHash, optionTotals, type LineSnapshot, type SalesTaxRulesLike } from '../domain/pricing'
import { TX_HOMESTEAD_WARNING, TX_LIEN_DISCLOSURE } from '../domain/noticeTexts'
import { presentedLabel, renderEstimatePdf, type EstimateSnapshot } from '../../../lib/salesPdf'
import { activeVersionFor, quoteFromVersion, type QuoteRequestLine } from './pricebook'
import { evaluateSaleRights, type EmergencyWaiverInput } from './cancellation'
import { addressLine, placeOfLocation, sellerBlock, storeRenderedPdf } from './salesShared'

/*
 * Estimates (SM§6, I-E2..I-E5). A version is built as a draft from the ACTIVE price book; its option and
 * line rows can only change while it is a draft (database trigger). Presenting freezes it: the snapshot,
 * its hash and the PDF are what the customer sees and what an Authorization binds to. Selling one option
 * records the Authorization, creates the job's WorkLines, checks the deposit against the home-improvement
 * contract policy and evaluates the buyer's cancellation rights (SM§6.2). A discount over the seller's
 * limit needs a second person (estimate.discount, canApproveDiscounts). Re-pricing never touches a
 * presented version: a re-quote is a new version.
 */

const PRESENT: Permission[] = ['canPresentEstimates']
const SELL: Permission[] = ['canSellEstimates']
const OFFICE: Permission[] = [...OFFICE_READ, 'canManagePriceBook']

const fail = (error: unknown): never => {
  if (error instanceof PricingError) throw new DomainError(error.code === 'GUARD_FAILED' ? Codes.GUARD_FAILED : Codes.INVALID_INPUT, error.message, error.details)
  throw error
}

// ── Context ───────────────────────────────────────────────────────────────────

const ESTIMATE_SELECT = {
  id: true, ref: true, title: true, status: true, version: true, source: true, jobId: true, opportunityId: true, customerId: true, businessUnitId: true, currentVersionId: true, createdById: true,
  presentedBy: { select: { userId: true } },
  customer: { select: { id: true, displayName: true, primaryContact: { select: { preferredLanguage: true } } } },
  location: { select: { id: true, address1: true, address2: true, city: true, state: true, postalCode: true, timeZone: true, propertyClass: true } },
  job: { select: { id: true, ref: true, businessUnitId: true, status: true } },
} as const

export async function loadEstimate(db: Tx | Db, estimateId: string) {
  const row = await db.estimate.findUnique({ where: { id: estimateId }, select: ESTIMATE_SELECT })
  if (!row) throw new DomainError(Codes.NOT_FOUND, 'Estimate not found.')
  return row
}
type EstimateCtx = Awaited<ReturnType<typeof loadEstimate>>

/** Office staff see every estimate; a technician only those on jobs they are assigned to, or that they wrote or presented. */
export async function assertEstimateAccess(tx: Tx | Db, actor: Actor, est: { jobId: string | null; createdById: string | null; presentedBy: { userId: string | null } | null }) {
  if (actor.kind !== 'user') return
  if (OFFICE.some(p => can(actor, p))) return
  if (est.createdById === actor.userId || est.presentedBy?.userId === actor.userId) return
  if (est.jobId && (await tx.visitAssignment.count({ where: { active: true, visit: { jobId: est.jobId }, employee: { userId: actor.userId } } }))) return
  throw new DomainError(Codes.NOT_AUTHORIZED, 'This estimate is on a job you are not assigned to.')
}

type VersionRow = { id: string; status: string; version: number; estimate: string; versionNumber: number; priceBookVersion: string | null; discountBps: number; discountApproval: string | null; validUntil: Date | null }

async function lockEstimateVersion(tx: Tx, versionId: string, expectedVersion?: number | null) {
  const [row] = await tx.$queryRaw<VersionRow[]>`SELECT id, status, version, estimate, "versionNumber", "priceBookVersion", "discountBps", "discountApproval", "validUntil" FROM "EstimateVersion" WHERE id = ${versionId} FOR UPDATE`
  if (!row) throw new DomainError(Codes.NOT_FOUND, 'Estimate version not found.')
  if (expectedVersion !== undefined && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This estimate changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
  return row
}

const requireStatus = (row: { status: string }, allowed: string[], to: string) => {
  if (!allowed.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} estimate can't be ${to}.`, { currentStatus: row.status })
}

/** The seller's discount limit: their role's RoleLimit, else the company threshold. */
export async function discountLimitBps(tx: Tx | Db, actor: Actor) {
  if (actor.kind !== 'user') return 0
  const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { roleId: true } })
  const limit = user?.roleId ? await tx.roleLimit.findFirst({ where: { roleId: user.roleId, kind: 'discount_bps' }, select: { limit: true } }) : null
  if (limit) return Number(limit.limit)
  const company = await tx.companySettings.findFirst({ select: { discountApprovalThresholdBps: true } })
  return company?.discountApprovalThresholdBps ?? 0
}

type TaxCtx = Parameters<typeof estimateSalesTax>[1]

async function taxContext(tx: Tx | Db, est: EstimateCtx, on: Date): Promise<TaxCtx> {
  const loc = est.location
  if (!loc) throw new DomainError(Codes.GUARD_FAILED, 'Add the service address before pricing; sales tax depends on it.', { reason: 'no_location' })
  const place = placeOfLocation(loc)
  const policy = await resolvePolicyFromDb<SalesTaxRulesLike>(tx, 'sales_tax', place, localDate({ timeZone: loc.timeZone }, on))
  const company = await tx.companySettings.findFirst({ select: { features: true } })
  const mode = (company?.features as { contractTaxMode?: string } | null)?.contractTaxMode === 'separated' ? 'separated' : 'lump_sum'
  return { propertyClass: loc.propertyClass, contractTaxMode: mode, cityCode: place.city, rules: policy.rules }
}

/** Re-total one option (discount spread, estimated tax, hash). Only on a draft; the trigger enforces it. */
async function recomputeOption(uow: UnitOfWork, optionId: string, discountBps: number, tax: TaxCtx) {
  const { tx } = uow
  const option = await tx.estimateOption.findUniqueOrThrow({ where: { id: optionId }, select: { id: true, tier: true, name: true } })
  const lines = await tx.estimateLine.findMany({ where: { optionId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
  let totals: ReturnType<typeof optionTotals>
  let taxed: ReturnType<typeof estimateSalesTax>
  try {
    totals = optionTotals(lines.map(l => ({ amountMinor: l.amountMinor, costMinor: l.costMinor })), discountBps)
    taxed = estimateSalesTax(lines.map((l, i) => ({ taxCategory: l.taxCategory, netMinor: l.amountMinor - totals.lineDiscounts[i], costMinor: l.costMinor })), tax)
  } catch (error) { return fail(error) }
  for (const [i, l] of lines.entries()) if (l.discountMinor !== totals.lineDiscounts[i]) await tx.estimateLine.update({ where: { id: l.id }, data: { discountMinor: totals.lineDiscounts[i] } })
  const totalMinor = totals.subtotalMinor - totals.discountMinor + taxed.taxMinor
  const contentHash = optionHash({
    tier: option.tier, name: option.name, subtotalMinor: totals.subtotalMinor, discountMinor: totals.discountMinor, totalMinor,
    lines: lines.map((l, i) => ({ ...(l.snapshot as LineSnapshot), id: l.id, amountMinor: l.amountMinor, discountMinor: totals.lineDiscounts[i] })),
  })
  await tx.estimateOption.update({ where: { id: optionId }, data: { subtotalMinor: totals.subtotalMinor, discountMinor: totals.discountMinor, estimatedTaxMinor: taxed.taxMinor, totalMinor, contentHash } })
  return { optionId, subtotalMinor: totals.subtotalMinor, discountMinor: totals.discountMinor, estimatedTaxMinor: taxed.taxMinor, totalMinor, marginBps: totals.marginBps, contentHash }
}

/**
 * What a discount approval is bound to: the discount percentage, the discount in money, and the
 * priced content it was computed on (every option's lines and totals). Tax is left out: it is
 * re-estimated at presenting time under today's policy and is not part of what the approver weighed.
 */
export async function discountBinding(tx: Tx, versionId: string, discountBps: number) {
  const options = await tx.estimateOption.findMany({ where: { estimateVersionId: versionId }, orderBy: { id: 'asc' }, include: { lines: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
  const discountMinor = options.reduce((m, o) => (o.discountMinor > m ? o.discountMinor : m), 0n)
  const bindingHash = payloadHash({
    discountBps,
    options: options.map(o => ({ id: o.id, tier: o.tier, subtotal: o.subtotalMinor.toString(), discount: o.discountMinor.toString(), lines: o.lines.map(l => [l.itemKey, l.quantity.toString(), l.unitPriceMinor.toString(), l.amountMinor.toString(), l.discountMinor.toString()]) })),
  })
  return { discountMinor: discountMinor.toString(), bindingHash }
}

/** Any price or content change on a draft detaches its discount approval: presenting needs a fresh one. */
async function voidDiscountApproval(uow: UnitOfWork, actor: Actor, row: { id: string; discountApproval: string | null; discountBps: number }, why: string) {
  if (!row.discountApproval) return
  await uow.tx.estimateVersion.update({ where: { id: row.id }, data: { discountApprovalId: null } })
  uow.audit({ eventType: 'estimate_version.discount_approval_voided', entityType: 'EstimateVersion', entityId: row.id, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), reason: why, before: { approvalId: row.discountApproval, discountBps: row.discountBps }, after: { approvalId: null }, metadata: {} })
}

// ── Create and build ──────────────────────────────────────────────────────────

export type OptionLineInput = QuoteRequestLine
export type OptionInput = { optionId?: string | null; tier: string; name: string; description?: string | null; memberPricing?: boolean | null; lines: OptionLineInput[] }

const TIERS = ['good', 'better', 'best', 'single', 'custom']

async function writeOption(uow: UnitOfWork, est: EstimateCtx, version: VersionRow, input: OptionInput, tax: TaxCtx, sortOrder: number) {
  const { tx } = uow
  if (!TIERS.includes(input.tier)) throw new DomainError(Codes.INVALID_INPUT, `Tier must be one of ${TIERS.join(', ')}.`, { field: 'tier' })
  const name = input.name?.trim()
  if (!name) throw new DomainError(Codes.INVALID_INPUT, 'Name the option.', { field: 'name' })
  // Member prices need an active membership on the customer; until a membership is on file, list prices apply.
  if (input.memberPricing) throw new DomainError(Codes.GUARD_FAILED, 'This customer has no active membership, so member prices do not apply.', { reason: 'no_active_membership' })
  const active = await activeVersionFor(tx, est.businessUnitId ?? est.job?.businessUnitId ?? null)
  if (version.priceBookVersion && version.priceBookVersion !== active.versionId) {
    throw new DomainError(Codes.GUARD_FAILED, 'A new price book is active since this estimate was started. Re-price it first.', { reason: 'pricebook_changed' })
  }
  if (!version.priceBookVersion) await tx.estimateVersion.update({ where: { id: version.id }, data: { priceBookVersionId: active.versionId } })
  const quoted = await quoteFromVersion(tx, active.versionId, input.lines, false)
  let optionId = input.optionId ?? null
  if (optionId) {
    const existing = await tx.estimateOption.findFirst({ where: { id: optionId, estimateVersionId: version.id }, select: { id: true } })
    if (!existing) throw new DomainError(Codes.NOT_FOUND, 'That option is not on this estimate version.', { field: 'optionId' })
    await tx.estimateLine.deleteMany({ where: { optionId } })
    await tx.estimateOption.update({ where: { id: optionId }, data: { tier: input.tier, name, description: input.description?.trim() ?? '' } })
  } else {
    optionId = (await tx.estimateOption.create({ data: { estimateVersionId: version.id, tier: input.tier, name, description: input.description?.trim() ?? '', sortOrder }, select: { id: true } })).id
  }
  await tx.estimateLine.createMany({
    data: quoted.map(({ amountMinor, ...snap }, i) => ({
      optionId: optionId!, pricebookItemId: snap.priceBookItemId, itemKey: snap.itemKey, snapshot: snap as never, description: snap.description,
      quantity: snap.quantity, uom: snap.uom, unitPriceMinor: BigInt(snap.unitPriceMinor), amountMinor, discountMinor: 0n, memberPriced: snap.memberPriced,
      costMinor: BigInt(snap.costMinor), taxCategory: snap.taxCategory, trade: snap.trade, cancellationClass: snap.cancellationClass,
      isAddOn: snap.cancellationClass === 'additional_goods_services', sortOrder: i,
    })),
  })
  return recomputeOption(uow, optionId, version.discountBps, tax)
}

export type CreateEstimateArgs = {
  jobId?: string | null; opportunityId?: string | null; customerId?: string | null; locationId?: string | null; businessUnitId?: string | null
  title: string; options?: OptionInput[] | null; idempotencyKey: string; now?: Date
}

async function createEstimateInTx(uow: UnitOfWork, actor: Actor, args: CreateEstimateArgs, source: 'staff' | 'technician' | 'agent_draft' | 'followup') {
  const { tx } = uow
  const title = args.title?.trim()
  if (!title) throw new DomainError(Codes.INVALID_INPUT, 'Give the estimate a title.', { field: 'title' })
  let customerId = args.customerId ?? null
  let locationId = args.locationId ?? null
  let businessUnitId = args.businessUnitId ?? null
  if (args.jobId) {
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { customerId: true, locationId: true, businessUnitId: true, status: true } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'Job not found.', { field: 'jobId' })
    if (['cancelled', 'closed'].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: 'job_closed' })
    customerId = job.customerId; locationId = job.locationId; businessUnitId = businessUnitId ?? job.businessUnitId
  } else if (args.opportunityId) {
    const opp = await tx.opportunity.findUnique({ where: { id: args.opportunityId }, select: { customerId: true, locationId: true } })
    if (!opp) throw new DomainError(Codes.NOT_FOUND, 'Opportunity not found.', { field: 'opportunityId' })
    customerId = opp.customerId; locationId = opp.locationId
  }
  if (!customerId || !locationId) throw new DomainError(Codes.INVALID_INPUT, 'An estimate needs a job, an opportunity, or a customer and service address.', { field: 'jobId' })
  const loc = await tx.serviceLocation.findUnique({ where: { id: locationId }, select: { customerId: true } })
  if (!loc) throw new DomainError(Codes.NOT_FOUND, 'Service address not found.', { field: 'locationId' })
  const ref = await nextReference(tx, 'EST', uow.now)
  const estimate = await tx.estimate.create({
    data: {
      ref, publicCode: publicCode('EST'), title, jobId: args.jobId ?? null, opportunityId: args.opportunityId ?? null, customerId, locationId, businessUnitId, status: 'open', source,
      createdById: actorUserId(actor), createdByAgentId: actorAgentId(actor),
    },
    select: { id: true },
  })
  const version = await tx.estimateVersion.create({ data: { estimateId: estimate.id, versionNumber: 1, label: 'Version 1', status: 'draft' }, select: { id: true } })
  await tx.estimate.update({ where: { id: estimate.id }, data: { currentVersionId: version.id } })
  auditCreate(uow, actor, 'Estimate', estimate.id, 'estimate.created', { ref, title, jobId: args.jobId ?? null, opportunityId: args.opportunityId ?? null, customerId, locationId, source })
  const options = []
  if (args.options?.length) {
    const est = await loadEstimate(tx, estimate.id)
    const tax = await taxContext(tx, est, uow.now)
    const row = await lockEstimateVersion(tx, version.id)
    for (const [i, o] of args.options.entries()) {
      options.push(await writeOption(uow, est, { ...row, priceBookVersion: (await tx.estimateVersion.findUniqueOrThrow({ where: { id: version.id }, select: { priceBookVersionId: true } })).priceBookVersionId }, o, tax, i))
    }
    auditCreate(uow, actor, 'EstimateVersion', version.id, 'estimate_version.options_saved', { options: options.map(o => ({ optionId: o.optionId, totalMinor: o.totalMinor.toString() })) })
  }
  return { estimateId: estimate.id, ref, versionId: version.id, options: options.map(({ marginBps: _m, ...o }) => ({ ...o, subtotalMinor: o.subtotalMinor.toString(), discountMinor: o.discountMinor.toString(), estimatedTaxMinor: o.estimatedTaxMinor.toString(), totalMinor: o.totalMinor.toString() })) }
}

export async function createEstimate(db: Db, actor: Actor, args: CreateEstimateArgs) {
  await authorizeOperation(db, actor, 'estimate.create', PRESENT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents draft estimates with estimate.draft.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    if (args.jobId && actor.kind === 'user' && !OFFICE.some(p => can(actor, p))) await assertEstimateAccess(uow.tx, actor, { jobId: args.jobId, createdById: null, presentedBy: null })
    return createEstimateInTx(uow, actor, args, can(actor, 'canWorkVisits') && !OFFICE.some(p => can(actor, p)) ? 'technician' : 'staff')
  })
  return { replay: result.replay, ...result.value }
}

/** estimate.draft / estimate.draft_from_capture: an agent writes a draft for a person to review and present. */
export async function draftEstimate(db: Db, actor: Actor, args: CreateEstimateArgs & { visitId?: string | null }) {
  const tool = args.visitId ? 'estimate.draft_from_capture' : 'estimate.draft'
  await authorizeOperation(db, actor, tool, PRESENT, args)
  if (!args.options?.length) throw new DomainError(Codes.INVALID_INPUT, 'A draft needs at least one option.', { field: 'options' })
  const { idempotencyKey, now: _now, visitId, ...rest } = args
  const result = await command(db, { name: tool, actor, idempotencyKey, params: { ...rest, visitId }, now: args.now }, async uow => {
    let jobId = args.jobId ?? null
    if (visitId) {
      const visit = await uow.tx.visit.findUnique({ where: { id: visitId }, select: { jobId: true } })
      if (!visit?.jobId) throw new DomainError(Codes.NOT_FOUND, 'Visit not found.', { field: 'visitId' })
      jobId = visit.jobId
    }
    if (jobId && actor.kind === 'user') await assertEstimateAccess(uow.tx, actor, { jobId, createdById: null, presentedBy: null })
    const value = await createEstimateInTx(uow, actor, { ...rest, jobId, idempotencyKey }, actor.kind === 'agent' ? 'agent_draft' : 'technician')
    await recordAgentAction(uow, actor, { tool, idempotencyKey, inputs: rest, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

export async function saveEstimateOption(db: Db, actor: Actor, args: OptionInput & { versionId: string; expectedVersion?: number | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.edit', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.save_option', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 'edited')
    const est = await loadEstimate(uow.tx, row.estimate)
    await assertEstimateAccess(uow.tx, actor, est)
    const count = await uow.tx.estimateOption.count({ where: { estimateVersionId: row.id } })
    if (!args.optionId && count >= 6) throw new DomainError(Codes.INVALID_INPUT, 'An estimate shows at most six options.', { field: 'optionId' })
    const option = await writeOption(uow, est, row, args, await taxContext(uow.tx, est, uow.now), count)
    await voidDiscountApproval(uow, actor, row, 'Option changed after the discount was approved')
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'draft', actor, eventType: 'estimate_version.option_saved', audit: { optionId: option.optionId, tier: args.tier, name: args.name, lines: args.lines.length, totalMinor: option.totalMinor.toString() } })
    return { versionId: row.id, version, optionId: option.optionId, totalMinor: option.totalMinor.toString(), subtotalMinor: option.subtotalMinor.toString(), discountMinor: option.discountMinor.toString(), estimatedTaxMinor: option.estimatedTaxMinor.toString() }
  })
  return { replay: result.replay, ...result.value }
}

export async function removeEstimateOption(db: Db, actor: Actor, args: { versionId: string; optionId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.edit', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.remove_option', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 'edited')
    await assertEstimateAccess(uow.tx, actor, await loadEstimate(uow.tx, row.estimate))
    const option = await uow.tx.estimateOption.findFirst({ where: { id: args.optionId, estimateVersionId: row.id }, select: { id: true } })
    if (!option) throw new DomainError(Codes.NOT_FOUND, 'That option is not on this estimate version.')
    await uow.tx.estimateLine.deleteMany({ where: { optionId: option.id } })
    await uow.tx.estimateOption.delete({ where: { id: option.id } })
    await voidDiscountApproval(uow, actor, row, 'Option removed after the discount was approved')
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'draft', actor, eventType: 'estimate_version.option_removed', audit: { optionId: option.id } })
    return { versionId: row.id, version }
  })
  return { replay: result.replay, ...result.value }
}

/** Re-quote every line of a draft from the price book active now (after a new version went live). */
export async function repriceEstimateVersion(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.edit', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.reprice', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 're-priced')
    const est = await loadEstimate(uow.tx, row.estimate)
    await assertEstimateAccess(uow.tx, actor, est)
    const repriced = await requoteOptionsInto(uow, est, row.id, { ...row, priceBookVersion: null })
    await voidDiscountApproval(uow, actor, row, 'Re-priced after the discount was approved')
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'draft', actor, eventType: 'estimate_version.repriced', audit: { from: row.priceBookVersion, options: repriced } })
    return { versionId: row.id, version, options: repriced }
  })
  return { replay: result.replay, ...result.value }
}

/** Copy (and re-price) the options of `sourceVersionId` into the draft `target`. */
async function requoteOptionsInto(uow: UnitOfWork, est: EstimateCtx, sourceVersionId: string, target: VersionRow) {
  const { tx } = uow
  const options = await tx.estimateOption.findMany({ where: { estimateVersionId: sourceVersionId }, orderBy: { sortOrder: 'asc' }, select: { id: true, tier: true, name: true, description: true, sortOrder: true, lines: { orderBy: { sortOrder: 'asc' }, select: { itemKey: true, quantity: true, cancellationClass: true, description: true } } } })
  if (sourceVersionId === target.id) {
    await tx.estimateLine.deleteMany({ where: { option: { estimateVersionId: target.id } } })
    await tx.estimateOption.deleteMany({ where: { estimateVersionId: target.id } })
  }
  await tx.estimateVersion.update({ where: { id: target.id }, data: { priceBookVersionId: null } })
  const tax = await taxContext(tx, est, uow.now)
  const out: { optionId: string; totalMinor: string }[] = []
  for (const o of options) {
    const r = await writeOption(uow, est, { ...target, priceBookVersion: null }, {
      tier: o.tier, name: o.name, description: o.description,
      lines: o.lines.map(l => ({ itemKey: l.itemKey, quantity: l.quantity.toString(), cancellationClass: l.cancellationClass, description: l.description })),
    }, tax, o.sortOrder)
    out.push({ optionId: r.optionId, totalMinor: r.totalMinor.toString() })
  }
  return out
}

// ── Discount (maker-checker over the seller's limit) ──────────────────────────

export async function setEstimateDiscount(db: Db, actor: Actor, args: { versionId: string; discountBps: number; reason?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.discount', PRESENT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not set discounts.')
  if (!Number.isInteger(args.discountBps) || args.discountBps < 0 || args.discountBps > 10_000) throw new DomainError(Codes.INVALID_INPUT, 'Discount is 0 to 10000 basis points.', { field: 'discountBps' })
  if (args.discountBps > 0 && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why the discount is given.', { field: 'reason' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.discount', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 'discounted')
    const est = await loadEstimate(tx, row.estimate)
    await assertEstimateAccess(tx, actor, est)
    await tx.estimateVersion.update({ where: { id: row.id }, data: { discountBps: args.discountBps, discountReason: args.reason?.trim() ?? '', discountApprovalId: null } })
    const tax = await taxContext(tx, est, uow.now)
    const options = await tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, select: { id: true } })
    const totals = []
    for (const o of options) totals.push(await recomputeOption(uow, o.id, args.discountBps, tax))
    const limit = await discountLimitBps(tx, actor)
    if (args.discountBps <= limit) {
      const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version + 0, from: ['draft'], to: 'draft', actor, eventType: 'estimate_version.discounted', reason: args.reason ?? null, audit: { discountBps: args.discountBps, limitBps: limit } })
      return { versionId: row.id, version, status: 'draft', approvalRequestId: null }
    }
    const approval = await requestApproval(uow, actor, {
      action: 'estimate.discount', targetList: 'EstimateVersion', targetId: row.id, requiredPermission: 'canApproveDiscounts',
      payload: { versionId: row.id, discountBps: args.discountBps, ...(await discountBinding(tx, row.id, args.discountBps)), options: totals.map(t => ({ optionId: t.optionId, contentHash: t.contentHash })) },
      summary: `${est.ref}: ${args.discountBps / 100}% discount (limit ${limit / 100}%) — ${args.reason?.trim()}`,
    })
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'pending_approval', actor, eventType: 'estimate_version.discount_requested', reason: args.reason ?? null, data: { discountApprovalId: approval.id }, audit: { discountBps: args.discountBps, limitBps: limit, approvalId: approval.id } })
    return { versionId: row.id, version, status: 'pending_approval', approvalRequestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Approved discount: the version returns to draft carrying the approval, ready to present. */
export async function applyEstimateDiscount(uow: UnitOfWork, actor: Actor, request: { id: string; targetId: string; payload: { versionId: string; discountBps: number; options: { optionId: string; contentHash: string }[] } }) {
  const row = await lockEstimateVersion(uow.tx, request.targetId)
  if (row.status !== 'pending_approval' || row.discountApproval !== request.id || row.discountBps !== request.payload.discountBps) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The estimate changed after the discount was requested.')
  const hashes = await uow.tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, select: { id: true, contentHash: true } })
  const expected = new Map(request.payload.options.map(o => [o.optionId, o.contentHash]))
  if (hashes.length !== expected.size || hashes.some(h => expected.get(h.id) !== h.contentHash)) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The options changed after the discount was requested.')
  await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['pending_approval'], to: 'draft', actor, eventType: 'estimate_version.discount_approved', approverId: actorUserId(actor), metadata: { approvalRequestId: request.id } })
  return { versionId: row.id, status: 'draft', discountBps: row.discountBps }
}

/** Back to draft without the approval (withdrawn or rejected). The discount stays until changed; presenting re-checks it. */
export async function reopenEstimateVersion(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.edit', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.reopen', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['pending_approval'], 'reopened')
    await assertEstimateAccess(uow.tx, actor, await loadEstimate(uow.tx, row.estimate))
    if (row.discountApproval) {
      const req = await uow.tx.approvalRequest.findUnique({ where: { id: row.discountApproval }, select: { id: true, status: true, version: true } })
      if (req?.status === 'pending') await casUpdate(uow, { model: 'ApprovalRequest', id: req.id, version: req.version, from: ['pending'], to: 'cancelled', actor, eventType: 'approval.cancelled', reason: 'Estimate reopened for editing' })
    }
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['pending_approval'], to: 'draft', actor, eventType: 'estimate_version.reopened', data: { discountApprovalId: null } })
    return { versionId: row.id, version, status: 'draft' }
  })
  return { replay: result.replay, ...result.value }
}

// ── Present ───────────────────────────────────────────────────────────────────

export async function presentEstimate(db: Db, actor: Actor, args: { versionId: string; via?: 'in_person' | 'email' | 'printed' | null; notes?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.present', PRESENT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person presents estimates; agents draft them.')
  const via = args.via ?? 'in_person'
  if (!['in_person', 'email', 'printed'].includes(via)) throw new DomainError(Codes.INVALID_INPUT, 'Present in person, by email, or printed.', { field: 'via' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.present', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 'presented')
    const est = await loadEstimate(tx, row.estimate)
    await assertEstimateAccess(tx, actor, est)
    const options = await tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
    if (!options.length || options.some(o => !o.lines.length)) throw new DomainError(Codes.GUARD_FAILED, 'Every option needs at least one line, and the estimate needs an option.', { reason: 'empty_option' })
    // I-E2: priced from the price book active right now.
    const active = await activeVersionFor(tx, est.businessUnitId ?? est.job?.businessUnitId ?? null)
    const stale = row.priceBookVersion !== active.versionId || options.some(o => o.lines.some(l => (l.snapshot as LineSnapshot).priceBookVersionId !== active.versionId))
    if (stale) throw new DomainError(Codes.GUARD_FAILED, 'A new price book is active since this estimate was priced. Re-price it, then present.', { reason: 'pricebook_changed' })
    // I-E5: discount within the presenter's limit, or approved by a second person.
    const limit = await discountLimitBps(tx, actor)
    if (row.discountBps > limit) {
      const approval = row.discountApproval ? await tx.approvalRequest.findUnique({ where: { id: row.discountApproval }, select: { status: true, payload: true } }) : null
      const ok = approval && approval.status === 'approved' && (approval.payload as { discountBps?: number } | null)?.discountBps === row.discountBps
      if (!ok) throw new DomainError(Codes.APPROVAL_REQUIRED, `A ${row.discountBps / 100}% discount is over your ${limit / 100}% limit and needs approval.`, { reason: 'discount_over_limit' })
    }
    // Totals are re-derived now so the frozen figures can't drift from the lines (and tax uses today's policy).
    const tax = await taxContext(tx, est, uow.now)
    for (const o of options) await recomputeOption(uow, o.id, row.discountBps, tax)
    // The approval covers this discount amount on this priced content, not just the percentage.
    if (row.discountBps > limit) {
      const approval = await tx.approvalRequest.findUnique({ where: { id: row.discountApproval! }, select: { payload: true } })
      const bound = approval?.payload as { discountMinor?: string; bindingHash?: string } | null
      const now = await discountBinding(tx, row.id, row.discountBps)
      if (!bound?.bindingHash || bound.bindingHash !== now.bindingHash || bound.discountMinor !== now.discountMinor) {
        throw new DomainError(Codes.APPROVAL_REQUIRED, 'The price or discount changed after it was approved. Request approval again.', { reason: 'discount_approval_stale' })
      }
    }
    const fresh = await tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
    const trades = new Set(fresh.flatMap(o => o.lines.map(l => l.trade)))
    const { company, block } = await sellerBlock(tx, est.businessUnitId, placeOfLocation(est.location).state, trades)
    const tz = est.location?.timeZone || company.homeTimeZone
    const today = localDate({ timeZone: tz }, uow.now)
    const lastValidDay = addDays(today, company.estimateValidityDays)
    const validUntil = zonedInstant(tz, addDays(lastValidDay, 1), '00:00')
    const place = placeOfLocation(est.location)
    let hic: { requiredFields: string[] } | null = null
    try { hic = (await resolvePolicyFromDb<{ requiredFields: string[] }>(tx, 'home_improvement_contract', place, today)).rules } catch (error) { if (!(error instanceof DomainError && error.code === Codes.POLICY_MISSING)) throw error }
    const residential = est.location?.propertyClass === 'residential'
    const employee = await tx.employee.findFirst({ where: { userId: actorUserId(actor) }, select: { id: true } })
    const snapshot: EstimateSnapshot = {
      ref: est.ref, versionNumber: row.versionNumber, title: est.title, presentedAt: uow.now.toISOString(), validUntil: lastValidDay, timeZone: tz,
      company: block,
      customer: { name: est.customer?.displayName ?? '' },
      location: est.location ? { address: addressLine(est.location) } : null,
      notes: args.notes?.trim() ?? '',
      discount: row.discountBps > 0 ? { bps: row.discountBps, reason: (await tx.estimateVersion.findUniqueOrThrow({ where: { id: row.id }, select: { discountReason: true } })).discountReason } : null,
      options: fresh.map(o => ({
        id: o.id, tier: o.tier, name: o.name, description: o.description, contentHash: o.contentHash, monthlyPaymentDisplay: '',
        subtotalMinor: o.subtotalMinor.toString(), discountMinor: o.discountMinor.toString(), estimatedTaxMinor: o.estimatedTaxMinor.toString(), totalMinor: o.totalMinor.toString(),
        lines: o.lines.map(l => ({ description: l.description, quantity: l.quantity.toString(), uom: l.uom, unitPriceMinor: l.unitPriceMinor.toString(), amountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString(), memberPriced: l.memberPriced, warrantyText: (l.snapshot as LineSnapshot).warrantyText, isAddOn: l.isAddOn })),
      })),
      disclosures: {
        taxNote: 'Sales tax shown is an estimate for this address; the invoice states the final amount.',
        homesteadWarning: residential && hic?.requiredFields.includes('homestead_warning') ? TX_HOMESTEAD_WARNING : null,
        lienDisclosure: residential && hic?.requiredFields.includes('lien_disclosure') ? TX_LIEN_DISCLOSURE : null,
        cancellationStatement: null,
      },
      priceBookVersionId: active.versionId,
      contentHash: '',
    }
    snapshot.contentHash = payloadHash({ ...snapshot, contentHash: undefined })
    const pdf = await storeRenderedPdf(uow, actor, {
      title: `${est.ref} v${row.versionNumber}`, kind: 'estimate_pdf', subjectType: 'EstimateVersion', subjectId: row.id, storageKey: `render:estimate-version/${row.id}`,
      bytes: renderEstimatePdf(snapshot, presentedLabel(snapshot)),
    })
    const version = await casUpdate(uow, {
      model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'presented', actor, eventType: 'estimate_version.presented',
      data: { snapshot: snapshot as never, contentHash: snapshot.contentHash, presentedAt: uow.now, presentedById: actorUserId(actor), presentedVia: via, validUntil, notes: snapshot.notes, pdfId: pdf.documentId },
      audit: { contentHash: snapshot.contentHash, via, validUntil: lastValidDay, options: fresh.map(o => ({ id: o.id, totalMinor: o.totalMinor.toString(), contentHash: o.contentHash })), pdfSha256: pdf.sha256 },
    })
    await tx.estimate.update({ where: { id: est.id }, data: { currentVersionId: row.id, presentedById: employee?.id ?? undefined, version: { increment: 1 } } })
    if (est.opportunityId) await tx.opportunity.updateMany({ where: { id: est.opportunityId, stage: { in: ['open', 'appointment_set'] } }, data: { stage: 'estimate_presented', version: { increment: 1 } } })
    if (via === 'email') uow.emit({ topic: 'notify.estimate', aggregateType: 'EstimateVersion', aggregateId: row.id, payload: { estimateId: est.id, ref: est.ref }, dedupeKey: `notify.estimate:${row.id}` })
    return { versionId: row.id, version, status: 'presented', contentHash: snapshot.contentHash, documentId: pdf.documentId, validUntil: lastValidDay }
  })
  return { replay: result.replay, ...result.value }
}

export { presentedLabel }

// ── Sell ──────────────────────────────────────────────────────────────────────

export type AuthorizationInput = {
  method: 'signature_on_device' | 'verbal_recorded' | 'written_paper' | 'po_number'
  signerName: string; signerContactId?: string | null; signerRole?: 'owner' | 'tenant' | 'property_manager' | 'other' | null
  signature?: unknown; callId?: string | null; poNumber?: string | null; ownerApproval?: string | null; ip?: string | null; userAgent?: string | null
}

function validateAuthorization(a: AuthorizationInput, location: string) {
  if (!a?.signerName?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Who authorized it?', { field: 'signerName' })
  if (!['signature_on_device', 'verbal_recorded', 'written_paper', 'po_number'].includes(a.method)) throw new DomainError(Codes.INVALID_INPUT, 'Authorization is a signature on the device, a recorded verbal approval, a signed paper copy, or a purchase order.', { field: 'method' })
  if (a.method === 'signature_on_device' && (a.signature === undefined || a.signature === null || a.signature === '')) throw new DomainError(Codes.INVALID_INPUT, 'Capture the signature.', { field: 'signature' })
  if (a.method === 'verbal_recorded' && (!a.callId || location !== 'remote')) throw new DomainError(Codes.INVALID_INPUT, 'A verbal approval is taken on a recorded call; link the call.', { field: 'callId' })
  if (a.method === 'po_number' && !a.poNumber?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the purchase order number.', { field: 'poNumber' })
  const role = a.signerRole ?? 'owner'
  if (role === 'tenant' && !a.ownerApproval?.trim()) throw new DomainError(Codes.GUARD_FAILED, 'A tenant can authorize work only with the owner\'s approval; record how the owner approved.', { reason: 'tenant_without_owner' })
  if (role === 'property_manager' && a.method !== 'po_number' && !a.ownerApproval?.trim()) throw new DomainError(Codes.GUARD_FAILED, 'A property manager authorizes with a purchase order or the owner\'s recorded approval.', { reason: 'pm_without_po' })
  return role
}

export type SellArgs = {
  versionId: string; optionId: string; expectedVersion: number
  authorization: AuthorizationInput
  saleLocation: (typeof SALE_LOCATIONS)[number]
  initiatedBy: 'customer_request' | 'solicited'
  depositMinor?: string | null
  depositMethod?: 'card' | 'ach' | 'cash' | 'check' | 'other' | null
  depositReference?: string | null
  emergencyWaiver?: EmergencyWaiverInput | null
  acrContext?: string[] | null
  exclusions?: string[] | null
  idempotencyKey: string; now?: Date
}

export async function sellEstimate(db: Db, actor: Actor, args: SellArgs) {
  await authorizeOperation(db, actor, 'estimate.sell', SELL, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records a sale.')
  if (!SALE_LOCATIONS.includes(args.saleLocation)) throw new DomainError(Codes.INVALID_INPUT, `Sale location must be one of ${SALE_LOCATIONS.join(', ')}.`, { field: 'saleLocation' })
  if (!['customer_request', 'solicited'].includes(args.initiatedBy)) throw new DomainError(Codes.INVALID_INPUT, 'Say whether the customer asked for this visit or it was solicited.', { field: 'initiatedBy' })
  const signerRole = validateAuthorization(args.authorization, args.saleLocation)
  const deposit = args.depositMinor ? (/^\d{1,13}$/.test(args.depositMinor) ? BigInt(args.depositMinor) : (() => { throw new DomainError(Codes.INVALID_INPUT, 'Deposit is whole cents.', { field: 'depositMinor' }) })()) : 0n
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.sell', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['presented'], 'sold')
    if (row.validUntil && row.validUntil.getTime() <= uow.now.getTime()) throw new DomainError(Codes.GUARD_FAILED, 'This estimate has expired. Re-quote it.', { reason: 'expired' })
    const est = await loadEstimate(tx, row.estimate)
    await assertEstimateAccess(tx, actor, est)
    if (!est.jobId) throw new DomainError(Codes.GUARD_FAILED, 'Attach the estimate to a job before selling it, so the work can be scheduled.', { reason: 'no_job' })
    const option = await tx.estimateOption.findFirst({ where: { id: args.optionId, estimateVersionId: row.id }, include: { lines: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
    if (!option) throw new DomainError(Codes.INVALID_INPUT, 'Choose one of the presented options.', { field: 'optionId' })
    if (args.authorization.signerContactId) {
      const contact = await tx.contact.findUnique({ where: { id: args.authorization.signerContactId }, select: { customerId: true } })
      if (contact?.customerId !== est.customerId) throw new DomainError(Codes.INVALID_INPUT, 'The signer is not a contact of this customer.', { field: 'signerContactId' })
    }
    if (args.authorization.callId && !(await tx.call.findUnique({ where: { id: args.authorization.callId }, select: { id: true } }))) throw new DomainError(Codes.NOT_FOUND, 'Call not found.', { field: 'callId' })
    // Deposit cap (home-improvement contract policy at the service address).
    const tz = est.location!.timeZone
    const place = placeOfLocation(est.location)
    if (deposit > 0n) {
      if (deposit > option.totalMinor) throw new DomainError(Codes.INVALID_INPUT, 'The deposit is more than the price.', { field: 'depositMinor' })
      const hic = await resolvePolicyFromDb<{ depositCapPct: string | null; depositCapMinor: string | null }>(tx, 'home_improvement_contract', place, localDate({ timeZone: tz }, uow.now))
      const cap = depositCap(option.totalMinor, hic.rules)
      if (cap !== null && deposit > cap) throw new DomainError(Codes.GUARD_FAILED, `The deposit is over the ${cap.toString()}¢ cap for this address.`, { reason: 'deposit_over_cap', capMinor: cap.toString() })
    }
    const authorization = await tx.authorization.create({
      data: {
        subjectType: 'EstimateVersion', subjectId: row.id, jobId: est.jobId, method: args.authorization.method, signerName: args.authorization.signerName.trim(),
        signerContactId: args.authorization.signerContactId ?? null, signerRole, signature: (args.authorization.signature ?? undefined) as never, callId: args.authorization.callId ?? null,
        poNumber: args.authorization.poNumber?.trim() ?? '', ip: args.authorization.ip ?? '', userAgent: args.authorization.userAgent ?? '', location: args.saleLocation, initiatedBy: args.initiatedBy,
        selectedLineIds: option.lines.map(l => l.id) as never, depositMinor: deposit, contentHash: option.contentHash, authorizedAt: uow.now, recordedById: actorUserId(actor),
      },
      select: { id: true },
    })
    if (deposit > 0n) {
      const ref = await nextReference(tx, 'PMT', uow.now)
      const payment = await tx.payment.create({ data: { ref, jobId: est.jobId, customerId: est.customerId ?? null, authorizationId: authorization.id, kind: 'deposit', method: args.depositMethod ?? 'card', amountMinor: deposit, reference: args.depositReference?.trim() ?? '', receivedAt: uow.now, recordedById: actorUserId(actor) }, select: { id: true } })
      auditCreate(uow, actor, 'Payment', payment.id, 'payment.recorded', { ref, authorizationId: authorization.id, amountMinor: deposit.toString(), method: args.depositMethod ?? 'card', kind: 'deposit' })
    }
    auditCreate(uow, actor, 'Authorization', authorization.id, 'authorization.recorded', { subject: `EstimateVersion:${row.id}`, optionId: option.id, method: args.authorization.method, signerRole, location: args.saleLocation, initiatedBy: args.initiatedBy, contentHash: option.contentHash, ownerApproval: args.authorization.ownerApproval ?? null })
    // WorkLines from the sold option (net of the order discount).
    const workLines = []
    for (const l of option.lines) {
      workLines.push(await tx.workLine.create({
        data: {
          jobId: est.jobId, source: 'estimate_line', description: l.description, snapshot: { ...(l.snapshot as object), estimateRef: est.ref, listAmountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString() } as never,
          quantity: l.quantity, uom: l.uom, unitPriceMinor: l.unitPriceMinor, amountMinor: l.amountMinor - l.discountMinor, taxCategory: l.taxCategory, trade: l.trade, cancellationClass: l.cancellationClass, status: 'planned', estimateLineId: l.id,
        },
        select: { id: true, amountMinor: true, trade: true, cancellationClass: true, description: true },
      }))
    }
    const version = await casUpdate(uow, {
      model: 'EstimateVersion', id: row.id, version: row.version, from: ['presented'], to: 'sold', actor, eventType: 'estimate_version.sold',
      data: { soldOptionId: option.id, authorizationId: authorization.id, soldAt: uow.now, depositRequiredMinor: deposit, closedAt: uow.now },
      audit: { optionId: option.id, totalMinor: option.totalMinor.toString(), depositMinor: deposit.toString(), workLines: workLines.length },
    })
    await tx.estimate.update({ where: { id: est.id }, data: { status: 'sold', soldVersionId: row.id, version: { increment: 1 } } })
    if (est.opportunityId) await tx.opportunity.updateMany({ where: { id: est.opportunityId }, data: { stage: 'won', version: { increment: 1 } } })
    const rights = await evaluateSaleRights(uow, actor, {
      jobId: est.jobId, customerId: est.customerId!, subjectType: 'EstimateVersion', subjectId: row.id, estimateVersionId: row.id, changeOrderId: null, authorizationId: authorization.id,
      location: args.saleLocation, initiatedBy: args.initiatedBy, transactionAt: uow.now, serviceLocation: est.location!, businessUnitId: est.businessUnitId, buyerName: est.customer?.displayName ?? '', language: est.customer?.primaryContact?.preferredLanguage || 'en',
      lines: workLines.map(w => ({ id: w.id, amountMinor: w.amountMinor, trade: w.trade as never, cancellationClass: w.cancellationClass as never, description: w.description })),
      exclusions: args.exclusions ?? [], emergencyWaiver: args.emergencyWaiver ?? null, acrContext: args.acrContext ?? [],
    })
    return { versionId: row.id, version, status: 'sold', authorizationId: authorization.id, workLineIds: workLines.map(w => w.id), cancellation: rights }
  })
  return { replay: result.replay, ...result.value }
}

// ── Decline, expire, re-quote, discard ────────────────────────────────────────

export async function declineEstimate(db: Db, actor: Actor, args: { versionId: string; reason: string; note?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.decline', PRESENT, args)
  if (!(DECLINE_REASONS as readonly string[]).includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason must be one of ${DECLINE_REASONS.join(', ')}.`, { field: 'reason' })
  if (args.reason === 'other' && !args.note?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why.', { field: 'note' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.decline', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['presented'], 'declined')
    const est = await loadEstimate(uow.tx, row.estimate)
    await assertEstimateAccess(uow.tx, actor, est)
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['presented'], to: 'declined', actor, eventType: 'estimate_version.declined', reason: args.note ?? null, data: { declineReason: args.reason, declineNote: args.note?.trim() ?? '', closedAt: uow.now } })
    await uow.tx.estimate.update({ where: { id: est.id }, data: { status: 'declined', version: { increment: 1 } } })
    if (est.opportunityId && ['chose_competitor', 'no_longer_needed'].includes(args.reason)) await uow.tx.opportunity.updateMany({ where: { id: est.opportunityId }, data: { stage: 'lost', version: { increment: 1 } } })
    return { versionId: row.id, version, status: 'declined' }
  })
  return { replay: result.replay, ...result.value }
}

/** Timer: presented estimates past validUntil expire. */
export async function expireDueEstimates(db: Db, now = new Date()) {
  const due = await db.estimateVersion.findMany({ where: { status: 'presented', validUntil: { lte: now } }, select: { id: true }, take: 200 })
  let expired = 0
  for (const { id } of due) {
    const actor: Actor = { kind: 'system', name: 'estimate-expiry' }
    const r = await command(db, { name: 'estimate.expire', actor, idempotencyKey: `estimate-expire:${id}`, params: { versionId: id }, now }, async uow => {
      const row = await lockEstimateVersion(uow.tx, id)
      if (row.status !== 'presented' || !row.validUntil || row.validUntil.getTime() > now.getTime()) return false
      await casUpdate(uow, { model: 'EstimateVersion', id, version: row.version, from: ['presented'], to: 'expired', actor, eventType: 'estimate_version.expired', data: { closedAt: uow.now } })
      await uow.tx.estimate.updateMany({ where: { id: row.estimate, status: 'open', currentVersionId: id }, data: { status: 'expired', version: { increment: 1 } } })
      return true
    })
    if (r.value) expired += 1
  }
  return { expired }
}

async function requoteInTx(uow: UnitOfWork, actor: Actor, versionId: string, expectedVersion: number | null | undefined, followup: boolean) {
  const { tx } = uow
  const row = await lockEstimateVersion(tx, versionId, expectedVersion)
  requireStatus(row, followup ? ['declined', 'expired'] : ['presented', 'declined', 'expired'], 're-quoted')
  const est = await loadEstimate(tx, row.estimate)
  if (actor.kind === 'user') await assertEstimateAccess(tx, actor, est)
  const latest = await tx.estimateVersion.findFirst({ where: { estimateId: est.id }, orderBy: { versionNumber: 'desc' }, select: { id: true, versionNumber: true } })
  if (latest?.id !== row.id) throw new DomainError(Codes.GUARD_FAILED, 'A newer version of this estimate exists; re-quote that one.', { reason: 'not_latest' })
  if (row.status === 'presented') await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['presented'], to: 'superseded', actor, eventType: 'estimate_version.superseded', data: { closedAt: uow.now } })
  const versionNumber = row.versionNumber + 1
  const next = await tx.estimateVersion.create({ data: { estimateId: est.id, versionNumber, label: `Version ${versionNumber}`, status: 'draft', supersedesId: row.id }, select: { id: true } })
  await tx.estimate.update({ where: { id: est.id }, data: { status: 'open', currentVersionId: next.id, version: { increment: 1 } } })
  auditCreate(uow, actor, 'EstimateVersion', next.id, 'estimate_version.drafted', { estimateId: est.id, versionNumber, supersedes: row.id, followup })
  const target = await lockEstimateVersion(tx, next.id)
  const options = await requoteOptionsInto(uow, est, row.id, target)
  return { estimateId: est.id, ref: est.ref, versionId: next.id, versionNumber, options }
}

export async function requoteEstimate(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.requote', PRESENT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents use estimate.draft_followup.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.requote', actor, idempotencyKey, params, now: args.now }, uow => requoteInTx(uow, actor, args.versionId, args.expectedVersion, false))
  return { replay: result.replay, ...result.value }
}

/** estimate.draft_followup: a re-priced draft of a declined or expired estimate, for a person to review. */
export async function draftFollowupEstimate(db: Db, actor: Actor, args: { versionId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.draft_followup', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.draft_followup', actor, idempotencyKey, params, now: args.now }, async uow => {
    const value = await requoteInTx(uow, actor, args.versionId, null, true)
    await recordAgentAction(uow, actor, { tool: 'estimate.draft_followup', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

export async function discardEstimateVersion(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'estimate.discard', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'estimate.discard', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion)
    requireStatus(row, ['draft'], 'discarded')
    const est = await loadEstimate(uow.tx, row.estimate)
    await assertEstimateAccess(uow.tx, actor, est)
    const version = await casUpdate(uow, { model: 'EstimateVersion', id: row.id, version: row.version, from: ['draft'], to: 'discarded', actor, eventType: 'estimate_version.discarded', reason: args.reason ?? null, data: { closedAt: uow.now } })
    const previous = row.versionNumber > 1 ? await uow.tx.estimateVersion.findFirst({ where: { estimateId: est.id, versionNumber: row.versionNumber - 1 }, select: { id: true, status: true } }) : null
    await uow.tx.estimate.update({ where: { id: est.id }, data: previous ? { currentVersionId: previous.id, status: previous.status === 'declined' ? 'declined' : previous.status === 'expired' ? 'expired' : 'open', version: { increment: 1 } } : { status: 'discarded', version: { increment: 1 } } })
    return { versionId: row.id, version, status: 'discarded' }
  })
  return { replay: result.replay, ...result.value }
}

// ── Change orders (SM§6.1) ────────────────────────────────────────────────────

type ChangeLines = { add: (LineSnapshot & { amountMinor: string })[]; remove: { workLineId: string; description: string; amountMinor: string }[] }

export async function draftChangeOrder(db: Db, actor: Actor, args: { jobId: string; reason: string; add?: QuoteRequestLine[] | null; removeWorkLineIds?: string[] | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'change_order.draft', PRESENT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person drafts change orders.')
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why the scope changes.', { field: 'reason' })
  if (!args.add?.length && !args.removeWorkLineIds?.length) throw new DomainError(Codes.INVALID_INPUT, 'Add or remove at least one line.', { field: 'add' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'change_order.draft', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true, businessUnitId: true } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'Job not found.')
    if (['cancelled', 'closed', 'completed'].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: 'job_closed' })
    await assertEstimateAccess(tx, actor, { jobId: job.id, createdById: null, presentedBy: null })
    const sold = await tx.estimate.findFirst({ where: { jobId: job.id, status: 'sold' }, orderBy: { createdAt: 'desc' }, select: { id: true } })
    const active = await activeVersionFor(tx, job.businessUnitId)
    const quoted = args.add?.length ? await quoteFromVersion(tx, active.versionId, args.add, false) : []
    const removing = args.removeWorkLineIds?.length ? await tx.workLine.findMany({ where: { id: { in: args.removeWorkLineIds }, jobId: job.id }, select: { id: true, description: true, amountMinor: true, status: true } }) : []
    if (removing.length !== (args.removeWorkLineIds?.length ?? 0)) throw new DomainError(Codes.INVALID_INPUT, 'Some lines to remove are not on this job.', { field: 'removeWorkLineIds' })
    const done = removing.find(w => w.status !== 'planned')
    if (done) throw new DomainError(Codes.GUARD_FAILED, `"${done.description}" is ${done.status}; only planned work can be removed.`, { reason: 'line_not_planned' })
    const lines: ChangeLines = {
      add: quoted.map(q => ({ ...q, amountMinor: q.amountMinor.toString() })),
      remove: removing.map(w => ({ workLineId: w.id, description: w.description, amountMinor: w.amountMinor.toString() })),
    }
    const delta = quoted.reduce((s, q) => s + q.amountMinor, 0n) - removing.reduce((s, w) => s + w.amountMinor, 0n)
    const ref = await nextReference(tx, 'CO', uow.now)
    const co = await tx.changeOrder.create({ data: { ref, jobId: job.id, estimateId: sold?.id ?? null, priceBookVersionId: active.versionId, status: 'draft', reason: args.reason.trim(), lines: lines as never, deltaMinor: delta, createdById: actorUserId(actor) }, select: { id: true, version: true } })
    auditCreate(uow, actor, 'ChangeOrder', co.id, 'change_order.drafted', { ref, jobId: job.id, deltaMinor: delta.toString(), add: lines.add.length, remove: lines.remove.length })
    return { changeOrderId: co.id, ref, version: co.version, deltaMinor: delta.toString() }
  })
  return { replay: result.replay, ...result.value }
}

async function lockChangeOrder(tx: Tx, id: string, expectedVersion: number) {
  const [row] = await tx.$queryRaw<{ id: string; status: string; version: number; job: string; lines: ChangeLines; deltaMinor: bigint; contentHash: string; ref: string; priceBookVersion: string | null }[]>`SELECT id, status, version, job, lines, "deltaMinor", "contentHash", ref, "priceBookVersion" FROM "ChangeOrder" WHERE id = ${id} FOR UPDATE`
  if (!row) throw new DomainError(Codes.NOT_FOUND, 'Change order not found.')
  if (row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This change order changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
  return row
}

export async function presentChangeOrder(db: Db, actor: Actor, args: { changeOrderId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'change_order.present', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'change_order.present', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockChangeOrder(uow.tx, args.changeOrderId, args.expectedVersion)
    requireStatus(row, ['draft'], 'presented')
    await assertEstimateAccess(uow.tx, actor, { jobId: row.job, createdById: null, presentedBy: null })
    const job = await uow.tx.job.findUniqueOrThrow({ where: { id: row.job }, select: { businessUnitId: true } })
    const active = await activeVersionFor(uow.tx, job.businessUnitId)
    if (row.lines.add.length && row.priceBookVersion !== active.versionId) throw new DomainError(Codes.GUARD_FAILED, 'A new price book is active since this change order was priced. Draft it again.', { reason: 'pricebook_changed' })
    // The lines hold internal unit costs, so this hash is keyed (see keyedPayloadHash).
    const contentHash = keyedPayloadHash({ changeOrderId: row.id, ref: row.ref, lines: row.lines, deltaMinor: row.deltaMinor.toString() })
    const version = await casUpdate(uow, { model: 'ChangeOrder', id: row.id, version: row.version, from: ['draft'], to: 'presented', actor, eventType: 'change_order.presented', data: { contentHash, presentedAt: uow.now } })
    return { changeOrderId: row.id, version, status: 'presented', contentHash }
  })
  return { replay: result.replay, ...result.value }
}

export async function acceptChangeOrder(db: Db, actor: Actor, args: { changeOrderId: string; expectedVersion: number; authorization: AuthorizationInput; saleLocation: SellArgs['saleLocation']; initiatedBy: SellArgs['initiatedBy']; emergencyWaiver?: SellArgs['emergencyWaiver']; acrContext?: string[] | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'change_order.accept', SELL, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records a customer\'s approval.')
  const signerRole = validateAuthorization(args.authorization, args.saleLocation)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'change_order.accept', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockChangeOrder(tx, args.changeOrderId, args.expectedVersion)
    requireStatus(row, ['presented'], 'approved')
    await assertEstimateAccess(tx, actor, { jobId: row.job, createdById: null, presentedBy: null })
    const job = await tx.job.findUniqueOrThrow({ where: { id: row.job }, select: { id: true, customerId: true, businessUnitId: true, location: { select: { id: true, address1: true, address2: true, city: true, state: true, postalCode: true, timeZone: true, propertyClass: true } }, customer: { select: { displayName: true, primaryContact: { select: { preferredLanguage: true } } } } } })
    const authorization = await tx.authorization.create({
      data: {
        subjectType: 'ChangeOrder', subjectId: row.id, jobId: row.job, method: args.authorization.method, signerName: args.authorization.signerName.trim(), signerContactId: args.authorization.signerContactId ?? null, signerRole,
        signature: (args.authorization.signature ?? undefined) as never, callId: args.authorization.callId ?? null, poNumber: args.authorization.poNumber?.trim() ?? '', ip: args.authorization.ip ?? '', userAgent: args.authorization.userAgent ?? '',
        location: args.saleLocation, initiatedBy: args.initiatedBy, selectedLineIds: [] as never, depositMinor: 0n, contentHash: row.contentHash, authorizedAt: uow.now, recordedById: actorUserId(actor),
      },
      select: { id: true },
    })
    auditCreate(uow, actor, 'Authorization', authorization.id, 'authorization.recorded', { subject: `ChangeOrder:${row.id}`, method: args.authorization.method, signerRole, contentHash: row.contentHash })
    const added = []
    for (const a of row.lines.add) {
      const { amountMinor, ...snap } = a
      added.push(await tx.workLine.create({
        data: { jobId: row.job, source: 'change_order', changeOrderId: row.id, description: snap.description, snapshot: { ...snap, changeOrderRef: row.ref } as never, quantity: snap.quantity, uom: snap.uom, unitPriceMinor: BigInt(snap.unitPriceMinor), amountMinor: BigInt(amountMinor), taxCategory: snap.taxCategory, trade: snap.trade, cancellationClass: snap.cancellationClass, status: 'planned' },
        select: { id: true, amountMinor: true, trade: true, cancellationClass: true, description: true },
      }))
    }
    for (const r of row.lines.remove) {
      const w = await tx.workLine.findUniqueOrThrow({ where: { id: r.workLineId }, select: { id: true, version: true, status: true } })
      await casUpdate(uow, { model: 'WorkLine', id: w.id, version: w.version, from: ['planned'], to: 'removed', actor, eventType: 'work_line.removed', metadata: { changeOrderId: row.id } })
    }
    // Rights are re-evaluated for the ADDED lines only (SM§6.1).
    const rights = added.length ? await evaluateSaleRights(uow, actor, {
      jobId: row.job, customerId: job.customerId!, subjectType: 'ChangeOrder', subjectId: row.id, estimateVersionId: null, changeOrderId: row.id, authorizationId: authorization.id,
      location: args.saleLocation, initiatedBy: args.initiatedBy, transactionAt: uow.now, serviceLocation: job.location!, businessUnitId: job.businessUnitId, buyerName: job.customer?.displayName ?? '', language: job.customer?.primaryContact?.preferredLanguage || 'en',
      lines: added.map(w => ({ id: w.id, amountMinor: w.amountMinor, trade: w.trade as never, cancellationClass: w.cancellationClass as never, description: w.description })),
      exclusions: [], emergencyWaiver: args.emergencyWaiver ?? null, acrContext: args.acrContext ?? [],
    }) : null
    const version = await casUpdate(uow, { model: 'ChangeOrder', id: row.id, version: row.version, from: ['presented'], to: 'approved', actor, eventType: 'change_order.approved', data: { authorizationId: authorization.id, decidedAt: uow.now, cancellationEvaluationId: rights?.evaluationId ?? null } })
    return { changeOrderId: row.id, version, status: 'approved', workLineIds: added.map(w => w.id), cancellation: rights }
  })
  return { replay: result.replay, ...result.value }
}

export async function declineChangeOrder(db: Db, actor: Actor, args: { changeOrderId: string; expectedVersion: number; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'change_order.decline', PRESENT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'change_order.decline', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockChangeOrder(uow.tx, args.changeOrderId, args.expectedVersion)
    requireStatus(row, ['draft', 'presented'], 'declined')
    await assertEstimateAccess(uow.tx, actor, { jobId: row.job, createdById: null, presentedBy: null })
    const version = await casUpdate(uow, { model: 'ChangeOrder', id: row.id, version: row.version, from: [row.status], to: 'declined', actor, eventType: 'change_order.declined', reason: args.reason ?? null, data: { decidedAt: uow.now } })
    return { changeOrderId: row.id, version, status: 'declined' }
  })
  return { replay: result.replay, ...result.value }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** For an agent following up: the estimate's state and option totals; no internal costs or margins. */
export async function estimateSummary(db: Db, actor: Actor, args: { estimateId: string }) {
  await authorizeOperation(db, actor, 'estimate.summary', PRESENT, args)
  const est = await loadEstimate(db, args.estimateId)
  if (actor.kind === 'user') await assertEstimateAccess(db, actor, est)
  const version = est.currentVersionId ? await db.estimateVersion.findUnique({ where: { id: est.currentVersionId }, select: { id: true, versionNumber: true, status: true, validUntil: true, declineReason: true, options: { orderBy: { sortOrder: 'asc' }, select: { id: true, tier: true, name: true, totalMinor: true } } } }) : null
  const out = { estimateId: est.id, ref: est.ref, title: est.title, status: est.status, version: version ? { ...version, options: version.options.map(o => ({ ...o, totalMinor: o.totalMinor.toString() })) } : null }
  await recordAgentRead(db, actor, { tool: 'estimate.summary', inputs: args, output: { ref: est.ref, status: est.status } })
  return out
}

