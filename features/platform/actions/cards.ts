'use server';

import { keystoneContext } from '@/features/keystone/context';
import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { stripeAdapter } from '@/features/keystone/services/stripeCards';
import { viewer } from '../lib/server';
import { recordCardPayment } from '../lib/cards';

type Out = { ok: true; url?: string; message?: string } | { ok: false; error: string };
const NO_STRIPE = 'Card payments are not set up on this server (no Stripe secret key).';
const db = () => keystoneContext.prisma as any;

/** Opens Stripe's card page so the customer's card is typed there and kept on the membership. Nothing is charged. */
export async function startMembershipCard(membershipId: string): Promise<Out> {
  const me = await viewer();
  if (!me.can('canSellMemberships') && !me.can('canManageMemberships')) return { ok: false, error: 'You cannot change a membership card.' };
  const stripe = stripeAdapter();
  if (!stripe) return { ok: false, error: NO_STRIPE };
  const m = await db().membership.findUnique({ where: { id: membershipId }, select: { id: true, ref: true, status: true } });
  if (!m || ['cancelled', 'transferred', 'expired'].includes(m.status)) return { ok: false, error: 'This membership is over.' };
  const origin = await getBaseUrl();
  const back = `/dashboard/platform/memberships/${m.id}`;
  try {
    const s = await stripe.setupCheckout({
      successUrl: `${origin}/api/cards/return?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(back)}`, cancelUrl: `${origin}${back}`,
      description: `Card on file for ${m.ref}`, metadata: { kind: 'membership_card', membershipId: m.id },
    });
    return { ok: true, url: s.url };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Stripe did not answer.' }; }
}

/** Opens Stripe's card page to pay an invoice's balance. One open card try per invoice: an unfinished one is reused. */
export async function startInvoiceCard(invoiceId: string): Promise<Out> {
  const me = await viewer();
  if (!me.can('canTakePayments') && !me.can('canManagePayments')) return { ok: false, error: 'You cannot take payments.' };
  const stripe = stripeAdapter();
  if (!stripe) return { ok: false, error: NO_STRIPE };
  const invoice = await db().invoice.findUnique({ where: { id: invoiceId }, select: { id: true, ref: true, status: true, balanceMinor: true } });
  if (!invoice || !['posted', 'partially_paid'].includes(invoice.status) || invoice.balanceMinor <= 0n) return { ok: false, error: 'This invoice takes no payment.' };
  const open = await db().paymentAttempt.findFirst({ where: { invoiceId, status: { in: ['pending', 'unknown'] } }, select: { id: true, status: true, amountMinor: true } });
  if (open?.status === 'unknown') return { ok: false, error: 'An earlier card try on this invoice has an unknown result. Resolve it under Payments first.' };
  let attemptId = open?.id as string | undefined;
  let amount = open?.amountMinor as bigint | undefined;
  if (!attemptId) {
    const r = await keystoneClient<{ startPaymentAttempt: { attemptId: string } }>(
      `mutation($i: ID!, $a: String!, $k: String!) { startPaymentAttempt(invoiceId: $i, amountMinor: $a, method: "card", idempotencyKey: $k) }`,
      { i: invoiceId, a: invoice.balanceMinor.toString(), k: `cardstart:${invoiceId}:${crypto.randomUUID()}` });
    if (!r.success) return { ok: false, error: r.error || 'The card try could not be started.' };
    attemptId = r.data.startPaymentAttempt.attemptId; amount = invoice.balanceMinor;
  }
  const origin = await getBaseUrl();
  const back = `/dashboard/platform/invoices/${invoice.id}`;
  try {
    const s = await stripe.paymentCheckout({
      amountMinor: amount!, name: `Invoice ${invoice.ref}`, successUrl: `${origin}/api/cards/return?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(back)}`, cancelUrl: `${origin}${back}`,
      metadata: { kind: 'invoice_card', invoiceId: invoice.id, attemptId: attemptId! },
    });
    return { ok: true, url: s.url };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Stripe did not answer.' }; }
}

/** Staff left Stripe's page before it came back: ask Stripe whether this invoice's open try was paid, and record it if so. */
export async function checkInvoiceCard(invoiceId: string): Promise<Out> {
  const me = await viewer();
  if (!me.can('canTakePayments') && !me.can('canManagePayments')) return { ok: false, error: 'You cannot take payments.' };
  const stripe = stripeAdapter();
  if (!stripe) return { ok: false, error: NO_STRIPE };
  const open = await db().paymentAttempt.findFirst({ where: { invoiceId, status: { in: ['pending', 'unknown'] } }, select: { id: true, amountMinor: true } });
  if (!open) return { ok: true, message: 'No card try is open on this invoice.' };
  const paid = await stripe.findPaidIntent(open.id);
  if (!paid) return { ok: true, message: 'Stripe shows no finished payment for this try yet.' };
  if (paid.amountMinor !== open.amountMinor || paid.invoiceId !== invoiceId) return { ok: false, error: 'Stripe has a payment for a different amount. Check the processor dashboard.' };
  const err = await recordCardPayment({ invoiceId, attemptId: open.id, amountMinor: open.amountMinor.toString(), paymentIntent: paid.paymentIntent });
  return err ? { ok: false, error: err } : { ok: true, message: 'Payment recorded.' };
}
