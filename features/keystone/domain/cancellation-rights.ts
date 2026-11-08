import type { z } from 'zod'
import { cancelByDeadline, type CalendarSpec } from '../lib/calendar'
import type { homeSolicitationRules } from './policySchemas'

/*
 * Home-solicitation cancellation rights (SM§6.2, I-E6; R§12.1, R§12.1a). Pure: the caller loads
 * the bound home_solicitation PolicyVersion, the sale facts and the calendar, and stores the result
 * as an immutable CancellationEvaluation. Nothing about a jurisdiction is in code; the rules are
 * the pack's data. Fails closed: an unknown exclusion code or calendar is an error, not "no right".
 *
 * Two scopes exist in the packs:
 * - door_to_door (16 CFR 429.0(a)): a sale "at other than the place of business of the seller",
 *   including one made "in response to or following an invitation by the buyer". The requested-repair
 *   exclusion (429.0(a)(5)) removes the repair and the replacement parts necessarily used, per line;
 *   additional goods or services sold on that visit stay covered.
 * - personal_solicitation (Tex. Bus. & Com. Code §601.002(a)): the merchant personally solicited the
 *   sale away from its place of business and the agreement was given there. When the customer called
 *   us for a repair, the requested work was not solicited; what the technician proposed on site was.
 *   The ACR exemption (Occ. Code §1302.003) removes HVAC lines of a consumer-initiated transaction.
 */

export type HomeSolicitationRules = z.infer<typeof homeSolicitationRules>
export type RightRule = HomeSolicitationRules['rules'][number]

export type SaleLocation = 'buyer_residence' | 'other_non_merchant' | 'merchant_place' | 'remote'
export type CancellationClass = 'requested_repair' | 'necessary_replacement_parts' | 'additional_goods_services'

export type SaleLine = {
  id: string
  amountMinor: bigint
  trade: 'hvac' | 'plumbing' | 'electrical' | 'general'
  cancellationClass: CancellationClass
  description?: string
}

export type SaleFacts = {
  /** Where the buyer agreed (Authorization.location). */
  location: SaleLocation
  /** Did the customer ask us out (customer_request) or did we solicit the visit (solicited)? */
  initiatedBy: 'customer_request' | 'solicited'
  transactionAt: Date
  /** IANA zone of the service location: cancel-by is midnight there. */
  timeZone: string
  lines: SaleLine[]
  /** Whole-sale exclusions that the facts establish, e.g. tila_rescission. Codes must exist in the rule. */
  exclusions?: string[]
  /** A buyer-initiated bona fide emergency with the buyer's own dated, signed, handwritten waiver. */
  emergencyWaiver?: { present: boolean; handwritten: boolean; signedAndDated: boolean } | null
  /** Context that defeats the ACR exemption (breach of express warranty, negligent installation). */
  acrContext?: string[]
  language?: string
}

export type RightResult = {
  rule: string
  title: string
  applies: boolean
  /** Why the right does or doesn't arise (machine codes, ordered). */
  reasons: string[]
  coveredLineIds: string[]
  coveredAmountMinor: string
  thresholdMinor: string | null
  comparison: RightRule['thresholdComparison']
  businessDays: number
  transactionDate: string
  lastDay: string | null
  /** The exclusive deadline (the instant at local midnight ending the last day), ISO-8601. */
  cancelBy: string | null
  noticeTemplate: string
  refundBusinessDays: number
  waived: boolean
}

export type CancellationEvaluationResult = {
  applies: boolean
  /** The latest cancel-by among applying rules, with the most covered lines on a tie. */
  governing: RightResult | null
  results: RightResult[]
  /** Union of covered lines across applying, unwaived rules. */
  coveredLineIds: string[]
  coveredAmountMinor: string
  language: string
}

export class CancellationRightsError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}

const KNOWN_EXCLUSIONS = new Set(['retail_prior_negotiation', 'tila_rescission', 'emergency_waiver', 'mail_or_phone_only', 'requested_repair'])

function thresholdFor(rule: RightRule, location: SaleLocation): bigint | null {
  if (location === 'buyer_residence') return BigInt(rule.thresholdAtResidenceMinor)
  if (location === 'other_non_merchant') return rule.thresholdElsewhereMinor === null ? null : BigInt(rule.thresholdElsewhereMinor)
  return null
}

const meets = (amount: bigint, threshold: bigint, comparison: RightRule['thresholdComparison']) =>
  comparison === 'at_least' ? amount >= threshold : amount > threshold

function waiverValid(rule: RightRule, facts: SaleFacts) {
  const w = facts.emergencyWaiver
  if (!w?.present || !rule.emergencyWaiver.allowed) return false
  if (facts.initiatedBy !== 'customer_request') return false
  if (rule.emergencyWaiver.handwritten && !w.handwritten) return false
  if (rule.emergencyWaiver.signedAndDated && !w.signedAndDated) return false
  return true
}

