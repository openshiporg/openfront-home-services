import { dec, Decimal, type DecimalInput, type Rounding } from './decimal'

/**
 * Money is integer minor units (bigint) plus an ISO-4217 code (SCHEMA G2). Conversions between a
 * decimal amount and minor units happen only here. Customer-facing line arithmetic rounds half-up
 * (DOMAIN §4.2); `toMinor` takes the rounding mode explicitly and defaults to half-up.
 */

const MINOR_DIGITS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, CHF: 2, CAD: 2, AUD: 2, SEK: 2, JPY: 0, KRW: 0, BHD: 3, KWD: 3 }

export const isCurrencyCode = (code: unknown): code is string => typeof code === 'string' && /^[A-Z]{3}$/.test(code)

export function minorDigits(currencyCode: string): number {
  if (!isCurrencyCode(currencyCode)) throw new Error(`Invalid currency code: ${String(currencyCode).slice(0, 8)}`)
  return MINOR_DIGITS[currencyCode] ?? 2
}

/** A decimal amount (e.g. "1234.565") to minor units, half-up by default: 123457n for USD. */
export function toMinor(amount: DecimalInput, currencyCode = 'USD', rounding: Rounding = Decimal.ROUND_HALF_UP): bigint {
  const digits = minorDigits(currencyCode)
  const scaled = dec(amount).times(new Decimal(10).pow(digits)).toDecimalPlaces(0, rounding)
  return BigInt(scaled.toFixed(0))
}

/** Minor units to an exact decimal amount. */
export function fromMinor(minor: bigint, currencyCode = 'USD'): Decimal {
  return dec(minor).div(new Decimal(10).pow(minorDigits(currencyCode)))
}

/** "1,234.56" style text with an explicit currency, for screens and statements. */
export function formatMinor(minor: bigint, currencyCode = 'USD'): string {
  const digits = minorDigits(currencyCode)
  const negative = minor < 0n
  const abs = negative ? -minor : minor
  const base = 10n ** BigInt(digits)
  const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = digits ? '.' + (abs % base).toString().padStart(digits, '0') : ''
  const symbol = currencyCode === 'USD' ? '$' : `${currencyCode} `
  return `${negative ? '−' : ''}${symbol}${whole}${fraction}`
}

/** Parse a stored bigint column (Prisma returns bigint; GraphQL returns string). */
export function minorOf(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim())
  throw new Error('Not an integer minor-unit amount')
}

export const sumMinor = (values: bigint[]) => values.reduce((a, b) => a + b, 0n)

/**
 * Split `total` minor units across weights with the largest-remainder method: every share is the
 * floor of its exact pro-rata amount, and the leftover units go one each to the largest
 * remainders (ties: the earlier index). The shares always sum exactly to `total`.
 */
export function allocateMinor(total: bigint, weights: DecimalInput[]): bigint[] {
  if (weights.length === 0) throw new Error('allocateMinor needs at least one weight')
  const w = weights.map(dec)
  if (w.some(x => x.isNegative())) throw new Error('allocateMinor weights must be non-negative')
  const weightSum = w.reduce((a, b) => a.plus(b), new Decimal(0))
  if (weightSum.isZero()) throw new Error('allocateMinor weights must not all be zero')
  const negative = total < 0n
  const abs = negative ? -total : total
  const exact = w.map(x => dec(abs).times(x).div(weightSum))
  const floors = exact.map(x => BigInt(x.floor().toFixed(0)))
  let leftover = abs - floors.reduce((a, b) => a + b, 0n)
  const order = exact.map((x, index) => ({ index, remainder: x.minus(x.floor()) }))
    .sort((a, b) => (b.remainder.comparedTo(a.remainder) || a.index - b.index))
  const shares = [...floors]
  for (let i = 0; leftover > 0n; i = (i + 1) % order.length, leftover -= 1n) shares[order[i].index] += 1n
  return negative ? shares.map(x => -x) : shares
}

/**
 * Parse a customer- or staff-entered money string ("1234.5", "1,234.50") to minor units. Excess
 * precision is rejected, never rounded silently (DOMAIN §4.4).
 */
export function parseMoney(input: string, currencyCode = 'USD'): bigint {
  const digits = minorDigits(currencyCode)
  const clean = String(input).trim().replace(/,/g, '').replace(/^\$/, '')
  const pattern = digits ? new RegExp(`^-?\\d+(\\.\\d{1,${digits}})?$`) : /^-?\d+$/
  if (!pattern.test(clean)) throw new Error(`Not a ${currencyCode} amount with at most ${digits} decimal places`)
  return toMinor(clean, currencyCode)
}

/** Line extension: round_half_up(unitPriceMinor × quantity) (DOMAIN §4.2). */
export function extendLine(unitPriceMinor: bigint, quantity: DecimalInput): bigint {
  const q = dec(quantity)
  if (q.isNegative()) throw new Error('Quantity must not be negative')
  return BigInt(dec(unitPriceMinor).times(q).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0))
}

/** A percentage of an amount, half-up per line (discounts, commission). `percent` is e.g. "12.5". */
export function percentOf(amountMinor: bigint, percent: DecimalInput): bigint {
  const p = dec(percent)
  if (p.isNegative() || p.greaterThan(100)) throw new Error('Percent must be between 0 and 100')
  return BigInt(dec(amountMinor).times(p).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0))
}

const QTY_SCALE = 10_000n
const halfUpDiv = (numerator: bigint, denominator: bigint) => (numerator + denominator / 2n) / denominator

/**
 * A directly entered line total → an integer minor-unit unit price whose half-up extension gives
 * back exactly that total (ported from Openfront Construction). Totals that cannot be represented
 * at that quantity are rejected rather than silently changed.
 */
export function priceLineFromTotal(totalMinor: bigint, quantity: DecimalInput = '1') {
  if (totalMinor < 0n) throw new Error('Line total must not be negative')
  const q = dec(quantity)
  if (!q.isPositive() || q.decimalPlaces() > 4) throw new Error('Quantity must be positive with at most 4 decimal places')
  const units = BigInt(q.times(QTY_SCALE).toFixed(0))
  const unitPriceMinor = halfUpDiv(totalMinor * QTY_SCALE, units)
  if (halfUpDiv(unitPriceMinor * units, QTY_SCALE) !== totalMinor) {
    throw new Error('This line total cannot be represented by a whole-cent unit price at this quantity; adjust the quantity or enter a quantity-one lump sum')
  }
  return { quantity: q.toFixed(), unitPriceMinor, amountMinor: totalMinor }
}

/** An exact decimal amount of minor units → whole minor units (half-up unless told otherwise). */
export function roundMinor(value: DecimalInput, rounding: Rounding = Decimal.ROUND_HALF_UP): bigint {
  return BigInt(dec(value).toDecimalPlaces(0, rounding).toFixed(0))
}

/** numerator / denominator in basis points, half-up, as a signed integer string; null when the denominator is 0. */
export function ratioBps(numerator: bigint, denominator: bigint): string | null {
  if (denominator === 0n) return null
  return dec(numerator).times(10_000).div(dec(denominator)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0)
}

/** amount × bps / 10 000, half-up to whole minor units. */
export function bpsOf(amountMinor: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('Basis points must be a whole number from 0 to 10000')
  return roundMinor(dec(amountMinor).times(bps).div(10_000))
}
