import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { choice, lifecycle, minor, readOnly, systemText, versionField } from './domainFields'
import { governed, immutable, managed, serverOnly } from './listAccess'
import { trackingFields } from './trackingFields'
import { costGuardedJson, costHash } from './costHidden'

/*
 * Platform spine (SCHEMA §17, §16, §3.6, §6.8), shared with the other Openfront verticals. CalendarDay is
 * named CalendarException because the GraphQL scalar CalendarDay is reserved.
 */

export const AuditEvent = list({
  access: immutable('canReadAudit'),
  ui: { labelField: 'eventType', listView: { initialColumns: ['seq', 'at', 'eventType', 'entityType', 'entityId', 'actorUser'], initialSort: { field: 'seq', direction: 'DESC' } } },
  fields: {
    seq: integer({ isIndexed: 'unique', validation: { isRequired: true }, ...readOnly }),
    eventKey: systemText({ indexed: 'unique', required: true }),
    eventType: systemText({ indexed: true, required: true }),
    entityType: systemText({ indexed: true, required: true }),
    entityId: systemText({ indexed: true, required: true }),
    actorUser: relationship({ ref: 'User', ...readOnly }),
    actorAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    approver: relationship({ ref: 'User', ...readOnly }),
    reason: systemText(),
    before: costGuardedJson({ ...readOnly }),
    after: costGuardedJson({ ...readOnly }),
    metadata: costGuardedJson({ ...readOnly }),
    requestId: systemText(),
    // Chain hashes are keyed, but still only for people who may read cost: no one else needs them, and no one else can filter or order by them.
    prevHash: costHash({ required: true }),
    hash: costHash({ required: true, indexed: 'unique' }),
    at: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' }, ...readOnly }),
  },
})

export const CommandReceipt = list({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    command: text({ validation: { isRequired: true } }),
    principalKey: text({ validation: { isRequired: true } }),
    requestHash: text({ validation: { isRequired: true } }),
    requestParams: json(),
    responseCode: text(),
    responseBody: json(),
    recoveryPoint: text({ defaultValue: 'completed' }),
    completedAt: timestamp({ defaultValue: { kind: 'now' } }),
    ...trackingFields,
  },
})

