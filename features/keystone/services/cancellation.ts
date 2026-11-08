import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, can, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { auditCreate, casUpdate } from '../lib/cas'
import { command } from '../lib/command'
import { addBusinessDays, addDays, inZone, localDate, US_FEDERAL, zonedInstant, type CalendarSpec } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { DomainError, Codes } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { CancellationRightsError, evaluateCancellationRights, noticeRuleOf, type HomeSolicitationRules, type RightResult, type SaleLine, type SaleLocation } from '../domain/cancellation-rights'
import { noticeDate, noticeText, NoticeTextError } from '../domain/noticeTexts'
import { resolvePolicyFromDb } from '../domain/policy'
import { renderNoticePdf, type NoticeSnapshot } from '../../../lib/salesPdf'
import { addressLine, placeOfLocation, sellerBlock, storeRecordedDocument, storeRenderedPdf, type LocationLike } from './salesShared'

/*
 * Home-solicitation cancellation rights (SM§6.2, I-E6). At every sale and every approved change order
 * the bound home_solicitation policy is evaluated against the sale's facts and stored, right or no
 * right, as an immutable CancellationEvaluation. When a right arises a CancellationNotice is issued:
 * the statutory receipt statement and the cancellation forms in duplicate, rendered from a frozen
 * snapshot. Failure is closed: no policy, an unknown calendar or no verified notice text in the sale's
 * language stops the sale rather than letting it through without a lawful notice.
 *
 * While a notice is open the covered work can't start (the start-work guard in setVisitStatus), unless
 * a second person approved an override with a reason. A buyer's cancellation received before the
 * deadline cancels the covered work lines and opens a refund obligation due in the rule's business days.
 */

const CALENDARS: Record<string, CalendarSpec> = { 'US-FEDERAL': US_FEDERAL }
const SELLERS: Permission[] = ['canSellEstimates', 'canManageCustomers', 'canBook']
const OFFICE: Permission[] = ['canManageCustomers', 'canBook', 'canDispatch', 'canManageInvoices']
const OPEN = ['issued', 'delivered']

export type EmergencyWaiverInput = { present: boolean; handwritten: boolean; signedAndDated: boolean; statement?: string | null; mediaRef?: string | null }

export type SaleRightsInput = {
  jobId: string; customerId: string; subjectType: 'EstimateVersion' | 'ChangeOrder'; subjectId: string
  estimateVersionId: string | null; changeOrderId: string | null; authorizationId: string
  location: SaleLocation; initiatedBy: 'customer_request' | 'solicited'; transactionAt: Date
  serviceLocation: LocationLike & { timeZone: string }
  businessUnitId: string | null; buyerName: string; language: string
  lines: (SaleLine & { description: string })[]
  exclusions: string[]; emergencyWaiver: EmergencyWaiverInput | null; acrContext: string[]
}

const rightsError = (error: unknown): never => {
  if (error instanceof CancellationRightsError || error instanceof NoticeTextError) {
    throw new DomainError(error.code === 'INVALID_INPUT' ? Codes.INVALID_INPUT : Codes.POLICY_INVALID, error.message)
  }
  throw error
}

