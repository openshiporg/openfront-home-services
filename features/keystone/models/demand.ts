import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { anyOf } from '../access'
import { choice, fixedChoice, lifecycle, minor, readOnly, systemText, versionField } from './domainFields'
import { governed, managed } from './listAccess'
import { trackingFields } from './trackingFields'

/* Demand (SCHEMA §4): where calls and leads come from, and the conversations that follow. */

export const CAMPAIGN_CHANNELS = ['google_lsa', 'google_ads', 'seo', 'direct_mail', 'referral', 'yard_sign', 'truck_wrap', 'tv_radio', 'marketplace', 'repeat', 'tech_generated', 'other'] as const

export const Campaign = list({
  access: managed(['canManageCampaigns', 'canManageLeads', 'canBook'], 'canManageCampaigns'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'channel', 'active'] } },
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    channel: choice(CAMPAIGN_CHANNELS, 'other'),
    monthlyCostMinor: minor({ defaultValue: 0n, description: 'Planned monthly spend in cents (actuals arrive with the accounting export).' }),
    active: checkbox({ defaultValue: true }),
    trackingNumbers: relationship({ ref: 'TrackingNumber.campaign', many: true }),
    ...trackingFields,
  },
})

export const TrackingNumber = list({
  access: managed(['canManageCampaigns', 'canManageLeads', 'canBook'], 'canManageCampaigns'),
  ui: { labelField: 'phoneE164', listView: { initialColumns: ['phoneE164', 'campaign', 'provider', 'businessUnit'] } },
  fields: {
    phoneE164: text({ isIndexed: 'unique', validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: 'E.164' } } }),
    campaign: relationship({ ref: 'Campaign.trackingNumbers' }),
    provider: text({ defaultValue: 'manual' }),
    forwardTo: text(),
    businessUnit: relationship({ ref: 'BusinessUnit' }),
    ...trackingFields,
  },
})

export const LEAD_SOURCES = ['call', 'sms', 'web_form', 'online_booking', 'lsa', 'marketplace', 'tech_generated', 'membership', 'import', 'ai_agent'] as const
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'booked', 'converted', 'lost', 'spam', 'merged'] as const
export const LOST_REASONS = ['price', 'timing', 'out_of_area', 'no_answer', 'competitor', 'not_serviceable', 'duplicate', 'other'] as const

