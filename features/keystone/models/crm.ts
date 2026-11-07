import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { anyOf, isSignedIn, permissions, sys } from '../access'
import { choice, fixedChoice, geo, lifecycle, minor, readOnly, systemText, versionField } from './domainFields'
import { governed, immutable } from './listAccess'
import { jobFilter, officeOrTech, scoped } from './scope'
import { trackingFields } from './trackingFields'

/*
 * Customers & properties (SCHEMA §3). The customer who pays and the place where work happens are
 * separate records (D§2). Phone numbers and emails are stored normalised with a hash companion for
 * dedupe (G11); agents only ever see masked values (customer.lookup).
 */

const techCustomer = (userId: string) => ({ jobs: { some: jobFilter(userId, true) } })
const techLocation = (userId: string) => ({ jobs: { some: jobFilter(userId, true) } })

/** Phone and email values: staff who book, dispatch or work the visit, and PII readers. */
const piiRead = anyOf('canReadCustomerPII', 'canBook', 'canDispatch', 'canWorkVisits')

export const Customer = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techCustomer) },
  },
  ui: { labelField: 'displayName', listView: { initialColumns: ['ref', 'displayName', 'kind', 'doNotService', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    kind: choice(['residential', 'commercial'], 'residential'),
    displayName: text({ validation: { isRequired: true } }),
    organizationName: text(),
    primaryContact: relationship({ ref: 'Contact' }),
    contacts: relationship({ ref: 'Contact.customer', many: true, ...readOnly }),
    locations: relationship({ ref: 'ServiceLocation.customer', many: true, ...readOnly }),
    jobs: relationship({ ref: 'Job.customer', many: true, ...readOnly }),
    billingLine1: text(),
    billingLine2: text(),
    billingCity: text(),
    billingRegion: text(),
    billingPostalCode: text(),
    taxExemptCertificate: relationship({ ref: 'Document' }),
    tags: relationship({ ref: 'Tag', many: true }),
    doNotService: checkbox({ defaultValue: false }),
    doNotServiceReason: text(),
    mergedInto: relationship({ ref: 'Customer', ...readOnly }),
    source: relationship({ ref: 'Campaign', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Contact = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(userId => ({ customer: techCustomer(userId) })) },
  },
  ui: { labelField: 'lastName', listView: { initialColumns: ['firstName', 'lastName', 'role', 'customer'] } },
  fields: {
    customer: relationship({ ref: 'Customer.contacts', ...readOnly }),
    firstName: text(),
    lastName: text(),
    role: choice(['owner', 'spouse', 'tenant', 'property_manager', 'billing', 'site_contact', 'other'], 'owner'),
    points: relationship({ ref: 'ContactPoint.contact', many: true, ...readOnly }),
    preferredLanguage: text({ defaultValue: 'en' }),
    ...trackingFields,
  },
})

/** A phone number or email. `value` is E.164 or lowercased; `valueHash` is sha256 of it (dedupe, DNC). */
export const ContactPoint = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(userId => ({ contact: { customer: techCustomer(userId) } })) },
  },
  ui: { labelField: 'kind', listView: { initialColumns: ['contact', 'kind', 'value', 'isPrimary', 'carrierLineType'] } },
  fields: {
    contact: relationship({ ref: 'Contact.points', ...readOnly }),
    kind: fixedChoice(['mobile', 'landline', 'email']),
    value: text({ validation: { isRequired: true }, access: { read: piiRead, create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    valueHash: systemText({ indexed: true, required: true }),
    verifiedAt: timestamp({ ...readOnly }),
    isPrimary: checkbox({ defaultValue: false, ...readOnly }),
    carrierLineType: fixedChoice(['unknown', 'mobile', 'landline', 'voip']),
    consents: relationship({ ref: 'ConsentRecord.contactPoint', many: true, ...readOnly }),
    ...trackingFields,
  },
})

export const CONSENT_PURPOSES = ['transactional_sms', 'transactional_voice', 'marketing_sms', 'marketing_email', 'marketing_voice', 'ai_voice_outbound', 'call_recording', 'auto_renewal'] as const

/** Append-only consent events (I-C4). Effective consent = the latest event per (point, purpose). */
export const ConsentRecord = list({
  access: immutable(['canManageCustomers', 'canBook', 'canSendMessages', 'canDispatch']),
  ui: { labelField: 'purpose', listView: { initialColumns: ['contactPoint', 'purpose', 'action', 'channel', 'recordedAt'] } },
  fields: {
    contactPoint: relationship({ ref: 'ContactPoint.consents', ...readOnly }),
    purpose: fixedChoice(CONSENT_PURPOSES),
    action: fixedChoice(['grant', 'revoke']),
    channel: fixedChoice(['web_form', 'portal', 'phone', 'sms_keyword', 'paper', 'in_person', 'import']),
    evidence: json({ ...readOnly }),
    wordingVersion: systemText(),
    policyVersion: relationship({ ref: 'PolicyVersion', ...readOnly }),
    recordedAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    actorKind: fixedChoice(['user', 'agent', 'system', 'customer', 'webhook']),
    actorId: systemText(),
    ...trackingFields,
  },
})

/** Internal do-not-contact list, keyed by the contact point hash. The national registry is an adapter cache. */
export const DncEntry = list({
  access: immutable(['canManageCustomers', 'canSendMessages', 'canManageCampaigns']),
  ui: { labelField: 'valueHash', listView: { initialColumns: ['kind', 'source', 'addedAt'] } },
  fields: {
    valueHash: systemText({ indexed: true, required: true }),
    kind: fixedChoice(['internal', 'national_cache']),
    source: systemText(),
    addedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

/** Where work happens. Coordinates, zone and service area are set by the geocode step, never typed in. */
export const ServiceLocation = list({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techLocation) },
  },
  ui: { labelField: 'address1', listView: { initialColumns: ['ref', 'address1', 'city', 'postalCode', 'customer', 'serviceArea', 'geocodeQuality'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    customer: relationship({ ref: 'Customer.locations', ...readOnly }),
    address1: text({ validation: { isRequired: true } }),
    address2: text(),
    city: text({ validation: { isRequired: true } }),
    state: text({ defaultValue: 'TX', validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: 'Two-letter state code' } } }),
    county: text(),
    postalCode: text({ validation: { isRequired: true, match: { regex: /^\d{5}(-\d{4})?$/, explanation: 'ZIP or ZIP+4' } } }),
    country: text({ defaultValue: 'US' }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    geocodeQuality: fixedChoice(['rooftop', 'interpolated', 'zip', 'failed']),
    timeZone: systemText({ required: true }),
    serviceArea: relationship({ ref: 'ServiceArea', ...readOnly }),
    propertyClass: choice(['residential', 'nonresidential', 'multiple_use'], 'residential'),
    propertyType: choice(['single_family', 'townhome', 'condo', 'multifamily', 'mobile_home', 'commercial'], 'single_family'),
    yearBuilt: integer({ validation: { min: 1800, max: 2100 } }),
    squareFeet: integer({ validation: { min: 0 } }),
    contacts: relationship({ ref: 'LocationContact.location', many: true, ...readOnly }),
    accessSecrets: relationship({ ref: 'AccessSecret.location', many: true, ...readOnly }),
    jobs: relationship({ ref: 'Job.location', many: true, ...readOnly }),
    mergedInto: relationship({ ref: 'ServiceLocation', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const LocationOwnership = list({
  access: immutable(['canManageCustomers', 'canBook']),
  ui: { labelField: 'reason' },
  fields: {
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    from: calendarDay({ ...readOnly }),
    to: calendarDay({ ...readOnly }),
    reason: fixedChoice(['purchase', 'sale', 'tenant_change', 'import', 'created']),
    ...trackingFields,
  },
})

export const LocationContact = list({
  access: governed(['canManageCustomers', 'canBook', 'canDispatch']),
  ui: { labelField: 'role' },
  fields: {
    location: relationship({ ref: 'ServiceLocation.contacts', ...readOnly }),
    contact: relationship({ ref: 'Contact', ...readOnly }),
    role: fixedChoice(['owner', 'tenant', 'property_manager', 'site_contact']),
    canAuthorizeWork: checkbox({ defaultValue: true, ...readOnly }),
    nteMinor: minor({ description: 'Not-to-exceed this contact may authorise, in cents.' }),
    ...trackingFields,
  },
})

/**
 * A gate code, lockbox or alarm code. The secret itself is AES-256-GCM ciphertext in SecretBox; the
 * only read path is revealAccessSecret(visitId), which checks assignment and logs a reveal (I-C2).
 * It is never an MCP tool.
 */
export const AccessSecret = list({
  access: {
    operation: { query: anyOf('canManageCustomers', 'canDispatch', 'canRevealAccessSecret'), create: sys, update: sys, delete: sys },
    filter: { query: ({ session }: any) => (isSignedIn({ session }) ? true : false) },
  },
  ui: { labelField: 'label', listView: { initialColumns: ['location', 'kind', 'label', 'status'] } },
  fields: {
    location: relationship({ ref: 'ServiceLocation.accessSecrets', ...readOnly }),
    kind: fixedChoice(['gate_code', 'lockbox', 'alarm', 'garage', 'pet', 'other']),
    label: systemText({ required: true }),
    secretRef: text({ access: { read: () => false, create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' } } }),
    status: lifecycle(['active', 'retired']),
    reveals: relationship({ ref: 'AccessSecretReveal.secret', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** Every time a person saw an access secret: who, for which visit, until when. */
export const AccessSecretReveal = list({
  access: immutable(['canManageCustomers', 'canReadAudit']),
  ui: { labelField: 'revealedAt', listView: { initialColumns: ['secret', 'revealedTo', 'visit', 'revealedAt', 'expiresAt'] } },
  fields: {
    secret: relationship({ ref: 'AccessSecret.reveals', ...readOnly }),
    revealedTo: relationship({ ref: 'User', ...readOnly }),
    visit: relationship({ ref: 'Visit', ...readOnly }),
    revealedAt: timestamp({ ...readOnly }),
    expiresAt: timestamp({ ...readOnly }),
    reason: systemText(),
    ...trackingFields,
  },
})
