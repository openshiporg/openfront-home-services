import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMAIN_TOOLS, FORBIDDEN_TOOL_PATTERNS, assertRegistrySafe, validateArguments } from './registry'

/*
 * The MCP surface is the agent's whole reach (INTEGRATIONS §11). Every tool is a named domain command or
 * a read; nothing human-only is exposed; every write is idempotent; every GraphQL field it calls exists.
 */

const PHASE1 = [
  'customer.lookup', 'location.lookup', 'customer.history', 'jobtype.match', 'capacity.windows', 'booking.hold', 'booking.release',
  'booking.confirm', 'consent.record', 'handoff.to_human', 'page.on_call', 'dispatch.recommend', 'dispatch.apply',
]

const PHASE2 = ['pricebook.search', 'pricebook.quote', 'estimate.draft', 'estimate.draft_from_capture', 'estimate.draft_followup', 'estimate.summary']

const schemaText = readFileSync(join(process.cwd(), 'schema.graphql'), 'utf8')
const block = (type: string) => schemaText.match(new RegExp(`type ${type} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
const fields = new Set([...block('Query').matchAll(/\n {2}(\w+)/g), ...block('Mutation').matchAll(/\n {2}(\w+)/g)].map(m => m[1]))

describe('MCP domain tool registry', () => {
  it('lists the Phase 1 receptionist and dispatch tools', () => {
    const names = DOMAIN_TOOLS.map(t => t.name)
    for (const name of [...PHASE1, ...PHASE2]) expect(names).toContain(name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('exposes nothing human-only and no generic CRUD', () => {
    expect(() => assertRegistrySafe()).not.toThrow()
    for (const tool of DOMAIN_TOOLS) for (const pattern of FORBIDDEN_TOOL_PATTERNS) expect(pattern.test(tool.name), `${tool.name} ~ ${pattern}`).toBe(false)
    for (const banned of ['estimate.present', 'estimate.sell', 'estimate.discount', 'pricebook.submit', 'pricebook.import_costs', 'cancellation.deliver', 'cancellation.waive', 'cancellation.refunded']) expect(DOMAIN_TOOLS.map(t => t.name)).not.toContain(banned)
    for (const banned of ['access.reveal', 'customer.merge', 'job.cancel', 'visit.status', 'message.requeue', 'credential.verify', 'lead.spam']) expect(DOMAIN_TOOLS.map(t => t.name)).not.toContain(banned)
  })

  it('makes every write tool take an idempotency key', () => {
    const writes = DOMAIN_TOOLS.filter(t => t.writes)
    expect(writes.length).toBeGreaterThan(5)
    for (const tool of writes) {
      expect(tool.inputSchema.required, tool.name).toContain('idempotencyKey')
      expect(tool.document, tool.name).toMatch(/^mutation /)
    }
    for (const tool of DOMAIN_TOOLS.filter(t => !t.writes)) expect(tool.document, tool.name).toMatch(/^query /)
  })

  it('points every tool at a GraphQL field that exists, with closed input schemas', () => {
    for (const tool of DOMAIN_TOOLS) {
      expect(fields.has(tool.field), `${tool.name} → ${tool.field}`).toBe(true)
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false)
      expect(tool.document, tool.name).toContain(` ${tool.field}`)
    }
  })

  it('rejects unknown and malformed arguments before they reach the server', () => {
    const hold = DOMAIN_TOOLS.find(t => t.name === 'booking.hold')!
    expect(() => validateArguments(hold, { windowId: 'w', jobTypeId: 'j', source: 'ai_agent', idempotencyKey: 'short' })).toThrow()
    expect(() => validateArguments(hold, { windowId: 'w', jobTypeId: 'j', source: 'csr', idempotencyKey: 'hold:12345678' })).toThrow()
    expect(() => validateArguments(hold, { windowId: 'w', jobTypeId: 'j', source: 'ai_agent', idempotencyKey: 'hold:12345678', minutes: 30 })).toThrow()
    expect(() => validateArguments(hold, { windowId: 'w', jobTypeId: 'j', source: 'ai_agent', idempotencyKey: 'hold:12345678' })).not.toThrow()
  })

  it('checks estimate options and lines all the way down', () => {
    const draft = DOMAIN_TOOLS.find(t => t.name === 'estimate.draft')!
    const ok = { title: 'Replace capacitor', idempotencyKey: 'draft:12345678', options: [{ tier: 'good', name: 'Repair', lines: [{ itemKey: 'F-CAP-DUAL-45', quantity: '1', cancellationClass: 'requested_repair' }] }] }
    expect(() => validateArguments(draft, ok)).not.toThrow()
    expect(() => validateArguments(draft, { ...ok, options: [{ ...ok.options[0], lines: [{ itemKey: 'X', quantity: 1.5 }] }] })).toThrow(/quantity must be a string/)
    expect(() => validateArguments(draft, { ...ok, options: [{ ...ok.options[0], lines: [{ itemKey: 'X', quantity: '1', costMinor: '10' }] }] })).toThrow(/costMinor is not an argument/)
    expect(() => validateArguments(draft, { ...ok, options: [{ ...ok.options[0], tier: 'premium' }] })).toThrow(/tier must be one of/)
    expect(() => validateArguments(draft, { ...ok, options: [ok.options[0], ok.options[0], ok.options[0], ok.options[0]] })).toThrow(/wrong number/)
    expect(() => validateArguments(draft, { ...ok, options: [{ tier: 'good', name: 'x', lines: [], discountBps: 500 }] })).toThrow()
  })
})
