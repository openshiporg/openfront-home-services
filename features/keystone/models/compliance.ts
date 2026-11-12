import { list } from '@keystone-6/core'
import { calendarDay, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { fixedChoice, lifecycle, minor, qty, rate, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { jobFilter } from './scope'
import { rowAccess } from './fieldAccess'
import { trackingFields } from './trackingFields'

/*
 * Permits, inspections, refrigerant records and lien clocks (SCHEMA §13.2-13.4, STATE-MACHINES §14-15). Refrigerant log entries are
 * append-only (database trigger) and every one names a technician credential: an EPA 608 credential that is verified and unexpired on
 * the day. A permit or inspection that is not closed holds a job in awaiting_inspection; it never lets it reach completed.
 * Lien deadlines are worked out from the policy pack's month-based clock when a page reads them; nothing is filed or sent.
 */

export const PERMIT_STATUSES = ['needed', 'applied', 'issued', 'closed', 'not_required', 'rejected'] as const
export const INSPECTION_STATUSES = ['requested', 'scheduled', 'passed', 'failed', 'cancelled'] as const
export const REFRIGERANT_KINDS = ['charge', 'recover', 'transfer', 'reclaim_shipment', 'disposal_verification'] as const
export const CYLINDER_STATUSES = ['in_service', 'full_recovery', 'sent_reclaim', 'empty', 'retired'] as const
export const LEAK_STATUSES = ['open', 'repair_due', 'repaired_verified', 'retrofit_plan', 'retired', 'not_applicable'] as const
export const LIEN_STATUSES = ['monitoring', 'notice_sent', 'affidavit_filed', 'released', 'abandoned'] as const

const PERMIT_OFFICE = ['canManagePermits', 'canDispatch', 'canManageInvoices', 'canViewBoard'] as const
const REFRIGERANT_OFFICE = ['canManageRefrigerant', 'canDispatch', 'canManageEquipment'] as const
const myJob = (userId: string) => ({ job: jobFilter(userId) })
const LIEN_READ = ['canManageInvoices', 'canManageAccounting', 'canPostInvoices'] as const

export const Permit = list({
  access: rowAccess(PERMIT_OFFICE, myJob),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'job', 'ahj', 'permitType', 'status', 'externalNumber', 'expiresOn'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    job: relationship({ ref: 'Job' }),
    ahj: text(),
    permitType: text(),
    externalNumber: systemText(),
    status: lifecycle(PERMIT_STATUSES),
    feeMinor: minor({ defaultValue: 0n }),
    appliedOn: calendarDay(),
    issuedOn: calendarDay(),
    expiresOn: calendarDay(),
    documents: relationship({ ref: 'Document', many: true }),
    note: systemText(),
    inspections: relationship({ ref: 'Inspection.permit', many: true }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Inspection = list({
  access: rowAccess(PERMIT_OFFICE, u => ({ permit: myJob(u) })),
  ui: { labelField: 'kind', listView: { initialColumns: ['permit', 'kind', 'status', 'scheduledFor', 'inspectorName'] } },
  fields: {
    permit: relationship({ ref: 'Permit.inspections' }),
    kind: text({ validation: { isRequired: true } }),
    status: lifecycle(INSPECTION_STATUSES),
    scheduledFor: timestamp(),
    inspectorName: text(),
    result: json({ isFilterable: false, isOrderable: false } as never),
    correctionsVisit: relationship({ ref: 'Visit' }),
    report: relationship({ ref: 'Document' }),
    version: versionField(),
    ...trackingFields,
  },
})

export const RefrigerantCylinder = list({
  access: rowAccess(REFRIGERANT_OFFICE, userId => ({ location: { employee: { user: { id: { equals: userId } } } } })),
  ui: { labelField: 'serialOrTag', listView: { initialColumns: ['serialOrTag', 'refrigerantType', 'kind', 'location', 'tareLb', 'status'] } },
  fields: {
    item: relationship({ ref: 'Item' }),
    serialOrTag: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    refrigerantType: text({ validation: { isRequired: true } }),
    kind: fixedChoice(['virgin', 'recovery', 'reclaim'], 'virgin'),
    location: relationship({ ref: 'StockLocation' }),
    tareLb: qty(),
    status: lifecycle(CYLINDER_STATUSES),
    version: versionField(),
    ...trackingFields,
  },
})

/** Append-only (database trigger). */
export const RefrigerantLogEntry = list({
  access: rowAccess(REFRIGERANT_OFFICE, userId => ({ technician: { user: { id: { equals: userId } } } })),
  ui: { labelField: 'kind', listView: { initialColumns: ['occurredAt', 'kind', 'refrigerantType', 'quantityLb', 'equipment', 'job', 'technician', 'cylinder'] } },
  fields: {
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false }, isFilterable: false, isOrderable: false } as never),
    kind: fixedChoice(REFRIGERANT_KINDS, 'charge'),
    equipment: relationship({ ref: 'InstalledEquipment' }),
    job: relationship({ ref: 'Job' }),
    cylinder: relationship({ ref: 'RefrigerantCylinder' }),
    refrigerantType: text({ validation: { isRequired: true } }),
    quantityLb: qty({ required: true }),
    technician: relationship({ ref: 'Employee' }),
    credential: relationship({ ref: 'Credential' }),
    occurredAt: timestamp(),
    notes: text(),
    ...trackingFields,
  },
})

export const LeakRateEvaluation = list({
  access: rowAccess(REFRIGERANT_OFFICE),
  ui: { labelField: 'status', listView: { initialColumns: ['equipment', 'chargeLb', 'addedLb', 'leakRatePct', 'threshold', 'status', 'repairDueBy'] } },
  fields: {
    equipment: relationship({ ref: 'InstalledEquipment' }),
    chargeLb: qty(),
    addedLb: qty(),
    leakRatePct: rate(),
    threshold: rate(),
    status: lifecycle(LEAK_STATUSES),
    repairDueBy: calendarDay(),
    policyVersion: relationship({ ref: 'PolicyVersion' }),
    version: versionField(),
    ...trackingFields,
  },
})

/** Immutable: what the refrigerant policy said about a line when it was sold and again at completion. */
export const RefrigerantInstallCheck = list({
  access: rowAccess(REFRIGERANT_OFFICE),
  ui: { labelField: 'result', listView: { initialColumns: ['workLine', 'equipmentModel', 'stage', 'result'] } },
  fields: {
    workLine: relationship({ ref: 'WorkLine' }),
    equipmentModel: relationship({ ref: 'EquipmentModel' }),
    stage: fixedChoice(['sold', 'work_complete'], 'sold'),
    policyVersion: relationship({ ref: 'PolicyVersion' }),
    result: fixedChoice(['allowed', 'blocked', 'warning'], 'allowed'),
    findings: json({ isFilterable: false, isOrderable: false } as never),
    ...trackingFields,
  },
})

export const LienTrack = list({
  access: governed([...LIEN_READ]),
  ui: { labelField: 'status', listView: { initialColumns: ['invoice', 'job', 'completionMonth', 'noticeDueOn', 'affidavitDueOn', 'status'] } },
  fields: {
    invoice: relationship({ ref: 'Invoice' }),
    job: relationship({ ref: 'Job' }),
    policyVersion: relationship({ ref: 'PolicyVersion' }),
    completionMonth: calendarDay(),
    noticeDueOn: calendarDay(),
    affidavitDueOn: calendarDay(),
    status: lifecycle(LIEN_STATUSES),
    documents: relationship({ ref: 'Document', many: true }),
    note: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})
