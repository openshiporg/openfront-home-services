import { createHash } from 'node:crypto'

/*
 * The one place a card is charged from code (INTEGRATIONS §payments). Membership billing calls it synchronously, inside a
 * staff request. Every charge carries a processor key that is fixed for the attempt, so asking twice charges once; and a
 * result that is lost (timeout, dropped connection) comes back as `unknown`, never as a guess. Stripe TEST keys only:
 * a live key is refused. No webhooks, no background polling: an unknown result is looked up again when staff run billing.
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

export class StripeTestAdapter implements PaymentAdapter {
  readonly name = 'stripe-test'
  constructor(private readonly secretKey: string, private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = 20_000) {
    if (!/^sk_test_/.test(secretKey) && !/^rk_test_/.test(secretKey)) throw new Error('Only a Stripe TEST key is accepted here.')
  }

  private async call(path: string, init: RequestInit & { idempotencyKey?: string }) {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.secretKey}` }
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey
    if (init.method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
    return this.fetcher(`${STRIPE}${path}`, { ...init, headers, signal: AbortSignal.timeout(this.timeoutMs) })
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const key = createHash('sha256').update(input.providerKey).digest('hex').slice(0, 40)
    let response: Response
    try {
      response = await this.call('/payment_intents', {
        method: 'POST',
        idempotencyKey: input.providerKey.slice(0, 255),
        body: form({
          amount: input.amountMinor.toString(), currency: (input.currency ?? 'usd').toLowerCase(), payment_method: input.paymentMethodRef,
          customer: input.customerRef, confirm: 'true', off_session: 'true', description: input.description.slice(0, 250),
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

/** Test double. Remembers every key, so a repeated key returns the first answer (as the processor does) and charges are countable. */
export class FakeAdapter implements PaymentAdapter {
  readonly name = 'fake'
  readonly charges = new Map<string, { amountMinor: bigint; result: ChargeResult; calls: number }>()
  /** Next answers to give, per call: 'ok', 'decline', or 'lost' (charged, but the caller is told unknown). */
  script: ('ok' | 'decline' | 'lost' | 'throw')[] = []
  /** Delay before answering, to make two callers overlap. */
  delayMs = 0
  lookups = 0
  private serial = 0

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (this.delayMs) await new Promise(resolve => setTimeout(resolve, this.delayMs))
    const seen = this.charges.get(input.providerKey)
    if (seen) { seen.calls += 1; return seen.result }
    const step = this.script.shift() ?? 'ok'
    if (step === 'throw') throw new Error('socket hang up')
    const providerRef = `pi_fake_${(this.serial += 1)}`
    const result: ChargeResult = step === 'decline' ? { outcome: 'failed', providerRef, note: 'Your card was declined.' } : { outcome: 'succeeded', providerRef }
    this.charges.set(input.providerKey, { amountMinor: input.amountMinor, result, calls: 1 })
    if (step === 'lost') return { outcome: 'unknown', providerRef: '', note: 'No answer from the processor.' }
    return result
  }

  async lookup(providerKey: string): Promise<LookupResult> {
    this.lookups += 1
    const seen = this.charges.get(providerKey)
    return seen ? seen.result : { outcome: 'none' }
  }

  get succeededCount() { return [...this.charges.values()].filter(c => c.result.outcome === 'succeeded').length }
}

let override: PaymentAdapter | null = null
/** Tests install a fake here. */
export const setPaymentAdapter = (adapter: PaymentAdapter | null) => { override = adapter }

export class NotConfiguredAdapter implements PaymentAdapter {
  readonly name = 'not-configured'
  async charge(): Promise<ChargeResult> { return { outcome: 'failed', providerRef: '', note: 'Card charging is not set up on this server (no Stripe test key).' } }
  async lookup(): Promise<LookupResult> { return { outcome: 'none' } }
}

export function paymentAdapter(): PaymentAdapter {
  if (override) return override
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new StripeTestAdapter(key) : new NotConfiguredAdapter()
}
