/**
 * Business-day calendars (SCHEMA §17, DOMAIN §6). Dates are "YYYY-MM-DD" strings in the calendar's
 * own time zone; a date never implies a time. Unknown years fail closed: a calendar only answers
 * inside its verified coverage, so no legal deadline is ever computed on a guess.
 *
 * The federal business-day calendar is the one the FTC Cooling-Off Rule and Texas Bus. & Com. Code
 * ch. 601 count in: "any calendar day except Sunday or any federal holiday" (16 CFR 429.0(f),
 * checked on eCFR 2026-11-07). Federal holidays are the eleven in 5 U.S.C. 6103(a), Juneteenth
 * included. Where a holiday falls on a Saturday or Sunday, both the actual date and the observed
 * weekday (5 U.S.C. 6103(b); EO 11582) are treated as holidays. That can only lengthen a buyer's
 * cancellation window, never shorten it. The seeded BusinessCalendar rows are the source of truth.
 */

export type CalendarSpec = {
  code: string
  timeZone: string
  /** Non-business weekdays, 0 = Sunday. */
  weekendDays: readonly number[]
  holidays: ReadonlySet<string>
  coverageThrough: string
}

export type HolidaySeed = { date: string; name: string; observed?: boolean }

export const FEDERAL_HOLIDAYS: HolidaySeed[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-19', name: 'Birthday of Martin Luther King, Jr.' },
  { date: '2026-02-16', name: "Washington's Birthday" },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-06-19', name: 'Juneteenth National Independence Day' },
  { date: '2026-07-03', name: 'Independence Day', observed: true },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-10-12', name: 'Columbus Day' },
  { date: '2026-11-11', name: 'Veterans Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-01-18', name: 'Birthday of Martin Luther King, Jr.' },
  { date: '2027-02-15', name: "Washington's Birthday" },
  { date: '2027-05-31', name: 'Memorial Day' },
  { date: '2027-06-18', name: 'Juneteenth National Independence Day', observed: true },
  { date: '2027-06-19', name: 'Juneteenth National Independence Day' },
  { date: '2027-07-04', name: 'Independence Day' },
  { date: '2027-07-05', name: 'Independence Day', observed: true },
  { date: '2027-09-06', name: 'Labor Day' },
  { date: '2027-10-11', name: 'Columbus Day' },
  { date: '2027-11-11', name: 'Veterans Day' },
  { date: '2027-11-25', name: 'Thanksgiving Day' },
  { date: '2027-12-24', name: 'Christmas Day', observed: true },
  { date: '2027-12-25', name: 'Christmas Day' },
  { date: '2027-12-31', name: "New Year's Day", observed: true },
  { date: '2028-01-01', name: "New Year's Day" },
  { date: '2028-01-17', name: 'Birthday of Martin Luther King, Jr.' },
  { date: '2028-02-21', name: "Washington's Birthday" },
  { date: '2028-05-29', name: 'Memorial Day' },
  { date: '2028-06-19', name: 'Juneteenth National Independence Day' },
  { date: '2028-07-04', name: 'Independence Day' },
  { date: '2028-09-04', name: 'Labor Day' },
  { date: '2028-10-09', name: 'Columbus Day' },
  { date: '2028-11-10', name: 'Veterans Day', observed: true },
  { date: '2028-11-11', name: 'Veterans Day' },
  { date: '2028-11-23', name: 'Thanksgiving Day' },
  { date: '2028-12-25', name: 'Christmas Day' },
]

export const FEDERAL_SOURCE = '16 CFR 429.0(f) business day (eCFR, checked 2026-11-07); holidays per 5 U.S.C. 6103(a)-(b), 2026-2028, actual and observed dates'

/** Legal business days: Sundays and federal holidays are not business days; Saturdays are. */
export const US_FEDERAL: CalendarSpec = {
  code: 'US-FEDERAL',
  timeZone: 'America/New_York',
  weekendDays: [0],
  holidays: new Set(FEDERAL_HOLIDAYS.map(h => h.date)),
  coverageThrough: '2028-12-31',
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function assertDate(date: string) {
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`Invalid date ${date}`)
}

