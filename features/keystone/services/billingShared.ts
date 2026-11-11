import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { localDate } from '../lib/calendar'
import type { Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import type { UnitOfWork } from '../lib/unitOfWork'

/* Helpers the invoice, payment, credit and financing services share: AR periods, the receivable ledger, allocations. */

export const TERMS_DAYS: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60 }
export const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
export const dayOf = (d: Date) => d.toISOString().slice(0, 10)

export type InvoiceRow = {
  id: string; ref: string; status: string; version: number; balanceMinor: bigint; totalMinor: bigint; customerId: string | null; payerId: string | null
  jobId: string | null; arPeriodId: string | null; locationId: string | null; authorizationId: string | null
}

export async function companyToday(tx: Tx, at: Date) {
  const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } })
  return localDate({ timeZone: company?.homeTimeZone || 'America/Chicago' }, at)
}

/** The AR period for a day's month, created open on first use (there is no scheduler to do it). */
export async function arPeriodFor(tx: Tx, day: string, { requireOpen = true } = {}) {
  const month = asDate(`${day.slice(0, 7)}-01`)
  const period = await tx.arPeriod.upsert({ where: { month }, create: { month, status: 'open' }, update: {}, select: { id: true, status: true } })
  if (requireOpen && period.status !== 'open') throw new DomainError(Codes.GUARD_FAILED, `The AR period for ${day.slice(0, 7)} is ${period.status}. Choose a date in an open period.`, { reason: 'ar_period_closed', month: day.slice(0, 7) })
  return period
}

export async function lockInvoice(tx: Tx, id: string): Promise<InvoiceRow> {
  return lockRow<InvoiceRow & Record<string, unknown>>(tx, 'Invoice', id)
}

/** Status an invoice has after its balance changes: paid at 0, partly paid when something has been applied, else posted. */
export function statusForBalance(total: bigint, balance: bigint) {
  return balance === 0n ? 'paid' : balance < total ? 'partially_paid' : 'posted'
}

/** One signed receivable entry, in the entry day's open period. The deferred trigger proves balance = sum(entries). */
export async function postArEntry(uow: UnitOfWork, input: { invoice: Pick<InvoiceRow, 'id' | 'customerId' | 'payerId'>; kind: string; amountMinor: bigint; sourceType: string; sourceId: string; note?: string }) {
  const day = await companyToday(uow.tx, uow.now)
  const period = await arPeriodFor(uow.tx, day)
  return uow.tx.arEntry.create({
    data: { invoiceId: input.invoice.id, customerId: input.invoice.customerId, payerId: input.invoice.payerId, kind: input.kind, amountMinor: input.amountMinor, sourceType: input.sourceType, sourceId: input.sourceId, arPeriodId: period.id, postedAt: uow.now, note: input.note ?? '' },
    select: { id: true },
  })
}

/** Set the balance after a ledger entry and move the status with it. */
export async function settleInvoice(uow: UnitOfWork, actor: Actor, invoice: InvoiceRow, delta: bigint, eventType: string, extra: { to?: string; reason?: string | null } = {}) {
  const balance = invoice.balanceMinor + delta
  if (balance < 0n) throw new DomainError(Codes.GUARD_FAILED, 'That is more than the invoice balance.', { balanceMinor: invoice.balanceMinor.toString() })
  const to = extra.to ?? statusForBalance(invoice.totalMinor, balance)
  const version = await casUpdate(uow, { model: 'Invoice', id: invoice.id, version: invoice.version, from: ['posted', 'partially_paid', 'paid'], to, actor, eventType, reason: extra.reason ?? null, data: { balanceMinor: balance }, audit: { balanceMinor: balance.toString() } })
  return { ...invoice, status: to, version, balanceMinor: balance }
}

/** Apply `amount` of a payment to an invoice: allocation, ledger entry, balance. */
export async function allocatePayment(uow: UnitOfWork, actor: Actor, invoice: InvoiceRow, paymentId: string, amount: bigint) {
  if (!['posted', 'partially_paid'].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`, { status: invoice.status })
  if (amount <= 0n || amount > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `Apply between $0.01 and the $${(Number(invoice.balanceMinor) / 100).toFixed(2)} balance.`)
  const allocation = await uow.tx.paymentAllocation.create({ data: { paymentId, invoiceId: invoice.id, kind: 'apply', amountMinor: amount, createdById: actorUserId(actor) }, select: { id: true } })
  await postArEntry(uow, { invoice, kind: 'payment_applied', amountMinor: -amount, sourceType: 'Payment', sourceId: paymentId })
  const next = await settleInvoice(uow, actor, invoice, -amount, 'invoice.payment_applied')
  auditCreate(uow, actor, 'PaymentAllocation', allocation.id, 'payment.allocated', { paymentId, invoiceId: invoice.id, amountMinor: amount.toString() })
  return next
}

/** Take back `amount` from a payment's applications to invoices, newest first. Returns what was reversed. */
export async function reverseAllocations(uow: UnitOfWork, actor: Actor, paymentId: string, amount: bigint, kind: 'refund_reopen' | 'payment_reversed', reason: string) {
  const rows = await uow.tx.paymentAllocation.findMany({ where: { paymentId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  const reversedOf = new Map<string, bigint>()
  for (const r of rows) if (r.kind === 'reverse' && r.reversesId) reversedOf.set(r.reversesId, (reversedOf.get(r.reversesId) ?? 0n) + r.amountMinor)
  let left = amount
  for (const row of rows) {
    if (left === 0n) break
    if (row.kind !== 'apply' || !row.invoiceId) continue
    const open = row.amountMinor - (reversedOf.get(row.id) ?? 0n)
    if (open <= 0n) continue
    const take = open < left ? open : left
    await uow.tx.paymentAllocation.create({ data: { paymentId, invoiceId: row.invoiceId, kind: 'reverse', reversesId: row.id, amountMinor: take, reason, createdById: actorUserId(actor) } })
    const invoice = await lockInvoice(uow.tx, row.invoiceId)
    await postArEntry(uow, { invoice, kind, amountMinor: take, sourceType: 'Payment', sourceId: paymentId, note: reason })
    await settleInvoice(uow, actor, invoice, take, `invoice.${kind}`, { reason })
    left -= take
  }
  return amount - left
}

/** Unapplied money on a payment: paid - still-applied allocations - refunds. */
export async function unappliedOf(tx: Tx, paymentId: string) {
  const [payment, allocations, refunds] = await Promise.all([
    tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { amountMinor: true } }),
    tx.paymentAllocation.findMany({ where: { paymentId }, select: { kind: true, amountMinor: true } }),
    tx.refund.aggregate({ where: { paymentId }, _sum: { amountMinor: true } }),
  ])
  const applied = allocations.reduce((a, r) => a + (r.kind === 'apply' ? r.amountMinor : -r.amountMinor), 0n)
  const refunded = refunds._sum.amountMinor ?? 0n
  return { amountMinor: payment.amountMinor, applied, refunded, unapplied: payment.amountMinor - applied - refunded }
}

export const money = (minor: bigint | number | string) => `$${(Number(minor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
