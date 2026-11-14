import { dec, Decimal, toScale, ZERO, type DecimalInput } from '../lib/decimal'
import { roundMinor } from '../lib/money'
import { addDays, weekday } from '../lib/calendar'

/*
 * Pure pay arithmetic (STATE-MACHINES §16, DOMAIN labour rules). No database, no clock: the same inputs always give the same lines.
 * Hours are exact decimals (4 places), money is whole minor units, rounding is half-up once per line.
 */

export class PayRuleError extends Error {}

/** The workweek starts on Monday (the FLSA workweek the company fixes; it can be any seven days, but it is fixed). */
export const workweekStart = (day: string) => addDays(day, -((weekday(day) + 6) % 7))

export const hoursBetween = (from: Date, to: Date) => dec(to.getTime() - from.getTime()).div(3_600_000).toDecimalPlaces(4)

// ── Segments proposed from visit status events ──────────────────────────────────────────────────────────────────

export type StatusEvent = { id: string; visitId: string; toStatus: string; occurredAt: Date }
export type ProposedSegment = { kind: 'job' | 'drive'; visitId: string; startsAt: Date; endsAt: Date; sourceKey: string }

/**
 * en_route → on_site is drive time; on_site/working → paused/done/cancelled/no_access is job time. A segment still open at the end of
 * the events is not proposed (the technician is still on it). Events are read in time order, ties by id, so the result is stable.
 */
