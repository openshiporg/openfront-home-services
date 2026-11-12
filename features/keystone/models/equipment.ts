import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, relationship, text, timestamp } from '@keystone-6/core/fields'
import { fixedChoice, lifecycle, minor, qty, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { jobFilter } from './scope'
import { rowAccess } from './fieldAccess'
import { trackingFields } from './trackingFields'

/*
 * Equipment and warranty (SCHEMA §11, STATE-MACHINES §11). Every write goes through a command (services/equipment.ts, warranty.ts);
 * the generated API is read-only. Nothing is sent to a manufacturer: a registration or claim is a record plus a packet staff copy into
 * the manufacturer's portal, and the manufacturer's own number is typed back in. Time (a registration deadline passing) is worked out
 * when a page or command touches it (advanceWarrantyStates), never by a timer.
 */

export const EQUIPMENT_STATUSES = ['active', 'replaced', 'removed', 'decommissioned'] as const
export const EQUIPMENT_KINDS = ['ac_condenser', 'heat_pump', 'furnace', 'air_handler', 'coil', 'mini_split', 'water_heater_tank', 'water_heater_tankless', 'boiler', 'panel', 'generator', 'ev_charger', 'other'] as const
export const APPLIANCE_CLASSES = ['residential_ac', 'light_commercial_ac', 'comfort_cooling', 'commercial_refrigeration', 'industrial_process', 'other'] as const
export const REGISTRATION_STATUSES = ['due', 'submitted', 'confirmed', 'overdue'] as const
export const CLAIM_STATUSES = ['draft', 'ready', 'submitted', 'info_requested', 'approved', 'partially_approved', 'denied', 'settled', 'closed'] as const
export const HOME_WARRANTY_STATUSES = ['dispatch_received', 'accepted', 'declined', 'auth_requested', 'authorized', 'cash_out_offered', 'denied', 'invoiced', 'paid'] as const

/** Anyone in the office who looks things up for a customer; technicians see only equipment at homes of their own jobs. */
export const EQUIPMENT_OFFICE = ['canDispatch', 'canViewBoard', 'canBook', 'canManageCustomers', 'canManageInvoices', 'canSubmitWarrantyClaims', 'canManageInventory'] as const
const WARRANTY_READ = ['canSubmitWarrantyClaims', 'canDispatch', 'canManageInvoices', 'canManageEquipment'] as const
const atMyJobs = (userId: string) => ({ location: { jobs: { some: jobFilter(userId, true) } } })

export const InstalledEquipment = list({
  access: rowAccess(EQUIPMENT_OFFICE, atMyJobs),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'location', 'manufacturer', 'modelNumber', 'serialNumber', 'kind', 'status'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    location: relationship({ ref: 'ServiceLocation' }),
    model: relationship({ ref: 'EquipmentModel' }),
    manufacturer: text(),
    modelNumber: text(),
    serialNumber: text({ isIndexed: true }),
    kind: fixedChoice(EQUIPMENT_KINDS, 'other'),
    applianceClass: fixedChoice(APPLIANCE_CLASSES, 'residential_ac'),
    tonnage: qty(),
    btuh: integer(),
    refrigerantType: text(),
    refrigerantChargeLb: qty(),
    manufactureDate: calendarDay(),
    installDate: calendarDay(),
    installedBy: relationship({ ref: 'Job' }),
    serializedUnit: relationship({ ref: 'SerializedUnit' }),
    status: lifecycle(EQUIPMENT_STATUSES),
    replacedBy: relationship({ ref: 'InstalledEquipment' }),
    locationInHome: text(),
    nameplatePhoto: relationship({ ref: 'Media' }),
    source: fixedChoice(['installed_by_us', 'recorded_on_visit', 'nameplate_scan', 'import'], 'recorded_on_visit'),
    version: versionField(),
    ...trackingFields,
  },
})

/** Append-only (database trigger): a reading is a fact about one moment. */
export const EquipmentReading = list({
  access: rowAccess(EQUIPMENT_OFFICE, u => ({ equipment: atMyJobs(u) })),
  ui: { labelField: 'kind', listView: { initialColumns: ['equipment', 'kind', 'value', 'unit', 'recordedAt'] } },
  fields: {
    equipment: relationship({ ref: 'InstalledEquipment' }),
    visit: relationship({ ref: 'Visit' }),
    kind: text({ validation: { isRequired: true } }),
    value: qty({ required: true }),
    unit: text(),
    recordedBy: relationship({ ref: 'User' }),
    recordedAt: timestamp(),
    ...trackingFields,
  },
})

