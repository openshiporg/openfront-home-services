import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { anyOf, sys } from '../access'
import { fixedChoice, geo, lifecycle, minor, qty, readOnly, systemText, versionField } from './domainFields'
import { governed, immutable, managed } from './listAccess'
import { jobFilter, officeOrTech, scoped, visitFilter } from './scope'
import { trackingFields } from './trackingFields'

/* Jobs & dispatch (SCHEMA §6). A Job is the work order; a Visit is one trip with an arrival window. */

export const JOB_STATUSES = ['draft', 'booked', 'scheduled', 'in_progress', 'on_hold', 'work_complete', 'awaiting_inspection', 'completed', 'closed', 'cancelled'] as const
export const JOB_HOLD_REASONS = ['', 'parts', 'customer_decision', 'financing', 'permit', 'authorization', 'access', 'other'] as const
export const JOB_CANCEL_REASONS = ['', 'customer_request', 'duplicate', 'no_access', 'out_of_area', 'scheduling', 'weather', 'other'] as const

export const Job = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: anyOf('canBook', 'canDispatch'), delete: sys },
    filter: { query: scoped(userId => jobFilter(userId)) },
  },
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'jobType', 'priority', 'status', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    publicCode: systemText({ indexed: 'unique', required: true }),
    customer: relationship({ ref: 'Customer.jobs', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation.jobs', ...readOnly }),
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    jobType: relationship({ ref: 'JobType', ...readOnly }),
    priority: fixedChoice(['emergency', 'urgent', 'standard', 'maintenance']),
    status: lifecycle(JOB_STATUSES),
    statusBeforeHold: systemText(),
    holdReason: fixedChoice(JOB_HOLD_REASONS),
    holdFollowUpOn: calendarDay({ ...readOnly }),
    cancelReason: fixedChoice(JOB_CANCEL_REASONS),
    summary: text({ ui: { description: 'What the customer reported, in their words.' } }),
    source: fixedChoice(['csr', 'online', 'ai_agent', 'tech_generated', 'membership', 'import']),
    lead: relationship({ ref: 'Lead', ...readOnly }),
    recallOf: relationship({ ref: 'Job', ...readOnly }),
    payers: relationship({ ref: 'JobPayer.job', many: true, ...readOnly }),
    poNumber: text(),
    nteMinor: minor({ description: 'Not-to-exceed authorised by the payer, in cents.' }),
    visits: relationship({ ref: 'Visit.job', many: true, ...readOnly }),
    workLines: relationship({ ref: 'WorkLine.job', many: true, ...readOnly }),
    bookedBy: relationship({ ref: 'User', ...readOnly }),
    bookedByAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    tags: relationship({ ref: 'Tag', many: true }),
    completedAt: timestamp({ ...readOnly }),
    closedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const JobPayer = list({
  access: governed(['canBook', 'canDispatch', 'canManageInvoices']),
  ui: { labelField: 'payerKind' },
  fields: {
    job: relationship({ ref: 'Job.payers', ...readOnly }),
    payerKind: fixedChoice(['customer', 'home_warranty', 'commercial_payer', 'manufacturer']),
    payerCustomer: relationship({ ref: 'Customer', ...readOnly }),
    authorizationRef: systemText(),
    sharePolicy: fixedChoice(['all', 'up_to_authorized', 'specific_lines']),
    ...trackingFields,
  },
})

export const VISIT_STATUSES = ['unassigned', 'scheduled', 'dispatched', 'en_route', 'on_site', 'working', 'paused', 'done', 'cancelled', 'no_access'] as const

export const Visit = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(visitFilter) },
  },
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'job', 'window', 'plannedStart', 'status'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    job: relationship({ ref: 'Job.visits', ...readOnly }),
    window: relationship({ ref: 'ArrivalWindow', ...readOnly }),
    plannedStart: timestamp({ ...readOnly }),
    plannedDurationMinutes: integer({ ...readOnly }),
    capacityHours: qty({ required: true }),
    status: lifecycle(VISIT_STATUSES),
    cancelReason: systemText(),
    assignments: relationship({ ref: 'VisitAssignment.visit', many: true, ...readOnly }),
    statusEvents: relationship({ ref: 'VisitStatusEvent.visit', many: true, ...readOnly }),
    actualArrivalAt: timestamp({ ...readOnly }),
    actualDoneAt: timestamp({ ...readOnly }),
    etaMinutes: integer({ ...readOnly }),
    customerSummaryDraft: systemText(),
    needsReview: checkbox({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: 'An out-of-order device event arrived; a dispatcher should look (I-D3).' } }),
    version: versionField(),
    ...trackingFields,
  },
})

