import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { isSignedIn, sys, type Permission, type Session } from '../access'
import { choice, fixedChoice, lifecycle, minor, qty, rate, readOnly, systemText, versionField } from './domainFields'
import { governed, managed } from './listAccess'
import { jobFilter, OFFICE_READ } from './scope'
import { trackingFields } from './trackingFields'

/*
 * Price book, estimates and cancellation rights (SCHEMA §7, SM§5-6, I-E1..I-E6). Every write goes
 * through a command (services/pricebook.ts, services/estimates.ts, services/cancellation.ts): the
 * generated API is read-only here. Published price-book rows, presented estimate versions,
 * authorizations and cancellation evaluations are frozen in the database too (phase2_guards).
 */

export const TRADE_OR_GENERAL = ['hvac', 'plumbing', 'electrical', 'general'] as const
export const TAX_CATEGORIES = ['labor', 'material', 'equipment', 'fee', 'disposal', 'permit_passthrough', 'warranty_reimbursed', 'membership', 'maintenance'] as const
export const CANCELLATION_CLASSES = ['requested_repair', 'necessary_replacement_parts', 'additional_goods_services'] as const
export const ITEM_KINDS = ['service_task', 'material', 'equipment', 'fee', 'discount', 'bundle'] as const
export const PRICEBOOK_STATUSES = ['draft', 'pending_approval', 'published', 'active', 'retired', 'discarded'] as const
export const ESTIMATE_STATUSES = ['draft', 'pending_approval', 'presented', 'sold', 'declined', 'expired', 'superseded', 'cancelled', 'discarded'] as const
export const NOTICE_STATUSES = ['issued', 'delivered', 'waived', 'cancelled_by_buyer', 'expired_uncancelled', 'refunded'] as const
export const DECLINE_REASONS = ['price', 'timing', 'chose_competitor', 'will_call_back', 'financing_declined', 'no_longer_needed', 'other'] as const
export const SALE_LOCATIONS = ['buyer_residence', 'other_non_merchant', 'merchant_place', 'remote'] as const

type Args = { session?: Session }
const has = (session: Session | undefined, names: Permission[]) => names.some(name => session?.data?.role?.[name] === true)

/** Price-book readers: office staff, sellers and the people who maintain or approve it. */
/** Internal cost (and so margin) is for whoever sets prices; technicians, CSRs and agent sessions never read it. */
const costRead = ({ session }: Args) => isSignedIn({ session }) && has(session, ['canManagePriceBook', 'canApprovePriceBook', 'canApproveDiscounts'])
const PRICEBOOK_READ: Permission[] = [...OFFICE_READ, 'canManagePriceBook', 'canApprovePriceBook', 'canPresentEstimates', 'canSellEstimates', 'canWorkVisits']

/** Sales readers: office staff and price-book/discount approvers see every estimate. */
const SALES_OFFICE: Permission[] = [...OFFICE_READ, 'canManagePriceBook', 'canApproveDiscounts', 'canApprovePolicies']

/** A technician sees estimates on jobs they are assigned to and the ones they presented (SCHEMA §19). */
const salesQuery = ({ session }: Args) => isSignedIn({ session }) && (has(session, SALES_OFFICE) || has(session, ['canWorkVisits', 'canPresentEstimates']))
const ownEstimates = (userId: string) => ({ OR: [{ job: jobFilter(userId) }, { presentedBy: { user: { id: { equals: userId } } } }] })
const salesFilter = (path: (own: Record<string, unknown>) => Record<string, unknown>) => ({ session }: Args) => {
  if (!isSignedIn({ session })) return false
  if (has(session, SALES_OFFICE)) return true
  if (has(session, ['canWorkVisits', 'canPresentEstimates'])) return path(ownEstimates(session!.itemId))
  return false
}
const salesAccess = (path: (own: Record<string, unknown>) => Record<string, unknown>) => ({
  operation: { query: salesQuery, create: sys, update: sys, delete: sys },
  filter: { query: salesFilter(path) },
})
// Rows that hang off a job directly: a tech sees them for jobs they are assigned to.
const jobRows = {
  operation: { query: salesQuery, create: sys, update: sys, delete: sys },
  filter: {
    query: ({ session }: Args) => {
      if (!isSignedIn({ session })) return false
      if (has(session, SALES_OFFICE)) return true
      if (has(session, ['canWorkVisits', 'canPresentEstimates'])) return { job: jobFilter(session!.itemId) }
      return false
    },
  },
}

// ── Reference data ────────────────────────────────────────────────────────────

