import { addDays, assertDate, localDate, zonedInstant } from '../lib/calendar'

/*
 * Membership time, all on calendar days in the location's zone (never server midnight, never 24-hour
 * multiples). Terms chain from the first start day: term n starts `termMonths * (n - 1)` months after it,
 * clamped to the end of a short month (Jan 31 + 1 month = Feb 28/29), and ends the day before term n+1 starts.
 * Nothing here runs on a timer: every caller computes the answer for the day it is asked.
 */

const pad = (n: number) => String(n).padStart(2, '0')
const parts = (date: string) => { assertDate(date); return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) } }
export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
export const daysInMonth = (y: number, m: number) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]

/** `date` plus whole months, clamped to the last day of a shorter month. */
export function addMonthsClamped(date: string, months: number) {
  const { y, m, d } = parts(date)
  const index = y * 12 + (m - 1) + months
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`
}

export const termStart = (anchor: string, termMonths: number, n: number) => addMonthsClamped(anchor, termMonths * (n - 1))
/** The last day of term n (inclusive). */
export const termEnd = (anchor: string, termMonths: number, n: number) => addDays(termStart(anchor, termMonths, n + 1), -1)
/** The day billing slot k (0-based) of term n falls due. */
export const slotDueDay = (anchor: string, termMonths: number, n: number, k: number) => addMonthsClamped(anchor, termMonths * (n - 1) + k)
export const periodOf = (day: string) => day.slice(0, 7)

/** Which term (1-based) a day falls in. */
export function termNumberOn(anchor: string, termMonths: number, day: string) {
  if (day < anchor) return 0
  let n = 1
  while (termEnd(anchor, termMonths, n) < day) n += 1
  return n
}

export function slotCount(billingFrequency: string, termMonths: number) {
  return billingFrequency === 'monthly' ? termMonths : 1
}

export type Season = { startMonthDay: string; endMonthDay: string } | null

const monthDay = (md: string, year: number) => {
  const m = Number(md.slice(0, 2))
  const d = Number(md.slice(3, 5))
  if (!/^\d\d-\d\d$/.test(md) || m < 1 || m > 12 || d < 1 || d > 31) throw new Error(`Invalid season day ${md}`)
  return `${year}-${pad(m)}-${pad(Math.min(d, daysInMonth(year, m)))}`
}

/**
 * The days an entitlement may be used in a term: the whole term, or the season's occurrence inside it that leaves
 * the most days (cut to the term; on a tie, the earlier one). Someone who joins on Dec 14 of an Oct 1 to Dec 15
 * season gets next fall, not two days. A season that crosses New Year (Nov 1 to Feb 28) runs into the next year.
 * Feb 29 in a non-leap year is Feb 28.
 */
export function windowFor(start: string, end: string, season: Season) {
  if (!season) return { startDay: start, endDay: end }
  const first = parts(start).y - 1
  const last = parts(end).y
  const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1
  let best: { startDay: string; endDay: string } | null = null
  for (let y = first; y <= last; y += 1) {
    const s = monthDay(season.startMonthDay, y)
    const wraps = season.endMonthDay < season.startMonthDay
    const e = monthDay(season.endMonthDay, wraps ? y + 1 : y)
    if (e < start || s > end) continue
    const w = { startDay: s < start ? start : s, endDay: e > end ? end : e }
    if (!best || days(w.startDay, w.endDay) > days(best.startDay, best.endDay)) best = w
  }
  return best ?? { startDay: start, endDay: end }
}

/** Where a window stands on a local day. */
export function windowState(day: string, w: { startDay: string; endDay: string }) {
  return day < w.startDay ? 'upcoming' : day > w.endDay ? 'expired' : 'open'
}

/** The instant a window stops being usable: the next local midnight after its last day, in the location's zone (DST-safe). */
export function windowEndsAt(timeZone: string, endDay: string) {
  return zonedInstant(timeZone, addDays(endDay, 1), '00:00')
}

/** Today at the location. */
export const dayAt = (timeZone: string, at: Date) => localDate({ timeZone }, at)

/** Whole days of a term still ahead of `day`, and the term's length: what a pro-rata credit is cut from. */
export function termDaysLeft(start: string, end: string, day: string) {
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
  const total = Math.round((ms(end) - ms(start)) / 86_400_000) + 1
  const left = day > end ? 0 : day < start ? total : Math.round((ms(end) - ms(day)) / 86_400_000) + 1
  return { left, total }
}

/** floor(amount * left / total) in integer cents. */
export const prorate = (amountMinor: bigint, left: number, total: number) => (total <= 0 ? 0n : (amountMinor * BigInt(left)) / BigInt(total))