/** A request for service (SM§1). Status changes only through the lead transition mutations. */
export const Lead = list({
  access: governed(['canManageLeads', 'canBook']),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'contactName', 'source', 'status', 'requestedJobType', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    source: fixedChoice(LEAD_SOURCES),
    campaign: relationship({ ref: 'Campaign', ...readOnly }),
    trackingNumber: relationship({ ref: 'TrackingNumber', ...readOnly }),
    externalId: systemText(),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    contactName: systemText(),
    phoneE164: text({ access: { read: anyOf('canReadCustomerPII', 'canBook', 'canManageLeads'), create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    email: text({ access: { read: anyOf('canReadCustomerPII', 'canBook', 'canManageLeads'), create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    requestedJobType: relationship({ ref: 'JobType', ...readOnly }),
    summary: systemText(),
    status: lifecycle(LEAD_STATUSES),
    lostReason: fixedChoice(['', ...LOST_REASONS]),
    firstResponseSeconds: integer({ ...readOnly }),
    respondDueAt: timestamp({ ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    mergedInto: relationship({ ref: 'Lead', ...readOnly }),
    assignedTo: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Conversation = list({
  access: governed(['canManageLeads', 'canBook', 'canSendMessages', 'canDispatch']),
  ui: { labelField: 'channel', listView: { initialColumns: ['customer', 'channel', 'status', 'updatedAt'] } },
  fields: {
    customer: relationship({ ref: 'Customer', ...readOnly }),
    contactPoint: relationship({ ref: 'ContactPoint', ...readOnly }),
    channel: fixedChoice(['voice', 'sms', 'email', 'chat']),
    status: lifecycle(['open', 'waiting_customer', 'waiting_staff', 'closed']),
    assignedTo: relationship({ ref: 'User', ...readOnly }),
    lead: relationship({ ref: 'Lead', ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    calls: relationship({ ref: 'Call.conversation', many: true, ...readOnly }),
    messages: relationship({ ref: 'Message.conversation', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const CALL_DISPOSITIONS = ['', 'booked', 'not_booked', 'existing_job', 'spam', 'emergency_paged', 'transferred'] as const

/** One phone call. Immutable once completed; recording and transcript arrive later by observation. */
export const Call = list({
  access: governed(['canManageLeads', 'canBook', 'canDispatch']),
  ui: { labelField: 'providerCallId', listView: { initialColumns: ['startedAt', 'direction', 'fromMasked', 'answeredBy', 'disposition', 'status'] } },
  fields: {
    conversation: relationship({ ref: 'Conversation.calls', ...readOnly }),
    direction: fixedChoice(['inbound', 'outbound']),
    providerCallId: systemText({ indexed: 'unique', required: true }),
    provider: systemText(),
    from: text({ access: { read: anyOf('canReadCustomerPII', 'canBook'), create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    fromMasked: systemText(),
    to: systemText(),
    trackingNumber: relationship({ ref: 'TrackingNumber', ...readOnly }),
    startedAt: timestamp({ ...readOnly }),
    endedAt: timestamp({ ...readOnly }),
    durationSeconds: integer({ ...readOnly }),
    answeredBy: fixedChoice(['human', 'ai_agent', 'voicemail', 'ivr']),
    agentRun: relationship({ ref: 'AgentRun', ...readOnly }),
    recording: relationship({ ref: 'Media', ...readOnly }),
    transcript: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Turns as [{speaker, text, at}]. Card numbers are never spoken on our calls (payment links only).' } }),
    recordingDisclosurePlayed: checkbox({ defaultValue: false, ...readOnly }),
    emergency: json({ ...readOnly }),
    summary: systemText(),
    disposition: fixedChoice(CALL_DISPOSITIONS),
    bookable: checkbox({ defaultValue: false, ...readOnly }),
    lead: relationship({ ref: 'Lead', ...readOnly }),
    job: relationship({ ref: 'Job', ...readOnly }),
    status: lifecycle(['ringing', 'ai_answering', 'human_answering', 'handoff_requested', 'completed']),
    version: versionField(),
    ...trackingFields,
  },
})

export const MESSAGE_BLOCK_REASONS = ['', 'no_consent', 'dnc', 'quiet_hours', 'unregistered_10dlc', 'opted_out', 'policy_unresolved'] as const

/** An SMS or email (SM§17). Outbound ones pass the send-time guard in the outbox worker (I-K1). */
export const Message = list({
  access: governed(['canSendMessages', 'canBook', 'canDispatch', 'canManageLeads']),
  ui: { labelField: 'template', listView: { initialColumns: ['createdAt', 'direction', 'purpose', 'template', 'status', 'blockedReason'] } },
  fields: {
    conversation: relationship({ ref: 'Conversation.messages', ...readOnly }),
    contactPoint: relationship({ ref: 'ContactPoint', ...readOnly }),
    direction: fixedChoice(['inbound', 'outbound']),
    channel: fixedChoice(['sms', 'email']),
    purpose: fixedChoice(['transactional', 'marketing', 'internal']),
    consentPurpose: systemText(),
    template: systemText(),
    body: text({ access: { read: anyOf('canSendMessages', 'canBook', 'canDispatch', 'canManageLeads'), create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    status: lifecycle(['queued', 'sending', 'blocked', 'sent', 'manual', 'delivered', 'failed', 'undeliverable', 'received']),
    blockedReason: fixedChoice(MESSAGE_BLOCK_REASONS),
    guardFindings: json({ ...readOnly }),
    providerMessageId: systemText({ indexed: true }),
    job: relationship({ ref: 'Job', ...readOnly }),
    visit: relationship({ ref: 'Visit', ...readOnly }),
    sentAt: timestamp({ ...readOnly }),
    deliveredAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Opportunity = list({
  access: governed(['canManageLeads', 'canBook', 'canPresentEstimates']),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'customer', 'kind', 'stage', 'estimatedValueMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    customer: relationship({ ref: 'Customer', ...readOnly }),
    location: relationship({ ref: 'ServiceLocation', ...readOnly }),
    kind: fixedChoice(['replacement', 'repair_followup', 'membership', 'commercial_bid', 'upgrade']),
    source: fixedChoice(['tech_generated', 'estimate_followup', 'agent_scan', 'membership_visit', 'inbound']),
    generatedBy: relationship({ ref: 'Employee', ...readOnly }),
    estimatedValueMinor: minor(),
    reasons: json({ ...readOnly }),
    stage: lifecycle(['open', 'appointment_set', 'estimate_presented', 'won', 'lost']),
    assignedTo: relationship({ ref: 'Employee', ...readOnly }),
    lead: relationship({ ref: 'Lead', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