export const UnitOfMeasure = list({
  access: managed('signedIn', 'canManagePriceBook'),
  ui: { labelField: 'code', listView: { initialColumns: ['code', 'name', 'kind', 'maxDecimals'] } },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^[a-z][a-z0-9_]{0,15}$/, explanation: 'Lower-case code like ea, ft, lb' } } }),
    name: text({ validation: { isRequired: true } }),
    kind: choice(['count', 'length', 'weight', 'volume', 'time', 'package'], 'count'),
    maxDecimals: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 4 }, ui: { description: 'How many decimal places a quantity may have (ea 0, ft 2, lb 2, hr 2).' } }),
    ...trackingFields,
  },
})

export const EquipmentModel = list({
  access: managed('signedIn', ['canManagePriceBook', 'canManageEquipment']),
  ui: { labelField: 'modelNumber', listView: { initialColumns: ['manufacturer', 'brand', 'modelNumber', 'kind', 'tonnage', 'refrigerantType'] } },
  fields: {
    manufacturer: text({ validation: { isRequired: true } }),
    brand: text(),
    modelNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    kind: choice(['ac_condenser', 'heat_pump', 'furnace', 'air_handler', 'coil', 'mini_split', 'water_heater_tank', 'water_heater_tankless', 'boiler', 'panel', 'generator', 'ev_charger', 'other'], 'other'),
    tonnage: qty(),
    btuh: integer({ validation: { min: 0 } }),
    efficiency: json({ defaultValue: {}, ui: { description: 'SEER2 / EER2 / HSPF2 / AFUE / UEF as decimal strings, e.g. {"seer2":"15.2"}.' } }),
    refrigerantType: text({ ui: { description: 'R-454B, R-32, R-410A…' } }),
    ahriRef: text(),
    warrantySummary: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

// ── Price book (SM§5) ─────────────────────────────────────────────────────────

export const PriceBook = list({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'code', 'activeVersion', 'currencyCode'] } },
  fields: {
    name: systemText({ required: true }),
    code: systemText({ indexed: 'unique', required: true }),
    currencyCode: systemText({ required: true }),
    businessUnits: relationship({ ref: 'BusinessUnit', many: true, ...readOnly }),
    activeVersion: relationship({ ref: 'PriceBookVersion', ...readOnly }),
    versions: relationship({ ref: 'PriceBookVersion.priceBook', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** One edition of the price book. Immutable once published (I-E1); one active per price book. */
export const PriceBookVersion = list({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: 'label', listView: { initialColumns: ['priceBook', 'versionNumber', 'status', 'effectiveAt', 'source'] } },
  fields: {
    priceBook: relationship({ ref: 'PriceBook.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    label: systemText({ required: true }),
    status: lifecycle(PRICEBOOK_STATUSES),
    source: fixedChoice(['manual', 'copy', 'supplier_import'], 'manual'),
    basedOn: relationship({ ref: 'PriceBookVersion', ...readOnly }),
    notes: systemText(),
    effectiveAt: timestamp({ ...readOnly }),
    contentHash: systemText(),
    diffReport: json({ ...readOnly }),
    costChangeReport: json({ ...readOnly, access: { ...readOnly.access, read: costRead } }),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    submittedBy: relationship({ ref: 'User', ...readOnly }),
    submittedAt: timestamp({ ...readOnly }),
    publishedBy: relationship({ ref: 'User', ...readOnly }),
    publishedAt: timestamp({ ...readOnly }),
    activatedAt: timestamp({ ...readOnly }),
    retiredAt: timestamp({ ...readOnly }),
    categories: relationship({ ref: 'PriceBookCategory.priceBookVersion', many: true, ...readOnly }),
    items: relationship({ ref: 'PriceBookItem.priceBookVersion', many: true, ...readOnly }),
    markupTables: relationship({ ref: 'MarkupTable.priceBookVersion', many: true, ...readOnly }),
    laborRates: relationship({ ref: 'LaborRate.priceBookVersion', many: true, ...readOnly }),
    memberPricingRules: relationship({ ref: 'MemberPricingRule.priceBookVersion', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const PriceBookCategory = list({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'categoryKey', 'trade', 'sortOrder', 'priceBookVersion'] } },
  fields: {
    priceBookVersion: relationship({ ref: 'PriceBookVersion.categories', ...readOnly }),
    categoryKey: systemText({ required: true }),
    name: systemText({ required: true }),
    trade: fixedChoice(TRADE_OR_GENERAL, 'general'),
    parentKey: systemText(),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})

/** A sellable row. itemKey is stable across versions; prices are frozen minor units at submit (D§4.2). */
export const PriceBookItem = list({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: 'name', listView: { initialColumns: ['itemKey', 'name', 'kind', 'trade', 'unitPriceMinor', 'priceBookVersion'] } },
  fields: {
    priceBookVersion: relationship({ ref: 'PriceBookVersion.items', ...readOnly }),
    itemKey: systemText({ indexed: true, required: true }),
    kind: fixedChoice(ITEM_KINDS, 'service_task'),
    categoryKey: systemText(),
    name: systemText({ required: true }),
    customerDescription: systemText(),
    internalNotes: systemText(),
    trade: fixedChoice(TRADE_OR_GENERAL, 'general'),
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    pricingMethod: fixedChoice(['fixed', 'formula'], 'fixed'),
    unitPriceMinor: minor({ defaultValue: 0n }),
    memberUnitPriceMinor: minor(),
    costMinor: minor({ defaultValue: 0n, access: { read: costRead } }),
    laborHours: qty({ ...readOnly }),
    uom: systemText({ required: true }),
    taxCategory: fixedChoice(TAX_CATEGORIES, 'labor'),
    warrantyText: systemText(),
    equipmentModel: relationship({ ref: 'EquipmentModel', ...readOnly }),
    materials: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Formula inputs and bill of materials: [{ itemKey, quantity }] of material items in the same version.' } }),
    commissionCode: systemText(),
    spiffCode: systemText(),
    cancellationClassDefault: fixedChoice(CANCELLATION_CLASSES, 'requested_repair'),
    ladderKey: systemText({ indexed: true }),
    tier: fixedChoice(['', 'good', 'better', 'best'], ''),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    active: checkbox({ defaultValue: true, ...readOnly }),
    ...trackingFields,
  },
})

export const MarkupTable = list({
  access: governed(['canManagePriceBook', 'canApprovePriceBook']),
  ui: { labelField: 'name' },
  fields: {
    priceBookVersion: relationship({ ref: 'PriceBookVersion.markupTables', ...readOnly }),
    name: systemText({ required: true }),
    appliesTo: fixedChoice(['material', 'equipment'], 'material'),
    tiers: json({ ...readOnly, ui: { ...readOnly.ui, description: '[{ fromCostMinor, toCostMinor | null, multiplier }]: cost in cents, multiplier a decimal string.' } }),
    ...trackingFields,
  },
})

export const LaborRate = list({
  access: governed(['canManagePriceBook', 'canApprovePriceBook']),
  ui: { labelField: 'hourlyMinor' },
  fields: {
    priceBookVersion: relationship({ ref: 'PriceBookVersion.laborRates', ...readOnly }),
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    hourlyMinor: minor({ required: true }),
    afterHoursMultiplier: rate({ ...readOnly }),
    ...trackingFields,
  },
})

/** Member pricing rows land with the price book; membership plans arrive in Phase 4 and refer to planCode. */
export const MemberPricingRule = list({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: 'planCode' },
  fields: {
    priceBookVersion: relationship({ ref: 'PriceBookVersion.memberPricingRules', ...readOnly }),
    planCode: systemText({ required: true }),
    scope: fixedChoice(['all', 'category', 'item'], 'all'),
    scopeKey: systemText(),
    discountBps: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 10_000 }, ...readOnly }),
    waiveTripFee: checkbox({ defaultValue: false, ...readOnly }),
    ...trackingFields,
  },
})

// ── Estimates (SM§6) ──────────────────────────────────────────────────────────

export const Estimate = list({
  access: salesAccess(own => own),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'job', 'status', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    publicCode: systemText({ indexed: 'unique', required: true }),
    title: systemText(),
    job: relationship({ ref: 'Job', ...readOnly }),
    opportunity: relationship({ ref: 'Opportunity', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    status: lifecycle(['open', 'sold', 'declined', 'expired', 'cancelled', 'discarded']),
    source: fixedChoice(['staff', 'technician', 'agent_draft', 'followup'], 'staff'),
    currentVersion: relationship({ ref: 'EstimateVersion', ...readOnly }),
    soldVersion: relationship({ ref: 'EstimateVersion', ...readOnly }),
    versions: relationship({ ref: 'EstimateVersion.estimate', many: true, ...readOnly }),
    presentedBy: relationship({ ref: 'Employee', ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    createdByAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** Immutable once presented (I-E3); a re-quote is vN+1 and supersedes vN. */
export const EstimateVersion = list({
  access: salesAccess(own => ({ estimate: own })),
  ui: { labelField: 'label', listView: { initialColumns: ['estimate', 'versionNumber', 'status', 'presentedAt', 'validUntil'] } },
  fields: {
    estimate: relationship({ ref: 'Estimate.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    label: systemText({ required: true }),
    status: lifecycle(ESTIMATE_STATUSES),
    priceBookVersion: relationship({ ref: 'PriceBookVersion', ...readOnly }),
    supersedes: relationship({ ref: 'EstimateVersion', ...readOnly }),
    discountBps: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 10_000 }, ...readOnly }),
    discountReason: systemText(),
    discountApproval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    notes: systemText(),
    presentedAt: timestamp({ ...readOnly }),
    presentedBy: relationship({ ref: 'User', ...readOnly }),
    presentedVia: fixedChoice(['', 'in_person', 'email', 'printed'], ''),
    validUntil: timestamp({ ...readOnly }),
    snapshot: json({ ...readOnly }),
    contentHash: systemText(),
    pdf: relationship({ ref: 'Document', ...readOnly }),
    options: relationship({ ref: 'EstimateOption.estimateVersion', many: true, ...readOnly }),
    soldOption: relationship({ ref: 'EstimateOption', ...readOnly }),
    authorization: relationship({ ref: 'Authorization', ...readOnly }),
    soldAt: timestamp({ ...readOnly }),
    depositRequiredMinor: minor({ defaultValue: 0n }),
    declineReason: fixedChoice(['', ...DECLINE_REASONS], ''),
    declineNote: systemText(),
    closedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const EstimateOption = list({
  access: salesAccess(own => ({ estimateVersion: { estimate: own } })),
  ui: { labelField: 'name', listView: { initialColumns: ['estimateVersion', 'tier', 'name', 'totalMinor'] } },
  fields: {
    estimateVersion: relationship({ ref: 'EstimateVersion.options', ...readOnly }),
    tier: fixedChoice(['good', 'better', 'best', 'single', 'custom'], 'single'),
    name: systemText({ required: true }),
    description: systemText(),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    subtotalMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    estimatedTaxMinor: minor({ defaultValue: 0n }),
    totalMinor: minor({ defaultValue: 0n }),
    monthlyPaymentDisplay: json({ ...readOnly }),
    contentHash: systemText(),
    lines: relationship({ ref: 'EstimateLine.option', many: true, ...readOnly }),
    ...trackingFields,
  },
})

/** A frozen copy of the price-book row at the time it was added (I-E2). */
export const EstimateLine = list({
  access: salesAccess(own => ({ option: { estimateVersion: { estimate: own } } })),
  ui: { labelField: 'description', listView: { initialColumns: ['option', 'description', 'quantity', 'unitPriceMinor', 'amountMinor', 'cancellationClass'] } },
  fields: {
    option: relationship({ ref: 'EstimateOption.lines', ...readOnly }),
    pricebookItem: relationship({ ref: 'PriceBookItem', ...readOnly }),
    itemKey: systemText(),
    snapshot: json({ ...readOnly }),
    description: systemText({ required: true }),
    quantity: qty({ required: true, ...readOnly }),
    uom: systemText({ required: true }),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    memberPriced: checkbox({ defaultValue: false, ...readOnly }),
    costMinor: minor({ defaultValue: 0n, access: { read: costRead } }),
    taxCategory: fixedChoice(TAX_CATEGORIES, 'labor'),
    trade: fixedChoice(TRADE_OR_GENERAL, 'general'),
    cancellationClass: fixedChoice(CANCELLATION_CLASSES, 'requested_repair'),
    isAddOn: checkbox({ defaultValue: false, ...readOnly }),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})

/** Evidence that the customer agreed: who, as what, how, when, where, and to exactly which lines. */
export const Authorization = list({
  access: jobRows,
  ui: { labelField: 'signerName', listView: { initialColumns: ['subjectType', 'signerName', 'method', 'location', 'authorizedAt'] } },
  fields: {
    subjectType: fixedChoice(['EstimateVersion', 'ChangeOrder'], 'EstimateVersion'),
    subjectId: systemText({ indexed: true, required: true }),
    job: relationship({ ref: 'Job', ...readOnly }),
    method: fixedChoice(['signature_on_device', 'portal_signature', 'verbal_recorded', 'written_paper', 'po_number'], 'signature_on_device'),
    signerName: systemText({ required: true }),
    signerContact: relationship({ ref: 'Contact', ...readOnly }),
    signerRole: fixedChoice(['owner', 'tenant', 'property_manager', 'other'], 'owner'),
    signature: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Signature strokes or typed name, as captured on the device.' } }),
    call: relationship({ ref: 'Call', ...readOnly }),
    poNumber: systemText(),
    ip: systemText(),
    userAgent: systemText(),
    location: fixedChoice(SALE_LOCATIONS, 'buyer_residence'),
    initiatedBy: fixedChoice(['customer_request', 'solicited'], 'customer_request'),
    selectedLineIds: json({ ...readOnly }),
    depositMinor: minor({ defaultValue: 0n }),
    contentHash: systemText({ required: true }),
    authorizedAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    recordedBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

/** The stored result of evaluating cancellation rights at a sale or change order (append-only). */
export const CancellationEvaluation = list({
  access: jobRows,
  ui: { labelField: 'governingRule', listView: { initialColumns: ['job', 'governingRule', 'rightApplies', 'evaluatedAt'] } },
  fields: {
    job: relationship({ ref: 'Job', ...readOnly }),
    authorization: relationship({ ref: 'Authorization', ...readOnly }),
    subjectType: fixedChoice(['EstimateVersion', 'ChangeOrder'], 'EstimateVersion'),
    subjectId: systemText({ indexed: true, required: true }),
    policyVersion: relationship({ ref: 'PolicyVersion', ...readOnly }),
    inputs: json({ ...readOnly }),
    results: json({ ...readOnly }),
    rightApplies: checkbox({ defaultValue: false, ...readOnly }),
    governingRule: systemText(),
    evaluatedAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})

export const CancellationNotice = list({
  access: jobRows,
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'job', 'rule', 'status', 'cancelBy'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    evaluation: relationship({ ref: 'CancellationEvaluation', ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    estimateVersion: relationship({ ref: 'EstimateVersion', ...readOnly }),
    changeOrder: relationship({ ref: 'ChangeOrder', ...readOnly }),
    rule: fixedChoice(['ftc_16cfr429', 'tx_bcc_601', 'other'], 'ftc_16cfr429'),
    rules: json({ ...readOnly }),
    policyVersion: relationship({ ref: 'PolicyVersion', ...readOnly }),
    noticeTemplate: systemText({ required: true }),
    language: systemText({ required: true }),
    coveredWorkLines: relationship({ ref: 'WorkLine.cancellationNotices', many: true, ...readOnly }),
    coveredAmountMinor: minor({ defaultValue: 0n }),
    transactionAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    cancelBy: timestamp({ validation: { isRequired: true }, ...readOnly }),
    timeZone: systemText({ required: true }),
    status: lifecycle(NOTICE_STATUSES),
    snapshot: json({ ...readOnly }),
    deliveryEvidence: json({ ...readOnly }),
    deliveredAt: timestamp({ ...readOnly }),
    noticeDocument: relationship({ ref: 'Document', ...readOnly }),
    waiverDocument: relationship({ ref: 'Document', ...readOnly }),
    cancelledAt: timestamp({ ...readOnly }),
    cancellationReceivedVia: fixedChoice(['', 'signed_form', 'mail', 'email', 'in_person', 'portal'], ''),
    refundDueBy: timestamp({ ...readOnly }),
    refundDueMinor: minor({ defaultValue: 0n }),
    refundEvidence: json({ ...readOnly }),
    startOverride: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** Adds or removes work after a sale; cancellation rights are re-evaluated for the added lines only. */
export const ChangeOrder = list({
  access: jobRows,
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'job', 'status', 'deltaMinor', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    job: relationship({ ref: 'Job', ...readOnly }),
    estimate: relationship({ ref: 'Estimate', ...readOnly }),
    priceBookVersion: relationship({ ref: 'PriceBookVersion', ...readOnly }),
    status: lifecycle(['draft', 'presented', 'approved', 'declined']),
    reason: systemText(),
    lines: json({ ...readOnly, ui: { ...readOnly.ui, description: '{ add: [frozen line snapshots], remove: [workLineId] }' } }),
    deltaMinor: minor({ defaultValue: 0n, description: 'Signed change to the sold price, in cents (removals are negative).' }),
    contentHash: systemText(),
    presentedAt: timestamp({ ...readOnly }),
    authorization: relationship({ ref: 'Authorization', ...readOnly }),
    cancellationEvaluation: relationship({ ref: 'CancellationEvaluation', ...readOnly }),
    decidedAt: timestamp({ ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