/** Evaluate, store the evaluation, and issue (or record the waiver of) the notice. Runs inside the sale's transaction. */
export async function evaluateSaleRights(uow: UnitOfWork, actor: Actor, input: SaleRightsInput) {
  const { tx } = uow
  const loc = input.serviceLocation
  const place = placeOfLocation(loc)
  const on = localDate({ timeZone: loc.timeZone }, input.transactionAt)
  const policy = await resolvePolicyFromDb<HomeSolicitationRules>(tx, 'home_solicitation', place, on)
  const facts = {
    location: input.location, initiatedBy: input.initiatedBy, transactionAt: input.transactionAt, timeZone: loc.timeZone,
    lines: input.lines.map(l => ({ id: l.id, amountMinor: l.amountMinor, trade: l.trade, cancellationClass: l.cancellationClass, description: l.description })),
    exclusions: input.exclusions, emergencyWaiver: input.emergencyWaiver ? { present: input.emergencyWaiver.present, handwritten: input.emergencyWaiver.handwritten, signedAndDated: input.emergencyWaiver.signedAndDated } : null,
    acrContext: input.acrContext, language: input.language,
  }
  let result: ReturnType<typeof evaluateCancellationRights>
  try { result = evaluateCancellationRights(policy.rules, facts, CALENDARS) } catch (error) { return rightsError(error) }
  const waivedOnly = !result.applies && result.results.some(r => r.applies && r.waived)
  const evaluation = await tx.cancellationEvaluation.create({
    data: {
      jobId: input.jobId, authorizationId: input.authorizationId, subjectType: input.subjectType, subjectId: input.subjectId, policyVersionId: policy.versionId,
      inputs: { ...facts, transactionAt: facts.transactionAt.toISOString(), lines: facts.lines.map(l => ({ ...l, amountMinor: l.amountMinor.toString() })), packCode: policy.packCode, place } as never,
      results: result as never, rightApplies: result.applies, governingRule: result.governing?.rule ?? '', evaluatedAt: uow.now,
    },
    select: { id: true },
  })
  auditCreate(uow, actor, 'CancellationEvaluation', evaluation.id, 'cancellation.evaluated', { subject: `${input.subjectType}:${input.subjectId}`, policyVersionId: policy.versionId, applies: result.applies, waived: waivedOnly, governing: result.governing?.rule ?? null, coveredAmountMinor: result.coveredAmountMinor })
  if (!result.applies && !waivedOnly) return { evaluationId: evaluation.id, applies: false, noticeId: null, reasons: result.results.map(r => ({ rule: r.rule, reasons: r.reasons })) }

  // The notice: every applying rule's form (federal and state each require their own), governed by the longest window.
  const live = result.results.filter(r => r.applies && (waivedOnly ? r.waived : !r.waived))
  const governing = waivedOnly ? live[0] : result.governing!
  const coveredIds = waivedOnly ? [...new Set(live.flatMap(r => r.coveredLineIds))] : result.coveredLineIds
  const covered = input.lines.filter(l => coveredIds.includes(l.id))
  const coveredAmount = covered.reduce((s, l) => s + l.amountMinor, 0n)
  const { block } = await sellerBlock(tx, input.businessUnitId, place.state, [])
  const fill = { sellerName: block.legalName || block.name, sellerAddress: block.address, transactionDate: noticeDate(governing.transactionDate), cancelByDate: noticeDate(governing.lastDay!) }
  const templates = [...new Set(live.map(r => r.noticeTemplate))]
  let notices: NoticeSnapshot['notices']
  try { notices = templates.map(t => noticeText(t, input.language, fill)) } catch (error) { return rightsError(error) }
  const ref = await nextReference(tx, 'NOC', uow.now)
  const snapshot: NoticeSnapshot = {
    ref, transactionDate: governing.transactionDate, cancelByDate: governing.lastDay!, cancelBy: governing.cancelBy!, timeZone: loc.timeZone, language: input.language,
    seller: { name: fill.sellerName, address: fill.sellerAddress }, buyer: { name: input.buyerName, address: addressLine(loc) },
    notices, coveredLines: covered.map(l => ({ description: l.description, amountMinor: l.amountMinor.toString() })), coveredAmountMinor: coveredAmount.toString(),
  }
  const notice = await tx.cancellationNotice.create({
    data: {
      ref, evaluationId: evaluation.id, jobId: input.jobId, customerId: input.customerId, estimateVersionId: input.estimateVersionId, changeOrderId: input.changeOrderId,
      rule: noticeRuleOf(governing.rule), rules: live.map(r => ({ rule: r.rule, title: r.title, cancelBy: r.cancelBy, lastDay: r.lastDay, refundBusinessDays: r.refundBusinessDays, coveredLineIds: r.coveredLineIds, waived: r.waived })) as never,
      policyVersionId: policy.versionId, noticeTemplate: governing.noticeTemplate, language: input.language,
      coveredWorkLines: { connect: coveredIds.map(id => ({ id })) }, coveredAmountMinor: coveredAmount, transactionAt: input.transactionAt, cancelBy: new Date(governing.cancelBy!), timeZone: loc.timeZone,
      status: 'issued', snapshot: snapshot as never,
    },
    select: { id: true, version: true },
  })
  const pdf = await storeRenderedPdf(uow, actor, { title: `${ref} notice of cancellation`, kind: 'cancellation_notice', subjectType: 'CancellationNotice', subjectId: notice.id, storageKey: `render:cancellation-notice/${notice.id}`, bytes: renderNoticePdf(snapshot) })
  await tx.cancellationNotice.update({ where: { id: notice.id }, data: { noticeDocumentId: pdf.documentId } })
  auditCreate(uow, actor, 'CancellationNotice', notice.id, 'cancellation_notice.issued', { ref, rule: governing.rule, cancelBy: governing.cancelBy, coveredAmountMinor: coveredAmount.toString(), coveredLines: coveredIds.length, templates, documentSha256: pdf.sha256 })
  if (waivedOnly) {
    const waiver = await recordWaiver(uow, actor, notice.id, ref, input.emergencyWaiver!)
    await casUpdate(uow, { model: 'CancellationNotice', id: notice.id, version: notice.version, from: ['issued'], to: 'waived', actor, eventType: 'cancellation_notice.waived', data: { waiverDocumentId: waiver.documentId }, audit: { waiverSha256: waiver.sha256 } })
  }
  return { evaluationId: evaluation.id, applies: !waivedOnly, waived: waivedOnly, noticeId: notice.id, ref, cancelBy: governing.cancelBy, coveredAmountMinor: coveredAmount.toString(), documentId: pdf.documentId }
}

