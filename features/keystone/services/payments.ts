import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, can, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import { stripeAdapter } from '../lib/paymentAdapter'
import { creditForRefund } from './invoices'
import { closeTermForRefund } from './memberships'
import { allocatePayment, arPeriodFor, asDate, companyToday, lockInvoice, money, reverseAllocations, unappliedOf } from './billingShared'

/*
 * Payments (I-M3..I-M6, I-M9). Money is recorded as it is received: cash, check, card and ACH taken on a terminal or
 * online outside this system, third-party and financing payouts. There is no processor integration here; a card or ACH try
 * whose outcome is not known stays `unknown` until a person resolves it with evidence. Overpayments become customer credit.
 */

const TAKE = ['canTakePayments', 'canManagePayments'] as const
const METHODS = ['card', 'ach', 'cash', 'check', 'other', 'financing', 'third_party', 'customer_credit'] as const
const cents = (v: unknown, field: string) => {
  if (typeof v !== 'string' || !/^[1-9]\d{0,12}$/.test(v)) throw new DomainError(Codes.INVALID_INPUT, 'Amount is whole cents, more than zero.', { field })
  return BigInt(v)
}
const tenderGroup = (method: string) => (method === 'card' ? 'card' : method === 'ach' ? 'ach' : method === 'financing' ? 'financing' : method === 'third_party' ? 'third_party' : 'check_cash')

export type RecordInvoicePaymentArgs = {
  invoiceId: string; amountMinor: string; method: (typeof METHODS)[number]; reference?: string | null; checkNumber?: string | null; feeMinor?: string | null
  receivedAt?: string | null; attemptId?: string | null; idempotencyKey: string; now?: Date
}

/** Put money into the batch for its day and tender group, creating the open batch on first use. */
async function batchFor(uow: UnitOfWork, method: string, day: string) {
  const group = tenderGroup(method)
  const date = asDate(day)
  const existing = await uow.tx.paymentBatch.findFirst({ where: { businessDate: date, tenderGroup: group }, select: { id: true, status: true, expectedMinor: true, version: true } })
  if (existing) return existing
  const ref = await nextReference(uow.tx, 'PBT', uow.now)
  return uow.tx.paymentBatch.create({ data: { ref, businessDate: date, tenderGroup: group, status: 'open' }, select: { id: true, status: true, expectedMinor: true, version: true } })
}

/** Create the Payment row and file it in the day's batch. */
export async function createPayment(uow: UnitOfWork, actor: Actor, a: { customerId: string | null; jobId: string | null; payerId?: string | null; method: string; amountMinor: bigint; feeMinor?: bigint; reference?: string; checkNumber?: string; receivedAt: Date; kind?: string }) {
  const day = await companyToday(uow.tx, a.receivedAt)
  await arPeriodFor(uow.tx, day) // money dated in a closed (or closing) AR month is refused (I-M9); the DB trigger Payment_period backs this
  const ref = await nextReference(uow.tx, 'PMT', uow.now)
  const payment = await uow.tx.payment.create({
    data: { ref, jobId: a.jobId, customerId: a.customerId, payerId: a.payerId ?? null, kind: a.kind ?? 'payment', method: a.method, amountMinor: a.amountMinor, feeMinor: a.feeMinor ?? 0n, reference: a.reference ?? '', checkNumber: a.checkNumber ?? '', receivedAt: a.receivedAt, recordedById: actorUserId(actor) },
    select: { id: true, ref: true },
  })
  const batch = await batchFor(uow, a.method, day)
  if (batch.status !== 'open') throw new DomainError(Codes.GUARD_FAILED, `The ${tenderGroup(a.method).replace('_', '/')} batch for ${day} is ${batch.status}. Record it on today's date, or reopen nothing: closed batches are final.`, { reason: 'batch_closed' })
  await uow.tx.paymentBatch.update({ where: { id: batch.id }, data: { expectedMinor: { increment: a.amountMinor - (a.feeMinor ?? 0n) }, feesMinor: { increment: a.feeMinor ?? 0n } } })
  return { ...payment, batchId: batch.id }
}

/**
 * A payment toward an invoice. The part up to the balance is applied; any excess becomes customer credit (I-M3).
 */
