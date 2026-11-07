import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { applyBps, dec, toScale } from './decimal'
import { allocateMinor, extendLine, formatMinor, fromMinor, minorOf, parseMoney, percentOf, priceLineFromTotal, toMinor } from './money'

describe('decimal', () => {
  it('is exact where binary floats are not', () => {
    expect(dec('0.1').plus('0.2').toFixed()).toBe('0.3')
    expect(dec('1234567890.1234567891').times('3').toFixed()).toBe('3703703670.3703703673')
  })
  it('refuses fractional JS numbers and malformed text', () => {
    expect(() => dec(0.1)).toThrow(/Refusing float/)
    expect(() => dec('12abc')).toThrow(/Not a decimal/)
    expect(() => dec('NaN')).toThrow(/Not a decimal/)
    expect(dec(42).toFixed()).toBe('42')
  })
  it('rounds half-up to column scale (DOMAIN §4.2)', () => {
    expect(toScale('2.5', 0)).toBe('3')
    expect(toScale('3.5', 0)).toBe('4')
    expect(toScale('1.00005', 'qty')).toBe('1.0001')
    expect(toScale('0.0825004', 'rate')).toBe('0.082500')
    expect(toScale('30.2672185', 'geo')).toBe('30.267219')
  })
  it('applies basis points exactly', () => {
    expect(applyBps('187.40', 5).toFixed()).toBe('0.0937')
  })
})

describe('money', () => {
  it('converts to and from minor units half-up', () => {
    expect(toMinor('1234.565')).toBe(123457n)
    expect(toMinor('1234.575')).toBe(123458n)
    expect(toMinor('1234.564')).toBe(123456n)
    expect(toMinor('1000', 'JPY')).toBe(1000n)
    expect(fromMinor(123456n).toFixed()).toBe('1234.56')
    expect(formatMinor(-123456789n)).toBe('−$1,234,567.89')
    expect(minorOf('42')).toBe(42n)
    expect(() => minorOf('4.2')).toThrow()
    expect(() => toMinor('1', 'usd')).toThrow(/currency/)
  })

  it('parses entered amounts and refuses excess precision', () => {
    expect(parseMoney('1,234.5')).toBe(123450n)
    expect(parseMoney('$89')).toBe(8900n)
    expect(() => parseMoney('1.005')).toThrow(/at most 2/)
    expect(() => parseMoney('12abc')).toThrow()
  })

  it('extends lines and takes percentages half-up', () => {
    expect(extendLine(1999n, '3')).toBe(5997n)
    expect(extendLine(1999n, '1.5')).toBe(2999n) // 2998.5 → 2999
    expect(extendLine(125n, '0.25')).toBe(31n) // 31.25 → 31
    expect(percentOf(12345n, '10')).toBe(1235n) // 1234.5 → 1235
    expect(() => extendLine(100n, '-1')).toThrow()
    expect(() => percentOf(100n, '101')).toThrow()
  })

  it('prices a directly entered total without changing it', () => {
    expect(priceLineFromTotal(9999n, '3')).toEqual({ quantity: '3', unitPriceMinor: 3333n, amountMinor: 9999n })
    expect(priceLineFromTotal(5000n, '2.5')).toEqual({ quantity: '2.5', unitPriceMinor: 2000n, amountMinor: 5000n })
    expect(() => priceLineFromTotal(10000n, '3')).toThrow(/cannot be represented/)
    fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.integer({ min: 1, max: 200 }), (unit, q) => {
      const total = extendLine(unit, q)
      const priced = priceLineFromTotal(total, String(q))
      expect(extendLine(priced.unitPriceMinor, q)).toBe(total)
    }), { numRuns: 300 })
  })

  it('allocates with the largest remainder', () => {
    expect(allocateMinor(100n, ['1', '1', '1'])).toEqual([34n, 33n, 33n])
    expect(allocateMinor(-100n, ['1', '1', '1'])).toEqual([-34n, -33n, -33n])
    expect(allocateMinor(10n, ['0.5', '0.25', '0.25'])).toEqual([5n, 3n, 2n])
    expect(() => allocateMinor(10n, ['0'])).toThrow()
  })

  it('always allocates exactly the total, each share within one unit of pro rata', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }),
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 40 }).filter(ws => ws.some(w => w > 0)),
        (total, weights) => {
          const shares = allocateMinor(total, weights)
          expect(shares.reduce((a, b) => a + b, 0n)).toBe(total)
          const weightSum = weights.reduce((a, b) => a + b, 0)
          shares.forEach((share, i) => {
            const exact = dec(total).times(weights[i]).div(weightSum)
            expect(dec(share).minus(exact).abs().lt(1)).toBe(true)
          })
        }
      ),
      { numRuns: 300 }
    )
  })
})