async function recordWaiver(uow: UnitOfWork, actor: Actor, noticeId: string, ref: string, waiver: EmergencyWaiverInput) {
  const statement = waiver.statement?.trim()
  if (!statement) throw new DomainError(Codes.INVALID_INPUT, 'Transcribe the buyer\'s handwritten emergency statement.', { field: 'emergencyWaiver.statement' })
  if (!waiver.mediaRef?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Attach the photo or scan of the buyer\'s handwritten statement.', { field: 'emergencyWaiver.mediaRef' })
  return storeRecordedDocument(uow, actor, { title: `${ref} emergency waiver`, kind: 'emergency_waiver', subjectType: 'CancellationNotice', subjectId: noticeId, storageKey: `media:${waiver.mediaRef.trim()}`, content: statement, mimeType: 'text/plain' })
}

// ── Notice lifecycle ──────────────────────────────────────────────────────────

type NoticeRow = { id: string; ref: string; status: string; version: number; job: string; cancelBy: Date; transactionAt: Date; timeZone: string; rules: { rule: string; refundBusinessDays: number; waived: boolean }[]; evaluation: string; startOverride: string | null; estimateVersion: string | null }

async function lockNotice(tx: Tx, id: string, expectedVersion?: number | null) {
  const [row] = await tx.$queryRaw<NoticeRow[]>`SELECT id, ref, status, version, job, "cancelBy", "transactionAt", "timeZone", rules, evaluation, "startOverride", "estimateVersion" FROM "CancellationNotice" WHERE id = ${id} FOR UPDATE`
  if (!row) throw new DomainError(Codes.NOT_FOUND, 'Cancellation notice not found.')
  if (expectedVersion !== undefined && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This notice changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
  return row
}

async function assertNoticeAccess(tx: Tx, actor: Actor, jobId: string) {
  if (actor.kind !== 'user' || OFFICE.some(p => can(actor, p))) return
  if (await tx.visitAssignment.count({ where: { active: true, visit: { jobId }, employee: { userId: actor.userId } } })) return
  throw new DomainError(Codes.NOT_AUTHORIZED, 'This notice is on a job you are not assigned to.')
}

const DELIVERY = ['signed_on_device', 'emailed', 'printed_acknowledged', 'handed_paper_copy'] as const

/** issued → delivered, with evidence of how the buyer got the notice and both forms. */
export async function deliverCancellationNotice(db: Db, actor: Actor, args: { noticeId: string; method: (typeof DELIVERY)[number]; acknowledgedBy: string; signature?: unknown; messageId?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'cancellation.deliver', SELLERS, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records delivery of a notice.')
  if (!DELIVERY.includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, `Delivery is one of ${DELIVERY.join(', ')}.`, { field: 'method' })
  if (!args.acknowledgedBy?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Who received the notice?', { field: 'acknowledgedBy' })
  if (args.method === 'signed_on_device' && (args.signature === undefined || args.signature === null || args.signature === '')) throw new DomainError(Codes.INVALID_INPUT, 'Capture the buyer\'s signature acknowledging the notice.', { field: 'signature' })
  if (args.method === 'emailed' && !args.messageId) throw new DomainError(Codes.INVALID_INPUT, 'Link the sent email.', { field: 'messageId' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'cancellation.deliver', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion)
    if (row.status !== 'issued') throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} notice can't be delivered.`, { currentStatus: row.status })
    await assertNoticeAccess(uow.tx, actor, row.job)
    if (args.messageId) {
      const message = await uow.tx.message.findUnique({ where: { id: args.messageId }, select: { status: true } })
      if (!message || !['sent', 'delivered'].includes(message.status)) throw new DomainError(Codes.GUARD_FAILED, 'That email has not been sent.', { reason: 'message_not_sent' })
    }
    const evidence = { method: args.method, acknowledgedBy: args.acknowledgedBy.trim(), signature: args.signature ?? null, messageId: args.messageId ?? null, recordedBy: actorUserId(actor), at: uow.now.toISOString() }
    const version = await casUpdate(uow, { model: 'CancellationNotice', id: row.id, version: row.version, from: ['issued'], to: 'delivered', actor, eventType: 'cancellation_notice.delivered', data: { deliveryEvidence: evidence as never, deliveredAt: uow.now }, audit: { method: args.method } })
    return { noticeId: row.id, version, status: 'delivered' }
  })
  return { replay: result.replay, ...result.value }
}

/** A buyer-initiated emergency with the buyer's own handwritten, signed and dated waiver (only where every applying rule allows it). */
export async function waiveCancellationNotice(db: Db, actor: Actor, args: { noticeId: string; waiver: EmergencyWaiverInput; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'cancellation.waive', SELLERS, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records a waiver.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'cancellation.waive', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockNotice(tx, args.noticeId, args.expectedVersion)
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} notice can't be waived.`, { currentStatus: row.status })
    if (uow.now.getTime() >= row.cancelBy.getTime()) throw new DomainError(Codes.GUARD_FAILED, 'The cancellation window has closed.', { reason: 'window_closed' })
    await assertNoticeAccess(tx, actor, row.job)
    const evaluation = await tx.cancellationEvaluation.findUniqueOrThrow({ where: { id: row.evaluation }, select: { inputs: true, policyVersionId: true } })
    const inputs = evaluation.inputs as { initiatedBy: string }
    if (inputs.initiatedBy !== 'customer_request') throw new DomainError(Codes.GUARD_FAILED, 'Only a buyer who called for an emergency can waive the right.', { reason: 'not_buyer_initiated' })
    const version = await tx.policyVersion.findUniqueOrThrow({ where: { id: evaluation.policyVersionId! }, select: { rules: true } })
    const policyRules = (version.rules as HomeSolicitationRules).rules
    for (const r of row.rules) {
      const rule = policyRules.find(p => p.code === r.rule)
      if (!rule?.emergencyWaiver.allowed) throw new DomainError(Codes.GUARD_FAILED, `${rule?.title ?? r.rule} can't be waived; the buyer keeps the right to cancel.`, { reason: 'waiver_not_available', rule: r.rule })
      if ((rule.emergencyWaiver.handwritten && !args.waiver.handwritten) || (rule.emergencyWaiver.signedAndDated && !args.waiver.signedAndDated)) throw new DomainError(Codes.GUARD_FAILED, 'The waiver must be the buyer\'s own handwritten statement, signed and dated.', { reason: 'waiver_incomplete' })
    }
    const waiver = await recordWaiver(uow, actor, row.id, row.ref, { ...args.waiver, present: true })
    const next = await casUpdate(uow, { model: 'CancellationNotice', id: row.id, version: row.version, from: OPEN, to: 'waived', actor, eventType: 'cancellation_notice.waived', data: { waiverDocumentId: waiver.documentId }, audit: { waiverSha256: waiver.sha256 } })
    return { noticeId: row.id, version: next, status: 'waived' }
  })
  return { replay: result.replay, ...result.value }
}

