import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import { addDays, localDate } from '../lib/calendar'
import type { Db } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { paymentAdapter, type ChargeResult, type PaymentAdapter } from '../lib/paymentAdapter'
import { nextReference, publicCode } from '../lib/sequence'
import { runInTransaction, type UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { daysInMonth, slotDueDay, termNumberOn } from '../domain/membershipTime'
import { asDate, companyToday, lockInvoice, money } from './billingShared'
import { postInvoiceInTx } from './invoices'
import { renewInTx } from './memberships'
import { allocatePayment, } from './billingShared'
import { createPayment } from './payments'

/*
 * Membership billing (STATE-MACHINES §10, overrides: no scheduler). Staff press "Run billing for <month>". The run lists what is
 * due and gives each membership, term and payment slot exactly one attempt row (a unique index makes a second row impossible).
 * Each attempt then charges at most once: it is claimed under a row lock, the charge carries a key fixed for the attempt, and
 * a result that never came back is stored as `unknown` and settled by asking the processor, never by guessing or charging again.
 * Pressing the button twice, at once or after a crash, finds the same rows and finishes the same work.
 */

// Running billing and retrying a charge are membership-manager actions (an accountant reads the runs, but does not charge cards).
const BILLING: Permission[] = ['canManageMemberships']
/** A membership in one of these is charged; any other (cancelled, transferred, expired, suspended) never is. */
const BILLABLE = ['pending_payment', 'active', 'past_due']
const STALE_CHARGE_MS = 2 * 60_000
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

export type AttemptOutcome = 'charged' | 'declined' | 'unknown' | 'in_progress' | 'already_paid' | 'no_card' | 'not_billable'

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')

/**
 * After a home sale the buyer never pays for what the seller paid: a slot the seller's membership paid, or one that fell due before
 * the transfer day (that stays on the seller's membership), carries over. Returns a test for `(membershipId, termNumber, slot, dueOn)`.
 */
export async function carriedOver(db: Pick<Db, 'membership' | 'membershipBillingAttempt'>, membershipIds: string[]) {
  const paid = new Set<string>()
  const from = new Map<string, string>()
  if (membershipIds.length) {
    const sellers = await db.membership.findMany({ where: { transferredToId: { in: membershipIds } }, select: { id: true, transferredToId: true, cancelEffectiveOn: true } })
    for (const s of sellers) {
      from.set(s.transferredToId!, ymd(s.cancelEffectiveOn))
      const rows = await db.membershipBillingAttempt.findMany({ where: { membershipId: s.id, status: 'succeeded' }, select: { termNumber: true, slot: true } })
      for (const r of rows) paid.add(`${s.transferredToId}:${r.termNumber}:${r.slot}`)
    }
  }
  return (membershipId: string, termNumber: number, slot: number, dueOn: string) =>
    paid.has(`${membershipId}:${termNumber}:${slot}`) || (from.has(membershipId) && dueOn < from.get(membershipId)!)
}

const lastDayOf = (period: string) => `${period}-${String(daysInMonth(Number(period.slice(0, 4)), Number(period.slice(5, 7)))).padStart(2, '0')}`

/** The invoice for one payment, posted through the same path as every other invoice (tax, AR period, ledger entry). */
async function invoiceForAttempt(uow: UnitOfWork, actor: Actor, attempt: { id: string; membershipId: string | null; termNumber: number; slot: number }) {
  const { tx } = uow
  const m = await tx.membership.findUniqueOrThrow({ where: { id: attempt.membershipId ?? '' }, select: { id: true, ref: true, customerId: true, locationId: true, plan: { select: { name: true } } } })
  const term = await tx.membershipTerm.findFirstOrThrow({ where: { membershipId: m.id, termNumber: attempt.termNumber }, select: { priceMinor: true, slots: true, startsOn: true } })
  const ref = await nextReference(tx, 'INV', uow.now)
  const label = term.slots > 1 ? `${m.plan?.name ?? 'Membership'}, payment ${attempt.slot + 1} of ${term.slots}` : `${m.plan?.name ?? 'Membership'}, ${term.startsOn?.getUTCFullYear()} term`
  const invoice = await tx.invoice.create({
    data: {
      ref, publicCode: publicCode('INV'), customerId: m.customerId, locationId: m.locationId, payerKind: 'customer', status: 'draft', progressReason: '',
      subtotalMinor: term.priceMinor, discountMinor: 0n, taxMinor: 0n, totalMinor: term.priceMinor, balanceMinor: 0n,
    },
    select: { id: true, version: true },
  })
  await tx.invoiceLine.create({ data: { invoiceId: invoice.id, workLineId: null, description: label, quantity: '1', uom: 'ea', unitPriceMinor: term.priceMinor, amountMinor: term.priceMinor, discountMinor: 0n, taxCategory: 'membership', costMinor: 0n, revenueAccountCode: '4400', sortOrder: 0 } })
  auditCreate(uow, actor, 'Invoice', invoice.id, 'invoice.drafted', { ref, membershipId: m.id, membershipRef: m.ref, slot: attempt.slot })
  const posted = await postInvoiceInTx(uow, actor, { invoiceId: invoice.id, expectedVersion: invoice.version })
  return { invoiceId: invoice.id, totalMinor: BigInt(posted.totalMinor) }
}

async function settleMembershipStatus(uow: UnitOfWork, actor: Actor, membershipId: string) {
  const { tx } = uow
  const m = await tx.membership.findUniqueOrThrow({ where: { id: membershipId }, select: { id: true, status: true, version: true } })
  const open = await tx.membershipBillingAttempt.count({ where: { membershipId, status: { in: ['failed', 'unknown'] } } })
  if (m.status === 'pending_payment' || m.status === 'past_due') {
    if (!open) await casUpdate(uow, { model: 'Membership', id: m.id, version: m.version, from: [m.status], to: 'active', actor, eventType: 'membership.paid_up' })
  } else if (m.status === 'active' && open) {
    await casUpdate(uow, { model: 'Membership', id: m.id, version: m.version, from: ['active'], to: 'past_due', actor, eventType: 'membership.payment_failed' })
  }
}

async function finalizeSuccess(db: Db, actor: Actor, attemptId: string, providerRef: string, now: Date) {
  return runInTransaction(db, async uow => {
    const { tx } = uow
    const attempt = await lockRow<{ id: string; status: string; invoiceId: string | null; membershipId: string | null; version: number }>(tx, 'MembershipBillingAttempt', attemptId)
    if (attempt.status === 'succeeded') return 'already_paid' as const
    if (!attempt.invoiceId) throw new DomainError(Codes.GUARD_FAILED, 'This attempt has no invoice to pay.')
    const invoice = await lockInvoice(tx, attempt.invoiceId)
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: null, method: 'card', amountMinor: invoice.balanceMinor, reference: providerRef, receivedAt: uow.now })
    await allocatePayment(uow, actor, invoice, payment.id, invoice.balanceMinor)
    await casUpdate(uow, { model: 'MembershipBillingAttempt', id: attempt.id, version: attempt.version, from: ['charging', 'unknown', 'queued', 'failed'], to: 'succeeded', actor, eventType: 'membership.charge_succeeded', data: { paymentId: payment.id, providerRef, failureNote: '' } })
    if (attempt.membershipId) await settleMembershipStatus(uow, actor, attempt.membershipId)
    return 'charged' as const
  }, { now })
}

