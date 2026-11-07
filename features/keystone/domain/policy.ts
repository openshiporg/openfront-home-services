import { DomainError, Codes } from '../lib/errors'
import { POLICY_KINDS, type PolicyKind } from '../models/policy'
import { parsePolicyRules, type ContactHoursRules } from './policySchemas'

/*
 * Policy resolution (SCHEMA §13.1, DOMAIN §7, STATE-MACHINES §0.7). Pure: the caller loads the
 * candidate bindings (loadPolicyCandidates) and this decides. Rules:
 *   - only active bindings whose scope matches the place are candidates;
 *   - the most specific scope wins (zip > city > county > state > branch > company), then the
 *     higher priority;
 *   - two different packs tied at the top is ambiguous, and so are two active versions of the
 *     winning pack covering the same instant: both fail closed (POLICY_AMBIGUOUS);
 *   - no matching binding or no version in effect fails closed (POLICY_MISSING);
 *   - rules that don't parse against the kind's schema fail closed (POLICY_INVALID);
 *   - contact hours are the exception: every matching layer applies and the stricter window wins
 *     (federal 8 a.m.–9 p.m. and Texas §301.051 combine to 9 a.m.–9 p.m., Sundays noon–9 p.m.).
 * The resolved version id is recorded on whatever the evaluation produced.
 */

export const SCOPE_SPECIFICITY = { company: 0, branch: 1, state: 2, county: 3, city: 4, zip: 5 } as const
export type PolicyScope = keyof typeof SCOPE_SPECIFICITY

export type PolicyPlace = {
  branchId?: string | null
  /** ISO 3166-2 subdivision, e.g. "US-TX". */
  state?: string | null
  /** e.g. "US-TX-TRAVIS". */
  county?: string | null
  /** e.g. "US-TX-AUSTIN". */
  city?: string | null
  zip?: string | null
}

export type CandidateVersion = { id: string; versionNumber: number; status: string; effectiveFrom: string; effectiveTo: string | null; rules: unknown; contentHash: string; sourceRefs?: unknown }
export type CandidateBinding = {
  id: string
  scope: PolicyScope
  scopeValue: string
  priority: number
  status: string
  pack: { id: string; code: string; kind: string; versions: CandidateVersion[] }
}

export type ResolvedPolicy<T = unknown> = {
  kind: PolicyKind
  packCode: string
  versionId: string
  versionNumber: number
  contentHash: string
  rules: T
  bindingId: string
  /** Every version that contributed (more than one only for contact hours). */
  layers: { packCode: string; versionId: string; scope: PolicyScope }[]
}

function matches(binding: CandidateBinding, place: PolicyPlace) {
  switch (binding.scope) {
    case 'company': return true
    case 'branch': return !!place.branchId && binding.scopeValue === place.branchId
    case 'state': return !!place.state && binding.scopeValue === place.state
    case 'county': return !!place.county && binding.scopeValue === place.county
    case 'city': return !!place.city && binding.scopeValue === place.city
    case 'zip': return !!place.zip && binding.scopeValue === place.zip
    default: return false
  }
}

/** The single active version of a pack in effect on `on` (YYYY-MM-DD). effectiveTo is exclusive. */
export function versionInEffect(binding: CandidateBinding, on: string): CandidateVersion {
  const live = binding.pack.versions.filter(v => v.status === 'active' && v.effectiveFrom <= on && (!v.effectiveTo || on < v.effectiveTo))
  if (!live.length) throw new DomainError(Codes.POLICY_MISSING, `No ${binding.pack.kind.replaceAll('_', ' ')} policy is in effect on ${on} for ${binding.pack.code}.`, { reason: 'no_version' })
  if (live.length > 1) throw new DomainError(Codes.POLICY_AMBIGUOUS, `More than one ${binding.pack.code} policy version is in effect on ${on}.`, { reason: 'overlapping_versions' })
  return live[0]
}

