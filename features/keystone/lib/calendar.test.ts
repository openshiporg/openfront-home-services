import { describe, expect, it } from 'vitest'
import { addBusinessDays, businessDaysBetween, cancelByDeadline, composeCalendars, isBusinessDay, localDate, nextBusinessDay, US_FEDERAL, zonedInstant } from './calendar'

describe('federal business-day calendar (16 CFR 429.0(f))', () => {
  it('counts Saturdays and skips Sundays and federal holidays', () => {
    expect(isBusinessDay(US_FEDERAL, '2026-11-07')).toBe(true) // Saturday
    expect(isBusinessDay(US_FEDERAL, '2026-11-08')).toBe(false) // Sunday
    expect(isBusinessDay(US_FEDERAL, '2026-11-11')).toBe(false) // Veterans Day
    expect(isBusinessDay(US_FEDERAL, '2026-11-26')).toBe(false) // Thanksgiving
    expect(isBusinessDay(US_FEDERAL, '2026-06-19')).toBe(false) // Juneteenth
    expect(isBusinessDay(US_FEDERAL, '2026-07-03')).toBe(false) // Independence Day observed
  })
  it('adds business days', () => {
    // Friday Nov 6 → Sat 7 (1), Mon 9 (2), Tue 10 (3).
    expect(addBusinessDays(US_FEDERAL, '2026-11-06', 3)).toBe('2026-11-10')
    // Monday Nov 9 → Tue 10, (Wed 11 holiday), Thu 12, Fri 13.
    expect(addBusinessDays(US_FEDERAL, '2026-11-09', 3)).toBe('2026-11-13')
    expect(nextBusinessDay(US_FEDERAL, '2026-12-24')).toBe('2026-12-26')
    expect(businessDaysBetween(US_FEDERAL, '2026-11-06', '2026-11-13')).toBe(5)
  })
  it('fails closed past its verified coverage', () => {
    expect(() => isBusinessDay(US_FEDERAL, '2029-01-02')).toThrow(/no verified schedule/)
    expect(() => isBusinessDay(US_FEDERAL, '2026-02-30')).toThrow(/Invalid date/)
  })
  it('computes the cancel-by deadline in the buyer zone', () => {
    // Signed 11:30 p.m. Friday in Austin (05:30Z Saturday): the transaction date is still Friday.
    const at = new Date('2026-11-07T05:30:00Z')
    expect(localDate({ timeZone: 'America/Chicago' }, at)).toBe('2026-11-06')
    const r = cancelByDeadline(US_FEDERAL, at, 'America/Chicago', 3)
    expect(r).toMatchObject({ transactionDate: '2026-11-06', lastDay: '2026-11-10' })
    expect(r.deadline.toISOString()).toBe('2026-11-11T06:00:00.000Z') // midnight CST
  })
  it('converts local wall time across DST', () => {
    expect(zonedInstant('America/Chicago', '2026-03-09', '08:00').toISOString()).toBe('2026-03-09T13:00:00.000Z') // CDT
    expect(zonedInstant('America/Chicago', '2026-11-02', '08:00').toISOString()).toBe('2026-11-02T14:00:00.000Z') // CST
  })
  it('composes a company calendar that is closed when any part is closed', () => {
    const company = composeCalendars('SUMMIT-HOURS', 'America/Chicago', [US_FEDERAL], { weekendDays: [6], holidays: ['2026-12-24'] })
    expect(isBusinessDay(company, '2026-11-07')).toBe(false)
    expect(isBusinessDay(company, '2026-12-24')).toBe(false)
    expect(isBusinessDay(company, '2026-11-26')).toBe(false)
    expect(isBusinessDay(company, '2026-11-09')).toBe(true)
  })
})
