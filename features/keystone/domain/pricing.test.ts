import { describe, expect, it } from 'vitest'
import { costChangeReport, depositCap, diffItems, formulaPrice, markupFor, optionTotals, quoteHash, quoteLine, submitFindings, validateMarkupTiers, versionContentHash, type PriceBookItemDraft } from './pricing'

const item = (over: Partial<PriceBookItemDraft> = {}): PriceBookItemDraft & { id: string } => ({
  id: 'i1', itemKey: 'PL-FAUCET', kind: 'service_task', categoryKey: 'plumbing-fixtures', name: 'Replace faucet', customerDescription: 'Remove and replace a kitchen faucet.',
  trade: 'plumbing', businessUnitId: null, pricingMethod: 'fixed', unitPriceMinor: 32500n, memberUnitPriceMinor: 29250n, costMinor: 4000n,
  laborHours: '1.5', uom: 'ea', taxCategory: 'labor', warrantyText: '', materials: [], cancellationClassDefault: 'requested_repair', ladderKey: '', tier: '', active: true,
  ...over,
})
const markup = { name: 'Materials', appliesTo: 'material' as const, tiers: [
  { fromCostMinor: '0', toCostMinor: '5000', multiplier: '2.5' },
  { fromCostMinor: '5000', toCostMinor: '50000', multiplier: '1.8' },
  { fromCostMinor: '50000', toCostMinor: null, multiplier: '1.35' },
] }

describe('price book arithmetic', () => {
  it('picks the markup tier by unit cost with [from, to) bounds', () => {
    expect(markupFor(markup, 4999n).toString()).toBe('2.5')
    expect(markupFor(markup, 5000n).toString()).toBe('1.8')
    expect(markupFor(markup, 900000n).toString()).toBe('1.35')
    expect(() => validateMarkupTiers(markup.tiers)).not.toThrow()
    expect(() => validateMarkupTiers([{ fromCostMinor: '100', toCostMinor: null, multiplier: '2' }])).toThrow(/start at 0/)
    expect(() => validateMarkupTiers([{ fromCostMinor: '0', toCostMinor: '100', multiplier: '2' }])).toThrow(/open-ended/)
    expect(() => validateMarkupTiers([{ fromCostMinor: '0', toCostMinor: null, multiplier: '0.9' }])).toThrow(/at least 1/)
  })

  it('formula price = hours × rate + Σ material cost × qty × markup, each half-up', () => {
    const cartridge = item({ itemKey: 'MAT-CART', kind: 'material', costMinor: 1999n, laborHours: null })
    const supply = item({ itemKey: 'MAT-SUPPLY', kind: 'material', costMinor: 650n, laborHours: null })
    const task = item({ pricingMethod: 'formula', laborHours: '1.25', materials: [{ itemKey: 'MAT-CART', quantity: '1' }, { itemKey: 'MAT-SUPPLY', quantity: '2' }] })
    const price = formulaPrice(task, { laborRates: [{ businessUnitId: null, hourlyMinor: 14500n, afterHoursMultiplier: null }], markup, materials: new Map([[cartridge.itemKey, cartridge], [supply.itemKey, supply]]) })
    // 1.25 × 145.00 = 181.25; 19.99 × 2.5 = 49.975 → 49.98; 6.50 × 2 × 2.5 = 32.50
    expect(price).toMatchObject({ laborMinor: 18125n, materialsMinor: 4998n + 3250n, unitPriceMinor: 18125n + 8248n, costMinor: 1999n + 1300n })
  })

  it('submit guards: task hours, warranty on equipment, unit known, member ≤ list', () => {
    const findings = submitFindings([
      item({ laborHours: null }),
      item({ itemKey: 'EQ-WH50', kind: 'equipment', warrantyText: ' ', laborHours: null }),
      item({ itemKey: 'PL-X', uom: 'furlong', memberUnitPriceMinor: 99999n }),
      item({ itemKey: 'PL-OFF', active: false, unitPriceMinor: -1n }),
    ], new Map([['ea', { maxDecimals: 0 }]]))
    expect(findings.map(f => `${f.itemKey}:${f.code}`)).toEqual(['PL-FAUCET:task_hours_missing', 'EQ-WH50:warranty_missing', 'PL-X:member_above_list', 'PL-X:unknown_uom'])
  })

  it('diffs added, removed, repriced and otherwise-changed items; the content hash ignores row order', () => {
    const a = [item(), item({ itemKey: 'PL-DRAIN', name: 'Clear drain', unitPriceMinor: 18900n }), item({ itemKey: 'PL-OLD', name: 'Old task' })]
    const b = [item({ unitPriceMinor: 34900n }), item({ itemKey: 'PL-DRAIN', name: 'Clear drain', unitPriceMinor: 18900n, warrantyText: '30 days' }), item({ itemKey: 'PL-NEW', name: 'New task' })]
    const diff = diffItems(a, b)
    expect(diff.added.map(x => x.itemKey)).toEqual(['PL-NEW'])
    expect(diff.removed.map(x => x.itemKey)).toEqual(['PL-OLD'])
    expect(diff.repriced).toEqual([{ itemKey: 'PL-FAUCET', name: 'Replace faucet', fromMinor: '32500', toMinor: '34900', changeBps: '738' }])
    expect(diff.changed).toEqual([{ itemKey: 'PL-DRAIN', name: 'Clear drain', fields: ['warrantyText'] }])
    const empty = { categories: [], laborRates: [], markupTables: [], memberPricingRules: [] }
    expect(versionContentHash({ items: a, ...empty })).toBe(versionContentHash({ items: [...a].reverse(), ...empty }))
    expect(versionContentHash({ items: a, ...empty })).toMatch(/^[0-9a-f]{64}$/)
  })

  it('supplier costs report changes and unknown keys without touching prices', () => {
    const report = costChangeReport([item()], [{ itemKey: 'PL-FAUCET', costMinor: 5200n }, { itemKey: 'NOPE', costMinor: 1n }])
    expect(report).toEqual({ changes: [{ itemKey: 'PL-FAUCET', name: 'Replace faucet', fromMinor: '4000', toMinor: '5200', marginBpsAfter: '8400' }], unknown: ['NOPE'] })
  })
})