export function addDays(date: string, days: number) {
  assertDate(date)
  const t = Date.parse(`${date}T12:00:00Z`) + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

/** The same calendar evaluated in another zone (a legal calendar is counted in the buyer's zone). */
export const inZone = (calendar: CalendarSpec, timeZone: string): CalendarSpec => ({ ...calendar, timeZone })

/** A calendar that is closed whenever any part is closed (a company calendar plus the federal holidays). */
export function composeCalendars(code: string, timeZone: string, parts: CalendarSpec[], extra: { weekendDays?: number[]; holidays?: string[] } = {}): CalendarSpec {
  if (!parts.length) throw new Error('composeCalendars needs at least one calendar')
  return {
    code,
    timeZone,
    weekendDays: [...new Set([...(extra.weekendDays ?? []), ...parts.flatMap(p => p.weekendDays)])].sort(),
    holidays: new Set([...(extra.holidays ?? []), ...parts.flatMap(p => [...p.holidays])]),
    coverageThrough: parts.map(p => p.coverageThrough).sort()[0],
  }
}

function covered(calendar: CalendarSpec, date: string) {
  if (date > calendar.coverageThrough) throw new Error(`${calendar.code} has no verified schedule for ${date}`)
}

export function isBusinessDay(calendar: CalendarSpec, date: string) {
  assertDate(date)
  covered(calendar, date)
  return !calendar.weekendDays.includes(weekday(date)) && !calendar.holidays.has(date)
}

export function nextBusinessDay(calendar: CalendarSpec, date: string) {
  let d = addDays(date, 1)
  while (!isBusinessDay(calendar, d)) d = addDays(d, 1)
  return d
}

export function previousBusinessDay(calendar: CalendarSpec, date: string) {
  let d = addDays(date, -1)
  while (!isBusinessDay(calendar, d)) d = addDays(d, -1)
  return d
}

/** The nth business day after `date` (n = 3 → the third business day after the transaction date). */
export function addBusinessDays(calendar: CalendarSpec, date: string, n: number) {
  if (!Number.isSafeInteger(n)) throw new Error('Business-day count must be a whole number')
  let d = date
  for (let i = 0; i < Math.abs(n); i += 1) d = n > 0 ? nextBusinessDay(calendar, d) : previousBusinessDay(calendar, d)
  return d
}

/** Business days in (from, to]. */
export function businessDaysBetween(calendar: CalendarSpec, from: string, to: string) {
  let count = 0
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isBusinessDay(calendar, d)) count += 1
  return count
}

const zoneParts = (timeZone: string, at: number) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at)).map(p => [p.type, p.value]))

/** The local date of an instant in a zone (the customer's day, never the server's midnight). */
export function localDate(calendar: Pick<CalendarSpec, 'timeZone'>, at: Date | number) {
  const p = zoneParts(calendar.timeZone, typeof at === 'number' ? at : at.getTime())
  return `${p.year}-${p.month}-${p.day}`
}

/** Local wall-clock "HH:mm" of an instant in a zone. */
export function localTime(timeZone: string, at: Date | number) {
  const p = zoneParts(timeZone, typeof at === 'number' ? at : at.getTime())
  return `${p.hour}:${p.minute}`
}

/** The UTC instant of a local wall-clock time on a date in a zone (DST-safe). */
export function zonedInstant(timeZone: string, date: string, hhmm: string) {
  assertDate(date)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) throw new Error(`Invalid time ${hhmm}`)
  const [h, m] = hhmm.split(':').map(x => Number.parseInt(x, 10))
  let guess = Date.parse(`${date}T${hhmm}:00Z`)
  for (let i = 0; i < 3; i += 1) {
    const p = zoneParts(timeZone, guess)
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    const target = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m)
    const diff = target - local
    if (diff === 0) break
    guess += diff
  }
  return new Date(guess)
}

/**
 * "Until midnight of the nth business day after the transaction" (16 CFR 429.1(a); Tex. Bus. &
 * Com. Code §601.051), counted on `calendar` in the buyer's zone. Returns the last day and the
 * exclusive deadline instant: the following local midnight.
 */
export function cancelByDeadline(calendar: CalendarSpec, transactionAt: Date | number, timeZone: string, businessDays: number) {
  const cal = inZone(calendar, timeZone)
  const transactionDate = localDate(cal, transactionAt)
  const lastDay = addBusinessDays(cal, transactionDate, businessDays)
  return { transactionDate, lastDay, deadline: zonedInstant(timeZone, addDays(lastDay, 1), '00:00') }
}
