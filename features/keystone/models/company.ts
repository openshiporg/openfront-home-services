import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, select, text } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { bps, ccy, choice, geo, minor, systemText, versionField } from './domainFields'
import { managed } from './listAccess'
import { trackingFields } from './trackingFields'

/* Company & access (SCHEMA §1). One company per database (G1): there is no companyId column. */

export const DEFAULT_FEATURES = {
  memberships: true,
  inventory: true,
  commercial: true,
  permits: true,
  financing: true,
  homeWarranty: true,
  payroll: true,
  aiVoice: false,
  dispatchRecommendations: true,
} as const

export const CompanySettings = list({
  isSingleton: true,
  graphql: { plural: 'CompanySettingsItems' },
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: permissions.canManageCompany, delete: () => false } },
  ui: { labelField: 'displayName' },
  fields: {
    singletonKey: text({ isIndexed: 'unique', defaultValue: 'company', validation: { isRequired: true }, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' } } }),
    legalName: text({ validation: { isRequired: true }, defaultValue: 'Openfront Home Services' }),
    displayName: text({ validation: { isRequired: true }, defaultValue: 'Openfront Home Services' }),
    homeTimeZone: text({ defaultValue: 'America/Chicago', validation: { isRequired: true } }),
    currencyCode: ccy(),
    defaultCountry: text({ defaultValue: 'US', validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: 'ISO 3166 country code' } } }),
    allowNegativeTruckStock: checkbox({ defaultValue: true }),
    estimateValidityDays: integer({ defaultValue: 30, validation: { isRequired: true, min: 1, max: 365 } }),
    recallWindowDays: integer({ defaultValue: 30, validation: { isRequired: true, min: 0, max: 365 } }),
    discountApprovalThresholdBps: bps(1000),
    refundApprovalThresholdMinor: minor({ defaultValue: 50000n }),
    poApprovalThresholdMinor: minor({ defaultValue: 250000n }),
    arPeriodCloseDay: integer({ defaultValue: 5, validation: { isRequired: true, min: 1, max: 28 } }),
    features: json({ defaultValue: DEFAULT_FEATURES, ui: { description: 'Modules this shop uses. Turning one off hides its screens; data is kept.' } }),
    onboardingStatus: select({
      type: 'string',
      options: ['not_started', 'in_progress', 'completed', 'dismissed'].map(value => ({ label: value.replaceAll('_', ' '), value })),
      defaultValue: 'not_started',
      validation: { isRequired: true },
    }),
    version: versionField(),
    ...trackingFields,
  },
})

export const TRADES = ['hvac', 'plumbing', 'electrical'] as const

export const ContractorLicense = list({
  access: managed('canAccessDashboard', 'canManageCompany'),
  ui: { labelField: 'licenseNumber', listView: { initialColumns: ['trade', 'issuer', 'licenseNumber', 'licenseClass', 'jurisdictionCode', 'expiresOn'] } },
  fields: {
    trade: choice([...TRADES, 'general', 'other'], 'hvac'),
    jurisdictionCode: text({ validation: { isRequired: true, match: { regex: /^[A-Z]{2}(-[A-Z0-9]{2,})*$/, explanation: 'Like US-TX or US-TX-AUSTIN' } } }),
    issuer: text({ ui: { description: 'TDLR, TSBPE, …' } }),
    licenseNumber: text({ validation: { isRequired: true } }),
    licenseClass: text(),
    endorsements: json({ defaultValue: [] }),
    responsibleName: text({ ui: { description: 'The licence holder of record (Texas responsible master plumber, ACR licence holder). Links to the Employee record once Phase 1 adds it.' } }),
    insuranceDocument: relationship({ ref: 'Document' }),
    expiresOn: calendarDay(),
    displayOnDocuments: checkbox({ defaultValue: true }),
    brands: relationship({ ref: 'Brand.licenses', many: true }),
    ...trackingFields,
  },
})

export const Brand = list({
  access: managed('canAccessDashboard', 'canManageCompany'),
  ui: { labelField: 'name' },
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    logo: relationship({ ref: 'Document' }),
    phone: text(),
    email: text(),
    website: text(),
    licenses: relationship({ ref: 'ContractorLicense.brands', many: true }),
    businessUnits: relationship({ ref: 'BusinessUnit.brand', many: true }),
    ...trackingFields,
  },
})