function parsed(kind: PolicyKind, binding: CandidateBinding, version: CandidateVersion) {
  const result = parsePolicyRules(kind, version.rules)
  if (!result.success) throw new DomainError(Codes.POLICY_INVALID, `${binding.pack.code} version ${version.versionNumber} has invalid ${kind} rules.`, { reason: result.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') })
  return result.data
}

const later = (a: string, b: string) => (a > b ? a : b)
const earlier = (a: string, b: string) => (a < b ? a : b)

/** Intersect two windows; an empty intersection means no contact at all that day. */
function intersect(a: { start: string; end: string }, b: { start: string; end: string }) {
  const start = later(a.start, b.start)
  const end = earlier(a.end, b.end)
  return start < end ? { start, end } : { start: '00:00', end: '00:00' }
}

export function stricterContactHours(layers: ContactHoursRules[]): ContactHoursRules {
  return layers.slice(1).reduce((acc, next) => ({
    purposes: [...new Set([...acc.purposes, ...next.purposes])],
    basis: 'recipient_local_time',
    weekdays: intersect(acc.weekdays, next.weekdays),
    saturday: intersect(acc.saturday, next.saturday),
    sunday: intersect(acc.sunday, next.sunday),
    // An exemption survives only when every layer grants it.
    exemptions: acc.exemptions.filter(e => next.exemptions.includes(e)),
  }), layers[0])
}

export function resolvePolicy<T = unknown>(kind: PolicyKind, place: PolicyPlace, on: string, candidates: CandidateBinding[]): ResolvedPolicy<T> {
  if (!(POLICY_KINDS as readonly string[]).includes(kind)) throw new DomainError(Codes.INVALID_INPUT, `Unknown policy kind ${kind}.`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) throw new DomainError(Codes.INVALID_INPUT, 'Policy date must be YYYY-MM-DD.')
  const applicable = candidates
    .filter(b => b.status === 'active' && b.pack.kind === kind && matches(b, place))
    .sort((a, b) => SCOPE_SPECIFICITY[b.scope] - SCOPE_SPECIFICITY[a.scope] || b.priority - a.priority)
  if (!applicable.length) throw new DomainError(Codes.POLICY_MISSING, `No ${kind.replaceAll('_', ' ')} policy applies here.`, { reason: 'no_binding' })

  if (kind === 'contact_hours') {
    const layers = applicable.map(binding => { const version = versionInEffect(binding, on); return { binding, version, rules: parsed(kind, binding, version) as ContactHoursRules } })
    const top = layers[0]
    return {
      kind, packCode: top.binding.pack.code, versionId: top.version.id, versionNumber: top.version.versionNumber, contentHash: top.version.contentHash, bindingId: top.binding.id,
      rules: stricterContactHours(layers.map(l => l.rules)) as T,
      layers: layers.map(l => ({ packCode: l.binding.pack.code, versionId: l.version.id, scope: l.binding.scope })),
    }
  }

  const [winner, runnerUp] = applicable
  if (runnerUp && SCOPE_SPECIFICITY[runnerUp.scope] === SCOPE_SPECIFICITY[winner.scope] && runnerUp.priority === winner.priority && runnerUp.pack.id !== winner.pack.id) {
    throw new DomainError(Codes.POLICY_AMBIGUOUS, `Two ${kind.replaceAll('_', ' ')} policies (${winner.pack.code}, ${runnerUp.pack.code}) apply equally here. Set a priority on one binding.`, { reason: 'tied_bindings' })
  }
  const version = versionInEffect(winner, on)
  return {
    kind, packCode: winner.pack.code, versionId: version.id, versionNumber: version.versionNumber, contentHash: version.contentHash, bindingId: winner.id,
    rules: parsed(kind, winner, version) as T,
    layers: [{ packCode: winner.pack.code, versionId: version.id, scope: winner.scope }],
  }
}

const isoDay = (d: Date | string | null) => (d === null ? null : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10))

/** Load the active bindings for a kind with their packs' active versions. */
export async function loadPolicyCandidates(db: any, kind: PolicyKind): Promise<CandidateBinding[]> {
  const rows = await db.policyBinding.findMany({
    where: { status: 'active', pack: { kind } },
    include: { pack: { include: { versions: { where: { status: 'active' } } } } },
  })
  return rows.map((b: any) => ({
    id: b.id, scope: b.scope, scopeValue: b.scopeValue, priority: b.priority, status: b.status,
    pack: {
      id: b.pack.id, code: b.pack.code, kind: b.pack.kind,
      versions: b.pack.versions.map((v: any) => ({ id: v.id, versionNumber: v.versionNumber, status: v.status, effectiveFrom: isoDay(v.effectiveFrom)!, effectiveTo: isoDay(v.effectiveTo), rules: v.rules, contentHash: v.contentHash, sourceRefs: v.sourceRefs })),
    },
  }))
}

export async function resolvePolicyFromDb<T = unknown>(db: any, kind: PolicyKind, place: PolicyPlace, on: string) {
  return resolvePolicy<T>(kind, place, on, await loadPolicyCandidates(db, kind))
}
