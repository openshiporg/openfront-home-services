import { createHash } from 'node:crypto'

/*
 * The one place a card is charged from code (INTEGRATIONS §payments). Membership billing calls it synchronously, inside a
 * staff request. Every charge carries a processor key that is fixed for the attempt, so asking twice charges once; and a
 * result that is lost (timeout, dropped connection) comes back as `unknown`, never as a guess. The mode follows the key
 * (sk_test_ or sk_live_): one code path. No webhooks, no background polling: an unknown result is looked up again when
 * staff run billing. Cards are entered on Stripe Checkout (setup mode to keep one on file, payment mode to pay an invoice).
 */

export type ChargeInput = {
  /** Fixed per attempt and generation. The processor treats a second call with the same key as the first. */
  providerKey: string
  amountMinor: bigint
  currency?: string
  paymentMethodRef: string
  customerRef?: string
  description: string
  metadata?: Record<string, string>
}

export type ChargeResult =
  | { outcome: 'succeeded'; providerRef: string }
  | { outcome: 'failed'; providerRef: string; note: string }
  /** The processor may or may not have charged. */
  | { outcome: 'unknown'; providerRef: string; note: string }

export type LookupResult = ChargeResult | { outcome: 'none' }

export interface PaymentAdapter {
  readonly name: string
  charge(input: ChargeInput): Promise<ChargeResult>
  /** What the processor knows about a key: used to settle an `unknown` attempt without charging again. */
  lookup(providerKey: string): Promise<LookupResult>
}

const STRIPE = 'https://api.stripe.com/v1'

const form = (values: Record<string, string | undefined>) => {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== '') body.set(k, v)
  return body
}

type StripeIntent = { id: string; status: string; last_payment_error?: { message?: string } | null }
const toResult = (intent: StripeIntent): ChargeResult => {
  if (intent.status === 'succeeded') return { outcome: 'succeeded', providerRef: intent.id }
  if (intent.status === 'processing') return { outcome: 'unknown', providerRef: intent.id, note: 'The processor is still working on this charge.' }
  return { outcome: 'failed', providerRef: intent.id, note: intent.last_payment_error?.message?.slice(0, 200) || `Charge ${intent.status.replace(/_/g, ' ')}.` }
}

export class StripeAdapter implements PaymentAdapter {
  readonly name = 'stripe'
  constructor(private readonly secretKey: string, private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = 20_000) {
    if (!/^(sk|rk)_(test|live)_/.test(secretKey)) throw new Error('That is not a Stripe secret key.')
  }

