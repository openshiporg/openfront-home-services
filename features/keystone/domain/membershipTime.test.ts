import { describe, expect, it } from 'vitest'
import { addMonthsClamped, dayAt, isLeapYear, prorate, slotCount, slotDueDay, termDaysLeft, termEnd, termNumberOn, termStart, windowEndsAt, windowFor, windowState } from './membershipTime'

/*
 * Phase 4 exit gate: season expiry and rollover are right across DST and leap years, against a golden table.
 * Every row is worked out by hand from the calendar, not by the code under test.
 */

describe('leap years', () => {
  it.each([[2024, true], [2025, false], [2028, true], [2100, false], [2000, true], [1900, false]])('%i leap=%s', (y, leap) => expect(isLeapYear(y)).toBe(leap))
})

describe('terms chain from the first day and clamp to short months (golden)', () => {
  const rows: [string, number, number, string, string][] = [
    // anchor, termMonths, n, start, end
    ['2026-03-15', 12, 1, '2026-03-15', '2027-03-14'],
    ['2026-03-15', 12, 2, '2027-03-15', '2028-03-14'],
    ['2026-03-15', 12, 3, '2028-03-15', '2029-03-14'],
    ['2024-02-29', 12, 1, '2024-02-29', '2025-02-27'],
    ['2024-02-29', 12, 2, '2025-02-28', '2026-02-27'],
    ['2024-02-29', 12, 5, '2028-02-29', '2029-02-27'],
    ['2026-01-31', 1, 2, '2026-02-28', '2026-03-30'],
    ['2026-01-31', 1, 3, '2026-03-31', '2026-04-29'],
    ['2028-01-31', 1, 2, '2028-02-29', '2028-03-30'],
    ['2026-11-11', 24, 2, '2028-11-11', '2030-11-10'],
    ['2026-12-31', 12, 2, '2027-12-31', '2028-12-30'],
  ]
  it.each(rows)('%s / %i months / term %i', (anchor, months, n, start, end) => {
    expect(termStart(anchor, months, n)).toBe(start)
    expect(termEnd(anchor, months, n)).toBe(end)
  })
  it('terms are back to back with no gap and no overlap, over a leap day', () => {
    for (let n = 1; n < 30; n += 1) {
      const end = termEnd('2024-02-29', 12, n)
      const next = termStart('2024-02-29', 12, n + 1)
      expect(Date.parse(`${next}T00:00:00Z`) - Date.parse(`${end}T00:00:00Z`)).toBe(86_400_000)
    }
  })
  it('a day belongs to exactly one term', () => {
    expect(termNumberOn('2026-03-15', 12, '2026-03-14')).toBe(0)
    expect(termNumberOn('2026-03-15', 12, '2026-03-15')).toBe(1)
    expect(termNumberOn('2026-03-15', 12, '2027-03-14')).toBe(1)
    expect(termNumberOn('2026-03-15', 12, '2027-03-15')).toBe(2)
    expect(termNumberOn('2024-02-29', 12, '2025-02-28')).toBe(2)
    expect(termNumberOn('2024-02-29', 12, '2025-02-27')).toBe(1)
  })
  it('monthly slots fall on the anchor day, clamped, never drifting', () => {
    expect(Array.from({ length: 12 }, (_, k) => slotDueDay('2026-01-31', 12, 1, k))).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31',
    ])
    expect(slotDueDay('2026-01-31', 12, 2, 1)).toBe('2027-02-28')
    expect(slotDueDay('2027-01-31', 12, 2, 1)).toBe('2028-02-29')
    expect(slotCount('monthly', 12)).toBe(12)
    expect(slotCount('annual', 12)).toBe(1)
  })
  it('adds months across year ends and negative months', () => {
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonthsClamped('2026-11-30', 15)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-01-15', 0)).toBe('2026-01-15')
  })
})

