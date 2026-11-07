import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { anyOf, isSignedIn } from '../access'
import { choice, fixedChoice, geo, lifecycle, qty, readOnly, versionField } from './domainFields'
import { governed, immutable, managed } from './listAccess'
import { trackingFields } from './trackingFields'

/* People & eligibility (SCHEMA §2). Who can do which work, and the evidence that says so. */

export const EMPLOYEE_KINDS = ['technician', 'csr', 'dispatcher', 'sales', 'manager', 'warehouse', 'office', 'apprentice'] as const

export const Employee = list({
  access: managed('signedIn', 'canManagePeople'),
  ui: { labelField: 'displayName', listView: { initialColumns: ['displayName', 'kind', 'homeBranch', 'employmentType', 'status'] } },
  fields: {
    user: relationship({ ref: 'User' }),
    firstName: text({ validation: { isRequired: true } }),
    lastName: text({ validation: { isRequired: true } }),
    displayName: text({ validation: { isRequired: true } }),
    employeeNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    homeBranch: relationship({ ref: 'Branch' }),
    businessUnits: relationship({ ref: 'BusinessUnit', many: true }),
    kind: choice(EMPLOYEE_KINDS, 'technician'),
    employmentType: choice(['w2_hourly', 'w2_salaried_exempt', 'w2_salaried_nonexempt', 'contractor_1099'], 'w2_hourly'),
    hireDate: calendarDay(),
    terminationDate: calendarDay(),
    skills: relationship({ ref: 'Skill', many: true }),
    credentials: relationship({ ref: 'Credential.employee', many: true, ...readOnly }),
    phoneE164: text({ validation: { match: { regex: /^(\+[1-9]\d{7,14})?$/, explanation: 'E.164, like +15125550123' } } }),
    email: text(),
    lat: geo({ description: 'Start-of-day latitude (home or shop), used for drive estimates.' }),
    lng: geo({ description: 'Start-of-day longitude.' }),
    dispatchable: checkbox({ defaultValue: true, ui: { description: 'Shown on the dispatch board.' } }),
    status: choice(['active', 'on_leave', 'terminated'], 'active'),
    ...trackingFields,
  },
})

export const CREDENTIAL_KINDS = ['state_trade_license', 'epa_608', 'nate', 'manufacturer', 'backflow', 'osha', 'driver_license', 'other'] as const
export const EPA_TYPES = ['none', 'type_i', 'type_ii', 'type_iii', 'universal'] as const

/** A licence or certification. Its status changes only through verifyCredential/revokeCredential (CAS). */
export const Credential = list({
  access: {
    operation: { query: anyOf('canManagePeople', 'canDispatch', 'canViewBoard', 'canWorkVisits'), create: anyOf('canManagePeople'), update: anyOf('canManagePeople'), delete: () => false },
    filter: {
      query: ({ session }: any) => {
        if (!isSignedIn({ session })) return false
        const role = session.data.role ?? {}
        if (role.canManagePeople || role.canDispatch || role.canViewBoard) return true
        return { employee: { user: { id: { equals: session.itemId } } } }
      },
    },
  },
  ui: { labelField: 'number', listView: { initialColumns: ['employee', 'kind', 'trade', 'licenseClass', 'epaType', 'expiresOn', 'status'] } },
  fields: {
    employee: relationship({ ref: 'Employee.credentials' }),
    kind: choice(CREDENTIAL_KINDS, 'state_trade_license'),
    trade: choice(['hvac', 'plumbing', 'electrical', 'general'], 'general'),
    jurisdictionCode: text({ defaultValue: 'US-TX', validation: { match: { regex: /^([A-Z]{2}(-[A-Z0-9]{2,})*)?$/, explanation: 'Like US-TX' } } }),
    issuer: text({ ui: { description: 'TDLR, TSBPE, EPA-approved certifying organisation, NATE…' } }),
    number: text(),
    licenseClass: text({ ui: { description: 'Texas class code: acr_certified_technician, acr_registered_technician, plumber_apprentice, tradesman_plumber, journeyman_plumber, master_plumber, electrical_apprentice, journeyman_electrician, master_electrician, residential_wireman.' } }),
    epaType: choice(EPA_TYPES, 'none'),
    endorsements: json({ defaultValue: [] }),
    issuedOn: calendarDay(),
    expiresOn: calendarDay({ ui: { description: 'An expired credential stops new assignments only (I-P2).' } }),
    evidence: relationship({ ref: 'Document' }),
    verifiedBy: relationship({ ref: 'User', ...readOnly }),
    verifiedAt: timestamp({ ...readOnly }),
    status: lifecycle(['pending_verification', 'verified', 'expired', 'revoked']),
    version: versionField(),
    ...trackingFields,
  },
})

