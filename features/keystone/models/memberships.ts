import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { anyOf, sys } from '../access'
import { fixedChoice, lifecycle, minor, readOnly, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { jobFilter, officeOrTech, scoped } from './scope'
import { trackingFields } from './trackingFields'

/*
 * Memberships and service agreements (SCHEMA §10, STATE-MACHINES §10). Every write goes through a command
 * (services/memberships.ts, membershipBilling.ts); the generated API is read-only. There is no timer: seasons,
 * expiry, rollover and "due for service" are computed on read, and billing is a staff button.
 * Plan versions are immutable once active, terms never change after they end, entitlement entries and
 * billing attempts are append-only in the database (phase4_memberships migration).
 */

export const PLAN_VERSION_STATUSES = ['draft', 'active', 'retired'] as const
export const MEMBERSHIP_STATUSES = ['pending_payment', 'active', 'past_due', 'suspended', 'renewal_due', 'expired', 'cancelled', 'transferred'] as const
export const BILLING_FREQUENCIES = ['annual', 'monthly'] as const
export const ATTEMPT_STATUSES = ['queued', 'charging', 'succeeded', 'failed', 'unknown'] as const
export const ENTRY_KINDS = ['debit', 'restore', 'expire', 'rollover'] as const
export const SIGNUP_CHANNELS = ['office', 'field', 'phone', 'online'] as const

/** Staff who sell or manage memberships. */
const SELL = ['canSellMemberships', 'canManageMemberships'] as const
/** Staff who see the money behind them: billing runs, charge attempts, processor references. */
const BILLING = ['canManageMemberships', 'canManageInvoices', 'canManageAccounting'] as const

/** Sellers in the office see every membership; a technician only those of customers on their own jobs. */
const customerRows = (path: (own: Record<string, unknown>) => Record<string, unknown>) => ({
  operation: { query: officeOrTech([...SELL]), create: sys, update: sys, delete: sys },
  filter: { query: scoped(userId => path({ jobs: { some: jobFilter(userId, true) } }), [...SELL]) },
})

const billingOnly = anyOf(...BILLING)
/** Processor references and saved-card tokens: read, filter and order only by billing staff (a filter is a guessing oracle). */
const hidden = { access: { read: billingOnly, create: () => false, update: () => false }, isFilterable: billingOnly, isOrderable: billingOnly, ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } } }

export const MembershipPlan = list({
  access: governed([...SELL, 'canManagePriceBook']),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'code', 'status'] } },
  fields: {
    name: systemText({ required: true }),
    code: systemText({ indexed: 'unique', required: true }),
    description: systemText(),
    status: lifecycle(['active', 'retired']),
    versions: relationship({ ref: 'MembershipPlanVersion.plan', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const MembershipPlanVersion = list({
  access: governed([...SELL, 'canManagePriceBook']),
  ui: { labelField: 'label', listView: { initialColumns: ['plan', 'versionNumber', 'status', 'priceMinor', 'billingFrequency'] } },
  fields: {
    plan: relationship({ ref: 'MembershipPlan.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true }, ...readOnly }),
    label: systemText(),
    status: lifecycle(PLAN_VERSION_STATUSES),
    /** Price of one payment: the whole term when billed annually, one month when billed monthly. */
    priceMinor: minor({ defaultValue: 0n, access: { read: () => true } }),
    billingFrequency: fixedChoice(BILLING_FREQUENCIES, 'annual'),
    termMonths: integer({ defaultValue: 12, validation: { isRequired: true }, ...readOnly }),
    autoRenew: checkbox({ defaultValue: false, ...readOnly }),
    renewalNoticeDays: integer({ defaultValue: 30, validation: { isRequired: true }, ...readOnly }),
    /** [{ code, name, quantity, seasonStart: 'MM-DD'?, seasonEnd: 'MM-DD'?, rollover: 'none' | 'one_term' }] */
    entitlements: json({ ...readOnly }),
    /** [{ title, text }] the customer is promised besides visits (member prices, no trip fee, priority booking). */
    benefits: json({ ...readOnly }),
    cancellationRefundMethod: fixedChoice(['none', 'prorata', 'full_within_days'], 'none'),
    cancellationRefundDays: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    autoRenewalPolicyVersion: systemText(),
    consentWordingVersion: systemText(),
    consentWording: systemText(),
    activatedAt: timestamp({ ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

export const Membership = list({
  access: customerRows(own => ({ customer: own })),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'plan', 'status', 'startsOn'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    publicCode: systemText({ indexed: 'unique', required: true }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    plan: relationship({ ref: 'MembershipPlan', ...readOnly }),
    planVersion: relationship({ ref: 'MembershipPlanVersion', ...readOnly }),
    status: lifecycle(MEMBERSHIP_STATUSES, 'pending_payment'),
    startsOn: calendarDay({ ...readOnly }),
    terms: relationship({ ref: 'MembershipTerm.membership', many: true, ...readOnly }),
    paymentMethodRef: text({ ...hidden }),
    paymentMethodLabel: systemText(),
    autoRenew: checkbox({ defaultValue: false, ...readOnly }),
    autoRenewConsent: relationship({ ref: 'ConsentRecord', ...readOnly }),
    signupChannel: fixedChoice(SIGNUP_CHANNELS, 'office'),
    soldBy: relationship({ ref: 'User', ...readOnly }),
    transferredTo: relationship({ ref: 'Membership', ...readOnly }),
    cancelledAt: timestamp({ ...readOnly }),
    cancelReason: systemText(),
    cancelEffectiveOn: calendarDay({ ...readOnly }),
    refundOwedMinor: minor({ defaultValue: 0n, access: { read: billingOnly } }),
    version: versionField(),
    ...trackingFields,
  },
})

export const MembershipTerm = list({
  access: customerRows(own => ({ membership: { customer: own } })),
  ui: { labelField: 'termKey', listView: { initialColumns: ['membership', 'termNumber', 'startsOn', 'endsOn', 'status'] } },
  fields: {
    termKey: systemText({ indexed: 'unique', required: true }),
    membership: relationship({ ref: 'Membership.terms', ...readOnly }),
    termNumber: integer({ validation: { isRequired: true }, ...readOnly }),
    planVersion: relationship({ ref: 'MembershipPlanVersion', ...readOnly }),
    startsOn: calendarDay({ ...readOnly }),
    endsOn: calendarDay({ ...readOnly }),
    billingFrequency: fixedChoice(BILLING_FREQUENCIES, 'annual'),
    priceMinor: minor({ defaultValue: 0n, access: { read: () => true } }),
    slots: integer({ defaultValue: 1, validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(['active', 'cancelled']),
    grants: relationship({ ref: 'EntitlementGrant.term', many: true, ...readOnly }),
    ...trackingFields,
  },
})

export const EntitlementGrant = list({
  access: customerRows(own => ({ membership: { customer: own } })),
  ui: { labelField: 'grantKey', listView: { initialColumns: ['membership', 'name', 'quantity', 'windowStart', 'windowEnd'] } },
  fields: {
    grantKey: systemText({ indexed: 'unique', required: true }),
    membership: relationship({ ref: 'Membership', ...readOnly }),
    term: relationship({ ref: 'MembershipTerm.grants', ...readOnly }),
    code: systemText({ required: true }),
    name: systemText({ required: true }),
    quantity: integer({ validation: { isRequired: true }, ...readOnly }),
    windowStart: calendarDay({ ...readOnly }),
    windowEnd: calendarDay({ ...readOnly }),
    rolloverPolicy: fixedChoice(['none', 'one_term'], 'none'),
    entries: relationship({ ref: 'EntitlementEntry.grant', many: true, ...readOnly }),
    ...trackingFields,
  },
})

/** Append-only. A grant's balance is its quantity plus the sum of its entries, and the database refuses an entry that would take it below zero. */
export const EntitlementEntry = list({
  access: customerRows(own => ({ grant: { membership: { customer: own } } })),
  ui: { labelField: 'kind', listView: { initialColumns: ['grant', 'kind', 'quantity', 'occurredAt'] } },
  fields: {
    key: systemText({ indexed: 'unique', required: true }),
    grant: relationship({ ref: 'EntitlementGrant.entries', ...readOnly }),
    kind: fixedChoice(ENTRY_KINDS, 'debit'),
    quantity: integer({ validation: { isRequired: true }, ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    reason: systemText(),
    occurredAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

/** A visit a member or agreement is owed, with the days it can happen. "Due" is computed from these days and today's date on every read. */
export const RecurringServiceEvent = list({
  access: customerRows(own => ({ OR: [{ membership: { customer: own } }, { agreement: { customer: own } }] })),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'membership', 'agreement', 'dueFrom', 'dueBy', 'status'] } },
  fields: {
    eventKey: systemText({ indexed: 'unique', required: true }),
    membership: relationship({ ref: 'Membership', ...readOnly }),
    agreement: relationship({ ref: 'ServiceAgreement.events', ...readOnly }),
    grant: relationship({ ref: 'EntitlementGrant', ...readOnly }),
    code: systemText(),
    name: systemText({ required: true }),
    dueFrom: calendarDay({ ...readOnly }),
    dueBy: calendarDay({ ...readOnly }),
    status: lifecycle(['open', 'booked', 'skipped']),
    job: relationship({ ref: 'Job', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const MembershipBillingRun = list({
  access: governed([...BILLING]),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'period', 'status', 'chargedCount', 'failedCount', 'unknownCount'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    period: systemText({ required: true }),
    idempotencyKey: text({ ...hidden, isIndexed: 'unique' }),
    status: lifecycle(['running', 'completed']),
    queuedCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    chargedCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    failedCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    unknownCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    remainingCount: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    chargedMinor: minor({ defaultValue: 0n }),
    startedBy: relationship({ ref: 'User', ...readOnly }),
    startedAt: timestamp({ ...readOnly }),
    completedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

/** One row per membership, term and payment slot, whatever happens: a crash or a second click finds the row and carries on with it. */
export const MembershipBillingAttempt = list({
  access: governed([...BILLING]),
  ui: { labelField: 'attemptKey', listView: { initialColumns: ['membership', 'termNumber', 'slot', 'dueOn', 'amountMinor', 'status'] } },
  fields: {
    attemptKey: systemText({ indexed: 'unique', required: true }),
    membership: relationship({ ref: 'Membership', ...readOnly }),
    term: relationship({ ref: 'MembershipTerm', ...readOnly }),
    termNumber: integer({ validation: { isRequired: true }, ...readOnly }),
    slot: integer({ validation: { isRequired: true }, ...readOnly }),
    dueOn: calendarDay({ ...readOnly }),
    amountMinor: minor({ defaultValue: 0n }),
    status: lifecycle(ATTEMPT_STATUSES),
    /** Goes up by one only after the processor confirmed the last try failed; each generation has its own processor key. */
    generation: integer({ defaultValue: 1, validation: { isRequired: true }, ...readOnly }),
    providerKey: text({ ...hidden }),
    providerRef: text({ ...hidden }),
    failureNote: systemText(),
    run: relationship({ ref: 'MembershipBillingRun', ...readOnly }),
    invoice: relationship({ ref: 'Invoice', ...readOnly }),
    payment: relationship({ ref: 'Payment', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** A record of who is coming up for renewal and what to tell them. Nothing is sent: staff copy the message or export the list. */
export const RenewalNotice = list({
  access: governed([...SELL]),
  ui: { labelField: 'noticeKey', listView: { initialColumns: ['membership', 'kind', 'dueOn', 'status'] } },
  fields: {
    noticeKey: systemText({ indexed: 'unique', required: true }),
    membership: relationship({ ref: 'Membership', ...readOnly }),
    term: relationship({ ref: 'MembershipTerm', ...readOnly }),
    kind: fixedChoice(['renewal_coming', 'auto_renew_reminder'], 'renewal_coming'),
    dueOn: calendarDay({ ...readOnly }),
    message: systemText(),
    status: lifecycle(['drafted', 'contacted', 'dismissed']),
    preparedBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

const AGREEMENT_PERMISSIONS = ['canManageMemberships', 'canManageInvoices', 'canManageAccounting', 'canBook', 'canDispatch'] as const
export const ServiceAgreement = list({
  access: governed([...AGREEMENT_PERMISSIONS]),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'name', 'customer', 'status', 'startsOn', 'endsOn'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    name: systemText({ required: true }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    payer: relationship({ ref: 'PayerProfile', ...readOnly }),
    status: lifecycle(['draft', 'active', 'ended']),
    startsOn: calendarDay({ ...readOnly }),
    endsOn: calendarDay({ ...readOnly }),
    scope: systemText(),
    /** Months of the year (01-12) a planned-maintenance visit is due. */
    visitMonths: json({ ...readOnly }),
    poNumber: text({ ...hidden }),
    nteMinor: minor({ defaultValue: 0n, access: { read: billingOnly } }),
    events: relationship({ ref: 'RecurringServiceEvent.agreement', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
