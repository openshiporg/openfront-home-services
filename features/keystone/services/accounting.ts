import { createHash } from 'node:crypto'
import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate } from '../lib/cas'
import { command } from '../lib/command'
import { localDate } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import { assertDateRange } from './accountingDates'

/*
 * Accounting export: a download, not a sync. Each receivable, credit and refund record becomes balanced journal lines, once.
 * A line's source key is unique, so asking for the same period twice never repeats a line; the second batch holds only what is new.
 */

export const ACCOUNTS = {
  ar: '1200', cash: '1010', card: '1020', ach: '1030', financing: '1040', thirdParty: '1050', customerCredit: '2400',
  salesTax: '2200', refundClearing: '2500', fees: '6100', salesReturns: '4900', badDebt: '6900',
} as const
const TENDER_ACCOUNT: Record<string, string> = { cash: ACCOUNTS.cash, check: ACCOUNTS.cash, other: ACCOUNTS.cash, card: ACCOUNTS.card, ach: ACCOUNTS.ach, financing: ACCOUNTS.financing, third_party: ACCOUNTS.thirdParty, customer_credit: ACCOUNTS.customerCredit }

type Line = { sourceKey: string; entryDate: string; account: string; debitMinor: bigint; creditMinor: bigint; memo: string; docRef: string; customerRef: string }

const dr = (base: Omit<Line, 'account' | 'debitMinor' | 'creditMinor' | 'sourceKey'> & { key: string }, account: string, amount: bigint, n: number): Line => ({ sourceKey: `${base.key}:${n}`, entryDate: base.entryDate, account, debitMinor: amount, creditMinor: 0n, memo: base.memo, docRef: base.docRef, customerRef: base.customerRef })
const cr = (base: Omit<Line, 'account' | 'debitMinor' | 'creditMinor' | 'sourceKey'> & { key: string }, account: string, amount: bigint, n: number): Line => ({ sourceKey: `${base.key}:${n}`, entryDate: base.entryDate, account, debitMinor: 0n, creditMinor: amount, memo: base.memo, docRef: base.docRef, customerRef: base.customerRef })

