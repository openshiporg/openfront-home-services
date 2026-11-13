import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

/**
 * Turns what Stripe says about a card page into records, through the same commands staff use (so every access rule,
 * audit entry and guard applies). The idempotency keys come from the Stripe ids, so reloading the return page or
 * pressing Check twice records once.
 */
export async function saveMembershipCard(membershipId: string, paymentMethod: string, label: string, sessionId: string) {
  const r = await keystoneClient(
    `mutation($m: ID!, $r: String!, $l: String!, $k: String!) { updateMembershipPaymentMethod(membershipId: $m, paymentMethodRef: $r, paymentMethodLabel: $l, idempotencyKey: $k) }`,
    { m: membershipId, r: paymentMethod, l: label || 'Card', k: `card:${sessionId}` },
  );
  return r.success ? null : r.error || 'The card could not be saved.';
}

export async function recordCardPayment(args: { invoiceId: string; attemptId: string; amountMinor: string; paymentIntent: string }) {
  const r = await keystoneClient(
    `mutation($i: ID!, $a: String!, $ref: String!, $att: ID!, $k: String!) { recordInvoicePayment(invoiceId: $i, amountMinor: $a, method: "card", reference: $ref, attemptId: $att, idempotencyKey: $k) }`,
    { i: args.invoiceId, a: args.amountMinor, ref: args.paymentIntent, att: args.attemptId, k: `cardpay:${args.attemptId}` },
  );
  return r.success ? null : r.error || 'The payment could not be recorded.';
}
