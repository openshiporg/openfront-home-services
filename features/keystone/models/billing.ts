import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { isSignedIn, sys, type Permission, type Session } from '../access'
import { fixedChoice, lifecycle, minor, qty, readOnly, systemText, versionField } from './domainFields'
import { governed, managed } from './listAccess'
import { jobFilter } from './scope'
import { trackingFields } from './trackingFields'
import { costOnly } from './costHidden'
import { TAX_CATEGORIES } from './sales'

/*
 * Billing, payments, financing and the accounting export (SCHEMA §8-9, SM§7-9, I-M1..I-M9). Every
 * write goes through a command (services/invoices.ts, payments.ts, credits.ts, financing.ts,
 * accounting.ts); the generated API is read-only. Posted invoices, allocations, AR entries and
 * customer-credit entries are frozen or append-only in the database (phase3_billing migration).
 */

export const INVOICE_STATUSES = ['draft', 'posted', 'partially_paid', 'paid', 'written_off', 'voided', 'discarded'] as const
export const COLLECTIONS_STATUSES = ['current', 'reminder_1', 'reminder_2', 'final_notice', 'collections_agency', 'lien_track', 'resolved'] as const
export const PAYER_KINDS = ['customer', 'home_warranty_company', 'property_manager', 'commercial', 'manufacturer', 'distributor'] as const
export const TERMS = ['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60'] as const
export const AR_KINDS = ['invoice_posted', 'payment_applied', 'payment_reversed', 'credit_memo', 'write_off', 'write_off_reversal', 'refund_reopen', 'dispute_withdrawal', 'dispute_reinstatement'] as const
export const FINANCING_STATUSES = ['started', 'submitted', 'approved', 'declined', 'needs_info', 'docs_signed', 'awaiting_funding', 'funded', 'cancelled', 'expired'] as const

type Args = { session?: Session | null }
const has = (session: Session | null | undefined, names: Permission[]) => names.some(name => session?.data?.role?.[name] === true)

/** People who run billing see every row. */
export const BILLING_OFFICE: Permission[] = [
  'canManageInvoices', 'canPostInvoices', 'canManagePayments', 'canIssueRefunds', 'canApproveWriteOff', 'canApproveCredits', 'canApproveRefunds', 'canManageAccounting', 'canCloseAr', 'canApproveArClose',
]
/** Counter staff who take payments and offer financing see billing rows too; a technician sees only their own jobs'. */
const COUNTER: Permission[] = ['canTakePayments', 'canOfferFinancing']

const billingQuery = ({ session }: Args) => isSignedIn({ session }) && (has(session, BILLING_OFFICE) || has(session, COUNTER))
const officeOnlyQuery = ({ session }: Args) => isSignedIn({ session }) && has(session, BILLING_OFFICE)

/** Rows that hang off a job: office sees all, counter staff all except a technician, who sees assigned jobs. */
const jobScoped = (path: (own: Record<string, unknown>) => Record<string, unknown>) => ({
  operation: { query: billingQuery, create: sys, update: sys, delete: sys },
  filter: {
    query: ({ session }: Args) => {
      if (!isSignedIn({ session })) return false
      if (has(session, BILLING_OFFICE)) return true
      if (has(session, ['canWorkVisits'])) return path(jobFilter(session!.itemId))
      return has(session, COUNTER) ? true : false
    },
  },
})
const invoiceRows = jobScoped(own => ({ job: own }))
const officeRows = { operation: { query: officeOnlyQuery, create: sys, update: sys, delete: sys } }