export async function recordInvoicePayment(db: Db, actor: Actor, args: RecordInvoicePaymentArgs) {
  await authorizeOperation(db, actor, 'payment.record_invoice', [...TAKE], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person takes payments.')
  const amount = cents(args.amountMinor, 'amountMinor')
  if (!METHODS.includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, `Paid by one of ${METHODS.join(', ')}.`, { field: 'method' })
  if (args.method === 'customer_credit') throw new DomainError(Codes.INVALID_INPUT, 'Use apply credit to pay with a customer credit.', { field: 'method' })
  if (args.method === 'check' && !args.checkNumber?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the check number.', { field: 'checkNumber' })
  const fee = args.feeMinor ? BigInt(args.feeMinor) : 0n
  if (fee < 0n || fee >= amount) throw new DomainError(Codes.INVALID_INPUT, 'The processing fee is less than the payment.', { field: 'feeMinor' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment.record_invoice', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const invoice = await lockInvoice(tx, args.invoiceId)
    if (!['posted', 'partially_paid'].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`, { status: invoice.status })
    const receivedAt = args.receivedAt ? new Date(args.receivedAt) : uow.now
    if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, 'When was it received? Not in the future.', { field: 'receivedAt' })

    if (['card', 'ach'].includes(args.method)) {
      const blocked = await tx.paymentAttempt.findFirst({ where: { invoiceId: invoice.id, status: 'unknown', ...(args.attemptId ? { id: { not: args.attemptId } } : {}) }, select: { intentKey: true } })
      if (blocked) throw new DomainError(Codes.GUARD_FAILED, 'An earlier card or ACH try on this invoice has an unknown outcome. Resolve it before taking another payment (I-M5).', { reason: 'unknown_attempt', intentKey: blocked.intentKey })
    }
    let attempt = null as null | { id: string; version: number; status: string; amountMinor: bigint; invoiceId: string | null }
    if (args.attemptId) {
      attempt = await lockRow<{ id: string; version: number; status: string; amountMinor: bigint; invoiceId: string | null }>(tx, 'PaymentAttempt', args.attemptId)
      if (attempt.invoiceId !== invoice.id || attempt.amountMinor !== amount || !['pending', 'unknown'].includes(attempt.status)) throw new DomainError(Codes.GUARD_FAILED, 'That attempt does not match this payment.', { reason: 'attempt_mismatch' })
    }
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: invoice.jobId, payerId: invoice.payerId, method: args.method, amountMinor: amount, feeMinor: fee, reference: args.reference?.trim(), checkNumber: args.checkNumber?.trim(), receivedAt })
    if (attempt) await casUpdate(uow, { model: 'PaymentAttempt', id: attempt.id, version: attempt.version, from: ['pending', 'unknown'], to: 'succeeded', actor, eventType: 'payment_attempt.succeeded', data: { paymentId: payment.id } })
    const apply = amount < invoice.balanceMinor ? amount : invoice.balanceMinor
    await allocatePayment(uow, actor, invoice, payment.id, apply)
    const excess = amount - apply
    if (excess > 0n && invoice.customerId) {
      await uow.tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: 'issued', amountMinor: excess, sourceType: 'Payment', sourceId: payment.id } })
      await uow.tx.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: null, kind: 'apply', amountMinor: excess, reason: 'overpayment to customer credit', createdById: actorUserId(actor) } })
    }
    auditCreate(uow, actor, 'Payment', payment.id, 'payment.recorded', { ref: payment.ref, invoiceId: invoice.id, amountMinor: amount.toString(), method: args.method, appliedMinor: apply.toString(), creditMinor: excess.toString() })
    return { paymentId: payment.id, ref: payment.ref, appliedMinor: apply.toString(), customerCreditMinor: excess.toString() }
  })
  return { replay: result.replay, ...result.value }
}

/** Apply a customer's credit to one of their open invoices. */
export async function applyCustomerCredit(db: Db, actor: Actor, args: { invoiceId: string; amountMinor: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'credit.apply', [...TAKE], args)
  const amount = cents(args.amountMinor, 'amountMinor')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'credit.apply', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const invoice = await lockInvoice(tx, args.invoiceId)
    if (!invoice.customerId) throw new DomainError(Codes.GUARD_FAILED, 'The invoice has no customer.')
    const balance = await tx.customerCreditEntry.aggregate({ where: { customerId: invoice.customerId }, _sum: { amountMinor: true } })
    const available = balance._sum.amountMinor ?? 0n
    if (amount > available) throw new DomainError(Codes.GUARD_FAILED, `Only ${money(available)} of credit is available.`, { reason: 'insufficient_credit' })
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: invoice.jobId, payerId: invoice.payerId, method: 'customer_credit', amountMinor: amount, reference: 'Customer credit', receivedAt: uow.now })
    await tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: 'applied', amountMinor: -amount, sourceType: 'Payment', sourceId: payment.id } })
    await allocatePayment(uow, actor, invoice, payment.id, amount)
    auditCreate(uow, actor, 'Payment', payment.id, 'credit.applied', { invoiceId: invoice.id, amountMinor: amount.toString() })
    return { paymentId: payment.id, ref: payment.ref }
  })
  return { replay: result.replay, ...result.value }
}

// ── Payment attempts ──────────────────────────────────────────────────────────

/** Note that a card or ACH try started. If the result is lost it stays unknown (I-M5): the card may or may not have been charged. */
export async function startPaymentAttempt(db: Db, actor: Actor, args: { invoiceId: string; amountMinor: string; method: 'card' | 'ach'; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payment.attempt_start', [...TAKE], args)
  const amount = cents(args.amountMinor, 'amountMinor')
  if (!['card', 'ach'].includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, 'A try is card or ACH.', { field: 'method' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment.attempt_start', actor, idempotencyKey, params, now: args.now }, async uow => {
    const invoice = await lockInvoice(uow.tx, args.invoiceId)
    if (!['posted', 'partially_paid'].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`)
    if (amount > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `That is more than the ${money(invoice.balanceMinor)} balance.`)
    if (await uow.tx.paymentAttempt.count({ where: { invoiceId: invoice.id, status: { in: ['pending', 'unknown'] } } })) throw new DomainError(Codes.GUARD_FAILED, 'A try on this invoice is still open. Finish or resolve it first.', { reason: 'attempt_open' })
    const attempt = await uow.tx.paymentAttempt.create({ data: { intentKey: `${invoice.ref}-${idempotencyKey}`.slice(0, 120), invoiceId: invoice.id, customerId: invoice.customerId, amountMinor: amount, method: args.method, status: 'pending', createdById: actorUserId(actor) }, select: { id: true, intentKey: true } })
    auditCreate(uow, actor, 'PaymentAttempt', attempt.id, 'payment_attempt.started', { invoiceId: invoice.id, amountMinor: amount.toString(), method: args.method })
    return { attemptId: attempt.id, intentKey: attempt.intentKey }
  })
  return { replay: result.replay, ...result.value }
}

/** The try ended without a clear answer (terminal timed out, screen closed). It is held as unknown; nothing retries it. */
export async function markAttemptUnknown(db: Db, actor: Actor, args: { attemptId: string; expectedVersion: number; note?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payment.attempt_unknown', [...TAKE], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment.attempt_unknown', actor, idempotencyKey, params, now: args.now }, async uow => {
    const a = await lockRow<{ id: string; version: number }>(uow.tx, 'PaymentAttempt', args.attemptId)
    if (a.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This try changed since you loaded it. Reload and try again.')
    const version = await casUpdate(uow, { model: 'PaymentAttempt', id: a.id, version: a.version, from: ['pending'], to: 'unknown', actor, eventType: 'payment_attempt.unknown', reason: args.note ?? null, data: { failureNote: args.note?.trim() ?? '' } })
    return { attemptId: a.id, status: 'unknown', version }
  })
  return { replay: result.replay, ...result.value }
}

/** A person closes a pending or unknown try after checking the processor: it failed (nothing was charged). A success is recorded as a payment with the attempt attached. */
export async function resolveAttemptFailed(db: Db, actor: Actor, args: { attemptId: string; expectedVersion: number; evidence: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payment.attempt_resolve', ['canManagePayments'], args)
  if (String(args.evidence ?? '').trim().length < 5) throw new DomainError(Codes.INVALID_INPUT, 'Say what you checked (for example the processor dashboard and the time).', { field: 'evidence' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment.attempt_resolve', actor, idempotencyKey, params, now: args.now }, async uow => {
    const a = await lockRow<{ id: string; version: number }>(uow.tx, 'PaymentAttempt', args.attemptId)
    if (a.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This try changed since you loaded it. Reload and try again.')
    const version = await casUpdate(uow, { model: 'PaymentAttempt', id: a.id, version: a.version, from: ['pending', 'unknown'], to: 'failed', actor, eventType: 'payment_attempt.resolved_failed', reason: args.evidence, data: { resolutionNote: args.evidence.trim() } })
    return { attemptId: a.id, status: 'failed', version }
  })
  return { replay: result.replay, ...result.value }
}

// ── Refunds ───────────────────────────────────────────────────────────────────

const REFUND_CREDIT = 'Membership payment refunded:'

/**
 * A membership invoice that an earlier refund reopened (before refunds credited the invoice): credit what that refund
 * reopened and close the term, exactly as a refund does now. Running it again does nothing.
 */
export async function settleRefundedMembershipInvoice(db: Db, actor: Actor, args: { invoiceId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'refund.settle_membership_invoice', ['canIssueRefunds'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'refund.settle_membership_invoice', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const invoice = await lockInvoice(tx, args.invoiceId)
    const charge = await tx.membershipBillingAttempt.findFirst({ where: { invoiceId: invoice.id, paymentId: { not: null } }, select: { paymentId: true, membershipId: true, termId: true } })
    if (!charge?.paymentId) throw new DomainError(Codes.GUARD_FAILED, 'This is not a membership invoice paid by card.', { reason: 'not_membership_invoice' })
    const refunds = await tx.refund.findMany({ where: { paymentId: charge.paymentId }, select: { amountMinor: true, reason: true } })
    const refunded = refunds.reduce((n, r) => n + r.amountMinor, 0n)
    if (!refunded) throw new DomainError(Codes.GUARD_FAILED, 'Nothing has been refunded on this invoice.', { reason: 'no_refund' })
    const credited = (await tx.creditMemo.aggregate({ where: { invoiceId: invoice.id, status: 'applied', note: { startsWith: REFUND_CREDIT } }, _sum: { totalMinor: true } }))._sum.totalMinor ?? 0n
    const owed = refunded - credited < invoice.balanceMinor ? refunded - credited : invoice.balanceMinor
    const memo = owed > 0n ? await creditForRefund(uow, actor, { invoiceId: invoice.id, amountMinor: owed, note: `${REFUND_CREDIT} ${refunds[0]?.reason ?? 'refund'}` }) : null
    if (charge.membershipId) await closeTermForRefund(uow, actor, { membershipId: charge.membershipId, termId: charge.termId, reason: refunds[0]?.reason ?? 'Refunded' })
    return { invoiceId: invoice.id, creditedMinor: owed > 0n ? owed.toString() : '0', memoRef: memo?.ref ?? null }
  })
  return { replay: result.replay, ...result.value }
}

async function writeRefund(uow: UnitOfWork, actor: Actor, a: { paymentId: string; amountMinor: bigint; method: string; reason: string; reference: string; approvalId: string | null }) {
  const { tx } = uow
  const u = await unappliedOf(tx, a.paymentId)
  if (a.amountMinor > u.amountMinor - u.refunded) throw new DomainError(Codes.GUARD_FAILED, `At most ${money(u.amountMinor - u.refunded)} is left to refund on this payment.`, { reason: 'refund_exceeds_payment' })
  // Money still applied to invoices is taken back from them first, newest application first.
  const needBack = a.amountMinor - u.unapplied
  const membershipCharge = await tx.membershipBillingAttempt.findFirst({ where: { paymentId: a.paymentId }, select: { invoiceId: true, membershipId: true, termId: true } })
  const customerId = (await tx.payment.findUniqueOrThrow({ where: { id: a.paymentId }, select: { customerId: true } })).customerId
  if (needBack > 0n) {
    const credit = customerId ? (await tx.customerCreditEntry.aggregate({ where: { customerId, sourceType: 'Payment', sourceId: a.paymentId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0n : 0n
    const fromCredit = credit < needBack ? credit : needBack
    if (fromCredit > 0n && customerId) {
      await tx.customerCreditEntry.create({ data: { customerId, kind: 'refunded', amountMinor: -fromCredit, sourceType: 'Payment', sourceId: a.paymentId } })
      await tx.paymentAllocation.create({ data: { paymentId: a.paymentId, invoiceId: null, kind: 'reverse', reversesId: (await tx.paymentAllocation.findFirst({ where: { paymentId: a.paymentId, invoiceId: null, kind: 'apply' }, select: { id: true } }))?.id, amountMinor: fromCredit, reason: 'refund of customer credit', createdById: actorUserId(actor) } })
    }
    const back = needBack - fromCredit
    if (back > 0n) {
      const done = await reverseAllocations(uow, actor, a.paymentId, back, 'refund_reopen', `Refund: ${a.reason}`)
      if (done !== back) throw new DomainError(Codes.GUARD_FAILED, 'The refund is more than this payment has applied.')
      // A membership charge refunded is not owed again (no plan re-bills a refund): the invoice is credited the same amount,
      // so it stays paid, and the term the money paid for is closed below.
      if (membershipCharge?.invoiceId) await creditForRefund(uow, actor, { invoiceId: membershipCharge.invoiceId, amountMinor: back, note: `${REFUND_CREDIT} ${a.reason}` })
    }
  }
  if (membershipCharge?.membershipId) await closeTermForRefund(uow, actor, { membershipId: membershipCharge.membershipId, termId: membershipCharge.termId, reason: a.reason })
  await arPeriodFor(tx, await companyToday(tx, uow.now)) // the DB trigger Refund_period refuses a refund dated in a non-open AR month
  const ref = await nextReference(tx, 'RFD', uow.now)
  const refund = await tx.refund.create({ data: { ref, paymentId: a.paymentId, method: a.method, amountMinor: a.amountMinor, reason: a.reason, approvalId: a.approvalId, reference: a.reference, refundedAt: uow.now, recordedById: actorUserId(actor) }, select: { id: true } })
  auditCreate(uow, actor, 'Refund', refund.id, 'refund.recorded', { ref, paymentId: a.paymentId, amountMinor: a.amountMinor.toString(), method: a.method, approvalId: a.approvalId })
  return { refundId: refund.id, ref }
}

/** What can issue a card refund: only the processor adapter's refund call, injected in tests. */
export type CardRefunder = { refund(input: { paymentIntent: string; amountMinor: bigint; idempotencyKey: string; reason?: string }): Promise<{ outcome: 'succeeded' | 'failed' | 'unknown'; refundId: string; note?: string }> }

/**
 * A "card refund" on a card payment that Stripe took (its reference is the payment intent, pi_...) is made AT Stripe, against that
 * intent, and the refund id Stripe returns (re_...) is what gets recorded. Anything else (a check, a payment taken on a terminal
 * elsewhere, no Stripe key on this server) is recorded against the id the person typed, as before.
 * Stripe is asked outside any database transaction, with a key made from the staff action's own key, so a retry never refunds twice.
 */
async function issueAtStripe(db: Db, refunder: CardRefunder | null, a: { paymentId: string; amountMinor: bigint; method: string; reason: string; key: string }): Promise<string | null> {
  if (a.method !== 'processor_refund' || !refunder) return null
  const payment = await db.payment.findUnique({ where: { id: a.paymentId }, select: { method: true, reference: true } })
  const intent = payment?.method === 'card' && /^pi_[A-Za-z0-9]+$/.test(payment.reference ?? '') ? payment.reference : null
  if (!intent) return null
  const r = await refunder.refund({ paymentIntent: intent, amountMinor: a.amountMinor, idempotencyKey: `hs-refund:${a.paymentId}:${a.key}`, reason: a.reason })
  if (r.outcome === 'succeeded') return r.refundId
  throw new DomainError(r.outcome === 'unknown' ? Codes.GUARD_FAILED : Codes.INVALID_INPUT, `Stripe did not refund this: ${r.note ?? r.outcome}`, { reason: r.outcome === 'unknown' ? 'refund_unknown' : 'refund_refused' })
}

/**
 * Refund a payment (I-M6). Above the company threshold it waits for a second person's approval; the approved request is bound
 * to the payment, amount, method and reference, and is consumed when the refund is recorded.
 */
export async function requestRefund(db: Db, actor: Actor, args: { paymentId: string; amountMinor: string; method: 'processor_refund' | 'check'; reason: string; reference: string; idempotencyKey: string; now?: Date }, refunder: CardRefunder | null = stripeAdapter()) {
  await authorizeOperation(db, actor, 'refund.issue', ['canIssueRefunds'], args)
  const amount = cents(args.amountMinor, 'amountMinor')
  if (!['processor_refund', 'check'].includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, 'Refund by processor refund or check.', { field: 'method' })
  const reason = String(args.reason ?? '').trim()
  if (reason.length < 3) throw new DomainError(Codes.INVALID_INPUT, 'Say why, in a few words.', { field: 'reason' })
  let reference = String(args.reference ?? '').trim()
  // Under the approval threshold the refund is recorded now, so Stripe is asked now. Above it, Stripe is asked when the approved refund is recorded.
  let stripeRef: string | null = null
  if (!reference || args.method === 'processor_refund') {
    const known = await unappliedOf(db as never, args.paymentId).catch(() => null)
    const limit = (await db.companySettings.findFirst({ select: { refundApprovalThresholdMinor: true } }))?.refundApprovalThresholdMinor ?? 50000n
    const direct = !!known && known.refunded + amount <= limit && amount <= known.amountMinor - known.refunded
    if (direct) stripeRef = await issueAtStripe(db, refunder, { paymentId: args.paymentId, amountMinor: amount, method: args.method, reason, key: args.idempotencyKey })
    if (stripeRef) reference = stripeRef
  }
  if (!reference && !(args.method === 'processor_refund' && (await cardPaymentAtStripe(db, args.paymentId, refunder)))) throw new DomainError(Codes.INVALID_INPUT, 'Enter the processor refund id or the check number.', { field: 'reference' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'refund.issue', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    await lockRow(tx, 'Payment', args.paymentId)
    const u = await unappliedOf(tx, args.paymentId)
    if (amount > u.amountMinor - u.refunded) throw new DomainError(Codes.GUARD_FAILED, `At most ${money(u.amountMinor - u.refunded)} is left to refund on this payment.`, { reason: 'refund_exceeds_payment' })
    const settings = await tx.companySettings.findFirst({ select: { refundApprovalThresholdMinor: true } })
    // The threshold is on everything refunded from this payment, so splitting one large refund into small ones still needs approval.
    if (u.refunded + amount <= (settings?.refundApprovalThresholdMinor ?? 50000n)) {
      return { status: 'recorded', approvalRequestId: null, ...(await writeRefund(uow, actor, { paymentId: args.paymentId, amountMinor: amount, method: args.method, reason, reference, approvalId: null })) }
    }
    const approval = await requestApproval(uow, actor, {
      action: 'refund.issue', targetList: 'Payment', targetId: args.paymentId, requiredPermission: 'canApproveRefunds',
      payload: { paymentId: args.paymentId, amountMinor: amount.toString(), method: args.method, reason, reference: reference === stripeRef ? '' : reference },
      summary: `Refund ${money(amount)} by ${args.method === 'check' ? 'check' : 'processor'} — ${reason}`,
    })
    return { status: 'pending_approval', approvalRequestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

// An approved refund is recorded when the requester (or anyone with issue-refund rights) confirms it; the approval is consumed then.
export async function recordApprovedRefund(db: Db, actor: Actor, args: { approvalRequestId: string; idempotencyKey: string; now?: Date }, refunder: CardRefunder | null = stripeAdapter()) {
  await authorizeOperation(db, actor, 'refund.record_approved', ['canIssueRefunds'], args)
  // An approved refund with no typed id is a card refund for Stripe to make, once, keyed by the approval itself.
  const pending = await db.approvalRequest.findUnique({ where: { id: args.approvalRequestId } })
  const pay = pending?.action === 'refund.issue' ? (pending.payload as { paymentId: string; amountMinor: string; method: string; reason: string; reference: string }) : null
  const atStripe = pay && !pay.reference ? await issueAtStripe(db, refunder, { paymentId: pay.paymentId, amountMinor: BigInt(pay.amountMinor), method: pay.method, reason: pay.reason, key: `approval:${args.approvalRequestId}` }) : null
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'refund.record_approved', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { consumeApproval } = await import('../lib/approval')
    const request = await uow.tx.approvalRequest.findUnique({ where: { id: args.approvalRequestId } })
    if (!request || request.action !== 'refund.issue') throw new DomainError(Codes.NOT_FOUND, 'Refund approval not found.')
    const payload = request.payload as { paymentId: string; amountMinor: string; method: string; reason: string; reference: string }
    await consumeApproval(uow, { requestId: request.id, action: request.action, targetList: request.targetList, targetId: request.targetId, payload })
    await lockRow(uow.tx, 'Payment', payload.paymentId)
    return { status: 'recorded', ...(await writeRefund(uow, actor, { paymentId: payload.paymentId, amountMinor: BigInt(payload.amountMinor), method: payload.method, reason: payload.reason, reference: atStripe || payload.reference, approvalId: request.id })) }
  })
  return { replay: result.replay, ...result.value }
}

/** Whether a card refund on this payment would be made at Stripe (so a typed id is not needed). */
async function cardPaymentAtStripe(db: Db, paymentId: string, refunder: CardRefunder | null) {
  if (!refunder) return false
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { method: true, reference: true } })
  return p?.method === 'card' && /^pi_[A-Za-z0-9]+$/.test(p.reference ?? '')
}

registerApplier('refund.issue', async () => ({ deferred: true }), { applyOnApprove: false })

// ── Batches ───────────────────────────────────────────────────────────────────

/** Close a day's batch for a tender group. A closed batch takes no more payments. */
export async function closePaymentBatch(db: Db, actor: Actor, args: { batchId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payment_batch.close', ['canManagePayments', 'canManageAccounting'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment_batch.close', actor, idempotencyKey, params, now: args.now }, async uow => {
    const b = await lockRow<{ id: string; version: number }>(uow.tx, 'PaymentBatch', args.batchId)
    if (b.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This batch changed since you loaded it. Reload and try again.')
    const version = await casUpdate(uow, { model: 'PaymentBatch', id: b.id, version: b.version, from: ['open'], to: 'closed', actor, eventType: 'payment_batch.closed', data: { closedById: actorUserId(actor), closedAt: uow.now } })
    return { batchId: b.id, status: 'closed', version }
  })
  return { replay: result.replay, ...result.value }
}

/** Match a closed batch to the deposit or payout; a variance is recorded, never hidden (I-M9). */
export async function reconcilePaymentBatch(db: Db, actor: Actor, args: { batchId: string; expectedVersion: number; depositedMinor: string; depositReference: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'payment_batch.reconcile', ['canManagePayments', 'canManageAccounting'], args)
  if (!/^\d{1,13}$/.test(args.depositedMinor ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'Deposit is whole cents.', { field: 'depositedMinor' })
  if (!String(args.depositReference ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the deposit or payout reference.', { field: 'depositReference' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'payment_batch.reconcile', actor, idempotencyKey, params, now: args.now }, async uow => {
    const b = await lockRow<{ id: string; version: number; expectedMinor: bigint; feesMinor: bigint }>(uow.tx, 'PaymentBatch', args.batchId)
    if (b.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This batch changed since you loaded it. Reload and try again.')
    const deposited = BigInt(args.depositedMinor)
    const variance = deposited - b.expectedMinor // expected is already net of processing fees
    const version = await casUpdate(uow, { model: 'PaymentBatch', id: b.id, version: b.version, from: ['closed'], to: 'reconciled', actor, eventType: 'payment_batch.reconciled', data: { depositedMinor: deposited, varianceMinor: variance, depositReference: args.depositReference.trim() }, audit: { varianceMinor: variance.toString() } })
    return { batchId: b.id, status: 'reconciled', varianceMinor: variance.toString(), version }
  })
  return { replay: result.replay, ...result.value }
}

void can
