/**
 * Openfront Home Services MCP domain tools (INTEGRATIONS §11). The generic createData/updateData/
 * deleteData tools are gone: an agent can only read through the list access rules of the user it
 * acts for, or call a named domain command. Each command is one GraphQL mutation that checks
 * permission and agent grants on the server, takes an idempotency key, and is audited.
 * Tool calls never approve anything; approvals are human-only.
 *
 * Never exposed as tools (INTEGRATIONS §11): refunds, credits, write-offs and discount approvals;
 * price-book, policy and pay publication; access-secret reveal; customer merges; marketing sends.
 */

import { PHASE1_TOOLS } from './phase1Tools'
import { PHASE2_TOOLS } from './phase2Tools'

export const FORBIDDEN_TOOL_PATTERNS = [/refund/i, /credit/i, /write.?off/i, /approve/i, /publish/i, /reveal/i, /merge/i, /campaign/i, /^decide/i, /secret/i, /^(create|update|delete)Data$/i]

export type DomainTool = {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, object>; required: string[]; additionalProperties?: boolean }
  /** GraphQL document; variables come from the validated arguments. */
  document: string
  /** Field of the GraphQL result to return. */
  field: string
  writes: boolean
}

const idempotencyKey = { type: 'string', minLength: 8, maxLength: 200, pattern: '^[A-Za-z0-9._:-]+$', description: 'Unique per intent. Reusing it returns the first result instead of acting twice.' }

export const DOMAIN_TOOLS: DomainTool[] = [
  {
    name: 'verifyAuditChain',
    description: 'Recompute the hash-chained audit log and report whether it is intact (and where it breaks if not). Needs canReadAudit.',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    document: 'query VerifyAuditChain { verifyAuditChain }',
    field: 'verifyAuditChain',
    writes: false,
  },
  {
    name: 'loadCompanySetup',
    description: 'Load the Summit Plumbing & Air company spine (roles, office staff, licences, branch, business units, calendars, approval policies, federal and Texas policy packs). Idempotent. Needs canManageOnboarding.',
    inputSchema: { type: 'object', properties: { idempotencyKey }, required: ['idempotencyKey'], additionalProperties: false },
    document: 'mutation LoadCompanySetup($idempotencyKey: String!) { loadCompanySetup(idempotencyKey: $idempotencyKey) }',
    field: 'loadCompanySetup',
    writes: true,
  },
  {
    name: 'loadOperationsSetup',
    description: "Load Summit's field operation after the company: 12 technicians with Texas licences and EPA 608 cards, job types with licensing rules and emergency scripts, arrival windows, shifts, on-call, campaigns and 61 fictional customers; then opens the next 21 days of windows. Idempotent. Needs canManageOnboarding.",
    inputSchema: { type: 'object', properties: { idempotencyKey }, required: ['idempotencyKey'], additionalProperties: false },
    document: 'mutation LoadOperationsSetup($idempotencyKey: String!) { loadOperationsSetup(idempotencyKey: $idempotencyKey) }',
    field: 'loadOperationsSetup',
    writes: true,
  },
  {
    name: 'policy.resolve',
    description: 'Which jurisdiction policy version governs a place on a date (cancellation rights, contact hours, tax, licensing, liens). Fails closed when no policy or more than one applies.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['home_solicitation', 'home_improvement_contract', 'auto_renewal', 'call_recording', 'contact_hours', 'refrigerant', 'licensing', 'sales_tax', 'wage_hour', 'lien', 'privacy'] },
        state: { type: 'string', pattern: '^[A-Z]{2}-[A-Z]{2}$', description: 'ISO 3166-2, e.g. US-TX' },
        county: { type: 'string', maxLength: 60 },
        city: { type: 'string', maxLength: 60 },
        zip: { type: 'string', pattern: '^[0-9]{5}$' },
        on: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', description: 'Local date, YYYY-MM-DD' },
      },
      required: ['kind', 'on'],
      additionalProperties: false,
    },
    document: 'query ResolvePolicy($kind: String!, $state: String, $county: String, $city: String, $zip: String, $on: String!) { resolvePolicy(kind: $kind, state: $state, county: $county, city: $city, zip: $zip, on: $on) }',
    field: 'resolvePolicy',
    writes: false,
  },
]

