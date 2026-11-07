import { dec, toScale } from '../lib/decimal'

/*
 * Dispatch recommendation v1 (BUILD-PLAN Phase 1; I-D4; rideshare autoDispatchRanking.ts pattern).
 * Deterministic: the same inputs give the same ranking, and every candidate carries its reasons.
 * Order: eligibility gates first (an ineligible tech is never ranked above an eligible one), then a
 * score from drive minutes, skills, continuity with this customer, and fairness (today's load).
 * There is deliberately no revenue-prediction feature until it has been reviewed for bias.
 */

export const DISPATCH_MODEL = 'hs-dispatch-v1'
export const DISPATCH_FEATURES = ['eligibility', 'drive_minutes', 'skills', 'continuity', 'fairness'] as const

export type Candidate = {
  employeeId: string
  name: string
  eligible: boolean
  eligibilityCodes: string[]
  /** Straight-line estimate when no routing adapter is connected (see driveMinutes). */
  driveMinutes: number | null
  skillsMatched: number
  skillsRequired: number
  /** Visits this tech has done at this location before. */
  priorVisitsHere: number
  /** Hours already assigned that day. */
  assignedHoursToday: string
  onShift: boolean
  overlaps: number
}

export type Ranked = Candidate & { score: number; rank: number; explanation: string[] }

/** Integer points; ties break on fewer drive minutes, then employee id, so the order is stable. */
export function rankCandidates(candidates: Candidate[]): Ranked[] {
  const scored = candidates.map(c => {
    const explanation: string[] = []
    let score = 0
    if (!c.eligible) explanation.push(`Not eligible: ${c.eligibilityCodes.join(', ') || 'see findings'}`)
    if (!c.onShift) { score -= 400; explanation.push('Not on shift for this window') }
    if (c.overlaps > 0) { score -= 300 * c.overlaps; explanation.push(`${c.overlaps} overlapping visit${c.overlaps > 1 ? 's' : ''}`) }
    if (c.driveMinutes === null) { score -= 60; explanation.push('Drive time unknown') }
    else { score -= c.driveMinutes * 2; explanation.push(`About ${c.driveMinutes} min away`) }
    if (c.skillsRequired > 0) {
      score += Math.round((100 * c.skillsMatched) / c.skillsRequired)
      explanation.push(`${c.skillsMatched} of ${c.skillsRequired} skills`)
    }
    if (c.priorVisitsHere > 0) { score += Math.min(3, c.priorVisitsHere) * 25; explanation.push(`Has been here ${c.priorVisitsHere} time${c.priorVisitsHere > 1 ? 's' : ''}`) }
    // Fairness: each assigned hour today costs 10 points, so work spreads across the team.
    const tenths = loadTenths(c.assignedHoursToday)
    score -= tenths
    explanation.push(`${Math.floor(tenths / 10)}.${tenths % 10} h already today`)
    return { ...c, score, explanation }
  })
  scored.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible)
    || b.score - a.score
    || (a.driveMinutes ?? 9999) - (b.driveMinutes ?? 9999)
    || a.employeeId.localeCompare(b.employeeId))
  return scored.map((c, i) => ({ ...c, rank: i + 1 }))
}

/** Hours as whole tenths (2.25 → 23, half-up), so the score stays an integer without floats. */
export function loadTenths(hours: string) {
  return Number.parseInt(toScale(dec(hours).times(10), 0), 10)
}

const EARTH_KM = 6371

/** Coordinates are display/ranking inputs (degrees), not money; parsed once from the exact decimal text. */
const degrees = (value: string) => Number(String(value))

/**
 * Drive minutes when no routing adapter is connected: great-circle distance × 1.35 road factor at an
 * average 45 km/h, rounded up. Display and ranking only; never billed.
 */
export function driveMinutes(from: { lat: string | null; lng: string | null } | null, to: { lat: string | null; lng: string | null } | null): number | null {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null
  const rad = (v: string) => (degrees(v) * Math.PI) / 180
  const [lat1, lng1, lat2, lng2] = [rad(from.lat), rad(from.lng), rad(to.lat), rad(to.lng)]
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
  const km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
  return Math.max(1, Math.ceil((km * 1.35 * 60) / 45))
}