/** Raw inbound provider facts (webhooks, polls). Content never changes; only appliedAt moves (raw-SQL trigger). */
export const ProviderObservation = list({
  access: governed('canManageIntegrations'),
  ui: { labelField: 'externalId', listView: { initialColumns: ['source', 'kind', 'externalId', 'signatureVerified', 'receivedAt', 'appliedAt'] } },
  fields: {
    source: systemText({ indexed: true, required: true }),
    kind: systemText({ required: true }),
    connection: relationship({ ref: 'IntegrationConnection', ...readOnly }),
    externalId: systemText({ required: true }),
    contentHash: systemText({ required: true }),
    signatureVerified: checkbox({ defaultValue: false, ...readOnly }),
    payload: json({ ...readOnly }),
    correlation: json({ ...readOnly }),
    receivedAt: timestamp({ defaultValue: { kind: 'now' }, ...readOnly }),
    appliedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

export const Lease = list({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    owner: text({ validation: { isRequired: true } }),
    fencingToken: integer({ defaultValue: 0, validation: { isRequired: true } }),
    expiresAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})

export const Sequence = list({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    nextValue: integer({ defaultValue: 1, validation: { isRequired: true } }),
  },
})

/** Timers (hold expiry, cancel-by, renewal notices, registration deadlines). One row per key. */
export const ScheduledJob = list({
  access: governed('canManageCompany'),
  ui: { labelField: 'key', listView: { initialColumns: ['kind', 'key', 'dueAt', 'status', 'attempts'] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    key: systemText({ indexed: 'unique', required: true }),
    dueAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    intervalSeconds: integer({ ...readOnly, ui: { ...readOnly.ui, description: 'Set for recurring jobs; empty for one-shot timers.' } }),
    payload: json({ ...readOnly }),
    status: lifecycle(['pending', 'running', 'done', 'failed', 'cancelled']),
    attempts: integer({ defaultValue: 0, ...readOnly }),
    lastRunAt: timestamp({ ...readOnly }),
    lastError: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})

export const Notification = list({
  access: {
    operation: { query: permissions.canAccessDashboard, create: () => false, update: permissions.canAccessDashboard, delete: () => false },
    filter: {
      query: ({ session }) => (session ? { recipient: { id: { equals: session.itemId } } } : false),
      update: ({ session }) => (session ? { recipient: { id: { equals: session.itemId } } } : false),
    },
  },
  fields: {
    recipient: relationship({ ref: 'User', ...readOnly }),
    channel: choice(['in_app', 'email'], 'in_app'),
    template: systemText({ required: true }),
    payload: json({ ...readOnly }),
    status: lifecycle(['pending', 'sent', 'failed']),
    sentAt: timestamp({ ...readOnly }),
    readAt: timestamp(),
    ...trackingFields,
  },
})

export const BusinessCalendar = list({
  access: managed('signedIn', 'canManageCompany'),
  ui: { labelField: 'code', listView: { initialColumns: ['code', 'name', 'kind', 'timeZone', 'coverageThrough'] } },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    name: text(),
    kind: choice(['legal_business_days', 'company_hours'], 'company_hours'),
    timeZone: text({ validation: { isRequired: true }, defaultValue: 'America/Chicago' }),
    weekendDays: json({ defaultValue: [0], ui: { description: 'Non-business weekdays, 0 = Sunday. The federal business-day calendar excludes Sundays only (16 CFR 429.0(f)).' } }),
    regularOpen: text({ defaultValue: '08:00', ui: { description: 'HH:mm local (company hours only).' } }),
    regularClose: text({ defaultValue: '17:00', ui: { description: 'HH:mm local (company hours only).' } }),
    composedOf: relationship({ ref: 'BusinessCalendar', many: true, ui: { description: 'Closed whenever any of these is closed (a company calendar includes the federal holidays).' } }),
    exceptions: relationship({ ref: 'CalendarException.calendar', many: true }),
    coverageThrough: calendarDay({ ui: { description: 'Dates past this fail closed: no deadline is computed on a guess.' } }),
    source: text({ ui: { description: 'Where the holiday table came from and when it was checked.' } }),
    ...trackingFields,
  },
})

export const CalendarException = list({
  access: managed('signedIn', 'canManageCompany'),
  ui: { labelField: 'date', listView: { initialColumns: ['calendar', 'date', 'kind', 'note'] } },
  fields: {
    calendar: relationship({ ref: 'BusinessCalendar.exceptions' }),
    date: calendarDay({ validation: { isRequired: true } }),
    kind: choice(['holiday', 'closure', 'special_open'], 'holiday'),
    openAt: text(),
    closeAt: text(),
    note: text(),
    ...trackingFields,
  },
})

export const ApprovalPolicy = list({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: 'action' },
  fields: {
    action: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    description: text(),
    requiredPermission: text({ validation: { isRequired: true } }),
    minApprovals: integer({ defaultValue: 1, validation: { min: 1 } }),
    thresholdMinor: minor(),
    expiresAfterMinutes: integer({ defaultValue: 1440 }),
    ...trackingFields,
  },
})

export const ApprovalRequest = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'action', listView: { initialColumns: ['action', 'status', 'targetList', 'requestedBy', 'createdAt', 'expiresAt'] } },
  fields: {
    action: systemText({ indexed: true, required: true }),
    summary: systemText(),
    targetList: systemText({ required: true }),
    targetId: systemText({ indexed: true, required: true }),
    payload: costGuardedJson({ ...readOnly }),
    payloadHash: systemText({ required: true }),
    requiredPermission: systemText({ required: true }),
    requestedBy: relationship({ ref: 'User', ...readOnly }),
    requestedByAgent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    status: lifecycle(['pending', 'approved', 'rejected', 'expired', 'cancelled']),
    expiresAt: timestamp({ ...readOnly }),
    consumedAt: timestamp({ ...readOnly, ui: { ...readOnly.ui, description: 'When the approved action was carried out. An approval is used once.' } }),
    decisions: relationship({ ref: 'ApprovalDecision.request', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const ApprovalDecision = list({
  access: immutable('canAccessDashboard'),
  fields: {
    request: relationship({ ref: 'ApprovalRequest.decisions', ...readOnly }),
    decidedBy: relationship({ ref: 'User', ...readOnly }),
    decision: select({ type: 'string', options: ['approve', 'reject'].map(value => ({ label: value, value })), validation: { isRequired: true }, ...readOnly }),
    reason: systemText(),
    at: timestamp({ defaultValue: { kind: 'now' }, ...readOnly }),
  },
})

/** Human work queue: timers, manual adapters and agents raise tasks; people close them. */
export const Task = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'title', listView: { initialColumns: ['title', 'kind', 'status', 'priority', 'dueAt', 'assignee', 'role'] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    title: systemText({ required: true }),
    detail: systemText(),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    dueAt: timestamp({ ...readOnly }),
    assignee: relationship({ ref: 'User', ...readOnly }),
    role: relationship({ ref: 'Role', ...readOnly }),
    status: lifecycle(['open', 'in_progress', 'done', 'cancelled']),
    priority: select({ type: 'string', options: ['low', 'normal', 'high', 'urgent'].map(value => ({ label: value, value })), defaultValue: 'normal', validation: { isRequired: true }, ...readOnly }),
    dedupeKey: systemText({ indexed: 'unique' }),
    resolution: systemText(),
    closedAt: timestamp({ ...readOnly }),
    closedBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const DOCUMENT_KINDS = [
  'estimate_pdf', 'invoice_pdf', 'cancellation_notice', 'emergency_waiver', 'signature', 'contract', 'permit', 'inspection_report',
  'warranty_packet', 'po_pdf', 'license', 'insurance', 'transcript', 'logo', 'policy_source', 'other',
] as const

export const Document = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'title', listView: { initialColumns: ['title', 'kind', 'visibility', 'subjectType', 'subjectId', 'createdAt'] } },
  fields: {
    title: systemText({ required: true }),
    kind: select({ type: 'string', options: DOCUMENT_KINDS.map(value => ({ label: value.replaceAll('_', ' '), value })), defaultValue: 'other', validation: { isRequired: true }, ...readOnly }),
    visibility: select({ type: 'string', options: ['internal', 'customer'].map(value => ({ label: value, value })), defaultValue: 'internal', validation: { isRequired: true }, ...readOnly }),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    versions: relationship({ ref: 'DocumentVersion.document', many: true, ...readOnly }),
    retentionUntil: calendarDay({ ...readOnly }),
    /** When a certificate (e.g. a sales-tax exemption) expires: it is good only for dates before this day. Empty = no expiry. */
    expiresAt: calendarDay({ ...readOnly }),
    ...trackingFields,
  },
})

/** One immutable stored file. A changed document is a new version; the bytes are content-addressed by sha256. */
export const DocumentVersion = list({
  access: immutable('canAccessDashboard'),
  ui: { labelField: 'sha256' },
  fields: {
    document: relationship({ ref: 'Document.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText({ required: true }),
    sizeBytes: integer({ ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

export const Media = list({
  access: governed('canAccessDashboard'),
  graphql: { plural: 'MediaItems' },
  ui: { labelField: 'storageKey', listView: { initialColumns: ['kind', 'subjectType', 'subjectId', 'capturedAt', 'visibility'] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    kind: select({ type: 'string', options: ['photo', 'video', 'scan_3d', 'audio', 'recording'].map(value => ({ label: value.replaceAll('_', ' '), value })), defaultValue: 'photo', validation: { isRequired: true }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText(),
    capturedAt: timestamp({ ...readOnly }),
    capturedBy: relationship({ ref: 'User', ...readOnly }),
    visibility: select({ type: 'string', options: ['internal', 'customer'].map(value => ({ label: value, value })), defaultValue: 'internal', validation: { isRequired: true }, ...readOnly }),
    ...trackingFields,
  },
})

export const Note = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'body', listView: { initialColumns: ['subjectType', 'subjectId', 'visibility', 'author', 'pinned', 'createdAt'] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    body: systemText({ required: true }),
    visibility: select({ type: 'string', options: ['internal', 'tech', 'customer'].map(value => ({ label: value, value })), defaultValue: 'internal', validation: { isRequired: true }, ...readOnly }),
    author: relationship({ ref: 'User', ...readOnly }),
    pinned: checkbox({ defaultValue: false, ...readOnly }),
    ...trackingFields,
  },
})

export const Tag = list({
  access: managed('canAccessDashboard', ['canManageCustomers', 'canManageCompany']),
  ui: { labelField: 'name' },
  fields: {
    name: text({ isIndexed: 'unique', validation: { isRequired: true, length: { max: 60 } } }),
    color: choice(['slate', 'blue', 'green', 'amber', 'red', 'violet'], 'slate'),
    ...trackingFields,
  },
})

/** Ids of the same record in another system (an incumbent import, QuickBooks, Stripe, Twilio). */
export const ExternalId = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'externalId', listView: { initialColumns: ['system', 'subjectType', 'subjectId', 'externalId'] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    system: systemText({ required: true }),
    externalId: systemText({ required: true }),
    ...trackingFields,
  },
})

/** AES-256-GCM ciphertext for provider credentials and access secrets (SCHEMA G10). Never exposed. */
export const SecretBox = list({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    purpose: select({ type: 'string', options: ['integration_credential', 'access_secret', 'webhook_secret'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    ciphertext: text({ validation: { isRequired: true } }),
    iv: text({ validation: { isRequired: true } }),
    authTag: text({ validation: { isRequired: true } }),
    keyVersion: integer({ defaultValue: 1 }),
    createdBy: relationship({ ref: 'User' }),
    rotatedAt: timestamp(),
    ...trackingFields,
  },
})
