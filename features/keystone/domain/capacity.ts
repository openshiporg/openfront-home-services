import { addDays, assertDate, weekday, zonedInstant } from '../lib/calendar'
import { dec, decSum, toScale, ZERO, type DecimalInput } from '../lib/decimal'

/*
 * Arrival windows and capacity (SCHEMA §5, SM§2, I-B1). Capacity is tech-hours per window. A booking
 * fits when booked + its hours ≤ capacity + approved overrides. Every number here is an exact decimal;
 * the database lock (`capacity:{bu}:{date}`) makes check-then-insert atomic.
 */

export type WindowTemplate = { id: string; businessUnitId: string; weekday: number; startLocal: string; endLocal: string; label: string; capacityHours: DecimalInput; capacityFactor?: DecimalInput | null; active: boolean }

export type MaterialisedWindow = { templateId: string; businessUnitId: string; date: string; startsAt: Date; endsAt: Date; label: string; capacityHours: string }

/**
 * The windows for one branch-local date. Wall-clock times convert to instants in the branch zone, so a
 * "08:00-10:00" window is 08:00-10:00 local on both sides of a DST change. Closed days produce none.
 */
export function windowsForDate(templates: WindowTemplate[], date: string, timeZone: string, isOpen: (date: string) => boolean): MaterialisedWindow[] {
  assertDate(date)
  if (!isOpen(date)) return []
  const day = weekday(date)
  return templates
    .filter(t => t.active && t.weekday === day)
    .map(t => {
      const startsAt = zonedInstant(timeZone, date, t.startLocal)
      const endsAt = zonedInstant(timeZone, date, t.endLocal)
      if (endsAt <= startsAt) throw new Error(`Window ${t.label} ends before it starts on ${date}`)
      const factor = t.capacityFactor === null || t.capacityFactor === undefined ? dec(1) : dec(t.capacityFactor)
      return { templateId: t.id, businessUnitId: t.businessUnitId, date, startsAt, endsAt, label: t.label, capacityHours: toScale(dec(t.capacityHours).times(factor), 'qty') }
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/** Dates from `from` for `days` days (inclusive of `from`). */
export function dateRange(from: string, days: number) {
  assertDate(from)
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(from, i))
}

export type CapacityState = { capacityHours: DecimalInput; usedHours: DecimalInput[]; overrideHours?: DecimalInput[] }

export function remainingHours(state: CapacityState) {
  const limit = dec(state.capacityHours).plus(decSum(state.overrideHours ?? []))
  const used = decSum(state.usedHours)
  const left = limit.minus(used)
  return left.lt(ZERO) ? ZERO : left
}

export function fits(state: CapacityState, hours: DecimalInput) {
  if (dec(hours).lte(ZERO)) throw new Error('A booking must use some capacity')
  return dec(hours).lte(remainingHours(state))
}

/** How long a hold lives (SM§2): 10 minutes online or AI, 30 for a CSR; a caller may ask for less. */
export function holdExpiry(now: Date, source: 'csr' | 'online' | 'ai_agent', requestedMinutes?: number | null) {
  const max = source === 'csr' ? 30 : 10
  const minutes = requestedMinutes ? Math.min(Math.max(1, Math.floor(requestedMinutes)), max) : max
  return new Date(now.getTime() + minutes * 60_000)
}
