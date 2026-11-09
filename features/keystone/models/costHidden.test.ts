import { describe, expect, it } from 'vitest'
import { payloadHash, keyedPayloadHash } from '../lib/canonical'
import { canReadCost, withoutCost } from './costHidden'

describe('withoutCost', () => {
  it('removes cost and margin keys at any depth and leaves the rest', () => {
    const snap = { itemKey: 'WH-50', unitPriceMinor: '129900', costMinor: '61000', nested: [{ marginBps: '5300', name: 'x' }], warrantyText: '6 years' }
    expect(withoutCost(snap)).toEqual({ itemKey: 'WH-50', unitPriceMinor: '129900', nested: [{ name: 'x' }], warrantyText: '6 years' })
  })
  it('never changes the stored value', () => {
    const snap = { costMinor: '1' }
    withoutCost(snap)
    expect(snap).toEqual({ costMinor: '1' })
  })
})

describe('withoutCost and hashes', () => {
  it('drops hashes that were computed over cost, at any depth', () => {
    const snap = { id: 'o1', contentHash: 'abc', options: [{ name: 'Good', contentHash: 'def', quoteHash: 'x', totalMinor: '5' }] }
    expect(withoutCost(snap)).toEqual({ id: 'o1', options: [{ name: 'Good', totalMinor: '5' }] })
  })
})

describe('keyedPayloadHash', () => {
  const lines = (cost: string) => ({ versionId: 'v1', lines: [{ itemKey: 'MAT-BRK-20A', unitPriceMinor: '1900', costMinor: cost }] })
  it('cannot be brute-forced without the server key, and changes with the key', () => {
    const real = keyedPayloadHash(lines('863'))
    // The attack from review r4: rebuild the plain SHA-256 of the same content for each guessed cost.
    let found: number | null = null
    for (let c = 0; c <= 5000; c += 1) if (payloadHash(lines(String(c))) === real) { found = c; break }
    expect(found).toBeNull()
    expect(real).toMatch(/^[0-9a-f]{64}$/)
    const before = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'a-different-server-secret-value'
    try { expect(keyedPayloadHash(lines('863'))).not.toBe(real) } finally { if (before === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = before }
  })
  it('is stable for the same content whatever the key order', () => {
    expect(keyedPayloadHash({ a: 1, b: 2 })).toBe(keyedPayloadHash({ b: 2, a: 1 }))
  })
})

describe('canReadCost', () => {
  const as = (perm: string) => ({ itemId: 'u', data: { role: { [perm]: true } } }) as never
  it('allows price-book roles only', () => {
    expect(canReadCost(as('canManagePriceBook'))).toBe(true)
    expect(canReadCost(as('canDispatch'))).toBe(false)
    expect(canReadCost(undefined)).toBe(false)
  })
})

describe('AuditEvent hash fields', () => {
  it('use costHash, so they follow the cost read, filter and order rule', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('./platform.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/prevHash: costHash\(/)
    expect(source).toMatch(/\bhash: costHash\(/)
  })
})
