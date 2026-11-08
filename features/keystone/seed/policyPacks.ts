import type { PolicyKind } from '../models/policy'

/*
 * The federal baseline and the US-TX packs (BUILD-PLAN §5; RESEARCH §12, §7.4). Every rule cites
 * its source. `verified` says whether the text was read at the source on the stated date; rules
 * marked unverified are conservative defaults and the Compliance screen shows them as such.
 * These are configuration: other states are added as packs, never code.
 */

export type PackSeed = {
  id: string
  code: string
  name: string
  kind: PolicyKind
  jurisdictionCode: string
  description: string
  binding: { id: string; scope: 'company' | 'state'; scopeValue: string; priority: number }
  version: PackVersionSeed
  /**
   * A later version of the same pack. Seeding closes the earlier version with effectiveTo (exclusive)
   * and adds this one, so past dates still resolve to the rules that were in effect then.
   */
  next?: PackVersionSeed & { versionNumber: number; reason: string }
}

type PackVersionSeed = { id: string; effectiveFrom: string; rules: unknown; sourceRefs: { ref: string; url?: string; verified: boolean; checkedOn?: string; note?: string }[] }

const ECFR_429 = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429'
const TX_601 = 'https://statutes.capitol.texas.gov/Docs/BC/htm/BC.601.htm'
const TX_1302 = 'https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1302.htm'
const TX_PROP_41 = 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.41.htm'
const TX_PROP_53 = 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.53.htm'

const FTC_RULE_TX = {
  code: 'ftc_cooling_off',
  title: 'FTC Cooling-Off Rule (16 CFR 429)',
  thresholdAtResidenceMinor: '2500', thresholdElsewhereMinor: '13000', thresholdComparison: 'at_least', businessDays: 3, calendar: 'US-FEDERAL',
  exclusions: [
    { code: 'retail_prior_negotiation', description: 'Prior negotiations at the seller\'s fixed retail location.', perLine: false },
    { code: 'tila_rescission', description: 'Truth in Lending rescission applies instead.', perLine: false },
    { code: 'emergency_waiver', description: 'Buyer-initiated emergency with a dated, signed, handwritten waiver.', perLine: false },
    { code: 'mail_or_phone_only', description: 'Entirely by mail or telephone.', perLine: false },
    { code: 'requested_repair', description: 'Requested repair or maintenance; additional goods or services are not excluded.', perLine: true },
  ],
  exemptions: [],
  emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
  noticeTemplate: 'ftc_429_notice_of_cancellation',
}
const TX_601_RULE = {
  code: 'tx_601',
  title: 'Texas home solicitation (Bus. & Com. Code ch. 601)',
  thresholdAtResidenceMinor: '2500', thresholdElsewhereMinor: '2500', thresholdComparison: 'more_than', businessDays: 3, calendar: 'US-FEDERAL',
  exclusions: [],
  exemptions: [{ code: 'tx_acr_consumer_initiated', trades: ['hvac'], when: 'consumer_initiated', except: ['breach_of_express_warranty', 'negligent_installation'] }],
  emergencyWaiver: { allowed: false, handwritten: true, signedAndDated: true },
  noticeTemplate: 'tx_601_notice_of_cancellation',
}
const TX_SOLICITATION_REFS = [
  { ref: '16 CFR 429.0-429.1', url: ECFR_429, verified: true, checkedOn: '2026-11-07' },
  { ref: 'Tex. Bus. & Com. Code §601.002 (scope: personally solicited away from the place of business; price over $25)', url: TX_601, verified: true, checkedOn: '2026-11-07' },
  { ref: 'Tex. Bus. & Com. Code §601.051 (cancel until midnight of the third business day after signing)', url: TX_601, verified: true, checkedOn: '2026-11-07' },
  { ref: 'Tex. Bus. & Com. Code §601.052 (receipt or contract in the language of the sale, with the bold 10-point statement and an attached notice of cancellation)', url: TX_601, verified: true, checkedOn: '2026-11-08' },
  { ref: 'Tex. Bus. & Com. Code ch. 601 "business day" definition', url: TX_601, verified: false, note: 'Section 601.001 defines no business day. The federal 16 CFR 429.0(f) calendar is used; verify before GA.' },
  { ref: 'Tex. Bus. & Com. Code §§601.003-601.004 (emergency waiver)', url: TX_601, verified: false, note: 'Not readable from the statutes mirrors. No Texas emergency waiver is honoured (fail closed) until verified.' },
  { ref: 'Tex. Occ. Code §1302.003 (ch. 601 does not apply to a consumer-initiated ACR transaction, except breach of express warranty or negligent installation)', url: TX_1302, verified: true, checkedOn: '2026-11-07' },
]