describe('estimate arithmetic', () => {
  it('freezes a line from the active version, member price when eligible, unit precision enforced', () => {
    const line = quoteLine('v1', { item: item(), quantity: '2', memberPricing: true }, { maxDecimals: 0 })
    expect(line).toMatchObject({ priceBookVersionId: 'v1', unitPriceMinor: '29250', listUnitPriceMinor: '32500', memberPriced: true, amountMinor: 58500n, costMinor: '8000', quantity: '2', cancellationClass: 'requested_repair' })
    expect(() => quoteLine('v1', { item: item(), quantity: '1.5', memberPricing: false }, { maxDecimals: 0 })).toThrow(/decimal places/)
    expect(() => quoteLine('v1', { item: item(), quantity: '0', memberPricing: false }, { maxDecimals: 0 })).toThrow(/more than zero/)
    expect(() => quoteLine('v1', { item: item({ active: false }), quantity: '1', memberPricing: false }, { maxDecimals: 0 })).toThrow(/not sold/)
    const ft = quoteLine('v1', { item: item({ uom: 'ft', unitPriceMinor: 1250n }), quantity: '12.5', memberPricing: false }, { maxDecimals: 2 })
    expect(ft.amountMinor).toBe(15625n)
  })

  it('an order discount is spread over lines exactly and the quote hash is stable', () => {
    const totals = optionTotals([{ amountMinor: 10001n, costMinor: 3000n }, { amountMinor: 20000n, costMinor: 5000n }, { amountMinor: 3333n, costMinor: 0n }], 1000)
    expect(totals.discountMinor).toBe(3333n)
    expect(totals.lineDiscounts.reduce((a, b) => a + b, 0n)).toBe(3333n)
    expect(totals).toMatchObject({ subtotalMinor: 33334n, totalBeforeTaxMinor: 30001n, costMinor: 8000n, marginBps: '7333' })
    expect(() => optionTotals([], 10_001)).toThrow()
    const line = quoteLine('v1', { item: item(), quantity: '1', memberPricing: false }, { maxDecimals: 0 })
    expect(quoteHash('v1', [line])).toBe(quoteHash('v1', [{ ...line }]))
    expect(quoteHash('v1', [line], 500)).not.toBe(quoteHash('v1', [line]))
  })

  it('deposit cap is the lower of the configured percentage and amount; none configured means no cap', () => {
    expect(depositCap(1_000_000n, { depositCapPct: '33.3333', depositCapMinor: '100000' })).toBe(100000n)
    expect(depositCap(100_001n, { depositCapPct: '33.3333', depositCapMinor: null })).toBe(33333n)
    expect(depositCap(100_000n, { depositCapPct: null, depositCapMinor: null })).toBeNull()
  })
})