const RECEIVED_VIA = ['signed_form', 'mail', 'email', 'in_person', 'portal'] as const

/**
 * The buyer cancelled. `sentAt` is when the buyer gave notice: the postmark for mail, the send time for
 * email, the moment it was handed over in person. It must fall before the deadline.
 */
export async function recordBuyerCancellation(db: Db, actor: Actor, args: { noticeId: string; via: (typeof RECEIVED_VIA)[number]; sentAt: string; amountPaidMinor?: string | null; note?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'cancellation.record_buyer_cancel', OFFICE, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records a buyer\'s cancellation.')
  if (!RECEIVED_VIA.includes(args.via)) throw new DomainError(Codes.INVALID_INPUT, `Received via one of ${RECEIVED_VIA.join(', ')}.`, { field: 'via' })
  const sentAt = new Date(args.sentAt)
  if (Number.isNaN(sentAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, 'When did the buyer send it?', { field: 'sentAt' })
  const typedPaid = args.amountPaidMinor ? (/^\d{1,13}$/.test(args.amountPaidMinor) ? BigInt(args.amountPaidMinor) : (() => { throw new DomainError(Codes.INVALID_INPUT, 'Amount paid is whole cents.', { field: 'amountPaidMinor' }) })()) : null
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'cancellation.record_buyer_cancel', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockNotice(tx, args.noticeId, args.expectedVersion)
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} notice can't be cancelled.`, { currentStatus: row.status })
    if (sentAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, 'The send time is in the future.', { field: 'sentAt' })
    if (sentAt.getTime() < row.transactionAt.getTime()) throw new DomainError(Codes.INVALID_INPUT, 'The send time is before the sale.', { field: 'sentAt' })
    if (sentAt.getTime() >= row.cancelBy.getTime()) throw new DomainError(Codes.GUARD_FAILED, 'This was sent after the cancellation deadline. Handle it as a customer-service cancellation, not a cooling-off cancellation.', { reason: 'after_deadline', cancelBy: row.cancelBy.toISOString() })
    // When the office does not type an amount, the refund is what was recorded as paid at the sale (the authorization's deposit).
    const recorded = await tx.cancellationNotice.findUnique({ where: { id: row.id }, select: { evaluation: { select: { authorization: { select: { depositMinor: true } } } } } })
    const paid = typedPaid ?? recorded?.evaluation?.authorization?.depositMinor ?? 0n
    const covered = await tx.workLine.findMany({ where: { cancellationNotices: { some: { id: row.id } } }, select: { id: true, version: true, status: true, amountMinor: true } })
    const cancelled: string[] = []
    for (const w of covered) {
      if (!['planned', 'completed'].includes(w.status)) continue
      await casUpdate(uow, { model: 'WorkLine', id: w.id, version: w.version, from: ['planned', 'completed'], to: 'cancelled_by_buyer', actor, eventType: 'work_line.cancelled_by_buyer', metadata: { noticeId: row.id } })
      cancelled.push(w.id)
    }
    // Refund due within the governing rule's business days of the buyer's notice (federal: 10).
    const days = Math.min(...row.rules.filter(r => !r.waived).map(r => r.refundBusinessDays))
    const cal = inZone(US_FEDERAL, row.timeZone)
    const lastRefundDay = addBusinessDays(cal, localDate(cal, sentAt), Number.isFinite(days) ? days : 10)
    const refundDueBy = zonedInstant(row.timeZone, addDays(lastRefundDay, 1), '00:00')
    const version = await casUpdate(uow, {
      model: 'CancellationNotice', id: row.id, version: row.version, from: OPEN, to: 'cancelled_by_buyer', actor, eventType: 'cancellation_notice.cancelled_by_buyer', reason: args.note ?? null,
      data: { cancelledAt: sentAt, cancellationReceivedVia: args.via, refundDueBy, refundDueMinor: paid }, audit: { via: args.via, sentAt: sentAt.toISOString(), refundDueBy: lastRefundDay, refundDueMinor: paid.toString(), workLines: cancelled.length },
    })
    // If nothing of the sold estimate remains, the estimate is cancelled too.
    if (row.estimateVersion) {
      const remaining = await tx.workLine.count({ where: { estimateLine: { option: { estimateVersionId: row.estimateVersion } }, status: { in: ['planned', 'completed'] } } })
      if (!remaining) {
        const ev = await tx.estimateVersion.findUniqueOrThrow({ where: { id: row.estimateVersion }, select: { id: true, version: true, status: true, estimateId: true } })
        if (ev.status === 'sold') {
          await casUpdate(uow, { model: 'EstimateVersion', id: ev.id, version: ev.version, from: ['sold'], to: 'cancelled', actor, eventType: 'estimate_version.cancelled_by_buyer', metadata: { noticeId: row.id } })
          if (ev.estimateId) await tx.estimate.update({ where: { id: ev.estimateId }, data: { status: 'cancelled', version: { increment: 1 } } })
        }
      }
    }
    await tx.task.upsert({
      where: { dedupeKey: `cancellation.refund:${row.id}` },
      create: { kind: 'cancellation.refund', title: `${row.ref}: buyer cancelled. ${paid > 0n ? 'Refund the payment and ' : ''}release any security interest by ${lastRefundDay}; cancel the scheduled work.`.slice(0, 200), subjectType: 'CancellationNotice', subjectId: row.id, status: 'open', priority: 'high', dueAt: refundDueBy, dedupeKey: `cancellation.refund:${row.id}` },
      update: {},
    })
    return { noticeId: row.id, version, status: 'cancelled_by_buyer', refundDueBy: lastRefundDay, workLineIds: cancelled }
  })
  return { replay: result.replay, ...result.value }
}