export function proposeSegments(events: StatusEvent[]): ProposedSegment[] {
  const out: ProposedSegment[] = []
  const byVisit = new Map<string, StatusEvent[]>()
  for (const e of events) byVisit.set(e.visitId, [...(byVisit.get(e.visitId) ?? []), e])
  for (const [visitId, list] of [...byVisit.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const sorted = [...list].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || (a.id < b.id ? -1 : 1))
    let open: { kind: 'job' | 'drive'; at: Date; id: string } | null = null
    const close = (e: StatusEvent) => {
      if (open && e.occurredAt.getTime() > open.at.getTime()) out.push({ kind: open.kind, visitId, startsAt: open.at, endsAt: e.occurredAt, sourceKey: `evt:${open.id}:${e.id}` })
      open = null
    }
    for (const e of sorted) {
      if (e.toStatus === 'en_route') { close(e); open = { kind: 'drive', at: e.occurredAt, id: e.id } }
      else if (e.toStatus === 'on_site' || e.toStatus === 'working') {
        if (open && (open as { kind: string }).kind === 'job') continue
        close(e); open = { kind: 'job', at: e.occurredAt, id: e.id }
      } else if (['paused', 'done', 'cancelled', 'no_access'].includes(e.toStatus)) close(e)
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || (a.sourceKey < b.sourceKey ? -1 : 1))
}

/** Two segments that cover the same moment. Standby and paid leave may sit alongside other time. */
const MAY_OVERLAP = new Set(['on_call_standby', 'pto'])
export function findOverlap<T extends { kind: string; startsAt: Date; endsAt: Date }>(segments: T[]): [T, T] | null {
  const list = segments.filter(s => !MAY_OVERLAP.has(s.kind)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  for (let i = 1; i < list.length; i += 1) if (list[i].startsAt.getTime() < list[i - 1].endsAt.getTime()) return [list[i - 1], list[i]]
  return null
}

export const PAID_KINDS = ['job', 'drive', 'shop', 'supply_run', 'break_paid', 'on_call_standby', 'training'] as const
/** What counts as hours worked on a timesheet: everything except the unpaid meal break and paid leave. */
export const isWorked = (kind: string) => (PAID_KINDS as readonly string[]).includes(kind)
export const MAX_DAY_HOURS = '16'

export function sheetHours(segments: { kind: string; hours: DecimalInput }[]) {
  return segments.filter(s => isWorked(s.kind) || s.kind === 'pto').reduce((a, s) => a.plus(dec(s.hours)), ZERO)
}

// ── Hourly and overtime lines ───────────────────────────────────────────────────────────────────────────────────

export type PaySegment = { id: string; kind: string; startsAt: Date; hours: string; workweekStart: string; payable: boolean }
export type HourlyPlan = { hourlyRates: Record<string, string>; overtime: { weeklyThresholdHours: DecimalInput; multiplier: DecimalInput } }
export type HourLine = { kind: 'regular' | 'overtime' | 'pto'; workweekStart: string; segmentKind: string; hours: string; rateMinor: bigint; amountMinor: bigint; lineKey: string; segmentIds: string[] }

function rateFor(plan: HourlyPlan, kind: string) {
  const rate = plan.hourlyRates[kind] ?? plan.hourlyRates.default
  if (rate === undefined) throw new PayRuleError(`The pay plan has no hourly rate for ${kind.replaceAll('_', ' ')} time.`)
  return dec(rate)
}

/**
 * One employee's hourly lines. Overtime is the time past the weekly threshold, taken from the end of the week in the order the work
 * happened. A segment already paid in an earlier period still counts toward the threshold but earns no new line.
 */
export function hourlyLines(employeeId: string, segments: PaySegment[], plan: HourlyPlan): HourLine[] {
  const threshold = dec(plan.overtime.weeklyThresholdHours)
  const multiplier = dec(plan.overtime.multiplier)
  const weeks = new Map<string, PaySegment[]>()
  for (const s of segments) weeks.set(s.workweekStart, [...(weeks.get(s.workweekStart) ?? []), s])
  const lines: HourLine[] = []
  for (const [week, list] of [...weeks.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // Hours an earlier period already paid come first; time that turns up late sits on top of the week, so it is the overtime.
    const sorted = [...list].sort((a, b) => Number(b.payable === false) - Number(a.payable === false) || a.startsAt.getTime() - b.startsAt.getTime() || (a.id < b.id ? -1 : 1))
    const reg = new Map<string, { hours: Decimal; ids: string[] }>()
    const ot = new Map<string, { hours: Decimal; ids: string[] }>()
    const pto = { hours: ZERO, ids: [] as string[] }
    let worked = ZERO
    const add = (m: Map<string, { hours: Decimal; ids: string[] }>, kind: string, h: Decimal, id: string) => {
      if (h.isZero()) return
      const cur = m.get(kind) ?? { hours: ZERO, ids: [] }
      m.set(kind, { hours: cur.hours.plus(h), ids: [...cur.ids, id] })
    }
    for (const s of sorted) {
      const h = dec(s.hours)
      if (s.kind === 'pto') { if (s.payable) { pto.hours = pto.hours.plus(h); pto.ids.push(s.id) } continue }
      if (!isWorked(s.kind)) continue
      const room = Decimal.max(ZERO, threshold.minus(worked))
      const regPart = Decimal.min(h, room)
      const otPart = h.minus(regPart)
      worked = worked.plus(h)
      if (!s.payable) continue
      add(reg, s.kind, regPart, s.id)
      add(ot, s.kind, otPart, s.id)
    }
    for (const [kind, v] of [...reg.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const rate = rateFor(plan, kind)
      lines.push({ kind: 'regular', workweekStart: week, segmentKind: kind, hours: toScale(v.hours, 4), rateMinor: roundMinor(rate), amountMinor: roundMinor(rate.times(v.hours)), lineKey: `hr:${employeeId}:${week}:${kind}:reg`, segmentIds: v.ids })
    }
    for (const [kind, v] of [...ot.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const rate = rateFor(plan, kind).times(multiplier)
      lines.push({ kind: 'overtime', workweekStart: week, segmentKind: kind, hours: toScale(v.hours, 4), rateMinor: roundMinor(rate), amountMinor: roundMinor(rate.times(v.hours)), lineKey: `hr:${employeeId}:${week}:${kind}:ot`, segmentIds: v.ids })
    }
    if (!pto.hours.isZero()) {
      const rate = rateFor(plan, 'pto')
      lines.push({ kind: 'pto', workweekStart: week, segmentKind: 'pto', hours: toScale(pto.hours, 4), rateMinor: roundMinor(rate), amountMinor: roundMinor(rate.times(pto.hours)), lineKey: `hr:${employeeId}:${week}:pto`, segmentIds: pto.ids })
    }
  }
  return lines
}

// ── Commission and spiffs ───────────────────────────────────────────────────────────────────────────────────────

export type CommissionRule = { scope: string; kind: 'percent_of_sold' | 'fixed_per_task'; value: string; splitBasis?: string }
export type CommissionPlan = { basis: 'invoice_posted' | 'payment_received'; rules: CommissionRule[] }

/** The most specific rule: the item's commission code, then its category (`category:KEY`), then `all`. */
export function ruleFor(rules: CommissionRule[], item: { commissionCode: string; categoryKey: string }) {
  return (item.commissionCode ? rules.find(r => r.scope === item.commissionCode) : undefined)
    ?? (item.categoryKey ? rules.find(r => r.scope === `category:${item.categoryKey}`) : undefined)
    ?? rules.find(r => r.scope === 'all')
    ?? null
}

/** Which roles share the pool: `sold_by`, `performed_by`, or `split:60` (60% to sold-by, the rest to performed-by). */
export function poolRoles(splitBasis: string | undefined): { role: 'sold_by' | 'performed_by'; pct: Decimal }[] {
  const s = splitBasis || 'sold_by'
  if (s === 'sold_by' || s === 'performed_by') return [{ role: s, pct: dec(100) }]
  const m = /^split:(\d{1,3})$/.exec(s)
  if (m && Number(m[1]) >= 0 && Number(m[1]) <= 100) return [{ role: 'sold_by', pct: dec(m[1]) }, { role: 'performed_by', pct: dec(100).minus(m[1]) }]
  throw new PayRuleError(`Unknown split basis "${s}": use sold_by, performed_by or split:<percent to sold-by>.`)
}

/**
 * The pool for one line, before it is divided by role and by share. `portion` is the part of the sale the trigger covers: 1 for a
 * posted invoice, payment ÷ invoice total for a payment.
 */
export function rulePool(rule: CommissionRule, netMinor: bigint, portion: DecimalInput = 1, quantity: DecimalInput = 1) {
  const part = dec(portion)
  if (rule.kind === 'percent_of_sold') return dec(netMinor).times(part).times(dec(rule.value)).div(100)
  return dec(rule.value).times(dec(quantity)).times(part)
}

/** One person's amount: pool × the role's share of it × their attribution share, rounded half-up once. */
export const shareAmount = (pool: Decimal, rolePct: DecimalInput, sharePct: DecimalInput) => roundMinor(pool.times(dec(rolePct)).div(100).times(dec(sharePct)).div(100))

export const spiffRole = (code: string) => (code === 'tgl' ? 'lead_generated_by' : 'sold_by') as 'lead_generated_by' | 'sold_by'

/** A fixed spiff (per unit sold), split by the attribution share. */
export const spiffAmount = (amountMinor: bigint, sharePct: DecimalInput, portion: DecimalInput = 1, quantity: DecimalInput = 1) => roundMinor(dec(amountMinor).times(dec(quantity)).times(dec(portion)).times(dec(sharePct)).div(100))

/** Shares for one sale and role must add up to exactly 100. */
export function sharesAddUp(shares: DecimalInput[]) {
  return shares.length > 0 && shares.reduce<Decimal>((a, s) => a.plus(dec(s)), ZERO).equals(100) && shares.every(s => dec(s).greaterThan(0))
}

/** Clawback: the original amount times the part of the sale that came back (capped at all of it), negative. */
export function clawbackAmount(originalMinor: bigint, returned: bigint, saleTotal: bigint) {
  if (saleTotal <= 0n) return -originalMinor
  const fraction = Decimal.min(dec(1), dec(returned).div(dec(saleTotal)))
  return -roundMinor(dec(originalMinor).times(fraction))
}
