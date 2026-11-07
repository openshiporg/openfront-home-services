import { list } from '@keystone-6/core'
import { checkbox, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { choice, fixedChoice, lifecycle, minor, readOnly, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { trackingFields } from './trackingFields'

/*
 * Agents (SCHEMA §16; STATE-MACHINES §18). An agent is an MCP client with scope grants per tool.
 * Every write goes through a server command; these lists are read-only through the API. Grants are
 * immutable rows: a change revokes one row and creates another.
 */

export const AGENT_AUTONOMY = ['disabled', 'propose_only', 'auto_within_policy'] as const

export const AgentIdentity = list({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'kind', 'status', 'killSwitch', 'owner'] } },
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    kind: choice(['llm_agent', 'rules_engine', 'external_mcp_client'], 'llm_agent'),
    provider: text(),
    modelRef: text(),
    owner: relationship({ ref: 'User' }),
    oauthApp: relationship({ ref: 'OAuthApp' }),
    status: lifecycle(['active', 'paused', 'revoked']),
    killSwitch: checkbox({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: 'When on, every tool call is refused before it runs.' } }),
    limits: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Rate and amount limits, e.g. {"actionsPerHour":120}.' } }),
    grants: relationship({ ref: 'AgentScopeGrant.agent', many: true, ...readOnly }),
    runs: relationship({ ref: 'AgentRun.agent', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const AgentScopeGrant = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'tool', listView: { initialColumns: ['agent', 'tool', 'autonomy', 'status', 'effectiveFrom', 'revokedAt'] } },
  fields: {
    agent: relationship({ ref: 'AgentIdentity.grants', ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    autonomy: fixedChoice(AGENT_AUTONOMY),
    constraints: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Limits, e.g. {"businessUnits":["HVAC-SVC"],"maxQuoteMinor":"250000"}.' } }),
    status: lifecycle(['requested', 'active', 'revoked']),
    grantedBy: relationship({ ref: 'User', ...readOnly }),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    effectiveFrom: timestamp({ ...readOnly }),
    revokedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const AgentRun = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'trigger', listView: { initialColumns: ['agent', 'trigger', 'status', 'startedAt', 'endedAt'] } },
  fields: {
    agent: relationship({ ref: 'AgentIdentity.runs', ...readOnly }),
    trigger: fixedChoice(['inbound_call', 'inbound_sms', 'schedule', 'user_request', 'webhook']),
    callRef: systemText({ indexed: true }),
    startedAt: timestamp({ defaultValue: { kind: 'now' }, ...readOnly }),
    endedAt: timestamp({ ...readOnly }),
    status: lifecycle(['started', 'completed', 'failed', 'aborted']),
    tokenUsage: json({ ...readOnly }),
    costMinor: minor(),
    actions: relationship({ ref: 'AgentAction.run', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const AgentAction = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'tool', listView: { initialColumns: ['tool', 'status', 'run', 'createdAt'] } },
  fields: {
    run: relationship({ ref: 'AgentRun.actions', ...readOnly }),
    agent: relationship({ ref: 'AgentIdentity', ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    idempotencyKey: systemText({ indexed: 'unique', required: true }),
    inputsHash: systemText({ required: true }),
    inputsProvenance: json({ ...readOnly }),
    output: json({ ...readOnly }),
    reasoningSummary: systemText(),
    status: lifecycle(['proposed', 'awaiting_approval', 'approved', 'rejected', 'applied', 'failed', 'expired']),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    appliedEffects: json({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