export const PayerProfile = list({
  access: managed(['canManageInvoices', 'canPostInvoices', 'canTakePayments', 'canManageAccounting'], 'canManageInvoices'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'kind', 'terms', 'poRequired', 'defaultNteMinor'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    kind: fixedChoice(PAYER_KINDS, 'commercial'),
    terms: fixedChoice(TERMS, 'net_30'),
    poRequired: checkbox({ defaultValue: false }),
    defaultNteMinor: minor({ description: 'Not-to-exceed on this payer\'s jobs unless the job sets its own, in cents.' }),
    portalUrl: text(),
    billingContact: text(),
    accountingCustomerRef: text({ ui: { description: 'The customer id in the accounting system, for the export.' } }),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const ThirdPartyAuthorization = list({
  access: jobScoped(own => ({ job: own })),
  ui: { labelField: 'externalRef', listView: { initialColumns: ['externalRef', 'job', 'payer', 'kind', 'authorizedAmountMinor', 'status'] } },
  fields: {
    job: relationship({ ref: 'Job', ...readOnly }),
    payer: relationship({ ref: 'PayerProfile', ...readOnly }),
    kind: fixedChoice(['home_warranty', 'po', 'nte', 'insurance'], 'po'),
    externalRef: systemText({ required: true }),
    authorizedAmountMinor: minor({ defaultValue: 0n }),
    serviceFeeMinor: minor({ defaultValue: 0n }),
    status: lifecycle(['requested', 'authorized', 'cash_out_offered', 'denied', 'consumed', 'expired', 'revised']),
    revisionOf: relationship({ ref: 'ThirdPartyAuthorization', ...readOnly }),
    evidence: relationship({ ref: 'Document', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const ArPeriod = list({
  access: governed(['canManageInvoices', 'canPostInvoices', 'canManageAccounting', 'canCloseAr', 'canApproveArClose']),
  ui: { labelField: 'month' },
  fields: {
    month: calendarDay({ isIndexed: 'unique', validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(['open', 'closing', 'closed']),
    closedBy: relationship({ ref: 'User', ...readOnly }),
    closedAt: timestamp({ ...readOnly }),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Invoice = list({
  access: invoiceRows,
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'status', 'invoiceDate', 'dueDate', 'totalMinor', 'balanceMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    publicCode: systemText({ indexed: 'unique', required: true }),
    job: relationship({ ref: 'Job', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    payer: relationship({ ref: 'PayerProfile', ...readOnly }),
    payerKind: fixedChoice(PAYER_KINDS, 'customer'),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    propertyClass: fixedChoice(['residential', 'nonresidential', 'multiple_use'], 'residential'),
    contractTaxMode: fixedChoice(['lump_sum', 'separated', 'not_applicable'], 'lump_sum'),
    taxResult: json({ ...readOnly }),
    status: lifecycle(INVOICE_STATUSES),
    invoiceDate: calendarDay({ ...readOnly }),
    dueDate: calendarDay({ ...readOnly }),
    arPeriod: relationship({ ref: 'ArPeriod', ...readOnly }),
    subtotalMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    taxMinor: minor({ defaultValue: 0n }),
    totalMinor: minor({ defaultValue: 0n }),
    balanceMinor: minor({ defaultValue: 0n }),
    poNumber: systemText(),
    authorization: relationship({ ref: 'ThirdPartyAuthorization', ...readOnly }),
    progressReason: systemText(),
    collectionsStatus: fixedChoice(COLLECTIONS_STATUSES, 'current'),
    snapshot: json({ ...readOnly }),
    pdf: relationship({ ref: 'Document', ...readOnly }),
    lines: relationship({ ref: 'InvoiceLine.invoice', many: true, ...readOnly }),
    allocations: relationship({ ref: 'PaymentAllocation.invoice', many: true, ...readOnly }),
    arEntries: relationship({ ref: 'ArEntry.invoice', many: true, ...readOnly }),
    creditMemos: relationship({ ref: 'CreditMemo.invoice', many: true, ...readOnly }),
    postedAt: timestamp({ ...readOnly }),
    postedBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const InvoiceLine = list({
  access: jobScoped(own => ({ invoice: { job: own } })),
  ui: { labelField: 'description', listView: { initialColumns: ['invoice', 'description', 'quantity', 'unitPriceMinor', 'amountMinor', 'taxMinor'] } },
  fields: {
    invoice: relationship({ ref: 'Invoice.lines', ...readOnly }),
    workLine: relationship({ ref: 'WorkLine', ...readOnly }),
    description: systemText({ required: true }),
    quantity: qty({ required: true, ...readOnly }),
    uom: systemText(),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    taxCategory: fixedChoice(TAX_CATEGORIES, 'labor'),
    taxable: checkbox({ defaultValue: false, ...readOnly }),
    taxBaseMinor: minor({ defaultValue: 0n }),
    taxRate: systemText(),
    taxMinor: minor({ defaultValue: 0n }),
    taxJurisdictions: json({ ...readOnly }),
    costMinor: minor({ defaultValue: 0n, ...costOnly }),
    revenueAccountCode: systemText(),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})

export const CreditMemo = list({
  access: jobScoped(own => ({ invoice: { job: own } })),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'invoice', 'reason', 'status', 'totalMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    invoice: relationship({ ref: 'Invoice.creditMemos', ...readOnly }),
    reason: fixedChoice(['pricing_error', 'goodwill', 'cancellation_right', 'warranty', 'recall', 'duplicate', 'other'], 'other'),
    note: systemText(),
    status: lifecycle(['draft', 'pending_approval', 'posted', 'applied', 'rejected']),
    totalMinor: minor({ defaultValue: 0n }),
    appliedToInvoiceMinor: minor({ defaultValue: 0n }),
    appliedToCreditMinor: minor({ defaultValue: 0n }),
    appliesTo: fixedChoice(['invoice_balance', 'customer_credit'], 'invoice_balance'),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    postedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const PaymentBatch = list({
  access: officeRows,
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'businessDate', 'tenderGroup', 'status', 'expectedMinor', 'depositedMinor', 'varianceMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    businessDate: calendarDay({ ...readOnly }),
    tenderGroup: fixedChoice(['card', 'ach', 'check_cash', 'financing', 'third_party'], 'card'),
    status: lifecycle(['open', 'closed', 'reconciled', 'exported']),
    expectedMinor: minor({ defaultValue: 0n }),
    depositedMinor: minor({ defaultValue: 0n }),
    feesMinor: minor({ defaultValue: 0n }),
    varianceMinor: minor({ defaultValue: 0n }),
    depositReference: systemText(),
    closedBy: relationship({ ref: 'User', ...readOnly }),
    closedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/**
 * A card or ACH try recorded by staff. If the outcome is not known (terminal timeout, a charge that may or may not have gone through)
 * it stays `unknown` and blocks another try on the same invoice until a person resolves it with evidence (I-M5).
 */
export const PaymentAttempt = list({
  access: officeRows,
  ui: { labelField: 'intentKey', listView: { initialColumns: ['intentKey', 'invoice', 'amountMinor', 'status', 'createdAt'] } },
  fields: {
    intentKey: systemText({ indexed: 'unique', required: true }),
    invoice: relationship({ ref: 'Invoice', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    amountMinor: minor({ required: true }),
    method: fixedChoice(['card', 'ach'], 'card'),
    status: lifecycle(['pending', 'succeeded', 'failed', 'unknown']),
    failureNote: systemText(),
    resolutionNote: systemText(),
    payment: relationship({ ref: 'Payment', ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** One application of a payment's money to an invoice (or, with no invoice, to the customer's credit). Immutable (I-M4). */
export const PaymentAllocation = list({
  access: officeRows,
  ui: { labelField: 'kind', listView: { initialColumns: ['payment', 'invoice', 'kind', 'amountMinor', 'createdAt'] } },
  fields: {
    payment: relationship({ ref: 'Payment', ...readOnly }),
    invoice: relationship({ ref: 'Invoice.allocations', ...readOnly }),
    kind: fixedChoice(['apply', 'reverse'], 'apply'),
    reverses: relationship({ ref: 'PaymentAllocation', ...readOnly }),
    amountMinor: minor({ required: true }),
    reason: systemText(),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

export const Dispute = list({
  access: officeRows,
  ui: { labelField: 'providerDisputeId', listView: { initialColumns: ['providerDisputeId', 'payment', 'amountMinor', 'status', 'evidenceDueBy'] } },
  fields: {
    payment: relationship({ ref: 'Payment', ...readOnly }),
    providerDisputeId: systemText({ indexed: 'unique', required: true }),
    amountMinor: minor({ required: true }),
    reasonCode: systemText(),
    status: lifecycle(['opened', 'evidence_due', 'evidence_submitted', 'won', 'lost']),
    evidenceDueBy: timestamp({ ...readOnly }),
    note: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})

/** The receivable sub-ledger (I-M3, I-M8): signed amounts, append-only. Invoice.balanceMinor is the sum, checked by a trigger. */
export const ArEntry = list({
  access: officeRows,
  ui: { labelField: 'kind', listView: { initialColumns: ['invoice', 'kind', 'amountMinor', 'sourceType', 'postedAt'] } },
  fields: {
    invoice: relationship({ ref: 'Invoice.arEntries', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    payer: relationship({ ref: 'PayerProfile', ...readOnly }),
    kind: fixedChoice(AR_KINDS, 'invoice_posted'),
    amountMinor: minor({ required: true }),
    sourceType: systemText(),
    sourceId: systemText({ indexed: true }),
    arPeriod: relationship({ ref: 'ArPeriod', ...readOnly }),
    postedAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    note: systemText(),
    ...trackingFields,
  },
})

export const CustomerCreditEntry = list({
  access: officeRows,
  ui: { labelField: 'kind', listView: { initialColumns: ['customer', 'kind', 'amountMinor', 'sourceType', 'createdAt'] } },
  fields: {
    customer: relationship({ ref: 'Customer', ...readOnly }),
    kind: fixedChoice(['issued', 'applied', 'refunded', 'expired'], 'issued'),
    amountMinor: minor({ required: true, description: 'Signed: issued is positive, the others reduce the balance.' }),
    sourceType: systemText(),
    sourceId: systemText({ indexed: true }),
    ...trackingFields,
  },
})

// ── Financing: a record of a third-party offer (SM§9, I-F1..I-F3). No lender integration. ──

export const FinancingProgram = list({
  access: managed(['canOfferFinancing', 'canManageInvoices', 'canTakePayments'], ['canManageInvoices', 'canManageAccounting']),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'partner', 'minMinor', 'maxMinor', 'active'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    partner: fixedChoice(['wisetack', 'other'], 'wisetack'),
    minMinor: minor({ defaultValue: 50000n }),
    maxMinor: minor({ defaultValue: 2500000n }),
    termsNote: text({ ui: { displayMode: 'textarea', description: 'As the partner publishes it. We do not compute or promise rates.' } }),
    applyUrl: text({ ui: { description: 'The partner\'s hosted application link given to the customer.' } }),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const FinancingApplication = list({
  access: jobScoped(own => ({ job: own })),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'program', 'amountMinor', 'status'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    estimateVersion: relationship({ ref: 'EstimateVersion', ...readOnly }),
    invoice: relationship({ ref: 'Invoice', ...readOnly }),
    program: relationship({ ref: 'FinancingProgram', ...readOnly }),
    amountMinor: minor({ required: true }),
    status: lifecycle(FINANCING_STATUSES),
    consentRecordedAt: timestamp({ ...readOnly }),
    partnerReference: systemText(),
    offers: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Offers exactly as the partner gave them.' } }),
    selectedOffer: json({ ...readOnly }),
    offerExpiresAt: timestamp({ ...readOnly }),
    declineNote: systemText(),
    fundings: relationship({ ref: 'FinancingFunding.application', many: true, ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const FinancingFunding = list({
  access: officeRows,
  ui: { labelField: 'reference', listView: { initialColumns: ['application', 'grossMinor', 'feeMinor', 'fundedAt'] } },
  fields: {
    application: relationship({ ref: 'FinancingApplication.fundings', ...readOnly }),
    grossMinor: minor({ required: true }),
    feeMinor: minor({ defaultValue: 0n }),
    reference: systemText({ required: true }),
    fundedAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    payment: relationship({ ref: 'Payment', ...readOnly }),
    ...trackingFields,
  },
})

// ── Accounting export: idempotent batches, downloaded as CSV. ──

export const AccountingExportBatch = list({
  access: governed(['canManageAccounting', 'canCloseAr']),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'periodFrom', 'periodTo', 'lineCount', 'debitMinor', 'creditMinor', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    format: fixedChoice(['csv'], 'csv'),
    periodFrom: calendarDay({ ...readOnly }),
    periodTo: calendarDay({ ...readOnly }),
    status: lifecycle(['created', 'downloaded']),
    lineCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    debitMinor: minor({ defaultValue: 0n }),
    creditMinor: minor({ defaultValue: 0n }),
    sha256: systemText(),
    lines: relationship({ ref: 'AccountingExportLine.batch', many: true, ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const AccountingExportLine = list({
  access: governed(['canManageAccounting', 'canCloseAr']),
  ui: { labelField: 'memo', listView: { initialColumns: ['batch', 'entryDate', 'account', 'debitMinor', 'creditMinor', 'memo'] } },
  fields: {
    batch: relationship({ ref: 'AccountingExportBatch.lines', ...readOnly }),
    sourceKey: systemText({ indexed: 'unique', required: true }),
    entryDate: calendarDay({ ...readOnly }),
    account: systemText({ required: true }),
    debitMinor: minor({ defaultValue: 0n }),
    creditMinor: minor({ defaultValue: 0n }),
    memo: systemText(),
    docRef: systemText(),
    customerRef: systemText(),
    sortOrder: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})