export const Branch = list({
  access: managed('canAccessDashboard', 'canManageCompany'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'code', 'timeZone', 'city', 'region'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{2,20}$/, explanation: 'Capital letters, digits and dashes' } } }),
    timeZone: text({ validation: { isRequired: true }, defaultValue: 'America/Chicago', ui: { description: 'IANA zone. Business dates for this branch are in this zone (I-O2).' } }),
    line1: text(),
    line2: text(),
    city: text(),
    region: text({ ui: { description: 'State or province code, e.g. TX' } }),
    postalCode: text(),
    country: text({ defaultValue: 'US' }),
    lat: geo(),
    lng: geo(),
    calendar: relationship({ ref: 'BusinessCalendar' }),
    businessUnits: relationship({ ref: 'BusinessUnit.branch', many: true }),
    serviceAreas: relationship({ ref: 'ServiceArea.branch', many: true }),
    policyBindings: relationship({ ref: 'PolicyBinding.branch', many: true }),
    ...trackingFields,
  },
})

export const BusinessUnit = list({
  access: managed('canAccessDashboard', 'canManageCompany'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'code', 'trade', 'kind', 'branch', 'active'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{2,24}$/, explanation: 'Capital letters, digits and dashes' } } }),
    trade: choice(TRADES, 'hvac'),
    kind: choice(['service', 'install', 'commercial', 'maintenance'], 'service'),
    brand: relationship({ ref: 'Brand.businessUnits' }),
    branch: relationship({ ref: 'Branch.businessUnits' }),
    serviceAreas: relationship({ ref: 'ServiceArea.businessUnits', many: true }),
    capacityEnabled: checkbox({ defaultValue: true }),
    revenueAccountCode: text(),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const ServiceArea = list({
  access: managed('canAccessDashboard', 'canManageCompany'),
  ui: { labelField: 'name' },
  fields: {
    name: text({ validation: { isRequired: true } }),
    branch: relationship({ ref: 'Branch.serviceAreas' }),
    kind: choice(['zip_list', 'polygon'], 'zip_list'),
    zips: json({ defaultValue: [], ui: { description: 'Five-digit ZIP codes served, e.g. ["78701","78702"].' } }),
    polygon: json({ ui: { description: 'GeoJSON Polygon or MultiPolygon.' } }),
    businessUnits: relationship({ ref: 'BusinessUnit.serviceAreas', many: true }),
    travelZone: choice(['standard', 'extended'], 'standard'),
    ...trackingFields,
  },
})

export const RoleLimit = list({
  access: managed('canAccessDashboard', 'canManageRoles'),
  ui: { labelField: 'kind', listView: { initialColumns: ['role', 'kind', 'limit'] } },
  fields: {
    role: relationship({ ref: 'Role.limits' }),
    kind: choice(['discount_bps', 'refund_minor', 'credit_minor', 'po_minor', 'overbook_pct'], 'discount_bps'),
    limit: minor({ required: true, description: 'Basis points, minor units or percent, per the kind.' }),
    ...trackingFields,
  },
})

export const IntegrationConnection = list({
  access: { operation: { query: permissions.canManageIntegrations, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: 'providerKey', listView: { initialColumns: ['area', 'providerKey', 'mode', 'status', 'updatedAt'] } },
  fields: {
    area: choice(['payments', 'financing', 'messaging', 'voice', 'maps', 'tax', 'accounting', 'payroll', 'suppliers', 'warranty', 'home_warranty', 'permits', 'lead_sources', 'storage', 'email'], 'payments'),
    providerKey: systemText({ required: true }),
    mode: choice(['manual', 'test', 'live'], 'manual'),
    status: select({ type: 'string', options: ['disconnected', 'connected', 'degraded', 'disabled'].map(value => ({ label: value, value })), defaultValue: 'disconnected', validation: { isRequired: true }, access: { create: () => false, update: () => false } }),
    secretRef: systemText({ }),
    config: json({ access: { create: () => false, update: () => false } }),
    capabilityProfile: json({ access: { create: () => false, update: () => false } }),
    health: json({ access: { create: () => false, update: () => false } }),
    version: versionField(),
    ...trackingFields,
  },
})
