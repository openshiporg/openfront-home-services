import { keystoneContext } from '@/features/keystone/context';
import { stripeAdapter } from '@/features/keystone/lib/paymentAdapter';
import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl';
import { recordCardPayment, saveMembershipCard } from '@/features/platform/lib/cards';

export const dynamic = 'force-dynamic';

/** Where Stripe's card page sends the browser back. The result is read from Stripe, never from the URL. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id') ?? '';
  const origin = (await getBaseUrl()) || url.origin;
  const next = url.searchParams.get('next') ?? '';
  const back = (extra: string) => {
    const path = /^\/dashboard\/platform\/[A-Za-z0-9/_-]*$/.test(next) ? next : '/dashboard/platform';
    return Response.redirect(new URL(`${path}${extra}`, origin), 303);
  };
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: url.pathname } as never);
  if (!(context.session as { itemId?: string } | undefined)?.itemId) return Response.redirect(new URL('/dashboard/signin', origin), 303);
  const stripe = stripeAdapter();
  if (!stripe || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return back('?cardError=' + encodeURIComponent('That card page could not be read.'));
  try {
    const r = await stripe.checkoutResult(sessionId);
    if (!r.done) return back('?cardError=' + encodeURIComponent('The card page was not finished, so nothing was saved or charged.'));
    if (r.mode === 'setup') {
      const err = await saveMembershipCard(r.metadata.membershipId ?? '', r.paymentMethod, r.label, sessionId);
      return back(err ? '?cardError=' + encodeURIComponent(err) : '');
    }
    const open = await (keystoneContext.prisma as any).paymentAttempt.findUnique({ where: { id: r.metadata.attemptId ?? '' }, select: { id: true, invoiceId: true, amountMinor: true } });
    if (!open || open.invoiceId !== r.metadata.invoiceId || open.amountMinor !== r.amountMinor) return back('?cardError=' + encodeURIComponent('Stripe took a payment that does not match this invoice. Check the processor dashboard.'));
    const err = await recordCardPayment({ invoiceId: open.invoiceId, attemptId: open.id, amountMinor: open.amountMinor.toString(), paymentIntent: r.paymentIntent });
    return back(err ? '?cardError=' + encodeURIComponent(err) : '');
  } catch (e) {
    return back('?cardError=' + encodeURIComponent(e instanceof Error ? e.message.slice(0, 200) : 'Stripe did not answer.'));
  }
}
