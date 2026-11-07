import { z } from 'zod'
import type { PolicyKind } from '../models/policy'

/*
 * One Zod schema per policy kind (SCHEMA §13.1, DOMAIN §7). A PolicyVersion's `rules` must parse
 * against its pack's schema before it can be published, and again every time it is resolved, so
 * a malformed rule set can never be applied. Amounts are minor-unit strings; rates are decimal
 * strings; nothing here is a float.
 */

const minorText = z.string().regex(/^\d{1,15}$/, 'whole cents as a string')
const decimalText = z.string().regex(/^\d+(\.\d+)?$/, 'a decimal as a string')
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm')
const trade = z.enum(['hvac', 'plumbing', 'electrical', 'general'])

const window = z.object({ start: hhmm, end: hhmm }).refine(w => w.start < w.end, 'start must be before end')

export const homeSolicitationRules = z.object({
  rules: z.array(z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    /** Price that triggers the right, at the buyer's residence and elsewhere (temporary places). */
    thresholdAtResidenceMinor: minorText,
    thresholdElsewhereMinor: minorText.nullable(),
    /** "$25 or more" (at_least) vs "exceeds $25" (more_than). */
    thresholdComparison: z.enum(['at_least', 'more_than']),
    /** Cancel until midnight of this business day after the transaction. */
    businessDays: z.number().int().min(1).max(15),
    calendar: z.string().min(1),
    /** Situations where the right does not arise; evaluated per sold line. */
    exclusions: z.array(z.object({ code: z.string(), description: z.string(), perLine: z.boolean().default(false) })),
    /** Trade-specific exemptions, e.g. the Texas ACR exemption for consumer-initiated transactions. */
    exemptions: z.array(z.object({ code: z.string(), trades: z.array(trade).min(1), when: z.enum(['consumer_initiated']), except: z.array(z.string()).default([]) })).default([]),
    emergencyWaiver: z.object({ allowed: z.boolean(), handwritten: z.boolean(), signedAndDated: z.boolean() }),
    noticeTemplate: z.string().min(1),
  })).min(1),
})

export const homeImprovementContractRules = z.object({
  depositCapPct: decimalText.nullable(),
  depositCapMinor: minorText.nullable(),
  requiredFields: z.array(z.string()),
  licenseDisplay: z.boolean(),
})

export const autoRenewalRules = z.object({
  affirmativeConsentRequired: z.boolean(),
  noticeLeadDays: z.number().int().min(0).max(120).nullable(),
  annualReminder: z.boolean(),
  onlineCancelRequired: z.boolean(),
})

export const callRecordingRules = z.object({
  consent: z.enum(['one_party', 'all_party']),
  disclosureRequired: z.boolean(),
  disclosureText: z.string().min(1),
})

export const contactHoursRules = z.object({
  /** Purposes these hours restrict. Transactional messages the customer asked for are governed separately. */
  purposes: z.array(z.enum(['solicitation', 'marketing', 'ai_voice_outbound', 'transactional'])).min(1),
  basis: z.literal('recipient_local_time'),
  weekdays: window,
  saturday: window,
  sunday: window,
  exemptions: z.array(z.string()).default([]),
})

export const refrigerantRules = z.object({
  technicianCertificationRequired: z.boolean(),
  certificationTypes: z.array(z.enum(['type_i', 'type_ii', 'type_iii', 'universal'])),
  disposalRecords: z.object({ minChargeLb: decimalText, maxChargeLb: decimalText, includesHfc: z.boolean() }),
  leakRepair: z.object({ minChargeLb: decimalText, repairDays: z.number().int().min(1), effectiveFrom: z.string(), excludedSubsectors: z.array(z.string()) }),
  installRules: z.array(z.object({ refrigerant: z.string(), equipmentClass: z.string(), allowed: z.boolean(), condition: z.string() })),
})

export const licensingRules = z.object({
  requirements: z.array(z.object({
    trade,
    jobTag: z.string().min(1),
    companyLicense: z.object({ issuer: z.string(), classes: z.array(z.string()).min(1), endorsement: z.string().nullable() }).nullable(),
    individual: z.object({ anyOf: z.array(z.string()).min(1), supervisionBy: z.array(z.string()).default([]) }).nullable(),
    maxCoolingTons: decimalText.nullable().default(null),
    maxHeatingBtuh: z.number().int().nullable().default(null),
  })).min(1),
})

export const salesTaxRules = z.object({
  engine: z.enum(['native_tables', 'adapter']),
  stateRate: decimalText,
  maxLocalRate: decimalText,
  localRates: z.array(z.object({ code: z.string(), name: z.string(), rate: decimalText })),
  matrix: z.array(z.object({
    propertyClass: z.enum(['residential', 'nonresidential', 'multiple_use']),
    contractTaxMode: z.enum(['lump_sum', 'separated', 'any']),
    taxCategory: z.enum(['labor', 'material', 'equipment', 'fee', 'disposal', 'maintenance', 'warranty_reimbursed', 'any']),
    taxable: z.boolean(),
    basis: z.enum(['price', 'at_least_cost', 'none']),
    note: z.string().optional(),
  })).min(1),
  rounding: z.enum(['per_line', 'per_invoice_jurisdiction']),
})

export const wageHourRules = z.object({
  weeklyOvertimeHours: decimalText,
  dailyOvertimeHours: decimalText.nullable(),
  overtimeMultiplier: decimalText,
  workweekStartDay: z.number().int().min(0).max(6),
  regularRateReview: z.boolean(),
})

export const lienRules = z.object({
  clocks: z.array(z.object({
    party: z.enum(['original_contractor', 'derivative_claimant']),
    projectClass: z.enum(['residential', 'other']),
    action: z.enum(['file_affidavit', 'notice_to_owner']),
    kind: z.literal('day_of_nth_month_after'),
    monthsAfter: z.number().int().min(1).max(12),
    dayOfMonth: z.number().int().min(1).max(28),
    from: z.enum(['month_work_completed', 'month_labor_or_materials_delivered']),
  })).min(1),
})

export const privacyRules = z.object({
  retention: z.array(z.object({ record: z.string(), years: z.number().int().min(0), verified: z.boolean() })),
  dataSubjectRequests: z.object({ export: z.boolean(), delete: z.boolean(), legalHoldRecords: z.array(z.string()) }),
})

export const POLICY_SCHEMAS: Record<PolicyKind, z.ZodTypeAny> = {
  home_solicitation: homeSolicitationRules,
  home_improvement_contract: homeImprovementContractRules,
  auto_renewal: autoRenewalRules,
  call_recording: callRecordingRules,
  contact_hours: contactHoursRules,
  refrigerant: refrigerantRules,
  licensing: licensingRules,
  sales_tax: salesTaxRules,
  wage_hour: wageHourRules,
  lien: lienRules,
  privacy: privacyRules,
}

export type ContactHoursRules = z.infer<typeof contactHoursRules>

export function parsePolicyRules(kind: PolicyKind, rules: unknown) {
  const schema = POLICY_SCHEMAS[kind]
  if (!schema) throw new Error(`Unknown policy kind ${kind}`)
  return schema.safeParse(rules)
}