export const POLICY_PACKS: PackSeed[] = [
  {
    id: 'seed_pack_us_home_solicitation',
    code: 'us-federal-home-solicitation',
    name: 'FTC Cooling-Off Rule',
    kind: 'home_solicitation',
    jurisdictionCode: 'US',
    description: '16 CFR 429: three business days to cancel a door-to-door sale.',
    binding: { id: 'seed_binding_us_home_solicitation', scope: 'company', scopeValue: 'company', priority: 0 },
    version: {
      id: 'seed_policy_us_home_solicitation_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        rules: [{
          code: 'ftc_cooling_off',
          title: 'FTC Cooling-Off Rule (16 CFR 429)',
          thresholdAtResidenceMinor: '2500',
          thresholdElsewhereMinor: '13000',
          thresholdComparison: 'at_least',
          businessDays: 3,
          calendar: 'US-FEDERAL',
          exclusions: [
            { code: 'retail_prior_negotiation', description: 'Made under prior negotiations during the buyer\'s visit to the seller\'s fixed retail location.', perLine: false },
            { code: 'tila_rescission', description: 'The buyer already has a right of rescission under the Truth in Lending Act.', perLine: false },
            { code: 'emergency_waiver', description: 'Buyer-initiated, bona fide immediate personal emergency, with a separate dated, signed, handwritten waiver.', perLine: false },
            { code: 'mail_or_phone_only', description: 'Conducted and consummated entirely by mail or telephone, with no other contact before delivery or performance.', perLine: false },
            { code: 'requested_repair', description: 'Buyer-initiated visit requested for repair or maintenance of the buyer\'s property. Additional goods or services beyond replacement parts necessarily used are not excluded.', perLine: true },
          ],
          exemptions: [],
          emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
          noticeTemplate: 'ftc_429_notice_of_cancellation',
        }],
      },
      sourceRefs: [
        { ref: '16 CFR 429.0(a) (door-to-door sale; $25 at residence, $130 elsewhere; exclusions 1-6)', url: ECFR_429, verified: true, checkedOn: '2026-11-07' },
        { ref: '16 CFR 429.0(f) (business day: any calendar day except Sunday or any federal holiday)', url: ECFR_429, verified: true, checkedOn: '2026-11-07' },
        { ref: '16 CFR 429.1(a)-(b) (cancel before midnight of the third business day; notice of cancellation)', url: ECFR_429, verified: true, checkedOn: '2026-11-07' },
      ],
    },
  },
  {
    id: 'seed_pack_tx_home_solicitation',
    code: 'us-tx-home-solicitation',
    name: 'Texas home solicitation (Bus. & Com. Code ch. 601)',
    kind: 'home_solicitation',
    jurisdictionCode: 'US-TX',
    description: 'Federal rule plus Texas ch. 601, with the ACR exemption for consumer-initiated transactions (Occ. Code §1302.003).',
    binding: { id: 'seed_binding_tx_home_solicitation', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_home_solicitation_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        rules: [
          {
            code: 'ftc_cooling_off',
            title: 'FTC Cooling-Off Rule (16 CFR 429)',
            thresholdAtResidenceMinor: '2500', thresholdElsewhereMinor: '13000', thresholdComparison: 'at_least', businessDays: 3, calendar: 'US-FEDERAL',
            exclusions: [
              { code: 'retail_prior_negotiation', description: 'Prior negotiations at the seller\'s fixed retail location.', perLine: false },
              { code: 'tila_rescission', description: 'Truth in Lending rescission applies instead.', perLine: false },
              { code: 'emergency_waiver', description: 'Buyer-initiated emergency with a dated, signed, handwritten waiver.', perLine: false },
              { code: 'mail_or_phone_only', description: 'Entirely by mail or telephone.', perLine: false },
              { code: 'requested_repair', description: 'Requested repair or maintenance; additional goods or services are not excluded.', perLine: true },
            ],
            exemptions: [],
            emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
            noticeTemplate: 'ftc_429_notice_of_cancellation',
          },
          {
            code: 'tx_601',
            title: 'Texas home solicitation (Bus. & Com. Code ch. 601)',
            thresholdAtResidenceMinor: '2500', thresholdElsewhereMinor: '2500', thresholdComparison: 'more_than', businessDays: 3, calendar: 'US-FEDERAL',
            exclusions: [],
            exemptions: [{ code: 'tx_acr_consumer_initiated', trades: ['hvac'], when: 'consumer_initiated', except: ['breach_of_express_warranty', 'negligent_installation'] }],
            emergencyWaiver: { allowed: false, handwritten: true, signedAndDated: true },
            noticeTemplate: 'tx_601_notice_of_cancellation',
          },
        ],
      },
      sourceRefs: [
        { ref: '16 CFR 429.0-429.1', url: ECFR_429, verified: true, checkedOn: '2026-11-07' },
        { ref: 'Tex. Bus. & Com. Code §601.002 (scope: personally solicited away from the place of business; price over $25)', url: TX_601, verified: true, checkedOn: '2026-11-07' },
        { ref: 'Tex. Bus. & Com. Code §601.051 (cancel until midnight of the third business day after signing)', url: TX_601, verified: true, checkedOn: '2026-11-07' },
        { ref: 'Tex. Bus. & Com. Code ch. 601 "business day" definition', url: TX_601, verified: false, note: 'Not readable from the statutes site (script-rendered). The federal 16 CFR 429.0(f) calendar is used; verify the chapter 601 definition, and whether ch. 601 has an emergency waiver, before GA.' },
        { ref: 'Tex. Occ. Code §1302.003 (ch. 601 does not apply to a consumer-initiated ACR transaction, except breach of express warranty or negligent installation)', url: TX_1302, verified: true, checkedOn: '2026-11-07' },
      ],
    },
    next: {
      id: 'seed_policy_tx_home_solicitation_v2',
      versionNumber: 2,
      effectiveFrom: '2026-11-08',
      reason: 'Chapter 601 covers what the merchant personally solicited: on a visit the customer asked for, that is the work proposed on site, not the requested repair.',
      rules: { rules: [FTC_RULE_TX, { ...TX_601_RULE, scope: 'personal_solicitation', refundBusinessDays: 10 }] },
      sourceRefs: TX_SOLICITATION_REFS,
    },
  },
  {
    id: 'seed_pack_tx_home_improvement_contract',
    code: 'us-tx-home-improvement-contract',
    name: 'Texas residential construction contracts',
    kind: 'home_improvement_contract',
    jurisdictionCode: 'US-TX',
    description: 'What a Texas residential improvement contract must carry: the homestead warning, the lien-law disclosure and the contractor\'s licence.',
    binding: { id: 'seed_binding_tx_home_improvement_contract', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_home_improvement_contract_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        depositCapPct: null,
        depositCapMinor: null,
        requiredFields: ['contractor_name_address', 'contractor_license', 'scope_of_work', 'price', 'payment_terms', 'homestead_warning', 'lien_disclosure', 'cancellation_notice'],
        licenseDisplay: true,
      },
      sourceRefs: [
        { ref: 'Tex. Prop. Code §41.007(a) (homestead improvement contract: 10-point bold "IMPORTANT NOTICE: You and your contractor are responsible for meeting the terms and conditions of this contract…")', url: TX_PROP_41, verified: true, checkedOn: '2026-11-08' },
        { ref: 'Tex. Prop. Code §41.007(c)-(d) (an arbitration clause must be in 10-point bold or it is unenforceable)', url: TX_PROP_41, verified: true, checkedOn: '2026-11-08' },
        { ref: 'Tex. Prop. Code §53.001(8)-(10) (residence; residential construction contract)', url: TX_PROP_53, verified: true, checkedOn: '2026-11-08' },
        { ref: 'Tex. Prop. Code §53.255 (disclosure statement to the owner before a residential construction contract is executed)', url: TX_PROP_53, verified: true, checkedOn: '2026-11-08' },
        { ref: 'Texas deposit cap on residential repair and improvement', verified: false, note: 'No general statutory deposit cap was found for Texas residential repair; the pack sets none. Verify before GA; a cap is configuration (depositCapPct/depositCapMinor), not code.' },
        { ref: 'Tex. Occ. Code §1302.251 and 16 TAC §75.70 (ACR contractor licence number on contracts, invoices and advertising)', verified: false, note: 'Display rule carried as licenseDisplay; verify the exact text before GA.' },
      ],
    },
  },
  {
    id: 'seed_pack_us_contact_hours',
    code: 'us-federal-contact-hours',
    name: 'TCPA calling hours',
    kind: 'contact_hours',
    jurisdictionCode: 'US',
    description: '47 CFR 64.1200(c)(1): telephone solicitations only 8 a.m.-9 p.m. at the called party\'s location.',
    binding: { id: 'seed_binding_us_contact_hours', scope: 'company', scopeValue: 'company', priority: 0 },
    version: {
      id: 'seed_policy_us_contact_hours_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        purposes: ['solicitation', 'marketing', 'ai_voice_outbound'],
        basis: 'recipient_local_time',
        weekdays: { start: '08:00', end: '21:00' },
        saturday: { start: '08:00', end: '21:00' },
        sunday: { start: '08:00', end: '21:00' },
        exemptions: ['express_request', 'existing_contract'],
      },
      sourceRefs: [
        { ref: '47 CFR 64.1200(c)(1)', url: 'https://www.ecfr.gov/current/title-47/part-64/section-64.1200', verified: true, checkedOn: '2026-11-07' },
        { ref: 'FCC 24-17 (AI-generated voices are "artificial" under the TCPA)', url: 'https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf', verified: true, checkedOn: '2026-11-07' },
      ],
    },
  },
  {
    id: 'seed_pack_tx_contact_hours',
    code: 'us-tx-contact-hours',
    name: 'Texas telephone solicitation hours',
    kind: 'contact_hours',
    jurisdictionCode: 'US-TX',
    description: 'Bus. & Com. Code §301.051: 9 a.m.-9 p.m. weekdays and Saturdays; noon-9 p.m. Sundays.',
    binding: { id: 'seed_binding_tx_contact_hours', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_contact_hours_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        purposes: ['solicitation', 'marketing', 'ai_voice_outbound'],
        basis: 'recipient_local_time',
        weekdays: { start: '09:00', end: '21:00' },
        saturday: { start: '09:00', end: '21:00' },
        sunday: { start: '12:00', end: '21:00' },
        exemptions: ['express_request', 'existing_contract', 'prior_business_relationship'],
      },
      sourceRefs: [{ ref: 'Tex. Bus. & Com. Code §301.051', url: 'https://statutes.capitol.texas.gov/Docs/BC/htm/BC.301.htm', verified: true, checkedOn: '2026-11-07' }],
    },
  },
  {
    id: 'seed_pack_tx_call_recording',
    code: 'us-tx-call-recording',
    name: 'Texas call recording',
    kind: 'call_recording',
    jurisdictionCode: 'US-TX',
    description: 'One-party consent (Penal Code §16.02(c)(4)); the company discloses recording anyway.',
    binding: { id: 'seed_binding_tx_call_recording', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_call_recording_v1',
      effectiveFrom: '2026-01-01',
      rules: { consent: 'one_party', disclosureRequired: true, disclosureText: 'This call may be recorded for quality and training.' },
      sourceRefs: [
        { ref: 'Tex. Penal Code §16.02(c)(4)', url: 'https://statutes.capitol.texas.gov/Docs/PE/htm/PE.16.htm', verified: true, checkedOn: '2026-11-07' },
        { ref: 'Disclosure is company policy (callers may be in all-party-consent states)', verified: true, checkedOn: '2026-11-07' },
      ],
    },
  },
  {
    id: 'seed_pack_tx_sales_tax',
    code: 'us-tx-sales-tax',
    name: 'Texas sales tax on repair and remodeling',
    kind: 'sales_tax',
    jurisdictionCode: 'US-TX',
    description: '6.25% state plus up to 2% local; residential repair labour exempt; lump-sum vs separated contracts.',
    binding: { id: 'seed_binding_tx_sales_tax', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_sales_tax_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        engine: 'native_tables',
        stateRate: '0.0625',
        maxLocalRate: '0.02',
        localRates: [{ code: 'US-TX-AUSTIN', name: 'Austin combined local', rate: '0.02' }],
        matrix: [
          { propertyClass: 'residential', contractTaxMode: 'any', taxCategory: 'labor', taxable: false, basis: 'none', note: 'Residential repair/remodel labour is not taxable.' },
          { propertyClass: 'residential', contractTaxMode: 'lump_sum', taxCategory: 'any', taxable: false, basis: 'none', note: 'Contractor pays tax on materials when buying them.' },
          { propertyClass: 'residential', contractTaxMode: 'separated', taxCategory: 'material', taxable: true, basis: 'at_least_cost' },
          { propertyClass: 'residential', contractTaxMode: 'separated', taxCategory: 'equipment', taxable: true, basis: 'at_least_cost' },
          { propertyClass: 'nonresidential', contractTaxMode: 'any', taxCategory: 'maintenance', taxable: true, basis: 'price', note: 'Conservative default until the scheduled-periodic-maintenance exclusion is mapped against Rule 3.357.' },
          { propertyClass: 'nonresidential', contractTaxMode: 'any', taxCategory: 'any', taxable: true, basis: 'price' },
        ],
        rounding: 'per_invoice_jurisdiction',
      },
      sourceRefs: [
        { ref: 'Texas Comptroller, Sales and Use Tax (6.25% state; up to 2% local)', url: 'https://comptroller.texas.gov/taxes/sales/', verified: true, checkedOn: '2026-11-07' },
        { ref: 'Texas Comptroller Pub. 94-116, Real Property Repair and Remodeling', url: 'https://comptroller.texas.gov/taxes/publications/94-116.php', verified: true, checkedOn: '2026-11-07' },
        { ref: 'Texas Comptroller Pub. 96-259, Taxable Services (scheduled periodic maintenance excluded from nonresidential repair)', url: 'https://comptroller.texas.gov/taxes/publications/96-259.php', verified: true, checkedOn: '2026-11-07' },
        { ref: '34 TAC §3.357 mapping of maintenance categories', verified: false, note: 'Commercial maintenance is taxed until verified.' },
        { ref: 'Rounding method', verified: false, note: 'Per-invoice-per-jurisdiction rounding allocated back to lines; verify against Comptroller guidance.' },
      ],
    },
  },
  {
    id: 'seed_pack_tx_lien',
    code: 'us-tx-lien',
    name: 'Texas mechanic\'s liens (Prop. Code ch. 53)',
    kind: 'lien',
    jurisdictionCode: 'US-TX',
    description: 'Month-based deadlines: the 15th day of the Nth month after the work month.',
    binding: { id: 'seed_binding_tx_lien', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_lien_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        clocks: [
          { party: 'original_contractor', projectClass: 'residential', action: 'file_affidavit', kind: 'day_of_nth_month_after', monthsAfter: 3, dayOfMonth: 15, from: 'month_work_completed' },
          { party: 'original_contractor', projectClass: 'other', action: 'file_affidavit', kind: 'day_of_nth_month_after', monthsAfter: 4, dayOfMonth: 15, from: 'month_work_completed' },
          { party: 'derivative_claimant', projectClass: 'residential', action: 'notice_to_owner', kind: 'day_of_nth_month_after', monthsAfter: 2, dayOfMonth: 15, from: 'month_labor_or_materials_delivered' },
          { party: 'derivative_claimant', projectClass: 'other', action: 'notice_to_owner', kind: 'day_of_nth_month_after', monthsAfter: 3, dayOfMonth: 15, from: 'month_labor_or_materials_delivered' },
        ],
      },
      sourceRefs: [{ ref: 'Tex. Prop. Code §53.052, §53.056', url: 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.53.htm', verified: true, checkedOn: '2026-11-07' }],
    },
  },
  {
    id: 'seed_pack_tx_licensing',
    code: 'us-tx-licensing',
    name: 'Texas trade licensing',
    kind: 'licensing',
    jurisdictionCode: 'US-TX',
    description: 'ACR (TDLR, Occ. Code ch. 1302), plumbing (TSBPE, ch. 1301) and electrical (TDLR, ch. 1305) requirements by job tag.',
    binding: { id: 'seed_binding_tx_licensing', scope: 'state', scopeValue: 'US-TX', priority: 0 },
    version: {
      id: 'seed_policy_tx_licensing_v1',
      effectiveFrom: '2026-01-01',
      rules: {
        requirements: [
          { trade: 'hvac', jobTag: 'acr_service', companyLicense: { issuer: 'TDLR', classes: ['A', 'B'], endorsement: 'environmental_air' }, individual: { anyOf: ['tx_acr_certified_technician', 'tx_acr_registered_technician', 'tx_acr_contractor'], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: 'hvac', jobTag: 'acr_large_system', companyLicense: { issuer: 'TDLR', classes: ['A'], endorsement: 'environmental_air' }, individual: { anyOf: ['tx_acr_certified_technician', 'tx_acr_contractor'], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: 'hvac', jobTag: 'refrigerant_handling', companyLicense: null, individual: { anyOf: ['epa608_type_ii', 'epa608_universal'], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: 'plumbing', jobTag: 'plumbing_service', companyLicense: { issuer: 'TSBPE', classes: ['Responsible Master Plumber'], endorsement: null }, individual: { anyOf: ['tx_master_plumber', 'tx_journeyman_plumber', 'tx_tradesman_plumber', 'tx_plumber_apprentice'], supervisionBy: ['tx_master_plumber', 'tx_journeyman_plumber'] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: 'electrical', jobTag: 'electrical_service', companyLicense: { issuer: 'TDLR', classes: ['Electrical Contractor'], endorsement: null }, individual: { anyOf: ['tx_master_electrician', 'tx_journeyman_electrician', 'tx_residential_wireman', 'tx_electrical_apprentice'], supervisionBy: ['tx_master_electrician', 'tx_journeyman_electrician'] }, maxCoolingTons: null, maxHeatingBtuh: null },
        ],
      },
      sourceRefs: [
        { ref: 'Tex. Occ. Code §1302.251; TDLR ACR contractor classes A/B and endorsements', url: 'https://www.tdlr.texas.gov/acr/contractor-apply.htm', verified: true, checkedOn: '2026-11-07' },
        { ref: 'ACR Class B ceiling (25 tons cooling, 1.5M BTU/h heating)', url: 'https://www.tdlr.texas.gov/acr/contractor-apply.htm', verified: true, checkedOn: '2026-11-07', note: 'Class B jobs carry maxCoolingTons once job types record tonnage (Phase 1).' },
        { ref: 'Tex. Occ. Code §1301.351 (licence plus supervision; responsible master plumber)', url: 'https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1301.htm', verified: true, checkedOn: '2026-11-07' },
        { ref: 'Tex. Occ. Code §1305.151; TDLR electrician licence classes', url: 'https://www.tdlr.texas.gov/electricians/elec.htm', verified: true, checkedOn: '2026-11-07' },
        { ref: '16 TAC ch. 75 ACR technician supervision ratios', verified: false, note: 'Not yet encoded.' },
        { ref: '40 CFR 82.161 (EPA 608 technician certification)', verified: true, checkedOn: '2026-11-07' },
      ],
    },
  },
  {
    id: 'seed_pack_us_wage_hour',
    code: 'us-federal-wage-hour',
    name: 'FLSA overtime',
    kind: 'wage_hour',
    jurisdictionCode: 'US',
    description: 'Overtime after 40 hours in a fixed workweek at 1.5x the regular rate; Texas adds no daily overtime.',
    binding: { id: 'seed_binding_us_wage_hour', scope: 'company', scopeValue: 'company', priority: 0 },
    version: {
      id: 'seed_policy_us_wage_hour_v1',
      effectiveFrom: '2026-01-01',
      rules: { weeklyOvertimeHours: '40', dailyOvertimeHours: null, overtimeMultiplier: '1.5', workweekStartDay: 1, regularRateReview: true },
      sourceRefs: [
        { ref: '29 U.S.C. 207(a); 29 CFR 778.105 (fixed workweek)', url: 'https://www.ecfr.gov/current/title-29/part-778', verified: true, checkedOn: '2026-11-07' },
        { ref: '29 CFR 778.111, 778.117 (piece-rate and commission in the regular rate)', url: 'https://www.ecfr.gov/current/title-29/part-778', verified: true, checkedOn: '2026-11-07', note: 'v1 flags weeks with commission and overtime for review (regularRateReview).' },
      ],
    },
  },
]
