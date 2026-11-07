import { list } from '@keystone-6/core'
import { calendarDay, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { fixedChoice, lifecycle, readOnly, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { trackingFields } from './trackingFields'

/*
 * Jurisdiction rules as data (SCHEMA §13.1, DOMAIN §7). A pack holds one kind of rule for one
 * jurisdiction; its versions are effective-dated and immutable once active; bindings say where a
 * pack applies. Code never hard-codes a state rule: it calls resolvePolicy(kind, place, at).
 */

export const POLICY_KINDS = [
  'home_solicitation', 'home_improvement_contract', 'auto_renewal', 'call_recording', 'contact_hours', 'refrigerant',
  'licensing', 'sales_tax', 'wage_hour', 'lien', 'privacy',
] as const
export type PolicyKind = (typeof POLICY_KINDS)[number]

export const PolicyPack = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'code', listView: { initialColumns: ['code', 'name', 'kind', 'jurisdictionCode'] } },
  fields: {
    code: systemText({ indexed: 'unique', required: true }),
    name: systemText({ required: true }),
    kind: fixedChoice(POLICY_KINDS),
    jurisdictionCode: systemText({ required: true }),
    description: systemText(),
    versions: relationship({ ref: 'PolicyVersion.pack', many: true, ...readOnly }),
    bindings: relationship({ ref: 'PolicyBinding.pack', many: true, ...readOnly }),
    ...trackingFields,
  },
})

export const PolicyVersion = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'contentHash', listView: { initialColumns: ['pack', 'versionNumber', 'status', 'effectiveFrom', 'effectiveTo', 'verifiedAt'] } },
  fields: {
    pack: relationship({ ref: 'PolicyPack.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    effectiveFrom: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    effectiveTo: calendarDay({ ...readOnly, ui: { ...readOnly.ui, description: 'Exclusive. Empty means open-ended.' } }),
    rules: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Validated against the Zod schema for the pack kind (domain/policySchemas.ts).' } }),
    sourceRefs: json({ ...readOnly, ui: { ...readOnly.ui, description: 'Citations for every rule, e.g. "16 CFR 429.1(a)".' } }),
    verifiedBy: text({ ...readOnly }),
    verifiedAt: timestamp({ ...readOnly }),
    status: lifecycle(['draft', 'pending_approval', 'active', 'retired']),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    contentHash: systemText({ required: true }),
    version: versionField(),
    ...trackingFields,
  },
})

export const PolicyBinding = list({
  access: governed('canAccessDashboard'),
  ui: { labelField: 'scopeValue', listView: { initialColumns: ['pack', 'scope', 'scopeValue', 'priority', 'status'] } },
  fields: {
    pack: relationship({ ref: 'PolicyPack.bindings', ...readOnly }),
    scope: fixedChoice(['company', 'branch', 'state', 'county', 'city', 'zip']),
    scopeValue: systemText({ required: true }),
    branch: relationship({ ref: 'Branch.policyBindings', ...readOnly }),
    priority: integer({ defaultValue: 0, ...readOnly }),
    status: lifecycle(['active', 'retired']),
    version: versionField(),
    ...trackingFields,
  },
})
