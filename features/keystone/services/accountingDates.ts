import { assertDate } from '../lib/calendar'
import { Codes, DomainError } from '../lib/errors'

export function assertDateRange(from: string, to: string) {
  try { assertDate(from); assertDate(to) } catch { throw new DomainError(Codes.INVALID_INPUT, 'Dates are YYYY-MM-DD.', { field: 'from' }) }
  if (to < from) throw new DomainError(Codes.INVALID_INPUT, 'The end date is on or after the start date.', { field: 'to' })
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 400 * 86_400_000) throw new DomainError(Codes.INVALID_INPUT, 'Export at most 400 days at a time.', { field: 'to' })
}