/** Write tools must take an idempotency key, and no tool may match a forbidden capability. */
export function assertRegistrySafe(tools: DomainTool[] = DOMAIN_TOOLS) {
  for (const tool of tools) {
    if (tool.writes && !tool.inputSchema.required.includes('idempotencyKey')) throw new Error(`Write tool ${tool.name} must require idempotencyKey`)
    if (FORBIDDEN_TOOL_PATTERNS.some(pattern => pattern.test(tool.name))) throw new Error(`Tool ${tool.name} exposes a human-only capability`)
  }
}
DOMAIN_TOOLS.push(...PHASE1_TOOLS, ...PHASE2_TOOLS)
assertRegistrySafe()

export function registerDomainTools(tools: DomainTool[]) {
  assertRegistrySafe(tools)
  for (const tool of tools) {
    if (DOMAIN_TOOLS.some(existing => existing.name === tool.name)) throw new Error(`Duplicate MCP tool ${tool.name}`)
    DOMAIN_TOOLS.push(tool)
  }
}

type Spec = { type?: string; enum?: unknown[]; minLength?: number; maxLength?: number; pattern?: string; minimum?: number; maximum?: number; minItems?: number; maxItems?: number; items?: Spec; properties?: Record<string, Spec>; required?: string[]; additionalProperties?: boolean }

/** Minimal JSON-schema check: flat arguments, plus lists of ids or of closed objects (estimate options and lines). */
export function validateArguments(tool: DomainTool, args: Record<string, unknown>) {
  const problems: string[] = []
  checkObject(tool.inputSchema as Spec, args, '', tool.name, problems)
  if (problems.length) throw new Error(`Invalid arguments: ${problems.slice(0, 20).join('; ')}`)
}

function checkObject(spec: Spec, value: Record<string, unknown>, at: string, owner: string, problems: string[]) {
  const properties = spec.properties ?? {}
  for (const key of spec.required ?? []) if (value[key] === undefined || value[key] === null || value[key] === '') problems.push(`${at}${key} is required`)
  for (const [key, item] of Object.entries(value)) {
    const child = properties[key]
    if (!child) {
      if (spec.additionalProperties === false) problems.push(`${at}${key} is not an argument of ${owner}`)
      continue
    }
    checkValue(child, item, `${at}${key}`, owner, problems)
  }
}

function checkValue(spec: Spec, value: unknown, key: string, owner: string, problems: string[]) {
  if (spec.type === 'string' && typeof value !== 'string') problems.push(`${key} must be a string`)
  if (spec.type === 'integer' && !Number.isSafeInteger(value)) problems.push(`${key} must be an integer`)
  if (spec.type === 'boolean' && typeof value !== 'boolean') problems.push(`${key} must be true or false`)
  if (spec.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) problems.push(`${key} must be an object`)
    else if (spec.properties) checkObject(spec, value as Record<string, unknown>, `${key}.`, owner, problems)
  }
  if (spec.type === 'array') {
    if (!Array.isArray(value)) problems.push(`${key} must be a list`)
    else {
      if ((spec.minItems && value.length < spec.minItems) || (spec.maxItems && value.length > spec.maxItems)) problems.push(`${key} has the wrong number of items`)
      if (spec.items) value.forEach((item, i) => checkValue(spec.items!, item, `${key}[${i}]`, owner, problems))
      else if (value.some(item => typeof item !== 'string')) problems.push(`${key} must be a list of ids`)
    }
  }
  if (spec.type === 'integer' && Number.isSafeInteger(value) && ((spec.minimum !== undefined && (value as number) < spec.minimum) || (spec.maximum !== undefined && (value as number) > spec.maximum))) problems.push(`${key} is out of range`)
  if (spec.enum && !spec.enum.includes(value)) problems.push(`${key} must be one of ${spec.enum.join(', ')}`)
  if (typeof value === 'string') {
    if (spec.minLength && value.length < spec.minLength) problems.push(`${key} is too short`)
    if (spec.maxLength && value.length > spec.maxLength) problems.push(`${key} is too long`)
    if (spec.pattern && !new RegExp(spec.pattern).test(value)) problems.push(`${key} has invalid characters`)
  }
}

export async function runDomainTool(tool: DomainTool, args: Record<string, unknown>, target: { graphqlEndpoint: string; auth: Record<string, string> }) {
  validateArguments(tool, args)
  const response = await fetch(target.graphqlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...target.auth },
    body: JSON.stringify({ query: tool.document, variables: args }),
  })
  const result = await response.json()
  if (result.errors?.length) {
    return { ok: false, errors: result.errors.map((e: { message?: string; extensions?: { code?: string } }) => ({ message: e.message, code: e.extensions?.code })) }
  }
  return { ok: true, result: result.data?.[tool.field] ?? null }
}