/** Lines a rule can cover, before thresholds: its scope, its per-line exclusions, its trade exemptions. */
function linesInScope(rule: RightRule, facts: SaleFacts, reasons: string[]): SaleLine[] {
  const perLine = new Set(rule.exclusions.filter(e => e.perLine).map(e => e.code))
  let lines = facts.lines.filter(line => line.amountMinor > 0n)
  if (rule.scope === 'personal_solicitation') {
    if (facts.initiatedBy === 'customer_request') {
      const before = lines.length
      lines = lines.filter(line => line.cancellationClass === 'additional_goods_services')
      if (lines.length < before) reasons.push('requested_work_not_solicited')
    }
  } else if (perLine.has('requested_repair') && facts.initiatedBy === 'customer_request') {
    // 16 CFR 429.0(a)(5)(vi): only when the buyer initiated the contact and asked for the repair visit.
    const before = lines.length
    lines = lines.filter(line => line.cancellationClass === 'additional_goods_services')
    if (lines.length < before) reasons.push('requested_repair_lines_excluded')
  }
  for (const exemption of rule.exemptions) {
    if (exemption.when !== 'consumer_initiated' || facts.initiatedBy !== 'customer_request') continue
    if ((facts.acrContext ?? []).some(code => exemption.except.includes(code))) { reasons.push(`${exemption.code}_not_available`); continue }
    const before = lines.length
    lines = lines.filter(line => !(exemption.trades as string[]).includes(line.trade))
    if (lines.length < before) reasons.push(exemption.code)
  }
  return lines
}

export function evaluateRule(rule: RightRule, facts: SaleFacts, calendar: CalendarSpec): RightResult {
  if (rule.calendar !== calendar.code) throw new CancellationRightsError('POLICY_INVALID', `Rule ${rule.code} counts business days on ${rule.calendar}, but ${calendar.code} was supplied.`)
  for (const code of facts.exclusions ?? []) {
    if (!KNOWN_EXCLUSIONS.has(code)) throw new CancellationRightsError('INVALID_INPUT', `Unknown exclusion ${code}.`)
  }
  const reasons: string[] = []
  const { transactionDate, lastDay, deadline } = cancelByDeadline(calendar, facts.transactionAt, facts.timeZone, rule.businessDays)
  const base = {
    rule: rule.code, title: rule.title, comparison: rule.thresholdComparison, businessDays: rule.businessDays, transactionDate,
    noticeTemplate: rule.noticeTemplate, refundBusinessDays: rule.refundBusinessDays,
  }
  const none = (why: string, threshold: bigint | null = null): RightResult => ({
    ...base, applies: false, reasons: [...reasons, why], coveredLineIds: [], coveredAmountMinor: '0', thresholdMinor: threshold?.toString() ?? null, lastDay: null, cancelBy: null, waived: false,
  })

  const threshold = thresholdFor(rule, facts.location)
  if (threshold === null) return none(facts.location === 'merchant_place' ? 'at_merchant_place_of_business' : 'not_a_covered_location')
  const ruleExclusions = new Set(rule.exclusions.filter(e => !e.perLine).map(e => e.code))
  const whole = (facts.exclusions ?? []).find(code => ruleExclusions.has(code) && code !== 'emergency_waiver')
  if (whole) return none(`excluded_${whole}`, threshold)
  if (rule.scope === 'personal_solicitation' && facts.location === 'remote') return none('not_personally_solicited', threshold)

  const lines = linesInScope(rule, facts, reasons)
  const covered = lines.reduce((sum, line) => sum + line.amountMinor, 0n)
  if (!lines.length) return none('no_covered_lines', threshold)
  if (!meets(covered, threshold, rule.thresholdComparison)) return none(rule.thresholdComparison === 'at_least' ? 'below_threshold' : 'not_more_than_threshold', threshold)

  const waived = waiverValid(rule, facts)
  if (facts.emergencyWaiver?.present && !waived) reasons.push(rule.emergencyWaiver.allowed ? 'emergency_waiver_incomplete' : 'emergency_waiver_not_available')
  return {
    ...base,
    applies: true,
    reasons: [...reasons, waived ? 'waived_by_buyer_emergency' : 'right_applies'],
    coveredLineIds: lines.map(line => line.id),
    coveredAmountMinor: covered.toString(),
    thresholdMinor: threshold.toString(),
    lastDay,
    cancelBy: deadline.toISOString(),
    waived,
  }
}

/**
 * Evaluate every rule in the bound version. The governing right is the one that lasts longest
 * (strictest for the seller); covered lines are the union across unwaived rules, since each rule
 * protects its own lines.
 */
export function evaluateCancellationRights(rules: HomeSolicitationRules, facts: SaleFacts, calendars: Record<string, CalendarSpec>): CancellationEvaluationResult {
  if (!facts.lines.length) throw new CancellationRightsError('INVALID_INPUT', 'A sale needs at least one line.')
  if (facts.lines.some(line => line.amountMinor < 0n)) throw new CancellationRightsError('INVALID_INPUT', 'Line amounts must not be negative.')
  const results = rules.rules.map(rule => {
    const calendar = calendars[rule.calendar]
    if (!calendar) throw new CancellationRightsError('POLICY_INVALID', `No ${rule.calendar} calendar is loaded for rule ${rule.code}.`)
    return evaluateRule(rule, facts, calendar)
  })
  const live = results.filter(r => r.applies && !r.waived)
  const governing = [...live].sort((a, b) => (b.cancelBy! < a.cancelBy! ? -1 : b.cancelBy! > a.cancelBy! ? 1 : b.coveredLineIds.length - a.coveredLineIds.length))[0] ?? null
  const ids = new Set(live.flatMap(r => r.coveredLineIds))
  const coveredAmount = facts.lines.filter(line => ids.has(line.id)).reduce((sum, line) => sum + line.amountMinor, 0n)
  return {
    applies: live.length > 0,
    governing,
    results,
    coveredLineIds: facts.lines.filter(line => ids.has(line.id)).map(line => line.id),
    coveredAmountMinor: coveredAmount.toString(),
    language: facts.language ?? 'en',
  }
}

/** The notice's rule enum (CancellationNotice.rule) for a pack rule code. */
export const noticeRuleOf = (code: string) => (code === 'ftc_cooling_off' ? 'ftc_16cfr429' : code === 'tx_601' ? 'tx_bcc_601' : 'other')