export const Skill = list({
  access: managed('signedIn', 'canManagePeople'),
  ui: { labelField: 'name' },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^[a-z0-9_]{2,40}$/, explanation: 'lower_snake_case' } } }),
    name: text({ validation: { isRequired: true } }),
    trade: choice(['hvac', 'plumbing', 'electrical', 'general'], 'general'),
    ...trackingFields,
  },
})

/** What a job type needs from the crew. The licensing rules themselves come from the bound PolicyVersion. */
export const JobTypeRequirement = list({
  access: managed('signedIn', 'canManageCompany'),
  ui: { labelField: 'name' },
  fields: {
    name: text({ validation: { isRequired: true } }),
    licensingTags: json({ defaultValue: [], ui: { description: 'Job tags in the licensing policy pack, e.g. ["acr_service","refrigerant_handling"].' } }),
    requiredCredentialKinds: json({ defaultValue: [], ui: { description: 'Extra credential kinds every assigned tech must hold, e.g. ["backflow"].' } }),
    requiresSupervisorOnJob: checkbox({ defaultValue: false }),
    maxCoolingTons: qty(),
    maxHeatingBtuh: integer(),
    skills: relationship({ ref: 'Skill', many: true }),
    ...trackingFields,
  },
})

/** One eligibility decision for one tech on one visit, with the policy version it used (I-P1). */
export const EligibilityEvaluation = list({
  access: immutable(['canDispatch', 'canViewBoard', 'canManagePeople']),
  ui: { labelField: 'result', listView: { initialColumns: ['visit', 'employee', 'result', 'evaluatedAt'] } },
  fields: {
    visit: relationship({ ref: 'Visit', ...readOnly }),
    employee: relationship({ ref: 'Employee', ...readOnly }),
    policyVersion: relationship({ ref: 'PolicyVersion', ...readOnly }),
    result: fixedChoice(['eligible', 'ineligible', 'override']),
    findings: json({ ...readOnly }),
    evaluatedAt: timestamp({ ...readOnly }),
    overrideApproval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    ...trackingFields,
  },
})

export const Crew = list({
  access: managed('signedIn', ['canDispatch', 'canManagePeople']),
  ui: { labelField: 'name' },
  fields: {
    name: text({ validation: { isRequired: true } }),
    lead: relationship({ ref: 'Employee' }),
    members: relationship({ ref: 'Employee', many: true }),
    businessUnit: relationship({ ref: 'BusinessUnit' }),
    ...trackingFields,
  },
})

const LOCAL_TIME = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: 'HH:MM, 24-hour' }

export const ShiftTemplate = list({
  access: managed('signedIn', ['canDispatch', 'canManagePeople']),
  ui: { labelField: 'startLocal', listView: { initialColumns: ['employee', 'weekday', 'startLocal', 'endLocal'] } },
  fields: {
    employee: relationship({ ref: 'Employee' }),
    weekday: integer({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: '0 = Sunday' } }),
    startLocal: text({ validation: { isRequired: true, match: LOCAL_TIME } }),
    endLocal: text({ validation: { isRequired: true, match: LOCAL_TIME } }),
    ...trackingFields,
  },
})

/** A shift on a branch-local date (materialised from templates; I-D2 checks read it). */
export const Shift = list({
  access: governed(['canDispatch', 'canViewBoard', 'canManagePeople', 'canWorkVisits']),
  ui: { labelField: 'date', listView: { initialColumns: ['employee', 'date', 'startsAt', 'endsAt', 'kind'] } },
  fields: {
    employee: relationship({ ref: 'Employee', ...readOnly }),
    date: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    startsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    endsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    kind: fixedChoice(['regular', 'on_call', 'overtime']),
    ...trackingFields,
  },
})

/** Who answers after-hours emergencies. The AI CSR's emergency page reads this (SM§17). */
export const OnCallRotation = list({
  access: managed('signedIn', ['canDispatch', 'canManagePeople']),
  ui: { labelField: 'phoneE164', listView: { initialColumns: ['businessUnit', 'employee', 'startsAt', 'endsAt', 'escalationOrder'] } },
  fields: {
    businessUnit: relationship({ ref: 'BusinessUnit' }),
    employee: relationship({ ref: 'Employee' }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    phoneE164: text({ validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: 'E.164' } } }),
    escalationOrder: integer({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 9 } }),
    ...trackingFields,
  },
})
