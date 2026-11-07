import { describe, expect, it } from 'vitest'
import { resolvePolicy, stricterContactHours, type CandidateBinding } from './policy'
import { POLICY_PACKS } from '../seed/policyPacks'

/** Candidates shaped like loadPolicyCandidates output, built from the seed packs. */
const fromSeed = (codes: string[]): CandidateBinding[] => POLICY_PACKS.filter(p => codes.includes(p.code)).map(p => ({
  id: p.binding.id, scope: p.binding.scope, scopeValue: p.binding.scopeValue, priority: p.binding.priority, status: 'active',
  pack: { id: p.id, code: p.code, kind: p.kind, versions: [{ id: p.version.id, versionNumber: 1, status: 'active', effectiveFrom: p.version.effectiveFrom, effectiveTo: null, rules: p.version.rules, contentHash: 'h'.repeat(64) }] },
}))

const austin = { state: 'US-TX', county: 'US-TX-TRAVIS', city: 'US-TX-AUSTIN', zip: '78704' }

describe('resolvePolicy (fails closed)', () => {
  it('the most specific scope wins: Texas over the federal company-wide pack', () => {
    const resolved = resolvePolicy('home_solicitation', austin, '2026-11-07', fromSeed(['us-federal-home-solicitation', 'us-tx-home-solicitation']))
    expect(resolved.packCode).toBe('us-tx-home-solicitation')
  })

  it('a place outside Texas falls back to the federal pack', () => {
    const resolved = resolvePolicy('home_solicitation', { state: 'US-OK' }, '2026-11-07', fromSeed(['us-federal-home-solicitation', 'us-tx-home-solicitation']))
    expect(resolved.packCode).toBe('us-federal-home-solicitation')
  })

  it('no binding for the kind is POLICY_MISSING', () => {
    expect(() => resolvePolicy('privacy', austin, '2026-11-07', [])).toThrow(expect.objectContaining({ code: 'POLICY_MISSING' }))
  })

  it('a date before any version is in effect is POLICY_MISSING', () => {
    expect(() => resolvePolicy('home_solicitation', austin, '2025-06-01', fromSeed(['us-tx-home-solicitation']))).toThrow(expect.objectContaining({ code: 'POLICY_MISSING' }))
  })

  it('two packs tied at the same scope and priority are POLICY_AMBIGUOUS', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    const twin = { ...tx, id: 'other-binding', pack: { ...tx.pack, id: 'other-pack', code: 'other' } }
    expect(() => resolvePolicy('home_solicitation', austin, '2026-11-07', [tx, twin])).toThrow(expect.objectContaining({ code: 'POLICY_AMBIGUOUS' }))
  })

  it('a higher priority breaks the tie', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    const twin = { ...tx, id: 'other-binding', priority: 5, pack: { ...tx.pack, id: 'other-pack', code: 'other' } }
    expect(resolvePolicy('home_solicitation', austin, '2026-11-07', [tx, twin]).packCode).toBe('other')
  })

  it('two active versions covering the same day are POLICY_AMBIGUOUS', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    const v1 = tx.pack.versions[0]
    const doubled = { ...tx, pack: { ...tx.pack, versions: [v1, { ...v1, id: 'v2', versionNumber: 2, effectiveFrom: '2026-06-01' }] } }
    expect(() => resolvePolicy('home_solicitation', austin, '2026-11-07', [doubled])).toThrow(expect.objectContaining({ code: 'POLICY_AMBIGUOUS' }))
  })

  it('a successor version that starts when the old one ends hands over cleanly', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    const v1 = { ...tx.pack.versions[0], effectiveTo: '2026-06-01' }
    const handover = { ...tx, pack: { ...tx.pack, versions: [v1, { ...v1, id: 'v2', versionNumber: 2, effectiveFrom: '2026-06-01', effectiveTo: null }] } }
    expect(resolvePolicy('home_solicitation', austin, '2026-05-31', [handover]).versionId).toBe(v1.id)
    expect(resolvePolicy('home_solicitation', austin, '2026-06-01', [handover]).versionId).toBe('v2')
  })

  it('rules that fail their schema are POLICY_INVALID', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    const broken = { ...tx, pack: { ...tx.pack, versions: [{ ...tx.pack.versions[0], rules: { rules: [{ code: 'x' }] } }] } }
    expect(() => resolvePolicy('home_solicitation', austin, '2026-11-07', [broken])).toThrow(expect.objectContaining({ code: 'POLICY_INVALID' }))
  })

  it('retired bindings are ignored', () => {
    const [tx] = fromSeed(['us-tx-home-solicitation'])
    expect(() => resolvePolicy('home_solicitation', austin, '2026-11-07', [{ ...tx, status: 'retired' }])).toThrow(expect.objectContaining({ code: 'POLICY_MISSING' }))
  })
})

describe('contact hours: every layer applies, the stricter window wins', () => {
  it('federal 8-9 and Texas 9-9 (Sunday noon) combine to Texas hours', () => {
    const resolved = resolvePolicy<{ weekdays: { start: string; end: string }; sunday: { start: string; end: string }; exemptions: string[] }>('contact_hours', austin, '2026-11-08', fromSeed(['us-federal-contact-hours', 'us-tx-contact-hours']))
    expect(resolved.rules.weekdays).toEqual({ start: '09:00', end: '21:00' })
    expect(resolved.rules.sunday).toEqual({ start: '12:00', end: '21:00' })
    expect(resolved.layers).toHaveLength(2)
    // An exemption survives only if every layer grants it.
    expect(resolved.rules.exemptions).not.toContain('prior_business_relationship')
    expect(resolved.rules.exemptions).toContain('express_request')
  })

  it('stricterContactHours is order-independent', () => {
    const packs = POLICY_PACKS.filter(p => p.kind === 'contact_hours').map(p => p.version.rules) as never[]
    expect(stricterContactHours(packs)).toEqual(stricterContactHours([...packs].reverse()))
  })
})