async function markStatus(db: Db, actor: Actor, attemptId: string, to: 'failed' | 'unknown', note: string, providerRef: string, now: Date) {
  return runInTransaction(db, async uow => {
    const attempt = await lockRow<{ id: string; status: string; version: number; membershipId: string | null }>(uow.tx, 'MembershipBillingAttempt', attemptId)
    if (attempt.status === 'succeeded') return
    await casUpdate(uow, { model: 'MembershipBillingAttempt', id: attempt.id, version: attempt.version, from: [attempt.status], to, actor, eventType: `membership.charge_${to}`, reason: note, data: { failureNote: note.slice(0, 300), ...(providerRef ? { providerRef } : {}) } })
    if (attempt.membershipId) await settleMembershipStatus(uow, actor, attempt.membershipId)
  }, { now })
}

/** Carry one attempt as far as it can go right now. Safe to call again at any moment. */
export async function processAttempt(db: Db, actor: Actor, attemptId: string, now: Date, adapter: PaymentAdapter = paymentAdapter(), opts: { newTry?: boolean } = {}): Promise<AttemptOutcome> {
  const seen = await db.membershipBillingAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { membership: { select: { status: true, paymentMethodRef: true, customer: { select: { ref: true } } } } } })
  if (seen.status === 'succeeded') return 'already_paid'
  // A cancelled, transferred or expired membership is never sent to the processor again, not even to ask.
  if (!BILLABLE.includes(seen.membership?.status ?? '')) return 'not_billable'
  if (seen.membershipId && (await carriedOver(db, [seen.membershipId]))(seen.membershipId, seen.termNumber, seen.slot, ymd(seen.dueOn))) return 'already_paid'
  let status = seen.status
  const stale = status === 'charging' && now.getTime() - seen.updatedAt.getTime() >= STALE_CHARGE_MS
  if (status === 'charging' && !stale) return 'in_progress'

  // A try whose answer never arrived: ask the processor what happened to that exact key.
  if (status === 'unknown' || stale) {
    const found = await adapter.lookup(seen.providerKey)
    if (found.outcome === 'succeeded') return finalizeSuccess(db, actor, attemptId, found.providerRef, now)
    if (found.outcome === 'unknown') {
      if (status !== 'unknown') await markStatus(db, actor, attemptId, 'unknown', found.note, '', now)
      return 'unknown'
    }
    if (found.outcome === 'failed') {
      // A decline is final for this key. Nothing charges the card again until a person updates it and presses Retry.
      await markStatus(db, actor, attemptId, 'failed', found.note, found.providerRef, now)
      return 'declined'
    } else {
      // The processor never saw it. The same key can safely be sent again: if it did arrive late, it is still one charge.
      status = 'retry_same_key'
    }
  }
  if (status === 'failed' && !opts.newTry) return 'declined'
  if (!seen.membership?.paymentMethodRef) return 'no_card'

  const claim = await runInTransaction(db, async uow => {
    const a = await lockRow<{ id: string; status: string; version: number; generation: number; invoiceId: string | null; membershipId: string | null; termNumber: number; slot: number; attemptKey: string; providerKey: string; updatedAt: Date }>(uow.tx, 'MembershipBillingAttempt', attemptId)
    const m = a.membershipId ? await lockRow<{ id: string; status: string }>(uow.tx, 'Membership', a.membershipId) : null
    if (!m || !BILLABLE.includes(m.status)) return { skip: 'not_billable' as const }
    const reclaimable = a.status === 'queued' || (a.status === 'failed' && opts.newTry === true) || (status === 'retry_same_key' && ['unknown', 'charging'].includes(a.status))
    if (!reclaimable) return { skip: a.status === 'succeeded' ? ('already_paid' as const) : a.status === 'failed' ? ('declined' as const) : ('in_progress' as const) }
    // A new generation (a new processor key) only follows a failure the processor itself confirmed.
    const generation = a.status === 'failed' ? a.generation + 1 : a.generation
    const providerKey = `${a.attemptKey}:g${generation}`
    const invoice = a.invoiceId ? { invoiceId: a.invoiceId, totalMinor: (await lockInvoice(uow.tx, a.invoiceId)).balanceMinor } : await invoiceForAttempt(uow, actor, a)
    await uow.tx.membershipBillingAttempt.update({ where: { id: a.id }, data: { status: 'charging', generation, providerKey, invoiceId: invoice.invoiceId, amountMinor: invoice.totalMinor, version: { increment: 1 } } })
    uow.audit({ eventType: 'membership.charge_started', entityType: 'MembershipBillingAttempt', entityId: a.id, actorUserId: actorUserId(actor), after: { generation, amountMinor: invoice.totalMinor.toString() } })
    return { skip: null, providerKey, amountMinor: invoice.totalMinor }
  }, { now })
  if (claim.skip) return claim.skip

  let result: ChargeResult
  try {
    result = await adapter.charge({
      providerKey: claim.providerKey!, amountMinor: claim.amountMinor!, paymentMethodRef: seen.membership.paymentMethodRef,
      description: `Membership ${seen.termNumber}.${seen.slot + 1}`, metadata: { attempt: seen.attemptKey },
    })
  } catch {
    result = { outcome: 'unknown', providerRef: '', note: 'The connection dropped before an answer came back. The card may or may not have been charged.' }
  }
  if (result.outcome === 'succeeded') return finalizeSuccess(db, actor, attemptId, result.providerRef, now)
  if (result.outcome === 'failed') { await markStatus(db, actor, attemptId, 'failed', result.note, result.providerRef, now); return 'declined' }
  await markStatus(db, actor, attemptId, 'unknown', result.note, result.providerRef, now)
  return 'unknown'
}

