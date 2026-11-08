import { describe, expect, it } from 'vitest'
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

describe('canReadCost', () => {
  const as = (perm: string) => ({ itemId: 'u', data: { role: { [perm]: true } } }) as never
  it('allows price-book roles only', () => {
    expect(canReadCost(as('canManagePriceBook'))).toBe(true)
    expect(canReadCost(as('canDispatch'))).toBe(false)
    expect(canReadCost(undefined)).toBe(false)
  })
})
