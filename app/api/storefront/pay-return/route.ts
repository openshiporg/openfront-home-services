import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl'
import { stripeAdapter } from '@/features/keystone/services/stripeCards'
import { INVOICE_CODE, invoiceByCode, recordOnlineCard } from '@/features/storefront/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * Where Stripe's card page sends a customer back after paying an invoice from its link. What happened is
 * read from Stripe by the session id, never from the URL, and recorded once (reloading this changes nothing).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = (await getBaseUrl()) || url.origin
  const code = (url.searchParams.get('code') ?? '').toUpperCase()
  const sessionId = url.searchParams.get('session_id') ?? ''
  if (!INVOICE_CODE.test(code)) return Response.redirect(new URL('/sign-in', origin), 303)
  const back = (result: string) => Response.redirect(new URL(`/pay/${code}?result=${result}`, origin), 303)
  const stripe = stripeAdapter()
  if (!stripe || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return back('unread')
  try {
    const invoice = await invoiceByCode(code)
    const r = await stripe.checkoutResult(sessionId)
    if (!invoice || r.mode !== 'payment') return back('unread')
    if (!r.done) return back('unfinished')
    if (r.metadata.invoiceId !== invoice.id || !r.metadata.attemptId) return back('mismatch')
    const error = await recordOnlineCard({ invoiceId: invoice.id, attemptId: r.metadata.attemptId, amountMinor: r.amountMinor, paymentIntent: r.paymentIntent })
    return back(error ? (/does not match/.test(error) ? 'mismatch' : 'filing') : 'paid')
  } catch (e) {
    console.error(JSON.stringify({ component: 'storefront-pay', status: 'return_failed', error: e instanceof Error ? e.message.slice(0, 300) : 'unknown error' }))
    return back('unread')
  }
}