describe('season windows (golden)', () => {
  const rows: [string, string, [string, string] | null, string, string][] = [
    // term start, term end, season MM-DD..MM-DD, window start, window end
    ['2026-03-15', '2027-03-14', null, '2026-03-15', '2027-03-14'],
    ['2026-03-15', '2027-03-14', ['04-01', '05-31'], '2026-04-01', '2026-05-31'],
    ['2026-03-15', '2027-03-14', ['03-01', '04-15'], '2026-03-15', '2026-04-15'],
    ['2026-07-01', '2027-06-30', ['03-01', '04-30'], '2027-03-01', '2027-04-30'],
    // a season that crosses New Year: heating check, Oct 1 to Feb 28
    ['2026-03-15', '2027-03-14', ['10-01', '02-28'], '2026-10-01', '2027-02-28'],
    ['2026-12-01', '2027-11-30', ['10-01', '02-28'], '2026-12-01', '2027-02-28'],
    // leap day: Feb 29 as an end in a non-leap year is Feb 28, in a leap year it is Feb 29
    ['2027-01-01', '2027-12-31', ['01-15', '02-29'], '2027-01-15', '2027-02-28'],
    ['2028-01-01', '2028-12-31', ['01-15', '02-29'], '2028-01-15', '2028-02-29'],
    ['2023-06-01', '2024-05-31', ['02-01', '02-29'], '2024-02-01', '2024-02-29'],
    // season ends after the term: cut to the term
    ['2026-03-15', '2027-03-14', ['03-01', '06-30'], '2026-03-15', '2026-06-30'],
    ['2026-03-15', '2026-09-14', ['08-01', '10-31'], '2026-08-01', '2026-09-14'],
    // a late joiner: Dec 14 on an Oct 1 to Dec 15 heating season gets next fall (in the term), not two days (review r1)
    ['2026-12-14', '2027-12-13', ['10-01', '12-15'], '2027-10-01', '2027-12-13'],
    ['2026-12-15', '2027-12-14', ['10-01', '12-15'], '2027-10-01', '2027-12-14'],
    ['2026-10-01', '2027-09-30', ['10-01', '12-15'], '2026-10-01', '2026-12-15'],
  ]
  it.each(rows)('term %s..%s season %j', (start, end, season, from, to) => {
    const w = windowFor(start, end, season ? { startMonthDay: season[0], endMonthDay: season[1] } : null)
    expect(w).toEqual({ startDay: from, endDay: to })
  })
  it('window states by local day', () => {
    const w = { startDay: '2026-04-01', endDay: '2026-05-31' }
    expect(windowState('2026-03-31', w)).toBe('upcoming')
    expect(windowState('2026-04-01', w)).toBe('open')
    expect(windowState('2026-05-31', w)).toBe('open')
    expect(windowState('2026-06-01', w)).toBe('expired')
  })
})

describe('a window ends at the next local midnight, across daylight saving time', () => {
  it('spring forward (2026-03-08, Chicago): the last day is 23 hours long', () => {
    // Midnight after Mar 8 is Mar 9 00:00 CDT = 05:00Z.
    expect(windowEndsAt('America/Chicago', '2026-03-08').toISOString()).toBe('2026-03-09T05:00:00.000Z')
    expect(windowEndsAt('America/Chicago', '2026-03-07').toISOString()).toBe('2026-03-08T06:00:00.000Z')
  })
  it('fall back (2026-11-01, Chicago): the last day is 25 hours long', () => {
    expect(windowEndsAt('America/Chicago', '2026-11-01').toISOString()).toBe('2026-11-02T06:00:00.000Z')
    expect(windowEndsAt('America/Chicago', '2026-10-31').toISOString()).toBe('2026-11-01T05:00:00.000Z')
  })
  it('a place without daylight saving never shifts (Phoenix)', () => {
    expect(windowEndsAt('America/Phoenix', '2026-03-08').toISOString()).toBe('2026-03-09T07:00:00.000Z')
    expect(windowEndsAt('America/Phoenix', '2026-11-01').toISOString()).toBe('2026-11-02T07:00:00.000Z')
  })
  it('the local day is decided in the location zone, not UTC', () => {
    // 2026-11-02 03:30Z is still Nov 1, 21:30 in Chicago (CST): the window of Nov 1 is open.
    expect(dayAt('America/Chicago', new Date('2026-11-02T03:30:00Z'))).toBe('2026-11-01')
    expect(dayAt('America/Chicago', new Date('2026-11-02T06:00:00Z'))).toBe('2026-11-02')
    // Spring forward: 2026-03-09 04:59Z is still Mar 8 at 23:59 CDT.
    expect(dayAt('America/Chicago', new Date('2026-03-09T04:59:59Z'))).toBe('2026-03-08')
    expect(dayAt('America/Chicago', new Date('2026-03-09T05:00:00Z'))).toBe('2026-03-09')
    // New Zealand is a day ahead of UTC.
    expect(dayAt('Pacific/Auckland', new Date('2026-12-31T12:00:00Z'))).toBe('2027-01-01')
  })
})

describe('pro-rata cancellation', () => {
  it('counts whole days left, inclusive of the cancel day', () => {
    expect(termDaysLeft('2026-01-01', '2026-12-31', '2026-01-01')).toEqual({ left: 365, total: 365 })
    expect(termDaysLeft('2026-01-01', '2026-12-31', '2026-07-01')).toEqual({ left: 184, total: 365 })
    expect(termDaysLeft('2026-01-01', '2026-12-31', '2026-12-31')).toEqual({ left: 1, total: 365 })
    expect(termDaysLeft('2026-01-01', '2026-12-31', '2027-01-01')).toEqual({ left: 0, total: 365 })
    expect(termDaysLeft('2026-01-01', '2026-12-31', '2025-12-01')).toEqual({ left: 365, total: 365 })
  })
  it('a term over a leap day is 366 days long', () => {
    expect(termDaysLeft('2027-03-15', '2028-03-14', '2027-03-15').total).toBe(366)
  })
  it('floors to the cent and never refunds more than was paid', () => {
    expect(prorate(19900n, 184, 365)).toBe(10031n)
    expect(prorate(19900n, 365, 365)).toBe(19900n)
    expect(prorate(19900n, 0, 365)).toBe(0n)
    expect(prorate(1n, 1, 3)).toBe(0n)
    expect(prorate(100n, 1, 0)).toBe(0n)
    for (let left = 0; left <= 366; left += 1) expect(prorate(12345n, left, 366) <= 12345n).toBe(true)
  })
})