/** cancelled_by_buyer → refunded, with the evidence (processor refund id, check number, or "nothing was paid"). */
export async function markCancellationRefunded(db: Db, actor: Actor, args: { noticeId: string; evidence: { method: 'processor_refund' | 'check' | 'nothing_paid'; reference?: string | null; amountMinor: string }; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'cancellation.refunded', ['canIssueRefunds', 'canManagePayments'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person records refunds.')
  const e = args.evidence
  if (!e || !['processor_refund', 'check', 'nothing_paid'].includes(e.method)) throw new DomainError(Codes.INVALID_INPUT, 'Refund evidence is a processor refund, a check, or nothing was paid.', { field: 'evidence.method' })
  if (!/^\d{1,13}$/.test(e.amountMinor ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'Amount is whole cents.', { field: 'evidence.amountMinor' })
  if (e.method !== 'nothing_paid' && !e.reference?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Give the refund or check reference.', { field: 'evidence.reference' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'cancellation.refunded', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion)
    if (row.status !== 'cancelled_by_buyer') throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} notice has no refund to record.`, { currentStatus: row.status })
    const due = await uow.tx.cancellationNotice.findUniqueOrThrow({ where: { id: row.id }, select: { refundDueMinor: true } })
    const amount = BigInt(e.amountMinor)
    if (amount !== due.refundDueMinor) throw new DomainError(Codes.GUARD_FAILED, `The refund must be the full amount paid (${due.refundDueMinor.toString()}¢).`, { reason: 'refund_amount_mismatch' })
    if ((e.method === 'nothing_paid') !== (amount === 0n)) throw new DomainError(Codes.INVALID_INPUT, '"Nothing paid" means an amount of zero.', { field: 'evidence.method' })
    const version = await casUpdate(uow, { model: 'CancellationNotice', id: row.id, version: row.version, from: ['cancelled_by_buyer'], to: 'refunded', actor, eventType: 'cancellation_notice.refunded', data: { refundEvidence: { ...e, recordedBy: actorUserId(actor), at: uow.now.toISOString() } as never }, audit: { method: e.method, amountMinor: e.amountMinor } })
    await uow.tx.task.updateMany({ where: { dedupeKey: `cancellation.refund:${row.id}`, status: 'open' }, data: { status: 'done', closedAt: uow.now, closedById: actorUserId(actor), resolution: 'Refund recorded', version: { increment: 1 } } })
    return { noticeId: row.id, version, status: 'refunded' }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * Timer: delivered notices whose window passed expire, which lifts the start-work hold. A notice that
 * was never delivered does not expire: the buyer never got the forms, so the office is told instead.
 */
export async function expireCancellationNotices(db: Db, now = new Date()) {
  const due = await db.cancellationNotice.findMany({ where: { status: { in: OPEN }, cancelBy: { lte: now } }, select: { id: true, ref: true, status: true }, take: 200 })
  let expired = 0
  let undelivered = 0
  for (const n of due) {
    if (n.status === 'issued') {
      await db.task.upsert({ where: { dedupeKey: `cancellation.undelivered:${n.id}` }, create: { kind: 'cancellation.undelivered', title: `${n.ref}: the notice of cancellation was never recorded as delivered. Deliver it; the buyer's right continues until then.`.slice(0, 200), subjectType: 'CancellationNotice', subjectId: n.id, status: 'open', priority: 'high', dedupeKey: `cancellation.undelivered:${n.id}` }, update: {} })
      undelivered += 1
      continue
    }
    const actor: Actor = { kind: 'system', name: 'cancellation-expiry' }
    const r = await command(db, { name: 'cancellation.expire', actor, idempotencyKey: `cancellation-expire:${n.id}`, params: { noticeId: n.id }, now }, async uow => {
      const row = await lockNotice(uow.tx, n.id)
      if (row.status !== 'delivered' || row.cancelBy.getTime() > now.getTime()) return false
      await casUpdate(uow, { model: 'CancellationNotice', id: row.id, version: row.version, from: ['delivered'], to: 'expired_uncancelled', actor, eventType: 'cancellation_notice.expired' })
      return true
    })
    if (r.value) expired += 1
  }
  return { expired, undelivered }
}

// ── Start-work hold (I-E6) ────────────────────────────────────────────────────

/** Open notices on a job that still hold back their covered lines (no approved override). */
export async function cancellationHoldsFor(db: Tx | Db, jobId: string, now: Date) {
  const notices = await db.cancellationNotice.findMany({
    where: { jobId, status: { in: OPEN } },
    select: { id: true, ref: true, status: true, cancelBy: true, startOverrideId: true, startOverride: { select: { status: true } }, coveredWorkLines: { select: { id: true, status: true } } },
  })
  return notices
    .filter(n => !(n.startOverride?.status === 'approved'))
    .filter(n => n.status === 'issued' || n.cancelBy.getTime() > now.getTime())
    .map(n => ({ id: n.id, ref: n.ref, status: n.status, cancelBy: n.cancelBy, lineIds: n.coveredWorkLines.filter(w => w.status === 'planned').map(w => w.id) }))
    .filter(n => n.lineIds.length > 0)
}

/**
 * A visit may start work only if it has uncovered work to do. When every planned line on the job is
 * held by an open notice, starting would start the buyer's cancellable work, so it is refused until the
 * window passes, the buyer waives (emergency), or a second person approves an override.
 */
export async function assertCanStartWork(tx: Tx, jobId: string, now: Date) {
  const holds = await cancellationHoldsFor(tx, jobId, now)
  if (!holds.length) return { holds: [] as typeof holds }
  const held = new Set(holds.flatMap(h => h.lineIds))
  const free = await tx.workLine.count({ where: { jobId, status: 'planned', id: { notIn: [...held] } } })
  if (free > 0) return { holds }
  const first = holds.sort((a, b) => a.cancelBy.getTime() - b.cancelBy.getTime())[0]
  throw new DomainError(Codes.GUARD_FAILED, first.status === 'issued'
    ? `The buyer's notice of cancellation (${first.ref}) hasn't been recorded as delivered, so the work it covers can't start.`
    : `The buyer can still cancel this work until ${first.cancelBy.toISOString()} (${first.ref}). Wait, record an emergency waiver, or ask a manager to approve starting early.`,
  { reason: 'cancellation_hold', noticeId: first.id, cancelBy: first.cancelBy.toISOString() })
}

/** Ask a second person to approve starting covered work inside the window. The buyer keeps the right to cancel. */
export const MIN_OVERRIDE_REASON = 10

/** Only the technician assigned to the job's visits, or someone with dispatch rights, may ask to start early. */
async function assertMayRequestOverride(tx: Tx, actor: Actor, jobId: string) {
  if (actor.kind !== 'user') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person asks to start early.')
  if (actor.permissions.has('canDispatch')) return
  const assigned = await tx.visit.count({ where: { jobId, assignments: { some: { active: true, employee: { user: { id: { equals: actor.userId } } } } } } })
  if (!assigned) throw new DomainError(Codes.NOT_AUTHORIZED, 'Only the technician assigned to this job, or dispatch, can ask to start early.')
}

export async function requestCancellationHoldOverride(db: Db, actor: Actor, args: { noticeId: string; reason: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'cancellation.override_hold', ['canDispatch', 'canSellEstimates'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not override cancellation holds.')
  const reasonText = args.reason?.trim() ?? ''
  if (reasonText.length < MIN_OVERRIDE_REASON) throw new DomainError(Codes.INVALID_INPUT, `Say why the work must start before the window closes (at least ${MIN_OVERRIDE_REASON} characters).`, { field: 'reason' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'cancellation.override_hold', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion)
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll('_', ' ')} notice holds nothing back.`, { currentStatus: row.status })
    await assertMayRequestOverride(uow.tx, actor, row.job)
    if (row.startOverride) {
      const existing = await uow.tx.approvalRequest.findUnique({ where: { id: row.startOverride }, select: { status: true } })
      if (existing && ['pending', 'approved'].includes(existing.status)) throw new DomainError(Codes.GUARD_FAILED, `An override is already ${existing.status}.`, { reason: 'override_exists' })
    }
    const approval = await requestApproval(uow, actor, { action: 'cancellation.start_override', targetList: 'CancellationNotice', targetId: row.id, requiredPermission: 'canApprovePolicies', payload: { noticeId: row.id, cancelBy: row.cancelBy.toISOString(), reason: args.reason.trim() }, summary: `${row.ref}: start covered work before ${row.cancelBy.toISOString()} — ${args.reason.trim()}` })
    const version = await casUpdate(uow, { model: 'CancellationNotice', id: row.id, version: row.version, from: OPEN, to: row.status, actor, eventType: 'cancellation_notice.override_requested', reason: args.reason, data: { startOverrideId: approval.id }, audit: { approvalId: approval.id } })
    return { noticeId: row.id, version, approvalRequestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

// The approval itself is the override: the hold checks for an approved request on the notice.
registerApplier('cancellation.start_override', async (uow, actor, request) => {
  const row = await lockNotice(uow.tx, request.targetId)
  if (row.startOverride !== request.id) throw new DomainError(Codes.APPROVAL_MISMATCH, 'A different override is on this notice now.')
  auditCreate(uow, actor, 'CancellationNotice', row.id, 'cancellation_notice.override_approved', { approvalRequestId: request.id })
  return { noticeId: row.id, overridden: true }
})

export type { RightResult }
