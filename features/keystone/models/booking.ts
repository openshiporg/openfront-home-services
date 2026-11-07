import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { choice, fixedChoice, lifecycle, qty, rate, readOnly, systemText, versionField } from './domainFields'
import { governed, managed } from './listAccess'
import { trackingFields } from './trackingFields'

/* Booking & capacity (SCHEMA §5). Capacity is counted in tech-hours per arrival window (I-B1). */

export const JOB_PRIORITIES = ['emergency', 'urgent', 'standard', 'maintenance'] as const

export const JobType = list({
  access: managed('signedIn', 'canManageCompany'),
  ui: { labelField: 'name', listView: { initialColumns: ['code', 'name', 'businessUnit', 'priority', 'capacityHours', 'bookableByAi'] } },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{3,24}$/, explanation: 'Like HVAC-NOCOOL' } } }),
    name: text({ validation: { isRequired: true } }),
    businessUnit: relationship({ ref: 'BusinessUnit' }),
    trade: choice(['hvac', 'plumbing', 'electrical'], 'hvac'),
    priority: choice(JOB_PRIORITIES, 'standard'),
    defaultDurationMinutes: integer({ defaultValue: 90, validation: { isRequired: true, min: 15, max: 1440 } }),
    capacityHours: qty({ required: true, description: 'Tech-hours one booking uses from a window (I-B1).' }),
    crewSize: integer({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 12 } }),
    requirements: relationship({ ref: 'JobTypeRequirement' }),
    keywords: json({ defaultValue: [], ui: { description: 'Words a caller uses for this problem; jobtype.match ranks by them.' } }),
    bookableOnline: checkbox({ defaultValue: false }),
    bookableByAi: checkbox({ defaultValue: false }),
    emergencyPolicy: json({ ui: { description: '{"keywords":[...],"script":"…","page":true}. A match makes the AI CSR give the script and page on-call (SM§17).' } }),
    checklistTemplate: relationship({ ref: 'ChecklistTemplate' }),
    refrigerantWork: checkbox({ defaultValue: false }),
    permitLikely: checkbox({ defaultValue: false }),
    bookingQuestions: json({ defaultValue: [] }),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

const LOCAL_TIME = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: 'HH:MM, 24-hour' }

export const ArrivalWindowTemplate = list({
  access: managed('signedIn', ['canManageCompany', 'canDispatch']),
  ui: { labelField: 'label', listView: { initialColumns: ['businessUnit', 'weekday', 'label', 'startLocal', 'endLocal', 'capacityHours', 'active'] } },
  fields: {
    businessUnit: relationship({ ref: 'BusinessUnit' }),
    weekday: integer({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: '0 = Sunday' } }),
    startLocal: text({ validation: { isRequired: true, match: LOCAL_TIME } }),
    endLocal: text({ validation: { isRequired: true, match: LOCAL_TIME } }),
    label: text({ validation: { isRequired: true } }),
    capacityHours: qty({ required: true, description: 'Tech-hours sold into this window before the plan factor.' }),
    capacityFactor: rate({ description: 'Multiplier for the window (1.000000 = as planned).' }),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

/** A window on a branch-local date. Created by materialiseWindows; booked hours are a cache of CapacityUsage. */
export const ArrivalWindow = list({
  access: governed(['canBook', 'canDispatch', 'canViewBoard', 'canWorkVisits']),
  ui: { labelField: 'label', listView: { initialColumns: ['businessUnit', 'date', 'label', 'capacityHours', 'bookedHours', 'closed'] } },
  fields: {
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    template: relationship({ ref: 'ArrivalWindowTemplate', ...readOnly }),
    date: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    startsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    endsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    label: systemText({ required: true }),
    capacityHours: qty({ required: true }),
    bookedHours: qty({ required: true }),
    closed: checkbox({ defaultValue: false, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const CapacityPlan = list({
  access: governed(['canBook', 'canDispatch', 'canViewBoard']),
  ui: { labelField: 'date' },
  fields: {
    businessUnit: relationship({ ref: 'BusinessUnit', ...readOnly }),
    date: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    techHoursAvailable: qty({ required: true }),
    reservedEmergencyHours: qty({ required: true }),
    ...trackingFields,
  },
})

/** One row per hold or visit using a window. Summed under the capacity lock (SM§2). */
export const CapacityUsage = list({
  access: governed(['canBook', 'canDispatch', 'canViewBoard']),
  ui: { labelField: 'kind', listView: { initialColumns: ['window', 'kind', 'hours', 'createdAt'] } },
  fields: {
    window: relationship({ ref: 'ArrivalWindow', ...readOnly }),
    kind: fixedChoice(['hold', 'visit']),
    hold: relationship({ ref: 'BookingHold', ...readOnly }),
    visit: relationship({ ref: 'Visit', ...readOnly }),
    hours: qty({ required: true }),
    ...trackingFields,
  },
})

export const CapacityOverride = list({
  access: governed(['canBook', 'canDispatch', 'canViewBoard']),
  ui: { labelField: 'reason' },
  fields: {
    window: relationship({ ref: 'ArrivalWindow', ...readOnly }),
    addHours: qty({ required: true }),
    reason: systemText({ required: true }),
    requestedBy: relationship({ ref: 'User', ...readOnly }),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    ...trackingFields,
  },
})

/** A short reservation of window capacity while a CSR or the AI CSR finishes the booking (SM§2). */
export const BookingHold = list({
  access: governed(['canBook', 'canDispatch', 'canViewBoard']),
  ui: { labelField: 'publicCode', listView: { initialColumns: ['publicCode', 'window', 'jobType', 'source', 'status', 'expiresAt'] } },
  fields: {
    publicCode: systemText({ indexed: 'unique', required: true }),
    window: relationship({ ref: 'ArrivalWindow', ...readOnly }),
    jobType: relationship({ ref: 'JobType', ...readOnly }),
    hours: qty({ required: true }),
    source: fixedChoice(['csr', 'online', 'ai_agent']),
    heldByUser: relationship({ ref: 'User', ...readOnly }),
    heldByAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    customerDraft: json({ ...readOnly }),
    expiresAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(['held', 'converted', 'released', 'expired']),
    job: relationship({ ref: 'Job', ...readOnly }),
    visit: relationship({ ref: 'Visit', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