/** Journal lines for every source record dated inside the range that has not been exported. */
export async function journalFor(tx: Tx, from: string, to: string, tz: string) {
  const lo = new Date(`${from}T00:00:00Z`)
  lo.setUTCDate(lo.getUTCDate() - 1)
  const hi = new Date(`${to}T00:00:00Z`)
  hi.setUTCDate(hi.getUTCDate() + 2)
  const inRange = (d: Date) => { const day = localDate({ timeZone: tz }, d); return day >= from && day <= to ? day : null }
  const lines: Line[] = []
  const customerRefOf = async (customerId: string | null, payerId: string | null) => {
    if (payerId) { const p = await tx.payerProfile.findUnique({ where: { id: payerId }, select: { accountingCustomerRef: true, name: true } }); return p?.accountingCustomerRef || p?.name || '' }
    if (!customerId) return ''
    const c = await tx.customer.findUnique({ where: { id: customerId }, select: { ref: true } })
    return c?.ref ?? ''
  }

  const entries = await tx.arEntry.findMany({ where: { postedAt: { gte: lo, lt: hi } }, orderBy: [{ postedAt: 'asc' }, { id: 'asc' }], include: { invoice: { select: { ref: true, lines: { orderBy: { sortOrder: 'asc' } } } } } })
  for (const e of entries) {
    const day = inRange(e.postedAt)
    if (!day) continue
    const base = { key: `ar:${e.id}`, entryDate: day, memo: `${e.kind.replace(/_/g, ' ')} ${e.invoice?.ref ?? ''}`.trim(), docRef: e.invoice?.ref ?? '', customerRef: await customerRefOf(e.customerId, e.payerId) }
    const amt = e.amountMinor < 0n ? -e.amountMinor : e.amountMinor
    if (e.kind === 'invoice_posted') {
      lines.push(dr(base, ACCOUNTS.ar, amt, 0))
      let n = 1
      let tax = 0n
      for (const l of e.invoice?.lines ?? []) {
        const net = l.amountMinor - l.discountMinor
        if (net > 0n) lines.push(cr(base, l.revenueAccountCode || '4000', net, n++))
        tax += l.taxMinor
      }
      if (tax > 0n) lines.push(cr(base, ACCOUNTS.salesTax, tax, n++))
    } else if (e.kind === 'payment_applied' || e.kind === 'payment_reversed' || e.kind === 'refund_reopen') {
      const pay = e.sourceId ? await tx.payment.findUnique({ where: { id: e.sourceId }, select: { method: true } }) : null
      const tender = e.kind === 'refund_reopen' ? ACCOUNTS.refundClearing : TENDER_ACCOUNT[pay?.method ?? 'other'] ?? ACCOUNTS.cash
      if (e.kind === 'payment_applied') { lines.push(dr(base, tender, amt, 0)); lines.push(cr(base, ACCOUNTS.ar, amt, 1)) }
      else if (e.kind === 'refund_reopen') { lines.push(dr(base, ACCOUNTS.ar, amt, 0)); lines.push(cr(base, tender, amt, 1)) }
      else { lines.push(dr(base, ACCOUNTS.ar, amt, 0)); lines.push(cr(base, tender, amt, 1)) }
    } else if (e.kind === 'credit_memo') {
      lines.push(dr(base, ACCOUNTS.salesReturns, amt, 0)); lines.push(cr(base, ACCOUNTS.ar, amt, 1))
    } else if (e.kind === 'write_off') {
      lines.push(dr(base, ACCOUNTS.badDebt, amt, 0)); lines.push(cr(base, ACCOUNTS.ar, amt, 1))
    }
  }

  // Money that never touched an invoice: processing fees, customer credit, and refunds paid out.
  const payments = await tx.payment.findMany({ where: { receivedAt: { gte: lo, lt: hi } }, select: { id: true, ref: true, method: true, feeMinor: true, receivedAt: true, customerId: true, payerId: true } })
  for (const p of payments) {
    const day = inRange(p.receivedAt)
    if (!day || p.feeMinor === 0n) continue
    const base = { key: `fee:${p.id}`, entryDate: day, memo: `processing fee ${p.ref}`, docRef: p.ref, customerRef: await customerRefOf(p.customerId, p.payerId) }
    lines.push(dr(base, ACCOUNTS.fees, p.feeMinor, 0)); lines.push(cr(base, TENDER_ACCOUNT[p.method] ?? ACCOUNTS.cash, p.feeMinor, 1))
  }
  const credits = await tx.customerCreditEntry.findMany({ where: { createdAt: { gte: lo, lt: hi } }, orderBy: { createdAt: 'asc' } })
  for (const c of credits) {
    const day = inRange(c.createdAt)
    if (!day) continue
    const base = { key: `credit:${c.id}`, entryDate: day, memo: `customer credit ${c.kind}`, docRef: c.sourceId, customerRef: await customerRefOf(c.customerId, null) }
    const amt = c.amountMinor < 0n ? -c.amountMinor : c.amountMinor
    if (c.kind === 'issued') {
      const src = c.sourceType === 'Payment' ? await tx.payment.findUnique({ where: { id: c.sourceId }, select: { method: true } }) : null
      lines.push(dr(base, src ? TENDER_ACCOUNT[src.method] ?? ACCOUNTS.cash : ACCOUNTS.salesReturns, amt, 0)); lines.push(cr(base, ACCOUNTS.customerCredit, amt, 1))
    } else if (c.kind === 'refunded') { lines.push(dr(base, ACCOUNTS.customerCredit, amt, 0)); lines.push(cr(base, ACCOUNTS.refundClearing, amt, 1)) }
    // `applied` is the customer_credit payment's own application, already shown as a payment_applied entry.
  }
  const refunds = await tx.refund.findMany({ where: { refundedAt: { gte: lo, lt: hi } }, include: { payment: { select: { method: true, customerId: true, payerId: true } } } })
  for (const r of refunds) {
    const day = inRange(r.refundedAt)
    if (!day) continue
    const base = { key: `refund:${r.id}`, entryDate: day, memo: `refund ${r.ref}`, docRef: r.ref, customerRef: await customerRefOf(r.payment?.customerId ?? null, r.payment?.payerId ?? null) }
    lines.push(dr(base, ACCOUNTS.refundClearing, r.amountMinor, 0)); lines.push(cr(base, TENDER_ACCOUNT[r.payment?.method ?? 'other'] ?? ACCOUNTS.cash, r.amountMinor, 1))
  }
  return lines
}