export const WarrantyRule = list({
  access: governed([...WARRANTY_READ]),
  ui: { labelField: 'manufacturer', listView: { initialColumns: ['manufacturer', 'brand', 'registrationDeadlineDays', 'partsYearsRegistered', 'partsYearsUnregistered', 'laborYears', 'submitMethod'] } },
  fields: {
    manufacturer: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    brand: text(),
    registrationDeadlineDays: integer({ defaultValue: 90, validation: { isRequired: true } }),
    partsYearsRegistered: integer({ defaultValue: 10, validation: { isRequired: true } }),
    partsYearsUnregistered: integer({ defaultValue: 5, validation: { isRequired: true } }),
    laborYears: integer({ defaultValue: 1, validation: { isRequired: true } }),
    claimDeadlineDays: integer({ defaultValue: 60, validation: { isRequired: true } }),
    submitMethod: fixedChoice(['manual_portal', 'api', 'distributor'], 'manual_portal'),
    portalUrl: text(),
    /** The brand terms are the owner's to confirm; a rule is a starting point, not a quotation of the manufacturer's paper. */
    verified: checkbox({ defaultValue: false }),
    notes: text(),
    ...trackingFields,
  },
})

export const WarrantyCoverage = list({
  access: governed([...WARRANTY_READ]),
  ui: { labelField: 'kind', listView: { initialColumns: ['equipment', 'kind', 'startsOn', 'endsOn', 'provider'] } },
  fields: {
    equipment: relationship({ ref: 'InstalledEquipment' }),
    kind: fixedChoice(['manufacturer_parts', 'manufacturer_labor', 'extended', 'workmanship', 'home_warranty'], 'manufacturer_parts'),
    startsOn: calendarDay(),
    endsOn: calendarDay(),
    provider: text(),
    contractNumber: text(),
    document: relationship({ ref: 'Document' }),
    /** The registration this coverage was worked out from, if any. */
    registration: relationship({ ref: 'WarrantyRegistration' }),
    ...trackingFields,
  },
})

export const WarrantyRegistration = list({
  access: governed([...WARRANTY_READ]),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'equipment', 'deadline', 'status', 'confirmationNumber'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    equipment: relationship({ ref: 'InstalledEquipment' }),
    rule: relationship({ ref: 'WarrantyRule' }),
    deadline: calendarDay(),
    status: lifecycle(REGISTRATION_STATUSES),
    confirmationNumber: systemText(),
    submittedBy: relationship({ ref: 'User' }),
    submittedAt: timestamp(),
    overdueSince: timestamp(),
    version: versionField(),
    ...trackingFields,
  },
})

export const WarrantyClaim = list({
  access: governed([...WARRANTY_READ]),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'job', 'equipment', 'status', 'claimedMinor', 'recoveredMinor', 'deadline'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    job: relationship({ ref: 'Job' }),
    equipment: relationship({ ref: 'InstalledEquipment' }),
    rule: relationship({ ref: 'WarrantyRule' }),
    claimant: fixedChoice(['manufacturer', 'distributor'], 'manufacturer'),
    distributor: relationship({ ref: 'Supplier' }),
    failedPart: text(),
    failureDate: calendarDay(),
    replacementItem: relationship({ ref: 'Item' }),
    replacementSerial: text(),
    laborHours: qty(),
    claimedMinor: minor({ defaultValue: 0n }),
    recoveredMinor: minor({ defaultValue: 0n }),
    status: lifecycle(CLAIM_STATUSES),
    externalClaimNumber: systemText(),
    evidence: relationship({ ref: 'Media', many: true }),
    rma: relationship({ ref: 'Rma' }),
    draftedBy: relationship({ ref: 'User' }),
    draftedByAgent: relationship({ ref: 'AgentIdentity' }),
    submittedBy: relationship({ ref: 'User' }),
    deadline: calendarDay(),
    decisionNote: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})

export const HomeWarrantyDispatch = list({
  access: governed(['canManageInvoices', 'canDispatch', 'canBook', 'canSubmitWarrantyClaims']),
  ui: { labelField: 'externalDispatchNumber', listView: { initialColumns: ['externalDispatchNumber', 'payer', 'job', 'status', 'serviceFeeMinor'] } },
  fields: {
    payer: relationship({ ref: 'PayerProfile' }),
    externalDispatchNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    job: relationship({ ref: 'Job' }),
    serviceFeeMinor: minor({ defaultValue: 0n }),
    authorizedMinor: minor({ defaultValue: 0n }),
    status: lifecycle(HOME_WARRANTY_STATUSES),
    authorization: relationship({ ref: 'ThirdPartyAuthorization' }),
    note: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})