export type BillingSummary = { runId: string; ref: string; period: string; status?: 'completed' | 'partial' | 'running'; queued: number; charged: number; declined: number; unknown: number; inProgress: number; noCard: number; remaining: number; chargedMinor: string; replay: boolean }

/**
 * "Run billing for <period>": every payment due on or before the end of that month, for every membership that can be billed.
 * Auto-renewing memberships whose next term starts by then are renewed first, if the customer was told in time.
 */
export async function runMembershipBilling(db: Db, actor: Actor, args: { period: string; idempotencyKey: string; now?: Date }, adapter: PaymentAdapter = paymentAdapter()): Promise<BillingSummary> {
  await authorizeOperation(db, actor, 'membership.billing_run', BILLING, args)
  if (!PERIOD.test(args.period ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'Choose a month to bill.', { field: 'period' })
  const now = args.now ?? new Date()
  const { idempotencyKey, now: _now, ...params } = args
  const prepared = await command(db, { name: 'membership.billing_run', actor, idempotencyKey, params, now }, async uow => {
    const { tx } = uow
    const today = await companyToday(tx, uow.now)
    if (args.period > today.slice(0, 7)) throw new DomainError(Codes.GUARD_FAILED, 'That month has not started. Bill this month or an earlier one.', { reason: 'future_period' })
    const end = lastDayOf(args.period)
    const run = await tx.membershipBillingRun.create({ data: { ref: await nextReference(tx, 'MBP', uow.now), period: args.period, idempotencyKey, status: 'running', startedById: actorUserId(actor), startedAt: uow.now }, select: { id: true, ref: true } })

    // Renew what renews itself, so the new term's first payment is part of this run.
    const renewing = await tx.membership.findMany({ where: { autoRenew: true, status: { in: ['active', 'past_due'] } }, select: { id: true, startsOn: true, planId: true, autoRenewConsentId: true, terms: { where: { status: 'active' }, orderBy: { termNumber: 'desc' }, take: 1, select: { termNumber: true, endsOn: true } } } })
    const skippedRenewals: { membershipId: string; reason: string }[] = []
    for (const m of renewing) {
      const last = m.terms[0]
      if (!last?.endsOn) continue
      const nextStart = addDays(last.endsOn.toISOString().slice(0, 10), 1)
      if (nextStart > end) continue
      const told = await tx.renewalNotice.findFirst({ where: { membershipId: m.id, kind: 'auto_renew_reminder', status: 'contacted', term: { termNumber: last.termNumber } }, select: { createdAt: true } })
      const version = await tx.membershipPlanVersion.findFirst({ where: { planId: m.planId ?? '', status: 'active' }, select: { renewalNoticeDays: true, autoRenew: true } })
      if (!version?.autoRenew) { skippedRenewals.push({ membershipId: m.id, reason: 'The current plan no longer renews itself.' }); continue }
      if (!told || told.createdAt.toISOString().slice(0, 10) > addDays(nextStart, -version.renewalNoticeDays)) { skippedRenewals.push({ membershipId: m.id, reason: 'The customer has not been told about the renewal in time.' }); continue }
      await renewInTx(uow, actor, m.id, today)
    }

    const members = await tx.membership.findMany({
      where: { status: { in: BILLABLE } },
      select: { id: true, startsOn: true, terms: { where: { status: 'active' }, select: { id: true, termNumber: true, slots: true, billingFrequency: true, startsOn: true } }, planVersion: { select: { termMonths: true } } },
    })
    const carried = await carriedOver(tx, members.map(m => m.id))
    const rows: { attemptKey: string; membershipId: string; termId: string; termNumber: number; slot: number; dueOn: Date; runId: string }[] = []
    for (const m of members) {
      const anchor = m.startsOn!.toISOString().slice(0, 10)
      for (const t of m.terms) {
        const months = m.planVersion?.termMonths ?? 12
        for (let k = 0; k < t.slots; k += 1) {
          const due = t.billingFrequency === 'monthly' ? slotDueDay(anchor, months, t.termNumber, k) : t.startsOn!.toISOString().slice(0, 10)
          if (due > end) continue
          // After a home sale the buyer pays only what falls due from the transfer day on, never what the seller paid.
          if (carried(m.id, t.termNumber, k, due)) continue
          rows.push({ attemptKey: `${m.id}:${t.termNumber}:${k}`, membershipId: m.id, termId: t.id, termNumber: t.termNumber, slot: k, dueOn: asDate(due), runId: run.id })
        }
      }
    }
    // ON CONFLICT DO NOTHING: a slot that already has its attempt keeps it (and its history).
    if (rows.length) await tx.membershipBillingAttempt.createMany({ data: rows, skipDuplicates: true })
    auditCreate(uow, actor, 'MembershipBillingRun', run.id, 'membership.billing_run_started', { period: args.period, candidates: rows.length, skippedRenewals })
    return { runId: run.id, ref: run.ref }
  })

  // A declined attempt is not picked up again: it waits for a new card and a person's Retry (it still counts as left to collect).
  const open = await db.membershipBillingAttempt.findMany({
    where: { dueOn: { lte: asDate(lastDayOf(args.period)) }, status: { not: 'succeeded' }, membership: { status: { in: BILLABLE } } },
    orderBy: [{ dueOn: 'asc' }, { attemptKey: 'asc' }], select: { id: true, status: true, membershipId: true, termNumber: true, slot: true, dueOn: true },
  })
  const carriedNow = await carriedOver(db, [...new Set(open.map(a => a.membershipId ?? ''))].filter(Boolean))
  const due = open.filter(a => !carriedNow(a.membershipId ?? '', a.termNumber, a.slot, ymd(a.dueOn)))
  const attempts = due.filter(a => a.status !== 'failed')
  const tally = { charged: 0, declined: due.length - attempts.length, unknown: 0, inProgress: 0, noCard: 0, already: 0 }
  const chargedIds: string[] = []
  for (const a of attempts) {
    const outcome = await processAttempt(db, actor, a.id, now, adapter)
    if (outcome === 'charged') { tally.charged += 1; chargedIds.push(a.id) }
    else if (outcome === 'declined') tally.declined += 1
    else if (outcome === 'unknown') tally.unknown += 1
    else if (outcome === 'in_progress') tally.inProgress += 1
    else if (outcome === 'no_card') tally.noCard += 1
    else tally.already += 1
  }
  // The run's total is what this press charged, so the count and the money always agree.
  const paid = await db.membershipBillingAttempt.aggregate({ where: { id: { in: chargedIds }, status: 'succeeded' }, _sum: { amountMinor: true } })
  const left = await db.membershipBillingAttempt.findMany({ where: { id: { in: due.map(a => a.id) }, status: { not: 'succeeded' } }, select: { id: true } })
  const remaining = left.length
  // The run ends in this request: completed when nothing is left, partial when something waits (a decline, the processor, no card).
  await db.membershipBillingRun.update({
    where: { id: prepared.value.runId },
    data: { status: remaining === 0 ? 'completed' : 'partial', queuedCount: attempts.length, chargedCount: tally.charged, failedCount: tally.declined, unknownCount: tally.unknown, remainingCount: remaining, chargedMinor: paid._sum.amountMinor ?? 0n, completedAt: now },
  })
  return { runId: prepared.value.runId, ref: prepared.value.ref, period: args.period, status: remaining === 0 ? 'completed' as const : 'partial' as const, queued: attempts.length, charged: tally.charged, declined: tally.declined, unknown: tally.unknown, inProgress: tally.inProgress, noCard: tally.noCard, remaining, chargedMinor: (paid._sum.amountMinor ?? 0n).toString(), replay: prepared.replay }
}

/**
 * Retry one payment. An unknown one is settled by asking the processor (and sent again with the same key only if it never saw it).
 * A declined one is tried again, with a new key, only when a person asks and the card was changed since the decline, or they
 * say why the same card should be tried again. A cancelled, transferred or expired membership is never charged.
 */
export async function retryAttempt(db: Db, actor: Actor, args: { attemptId: string; reason?: string | null; idempotencyKey: string; now?: Date }, adapter: PaymentAdapter = paymentAdapter()) {
  await authorizeOperation(db, actor, 'membership.attempt_retry', BILLING, args)
  const now = args.now ?? new Date()
  const a = await db.membershipBillingAttempt.findUnique({ where: { id: args.attemptId }, select: { id: true, status: true, updatedAt: true, membership: { select: { id: true, status: true, location: { select: { timeZone: true } }, terms: { where: { status: 'active' }, select: { endsOn: true } } } } } })
  if (!a?.membership) throw new DomainError(Codes.NOT_FOUND, 'Payment not found.')
  const m = a.membership
  const today = localDate({ timeZone: m.location?.timeZone ?? 'America/Chicago' }, now)
  const lastEnd = m.terms.map(t => ymd(t.endsOn)).sort().pop() ?? ''
  const standing = !BILLABLE.includes(m.status) ? m.status : !lastEnd || lastEnd < today ? 'expired' : m.status
  if (!BILLABLE.includes(standing)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${standing.replace(/_/g, ' ')}, so it is not charged.`, { reason: 'membership_not_billable' })
  const reason = String(args.reason ?? '').trim()
  let newTry = false
  if (a.status === 'failed') {
    const cardChanged = await db.auditEvent.findFirst({ where: { entityType: 'Membership', entityId: m.id, eventType: 'membership.payment_method_set', at: { gt: a.updatedAt } }, select: { id: true } })
    if (!cardChanged && reason.length < 3) throw new DomainError(Codes.GUARD_FAILED, 'Card declined: update the card, then Retry. To try the same card again, say why.', { reason: 'card_not_updated' })
    newTry = true
  }
  const outcome = await processAttempt(db, actor, args.attemptId, now, adapter, { newTry })
  if (newTry) await runInTransaction(db, async uow => { auditCreate(uow, actor, 'MembershipBillingAttempt', a.id, 'membership.charge_retried', { outcome }, { reason: reason || 'Card updated' }) }, { now })
  return { attemptId: args.attemptId, outcome }
}

export const describeOutcome = (o: AttemptOutcome) => ({ charged: 'Charged', declined: 'Declined', unknown: 'Waiting on the card processor', in_progress: 'Already being charged', already_paid: 'Already paid', no_card: 'No card on file', not_billable: 'Membership is not billed' })[o]
export { money, termNumberOn }
