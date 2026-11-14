import { keystoneContext } from '@/features/keystone/context'
import { systemActor } from '@/features/keystone/lib/actor'
import { recordInvoicePayment } from '@/features/keystone/services/payments'
import { stripeAdapter } from '@/features/keystone/services/stripeCards'

/*
 * A customer pays an invoice by card from its own link. The card is typed on Stripe Checkout; the result
 * is read back from Stripe (never from the URL) and recorded through the same payment command staff
 * use, so the batch, the allocation, the AR entry and the audit trail are the same.
 */

export const ONLINE_PAYMENTS = systemActor('online-payment')
export const INVOICE_CODE = /^INV-[0-9A-Z]{4}-[0-9A-Z]{4}$/
const db = () => keystoneContext.prisma as any

export type PublicInvoice = {
  id: string; ref: string; code: string; status: string; customer: string; address: string; invoiceDate: string | null; dueDate: string | null
  subtotalMinor: string; discountMinor: string; taxMinor: string; totalMinor: string; balanceMinor: string
  lines: { description: string; quantity: string; amountMinor: string }[]
  openAttempt: { id: string; status: string; amountMinor: string } | null
}

export async function invoiceByCode(code: string): Promise<PublicInvoice | null> {
  if (!INVOICE_CODE.test(code)) return null
  const i = await db().invoice.findUnique({
    where: { publicCode: code },
    select: {
      id: true, ref: true, publicCode: true, status: true, invoiceDate: true, dueDate: true, subtotalMinor: true, discountMinor: true, taxMinor: true, totalMinor: true, balanceMinor: true,
      customer: { select: { displayName: true } }, location: { select: { address1: true, city: true } },
      lines: { orderBy: { sortOrder: 'asc' }, select: { description: true, quantity: true, amountMinor: true } },
    },
  })
  // A draft or discarded invoice was never sent; its link shows nothing.
  if (!i || ['draft', 'discarded'].includes(i.status)) return null
  const open = await db().paymentAttempt.findFirst({ where: { invoiceId: i.id, status: { in: ['pending', 'unknown'] } }, select: { id: true, status: true, amountMinor: true } })
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
  return {
    id: i.id, ref: i.ref, code: i.publicCode, status: i.status, customer: i.customer?.displayName ?? '', address: i.location ? `${i.location.address1}, ${i.location.city}` : '',
    invoiceDate: day(i.invoiceDate), dueDate: day(i.dueDate), subtotalMinor: i.subtotalMinor.toString(), discountMinor: i.discountMinor.toString(), taxMinor: i.taxMinor.toString(),
    totalMinor: i.totalMinor.toString(), balanceMinor: i.balanceMinor.toString(),
    lines: i.lines.map((l: any) => ({ description: l.description, quantity: l.quantity.toString(), amountMinor: l.amountMinor.toString() })),
    openAttempt: open ? { id: open.id, status: open.status, amountMinor: open.amountMinor.toString() } : null,
  }
}

/** Record a card payment Stripe confirms for this attempt. Safe to call twice: the attempt and the key allow one. */
export async function recordOnlineCard(args: { invoiceId: string; attemptId: string; amountMinor: bigint; paymentIntent: string }): Promise<string | null> {
  const attempt = await db().paymentAttempt.findUnique({ where: { id: args.attemptId }, select: { id: true, invoiceId: true, amountMinor: true, status: true } })
  if (!attempt || attempt.invoiceId !== args.invoiceId || attempt.amountMinor !== args.amountMinor) return 'The card payment does not match this invoice. Please call us so we can check it.'
  if (attempt.status === 'succeeded') return null
  try {
    await recordInvoicePayment(keystoneContext.prisma as never, ONLINE_PAYMENTS, { invoiceId: args.invoiceId, amountMinor: args.amountMinor.toString(), method: 'card', reference: args.paymentIntent, attemptId: args.attemptId, idempotencyKey: `cardpay:${args.attemptId}` })
    return null
  } catch (e) {
    console.error(JSON.stringify({ component: 'storefront-pay', status: 'record_failed', attemptId: args.attemptId, error: e instanceof Error ? e.message.slice(0, 300) : 'unknown error' }))
    return 'Your card was charged, but we could not file the payment yet. You will not be charged again; the office will finish it.'
  }
}

/** The customer closed Stripe's page before it sent them back: ask Stripe whether the open try was paid. */
export async function settleOpenAttempt(invoice: PublicInvoice): Promise<boolean> {
  const stripe = stripeAdapter()
  if (!stripe || !invoice.openAttempt) return false
  const paid = await stripe.findPaidIntent(invoice.openAttempt.id)
  if (!paid || paid.invoiceId !== invoice.id || paid.amountMinor.toString() !== invoice.openAttempt.amountMinor) return false
  return (await recordOnlineCard({ invoiceId: invoice.id, attemptId: invoice.openAttempt.id, amountMinor: paid.amountMinor, paymentIntent: paid.paymentIntent })) === null
}