  private async call(path: string, init: RequestInit & { idempotencyKey?: string }) {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.secretKey}` }
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey
    if (init.method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
    return this.fetcher(`${STRIPE}${path}`, { ...init, headers, signal: AbortSignal.timeout(this.timeoutMs) })
  }

  /** The Stripe customer a saved card belongs to (Checkout setup mode makes one); an off-session charge needs it. */
  private async customerOf(paymentMethod: string): Promise<string | undefined> {
    try {
      const r = await this.call(`/payment_methods/${encodeURIComponent(paymentMethod)}`, { method: 'GET' })
      const j = (await r.json()) as { customer?: string | null }
      return j.customer ?? undefined
    } catch { return undefined }
  }

  /** A hosted page where the customer types a card to keep on file (no charge). */
  async setupCheckout(args: { successUrl: string; cancelUrl: string; description: string; metadata?: Record<string, string> }): Promise<{ id: string; url: string }> {
    const r = await this.call('/checkout/sessions', { method: 'POST', body: form({
      mode: 'setup', 'payment_method_types[0]': 'card', customer_creation: 'always', success_url: args.successUrl, cancel_url: args.cancelUrl,
      'setup_intent_data[description]': args.description.slice(0, 250), ...Object.fromEntries(Object.entries(args.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v])),
    }) })
    const j = (await r.json()) as { id?: string; url?: string; error?: { message?: string } }
    if (!r.ok || !j.id || !j.url) throw new Error(j.error?.message ?? 'Stripe did not open the card page.')
    return { id: j.id, url: j.url }
  }

  /** A hosted page where the customer pays one amount by card. */
  async paymentCheckout(args: { amountMinor: bigint; currency?: string; name: string; successUrl: string; cancelUrl: string; metadata?: Record<string, string> }): Promise<{ id: string; url: string }> {
    const meta = Object.fromEntries(Object.entries(args.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v]))
    const r = await this.call('/checkout/sessions', { method: 'POST', body: form({
      mode: 'payment', 'payment_method_types[0]': 'card', success_url: args.successUrl, cancel_url: args.cancelUrl,
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': (args.currency ?? 'usd').toLowerCase(),
      'line_items[0][price_data][unit_amount]': args.amountMinor.toString(), 'line_items[0][price_data][product_data][name]': args.name.slice(0, 250),
      'payment_intent_data[description]': args.name.slice(0, 250), ...Object.fromEntries(Object.entries(args.metadata ?? {}).map(([k, v]) => [`payment_intent_data[metadata][${k}]`, v])), ...meta,
    }) })
    const j = (await r.json()) as { id?: string; url?: string; error?: { message?: string } }
    if (!r.ok || !j.id || !j.url) throw new Error(j.error?.message ?? 'Stripe did not open the payment page.')
    return { id: j.id, url: j.url }
  }

  /** What the customer did on a Checkout page. */
  async checkoutResult(sessionId: string): Promise<
    | { mode: 'setup'; done: boolean; paymentMethod: string; label: string; metadata: Record<string, string> }
    | { mode: 'payment'; done: boolean; paymentIntent: string; amountMinor: bigint; metadata: Record<string, string> }
  > {
    const r = await this.call(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=setup_intent.payment_method&expand[]=payment_intent`, { method: 'GET' })
    const j = (await r.json()) as {
      mode?: string; status?: string; payment_status?: string; metadata?: Record<string, string>; amount_total?: number
      setup_intent?: { payment_method?: { id?: string; card?: { brand?: string; last4?: string } } | null } | null; payment_intent?: { id?: string; status?: string } | null; error?: { message?: string }
    }
    if (!r.ok || j.error) throw new Error(j.error?.message ?? 'Stripe could not be asked about that page.')
    const metadata = j.metadata ?? {}
    if (j.mode === 'setup') {
      const pm = j.setup_intent?.payment_method
      const card = pm?.card
      return { mode: 'setup', done: j.status === 'complete' && !!pm?.id, paymentMethod: pm?.id ?? '', label: card ? `${(card.brand ?? 'Card').replace(/^./, c => c.toUpperCase())} ending ${card.last4}` : '', metadata }
    }
    return { mode: 'payment', done: j.payment_status === 'paid' && j.payment_intent?.status === 'succeeded', paymentIntent: j.payment_intent?.id ?? '', amountMinor: BigInt(j.amount_total ?? 0), metadata }
  }

  /** A paid Checkout payment for this attempt, if the customer finished one (staff left the page before it came back). */
  async findPaidIntent(attemptId: string): Promise<{ paymentIntent: string; amountMinor: bigint; invoiceId: string } | null> {
    try {
      const r = await this.call(`/payment_intents/search?query=${encodeURIComponent(`metadata['attemptId']:'${attemptId.replace(/[^A-Za-z0-9_-]/g, '')}' AND status:'succeeded'`)}&limit=1`, { method: 'GET' })
      const j = (await r.json()) as { data?: { id: string; amount_received?: number; metadata?: Record<string, string> }[] }
      const f = j.data?.[0]
      return r.ok && f ? { paymentIntent: f.id, amountMinor: BigInt(f.amount_received ?? 0), invoiceId: f.metadata?.invoiceId ?? '' } : null
    } catch { return null }
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const key = createHash('sha256').update(input.providerKey).digest('hex').slice(0, 40)
    const customer = input.customerRef ?? await this.customerOf(input.paymentMethodRef)
    let response: Response
    try {
      response = await this.call('/payment_intents', {
        method: 'POST',
        idempotencyKey: input.providerKey.slice(0, 255),
        body: form({
          amount: input.amountMinor.toString(), currency: (input.currency ?? 'usd').toLowerCase(), payment_method: input.paymentMethodRef,
          customer, confirm: 'true', off_session: 'true', description: input.description.slice(0, 250),
          'metadata[providerKey]': key, ...Object.fromEntries(Object.entries(input.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v])),
        }),
      })
    } catch {
      return { outcome: 'unknown', providerRef: '', note: 'No answer from the processor. The card may or may not have been charged.' }
    }
    const json = (await response.json().catch(() => null)) as { id?: string; status?: string; error?: { message?: string; payment_intent?: StripeIntent; type?: string } } | null
    if (response.status >= 500 || !json) return { outcome: 'unknown', providerRef: '', note: 'The processor answered with an error. The card may or may not have been charged.' }
    if (json.error) {
      const intent = json.error.payment_intent
      if (intent?.id) return { outcome: 'failed', providerRef: intent.id, note: json.error.message?.slice(0, 200) || 'The card was declined.' }
      if (response.status === 429 || json.error.type === 'api_connection_error') return { outcome: 'unknown', providerRef: '', note: 'The processor was busy. Nothing is known about this charge yet.' }
      return { outcome: 'failed', providerRef: '', note: json.error.message?.slice(0, 200) || 'The card was declined.' }
    }
    return toResult(json as unknown as StripeIntent)
  }

  async lookup(providerKey: string): Promise<LookupResult> {
    const key = createHash('sha256').update(providerKey).digest('hex').slice(0, 40)
    try {
      const response = await this.call(`/payment_intents/search?query=${encodeURIComponent(`metadata['providerKey']:'${key}'`)}&limit=1`, { method: 'GET' })
      const json = (await response.json()) as { data?: StripeIntent[]; error?: unknown }
      if (!response.ok || json.error) return { outcome: 'unknown', providerRef: '', note: 'The processor could not be asked right now.' }
      const found = json.data?.[0]
      return found ? toResult(found) : { outcome: 'none' }
    } catch {
      return { outcome: 'unknown', providerRef: '', note: 'The processor could not be reached.' }
    }
  }
}

export class NotConfiguredAdapter implements PaymentAdapter {
  readonly name = 'not-configured'
  async charge(): Promise<ChargeResult> { return { outcome: 'failed', providerRef: '', note: 'Card charging is not set up on this server (no Stripe secret key).' } }
  async lookup(): Promise<LookupResult> { return { outcome: 'none' } }
}

export function paymentAdapter(): PaymentAdapter {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new StripeAdapter(key) : new NotConfiguredAdapter()
}

/** The Stripe adapter, or null when the server has no secret key (card pages then say so, plainly). */
export function stripeAdapter(): StripeAdapter | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new StripeAdapter(key) : null
}
