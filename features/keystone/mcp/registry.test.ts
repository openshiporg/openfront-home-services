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

const schemaText = readFileSync(join(process.cwd(), 'schema.graphql'), 'utf8')
const block = (type: string) => schemaText.match(new RegExp(`type ${type} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
const fields = new Set([...block('Query').matchAll(/\n {2}(\w+)/g), ...block('Mutation').matchAll(/\n {2}(\w+)/g)].map(m => m[1]))

describe('MCP domain tool registry', () => {
  it('lists the Phase 1 receptionist and dispatch tools', () => {
    const names = DOMAIN_TOOLS.map(t => t.name)
    for (const name of PHASE1) expect(names).toContain(name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('exposes nothing human-only and no generic CRUD', () => {
    expect(() => assertRegistrySafe()).not.toThrow()
    for (const tool of DOMAIN_TOOLS) for (const pattern of FORBIDDEN_TOOL_PATTERNS) expect(pattern.test(tool.name), `${tool.name} ~ ${pattern}`).toBe(false)
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
})
