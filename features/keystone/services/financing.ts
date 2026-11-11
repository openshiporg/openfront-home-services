import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import { money, lockInvoice, allocatePayment } from './billingShared'
import { createPaymentForFunding } from './financingPayment'

/*
 * Financing is a record of an offer made by a third party (SM§9). We do not call a lender and we send nothing: staff note what
 * the partner said, and the customer applies on the partner's own page. Funding is recorded when the partner's payout arrives,
 * and only once the cancellation window on the sale has closed (the cancelBy guard), because a funded loan on a cancellable sale
 * would have to be unwound.
 */

const FIN = ['canOfferFinancing', 'canManageInvoices'] as const
const cents = (v: unknown, field: string) => {
  if (typeof v !== 'string' || !/^[1-9]\d{0,12}$/.test(v)) throw new DomainError(Codes.INVALID_INPUT, 'Amount is whole cents, more than zero.', { field })
  return BigInt(v)
}

/** Start a record of an offer: the customer, the amount, the program and (when known) the invoice or estimate it is for. */
export async function startFinancing(db: Db, actor: Actor, args: { customerId: string; programId: string; amountMinor: string; jobId?: string | null; invoiceId?: string | null; estimateVersionId?: string | null; consent: boolean; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'financing.start', [...FIN], args)
  const amount = cents(args.amountMinor, 'amountMinor')
  if (args.consent !== true) throw new DomainError(Codes.GUARD_FAILED, 'Record that the customer agreed to be sent to the partner\'s application first.', { reason: 'consent_required' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'financing.start', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const program = await tx.financingProgram.findUnique({ where: { id: args.programId } })
    if (!program || !program.active) throw new DomainError(Codes.GUARD_FAILED, 'That financing program is not offered.')
    if (amount < program.minMinor || amount > program.maxMinor) throw new DomainError(Codes.GUARD_FAILED, `This program covers ${money(program.minMinor)} to ${money(program.maxMinor)}.`, { reason: 'outside_program_range' })
    const customer = await tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true } })
    if (!customer) throw new DomainError(Codes.NOT_FOUND, 'Customer not found.')
    if (args.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: args.invoiceId }, select: { customerId: true, balanceMinor: true, status: true } })
      if (!inv || inv.customerId !== customer.id) throw new DomainError(Codes.GUARD_FAILED, 'That invoice is not this customer\'s.')
      if (amount > inv.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `That is more than the ${money(inv.balanceMinor)} still owed.`)
    }
    const ref = await nextReference(tx, 'FIN', uow.now)
    const app = await tx.financingApplication.create({ data: { ref, customerId: customer.id, jobId: args.jobId ?? null, invoiceId: args.invoiceId ?? null, estimateVersionId: args.estimateVersionId ?? null, programId: program.id, amountMinor: amount, status: 'started', consentRecordedAt: uow.now, createdById: actorUserId(actor) }, select: { id: true } })
    auditCreate(uow, actor, 'FinancingApplication', app.id, 'financing.started', { ref, amountMinor: amount.toString(), programId: program.id })
    return { applicationId: app.id, ref, applyUrl: program.applyUrl }
  })
  return { replay: result.replay, ...result.value }
}

const FLOW: Record<string, string[]> = {
  started: ['submitted', 'cancelled'],
  submitted: ['approved', 'declined', 'needs_info', 'cancelled'],
  needs_info: ['submitted', 'declined', 'cancelled'],
  approved: ['docs_signed', 'declined', 'expired', 'cancelled'],
  docs_signed: ['awaiting_funding', 'cancelled'],
  awaiting_funding: ['funded', 'cancelled'],
}

