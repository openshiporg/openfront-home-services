import { createHash } from 'node:crypto'
import { DomainError, Codes } from '../lib/errors'

/*
 * Contact values (SCHEMA G11). Phones are stored as E.164 and emails lowercased, each with a sha256
 * companion used for dedupe and the do-not-contact list. Agents and logs only ever see masks.
 */

/** North American numbers to E.164. Accepts +1, 1-prefixed and bare 10-digit forms; anything else fails. */
export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim()
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/[\s().-]/g, '')
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new DomainError(Codes.INVALID_INPUT, 'That phone number is not valid.', { field: 'phone' })
    return `+${digits}`
  }
  const digits = raw.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  // NANP: area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new DomainError(Codes.INVALID_INPUT, 'That phone number is not valid.', { field: 'phone' })
  return `+1${national}`
}

export function normalizeEmail(input: string): string {
  const value = String(input ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 254) throw new DomainError(Codes.INVALID_INPUT, 'That email address is not valid.', { field: 'email' })
  return value
}

export const contactHash = (normalized: string) => createHash('sha256').update(`contact:${normalized}`).digest('hex')

/** "+15125550123" → "(•••) •••-0123". */
export function maskPhone(e164: string | null | undefined) {
  if (!e164) return ''
  return `(•••) •••-${e164.slice(-4)}`
}

/** "dana@example.com" → "d•••@example.com". */
export function maskEmail(email: string | null | undefined) {
  if (!email) return ''
  const [user, domain] = email.split('@')
  return `${user.slice(0, 1)}•••@${domain ?? ''}`
}

/** "4100 Industrial Blvd" → "4100 I•••": enough for a caller to confirm, not enough to find the house. */
export function maskAddress(line1: string | null | undefined) {
  if (!line1) return ''
  const [number, ...rest] = line1.trim().split(/\s+/)
  const street = rest.join(' ')
  return street ? `${number} ${street.slice(0, 1)}•••` : `${number.slice(0, 1)}•••`
}

/** First name and last initial only. */
export function maskName(first: string | null | undefined, last: string | null | undefined) {
  return [first?.trim(), last?.trim() ? `${last.trim()[0]}.` : ''].filter(Boolean).join(' ')
}