export const VisitAssignment = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(userId => ({ employee: { user: { id: { equals: userId } } } })) },
  },
  ui: { labelField: 'role', listView: { initialColumns: ['visit', 'employee', 'role', 'active', 'assignedAt'] } },
  fields: {
    visit: relationship({ ref: 'Visit.assignments', ...readOnly }),
    employee: relationship({ ref: 'Employee', ...readOnly }),
    role: fixedChoice(['lead', 'helper', 'sales', 'apprentice']),
    assignedAt: timestamp({ ...readOnly }),
    assignedBy: relationship({ ref: 'User', ...readOnly }),
    assignedByAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    recommendation: relationship({ ref: 'DispatchRecommendation', ...readOnly }),
    overrideReason: fixedChoice(['', 'customer_request', 'skill', 'continuity', 'geography', 'fairness', 'other']),
    eligibility: relationship({ ref: 'EligibilityEvaluation', ...readOnly }),
    active: checkbox({ defaultValue: true, ...readOnly }),
    endedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

/** Append-only visit status history (I-D3). Offline device events carry their own idempotency key. */
export const VisitStatusEvent = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(userId => ({ visit: visitFilter(userId) })) },
  },
  ui: { labelField: 'toStatus', listView: { initialColumns: ['visit', 'fromStatus', 'toStatus', 'kind', 'occurredAt', 'clientRecordedAt'] } },
  fields: {
    visit: relationship({ ref: 'Visit.statusEvents', ...readOnly }),
    employee: relationship({ ref: 'Employee', ...readOnly }),
    actorUser: relationship({ ref: 'User', ...readOnly }),
    fromStatus: systemText({ required: true }),
    toStatus: systemText({ required: true }),
    kind: fixedChoice(['transition', 'correction']),
    occurredAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    clientRecordedAt: timestamp({ ...readOnly }),
    idempotencyKey: systemText({ indexed: 'unique', required: true }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    deviceId: systemText(),
    note: systemText(),
    ...trackingFields,
  },
})

/** A ranked list of candidate techs with stored reasons. Immutable except the decision (I-D4). */
export const DispatchRecommendation = list({
  access: immutable(['canDispatch', 'canViewBoard']),
  ui: { labelField: 'decision', listView: { initialColumns: ['visit', 'decision', 'modelRef', 'createdAt'] } },
  fields: {
    visit: relationship({ ref: 'Visit', ...readOnly }),
    rankedCandidates: json({ ...readOnly }),
    inputsHash: systemText({ required: true }),
    features: json({ ...readOnly, ui: { ...readOnly.ui, description: 'The scoring features used. Revenue prediction is not one of them until reviewed.' } }),
    modelRef: systemText({ required: true }),
    generatedBy: relationship({ ref: 'AgentIdentity', ...readOnly }),
    requestedBy: relationship({ ref: 'User', ...readOnly }),
    decision: lifecycle(['proposed', 'applied', 'overridden', 'expired']),
    decidedBy: relationship({ ref: 'User', ...readOnly }),
    decidedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const ChecklistTemplate = list({
  access: managed('signedIn', ['canManageCompany', 'canDispatch']),
  ui: { labelField: 'name' },
  fields: {
    name: text({ validation: { isRequired: true } }),
    items: json({ defaultValue: [], ui: { description: '[{"key":"static_pressure","label":"Total static pressure","type":"reading","unit":"inWC","required":true}]' } }),
    templateVersion: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    required: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const ChecklistResponse = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(userId => ({ visit: visitFilter(userId) })) },
  },
  ui: { labelField: 'completedAt' },
  fields: {
    visit: relationship({ ref: 'Visit', ...readOnly }),
    template: relationship({ ref: 'ChecklistTemplate', ...readOnly }),
    templateVersion: integer({ ...readOnly }),
    answers: json({ ...readOnly }),
    completedBy: relationship({ ref: 'User', ...readOnly }),
    completedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

/** What was done or is to be billed. Pricing arrives with the price book (Phase 2); quantities are exact. */
export const WorkLine = list({
  access: {
    operation: { query: officeOrTech(['canManageInvoices']), create: sys, update: sys, delete: sys },
    filter: { query: scoped(userId => ({ job: jobFilter(userId) }), ['canManageInvoices']) },
  },
  ui: { labelField: 'description', listView: { initialColumns: ['job', 'description', 'quantity', 'unitPriceMinor', 'amountMinor', 'status'] } },
  fields: {
    job: relationship({ ref: 'Job.workLines', ...readOnly }),
    source: fixedChoice(['estimate_line', 'pricebook', 'manual', 'change_order', 'membership_benefit']),
    description: systemText({ required: true }),
    snapshot: json({ ...readOnly }),
    quantity: qty({ required: true }),
    uom: systemText(),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    taxCategory: fixedChoice(['labor', 'material', 'equipment', 'fee', 'disposal', 'permit_passthrough', 'warranty_reimbursed', 'membership', 'maintenance']),
    trade: fixedChoice(['hvac', 'plumbing', 'electrical', 'general']),
    cancellationClass: fixedChoice(['requested_repair', 'necessary_replacement_parts', 'additional_goods_services']),
    status: lifecycle(['planned', 'completed', 'removed', 'cancelled_by_buyer']),
    estimateLine: relationship({ ref: 'EstimateLine', ...readOnly }),
    changeOrder: relationship({ ref: 'ChangeOrder', ...readOnly }),
    cancellationNotices: relationship({ ref: 'CancellationNotice.coveredWorkLines', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