/** Note what the partner told the customer. Offers are kept exactly as given; this system never computes a rate or a payment. */
export async function recordFinancingStatus(db: Db, actor: Actor, args: { applicationId: string; to: string; expectedVersion: number; partnerReference?: string | null; offers?: unknown; selectedOffer?: unknown; offerExpiresAt?: string | null; note?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'financing.record_status', [...FIN], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'financing.record_status', actor, idempotencyKey, params, now: args.now }, async uow => {
    const app = await lockRow<{ id: string; version: number; status: string; amountMinor: bigint }>(uow.tx, 'FinancingApplication', args.applicationId)
    if (app.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This application changed since you loaded it. Reload and try again.', { currentStatus: app.status, currentVersion: app.version })
    if (args.to === 'funded') throw new DomainError(Codes.INVALID_INPUT, 'Funding is recorded with the partner\'s payout reference.', { field: 'to' })
    if (!(FLOW[app.status] ?? []).includes(args.to)) throw new DomainError(Codes.INVALID_TRANSITION, `Financing cannot go from ${app.status.replace(/_/g, ' ')} to ${args.to.replace(/_/g, ' ')}.`)
    if (args.to === 'declined' && !args.note?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Note the reason the partner gave.', { field: 'note' })
    if (args.to === 'approved' && !args.offers) throw new DomainError(Codes.INVALID_INPUT, 'Record the offers exactly as the partner showed them.', { field: 'offers' })
    const data: Record<string, unknown> = {}
    if (args.partnerReference) data.partnerReference = args.partnerReference.trim()
    if (args.offers) data.offers = args.offers
    if (args.selectedOffer) data.selectedOffer = args.selectedOffer
    if (args.offerExpiresAt) data.offerExpiresAt = new Date(args.offerExpiresAt)
    if (args.to === 'declined') data.declineNote = args.note!.trim()
    const version = await casUpdate(uow, { model: 'FinancingApplication', id: app.id, version: app.version, from: [app.status], to: args.to, actor, eventType: `financing.${args.to}`, reason: args.note ?? null, data, audit: { partnerReference: args.partnerReference ?? null } })
    return { applicationId: app.id, status: args.to, version }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * Funding arrives. Recorded only when the loan was signed, the amount matches what the customer chose, and the sale's
 * cancellation window has closed (cancelBy), or a cancelled-sale notice does not exist. The payout becomes a payment on the invoice.
 */
export async function recordFinancingFunding(db: Db, actor: Actor, args: { applicationId: string; expectedVersion: number; grossMinor: string; feeMinor?: string | null; reference: string; fundedAt?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'financing.fund', ['canManagePayments', 'canManageAccounting'], args)
  const gross = cents(args.grossMinor, 'grossMinor')
  const fee = args.feeMinor ? BigInt(args.feeMinor) : 0n
  if (fee < 0n || fee >= gross) throw new DomainError(Codes.INVALID_INPUT, 'The partner fee is less than the payout.', { field: 'feeMinor' })
  if (!String(args.reference ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the partner\'s payout reference.', { field: 'reference' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'financing.fund', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const app = await lockRow<{ id: string; version: number; status: string; amountMinor: bigint; invoiceId: string | null; jobId: string | null; customerId: string | null }>(tx, 'FinancingApplication', args.applicationId)
    if (app.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This application changed since you loaded it. Reload and try again.')
    if (app.status !== 'awaiting_funding') throw new DomainError(Codes.GUARD_FAILED, `Funding is recorded once the loan is signed and awaiting funding; this one is ${app.status.replace(/_/g, ' ')}.`)
    if (gross !== app.amountMinor) throw new DomainError(Codes.GUARD_FAILED, `The partner funded ${money(gross)} but the customer chose ${money(app.amountMinor)}.`, { reason: 'amount_mismatch' })
    if (!app.invoiceId) throw new DomainError(Codes.GUARD_FAILED, 'Link the financing to an invoice before recording funding.', { reason: 'invoice_required' })
    const fundedAt = args.fundedAt ? new Date(args.fundedAt) : uow.now
    if (Number.isNaN(fundedAt.getTime()) || fundedAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, 'When did the money arrive? Not in the future.', { field: 'fundedAt' })
    // cancelBy guard: any open cancellation window on this job's sale must have closed.
    if (app.jobId) {
      const open = await tx.cancellationNotice.findFirst({ where: { jobId: app.jobId, status: { in: ['issued', 'delivered'] }, cancelBy: { gt: uow.now } }, select: { ref: true, cancelBy: true } })
      if (open) throw new DomainError(Codes.GUARD_FAILED, `The customer can still cancel this sale until ${open.cancelBy.toISOString().slice(0, 10)} (${open.ref}). Record funding after that.`, { reason: 'cancel_window_open', cancelBy: open.cancelBy.toISOString() })
      const cancelled = await tx.cancellationNotice.findFirst({ where: { jobId: app.jobId, status: { in: ['cancelled_by_buyer', 'refunded'] } }, select: { ref: true } })
      if (cancelled) throw new DomainError(Codes.GUARD_FAILED, `The customer cancelled this sale (${cancelled.ref}); do not record funding.`, { reason: 'sale_cancelled' })
    }
    const invoice = await lockInvoice(tx, app.invoiceId)
    const payment = await createPaymentForFunding(uow, actor, { invoice, gross, fee, reference: args.reference.trim(), receivedAt: fundedAt })
    const funding = await tx.financingFunding.create({ data: { applicationId: app.id, grossMinor: gross, feeMinor: fee, reference: args.reference.trim(), fundedAt, paymentId: payment.id }, select: { id: true } })
    const apply = gross < invoice.balanceMinor ? gross : invoice.balanceMinor
    await allocatePayment(uow, actor, invoice, payment.id, apply)
    const version = await casUpdate(uow, { model: 'FinancingApplication', id: app.id, version: app.version, from: ['awaiting_funding'], to: 'funded', actor, eventType: 'financing.funded', data: {}, audit: { grossMinor: gross.toString(), feeMinor: fee.toString() } })
    auditCreate(uow, actor, 'FinancingFunding', funding.id, 'financing.funding_recorded', { applicationId: app.id, grossMinor: gross.toString(), feeMinor: fee.toString(), reference: args.reference, paymentId: payment.id })
    return { applicationId: app.id, status: 'funded', version, paymentId: payment.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Start with a financing program (office setup). */
export async function saveFinancingProgram(db: Db, actor: Actor, args: { programId?: string | null; name: string; partner?: string | null; minMinor: string; maxMinor: string; termsNote?: string | null; applyUrl?: string | null; active?: boolean | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'financing.program_save', ['canManageInvoices', 'canManageAccounting'], args)
  const min = cents(args.minMinor, 'minMinor')
  const max = cents(args.maxMinor, 'maxMinor')
  if (max < min) throw new DomainError(Codes.INVALID_INPUT, 'The maximum is at least the minimum.', { field: 'maxMinor' })
  if (!String(args.name ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Name the program.', { field: 'name' })
  if (args.applyUrl && !/^https:\/\//i.test(args.applyUrl)) throw new DomainError(Codes.INVALID_INPUT, 'The application link is an https address.', { field: 'applyUrl' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'financing.program_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const data = { name: args.name.trim(), partner: args.partner === 'other' ? 'other' : 'wisetack', minMinor: min, maxMinor: max, termsNote: args.termsNote?.trim() ?? '', applyUrl: args.applyUrl?.trim() ?? '', active: args.active !== false }
    const row = args.programId ? await uow.tx.financingProgram.update({ where: { id: args.programId }, data, select: { id: true } }) : await uow.tx.financingProgram.create({ data, select: { id: true } })
    auditCreate(uow, actor, 'FinancingProgram', row.id, args.programId ? 'financing.program_updated' : 'financing.program_created', { name: data.name })
    return { programId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Third-party authorizations (warranty companies, POs, not-to-exceed) ─────────

export async function recordThirdPartyAuthorization(db: Db, actor: Actor, args: { jobId: string; payerId: string; kind: string; externalRef: string; authorizedAmountMinor: string; serviceFeeMinor?: string | null; expectedVersion?: number | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'authorization.record', ['canManageInvoices'], args)
  const amount = cents(args.authorizedAmountMinor, 'authorizedAmountMinor')
  if (!['home_warranty', 'po', 'nte', 'insurance'].includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, 'Kind is home_warranty, po, nte or insurance.', { field: 'kind' })
  if (!String(args.externalRef ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the payer\'s authorization or PO number.', { field: 'externalRef' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'authorization.record', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const [job, payer] = await Promise.all([tx.job.findUnique({ where: { id: args.jobId }, select: { id: true } }), tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true } })])
    if (!job || !payer) throw new DomainError(Codes.NOT_FOUND, 'Job or payer not found.')
    // A revised authorization supersedes the earlier one for the same payer reference.
    const prior = await tx.thirdPartyAuthorization.findFirst({ where: { jobId: job.id, payerId: payer.id, externalRef: args.externalRef.trim(), status: 'authorized' } })
    if (prior) await casUpdate(uow, { model: 'ThirdPartyAuthorization', id: prior.id, version: prior.version, from: ['authorized'], to: 'revised', actor, eventType: 'authorization.revised' })
    const row = await tx.thirdPartyAuthorization.create({ data: { jobId: job.id, payerId: payer.id, kind: args.kind, externalRef: args.externalRef.trim(), authorizedAmountMinor: amount, serviceFeeMinor: args.serviceFeeMinor ? BigInt(args.serviceFeeMinor) : 0n, status: 'authorized', revisionOfId: prior?.id ?? null }, select: { id: true } })
    auditCreate(uow, actor, 'ThirdPartyAuthorization', row.id, 'authorization.recorded', { jobId: job.id, kind: args.kind, amountMinor: amount.toString(), revisionOf: prior?.id ?? null })
    return { authorizationId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function savePayerProfile(db: Db, actor: Actor, args: { payerId?: string | null; name: string; kind: string; terms: string; poRequired?: boolean | null; billingContact?: string | null; accountingCustomerRef?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payer.save', ['canManageInvoices'], args)
  if (!String(args.name ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Name the payer.', { field: 'name' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payer.save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const data = { name: args.name.trim(), kind: args.kind, terms: args.terms, poRequired: args.poRequired === true, billingContact: args.billingContact?.trim() ?? '', accountingCustomerRef: args.accountingCustomerRef?.trim() ?? '' }
    const row = args.payerId ? await uow.tx.payerProfile.update({ where: { id: args.payerId }, data, select: { id: true } }) : await uow.tx.payerProfile.create({ data, select: { id: true } })
    auditCreate(uow, actor, 'PayerProfile', row.id, args.payerId ? 'payer.updated' : 'payer.created', { name: data.name, kind: data.kind, terms: data.terms })
    return { payerId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── AR period close (approval) ───────────────────────────────────────────────

export async function requestArPeriodClose(db: Db, actor: Actor, args: { periodId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'ar_period.close_request', ['canCloseAr'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'ar_period.close_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const p = await lockRow<{ id: string; version: number; status: string; month: Date }>(uow.tx, 'ArPeriod', args.periodId)
    if (p.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This period changed since you loaded it. Reload and try again.')
    const drafts = await uow.tx.invoice.count({ where: { status: 'draft', arPeriodId: p.id } })
    const openBatches = await uow.tx.paymentBatch.count({ where: { status: 'open', businessDate: { gte: p.month, lt: new Date(Date.UTC(p.month.getUTCFullYear(), p.month.getUTCMonth() + 1, 1)) } } })
    if (openBatches) throw new DomainError(Codes.GUARD_FAILED, `${openBatches} payment batch${openBatches === 1 ? ' is' : 'es are'} still open in this month. Close them first.`, { reason: 'open_batches' })
    const approval = await requestApproval(uow, actor, { action: 'ar_period.close', targetList: 'ArPeriod', targetId: p.id, requiredPermission: 'canApproveArClose', payload: { periodId: p.id, month: p.month.toISOString().slice(0, 7), version: p.version + 1 }, summary: `Close AR period ${p.month.toISOString().slice(0, 7)}` })
    const version = await casUpdate(uow, { model: 'ArPeriod', id: p.id, version: p.version, from: ['open'], to: 'closing', actor, eventType: 'ar_period.close_requested', data: { approvalId: approval.id } })
    void drafts
    return { periodId: p.id, status: 'closing', version, approvalRequestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

registerApplier('ar_period.close', async (uow, actor, request) => {
  const p = await lockRow<{ id: string; version: number; status: string; approvalId: string | null }>(uow.tx, 'ArPeriod', request.targetId)
  if (p.status !== 'closing' || p.approvalId !== request.id || p.version !== request.payload.version) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The period changed after the close was requested.')
  await casUpdate(uow, { model: 'ArPeriod', id: p.id, version: p.version, from: ['closing'], to: 'closed', actor, eventType: 'ar_period.closed', approverId: actorUserId(actor), data: { closedById: actorUserId(actor), closedAt: uow.now } })
  return { periodId: p.id, status: 'closed' }
})

/** Back out of a close request. */
export async function reopenArPeriod(db: Db, actor: Actor, args: { periodId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'ar_period.reopen', ['canCloseAr'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'ar_period.reopen', actor, idempotencyKey, params, now: args.now }, async uow => {
    const p = await lockRow<{ id: string; version: number; approvalId: string | null }>(uow.tx, 'ArPeriod', args.periodId)
    if (p.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This period changed since you loaded it. Reload and try again.')
    if (p.approvalId) {
      const req = await uow.tx.approvalRequest.findUnique({ where: { id: p.approvalId }, select: { id: true, status: true, version: true } })
      if (req?.status === 'pending') await casUpdate(uow, { model: 'ApprovalRequest', id: req.id, version: req.version, from: ['pending'], to: 'cancelled', actor, eventType: 'approval.cancelled', reason: 'AR period reopened' })
    }
    const version = await casUpdate(uow, { model: 'ArPeriod', id: p.id, version: p.version, from: ['closing'], to: 'open', actor, eventType: 'ar_period.reopened', data: { approvalId: null } })
    return { periodId: p.id, status: 'open', version }
  })
  return { replay: result.replay, ...result.value }
}
