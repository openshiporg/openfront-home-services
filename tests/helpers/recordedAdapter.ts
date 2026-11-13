import type { ChargeInput, ChargeResult, LookupResult, PaymentAdapter } from '../../features/keystone/lib/paymentAdapter'

/* Used by the database tests only; nothing in the product imports this file. */
/** Records calls and answers as told, for the database tests. Remembers every key, so a repeated key returns the first answer (as the processor does) and charges are countable. */
export class RecordedAdapter implements PaymentAdapter {
  readonly name = 'recorded'
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