/** Build a batch of everything in the range that has not been exported. Returns the batch to download. */
export async function createExportBatch(db: Db, actor: Actor, args: { from: string; to: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'accounting.export', ['canManageAccounting'], args)
  assertDateRange(args.from, args.to)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'accounting.export', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } })
    const all = await journalFor(tx, args.from, args.to, company?.homeTimeZone || 'America/Chicago')
    const done = new Set((await tx.accountingExportLine.findMany({ where: { sourceKey: { in: all.map(l => l.sourceKey) } }, select: { sourceKey: true } })).map(l => l.sourceKey))
    const fresh = all.filter(l => !done.has(l.sourceKey))
    if (!fresh.length) throw new DomainError(Codes.GUARD_FAILED, 'Nothing new to export in that range.', { reason: 'nothing_to_export' })
    const debit = fresh.reduce((a, l) => a + l.debitMinor, 0n)
    const credit = fresh.reduce((a, l) => a + l.creditMinor, 0n)
    if (debit !== credit) throw new DomainError(Codes.GUARD_FAILED, `The journal does not balance (debits ${debit}, credits ${credit}). Nothing was exported.`, { reason: 'unbalanced' })
    const ref = await nextReference(tx, 'EXP', uow.now)
    const sha = createHash('sha256').update(fresh.map(l => l.sourceKey).join('\n')).digest('hex')
    const batch = await tx.accountingExportBatch.create({ data: { ref, periodFrom: new Date(`${args.from}T00:00:00Z`), periodTo: new Date(`${args.to}T00:00:00Z`), status: 'created', lineCount: fresh.length, debitMinor: debit, creditMinor: credit, sha256: sha, createdById: actorUserId(actor) }, select: { id: true } })
    await tx.accountingExportLine.createMany({ data: fresh.map((l, i) => ({ batchId: batch.id, sourceKey: l.sourceKey, entryDate: new Date(`${l.entryDate}T00:00:00Z`), account: l.account, debitMinor: l.debitMinor, creditMinor: l.creditMinor, memo: l.memo, docRef: l.docRef, customerRef: l.customerRef, sortOrder: i })) })
    auditCreate(uow, actor, 'AccountingExportBatch', batch.id, 'accounting.exported', { ref, lines: fresh.length, debitMinor: debit.toString(), from: args.from, to: args.to })
    return { batchId: batch.id, ref, lineCount: fresh.length, debitMinor: debit.toString() }
  })
  return { replay: result.replay, ...result.value }
}

const cell = (v: string) => (/[",\n\r]/.test(v) || /^[=+\-@\t]/.test(v) ? `"${(/^[=+\-@\t]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"` : v)
const dollars = (m: bigint) => `${m < 0n ? '-' : ''}${(m < 0n ? -m : m) / 100n}.${String((m < 0n ? -m : m) % 100n).padStart(2, '0')}`

/** The batch as CSV (one journal line per row, dollars and cents, formula-safe). */
export async function exportBatchCsv(tx: Tx | Db, batchId: string) {
  const batch = await tx.accountingExportBatch.findUnique({ where: { id: batchId }, include: { lines: { orderBy: { sortOrder: 'asc' } } } })
  if (!batch) return null
  const rows = [['Date', 'Account', 'Debit', 'Credit', 'Memo', 'Document', 'Customer'].join(',')]
  for (const l of batch.lines) rows.push([(l.entryDate?.toISOString().slice(0, 10) ?? ''), l.account, l.debitMinor ? dollars(l.debitMinor) : '', l.creditMinor ? dollars(l.creditMinor) : '', cell(l.memo), cell(l.docRef), cell(l.customerRef)].join(','))
  return { ref: batch.ref, csv: `${rows.join('\r\n')}\r\n` }
}

/** A report as CSV, for the Export buttons on lists (AR aging, payments, tax). */
export function toCsv(header: string[], rows: (string | number | bigint | null)[][]) {
  return `${[header.map(cell).join(','), ...rows.map(r => r.map(v => cell(v === null ? '' : String(v))).join(','))].join('\r\n')}\r\n`
}
export const centsToDollars = dollars
