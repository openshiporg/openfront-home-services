import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames } from '../access'
import { verifyAuditChain } from '../lib/audit'
import { loadCompanySetup } from './setup'
import { cancelApprovalRequest, decideApprovalRequest, requestCompanyControls } from './approvals'
import { resolvePolicyQuery } from './policy'
import { APPROVAL_POLICIES, BUSINESS_UNITS, COMPANY_CLOSED_HOLIDAYS, LICENSES, ROLES, SERVICE_AREAS, STAFF } from '../seed/company'
import { POLICY_PACKS } from '../seed/policyPacks'
import { FEDERAL_HOLIDAYS } from '../lib/calendar'
import { resolvePolicyFromDb } from '../domain/policy'

/** A Keystone-like session for a user with the given permissions. */
const sessionFor = (id: string, granted: string[]) => ({
  itemId: id,
  data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, granted.includes(p)])) } },
})

describe.skipIf(!hasTestDatabase)('Phase 0 commands (database)', () => {
  let prisma: PrismaClient
  let owner: { session: unknown; prisma: PrismaClient }
  let controller: { session: unknown; prisma: PrismaClient }
  let csr: { session: unknown; prisma: PrismaClient }

  beforeAll(async () => {
    prisma = testPrisma(8)
    await resetDatabase(prisma)
    const make = (name: string) => prisma.user.create({ data: { name, email: `${uniqueKey(name)}@test.local`, password: 'x'.repeat(60) } })
    const [o, r, t] = await Promise.all([make('owner'), make('controller'), make('csr')])
    owner = { session: sessionFor(o.id, permissionNames.filter(p => p !== 'canBreakGlass')), prisma }
    controller = { session: sessionFor(r.id, ['canAccessDashboard', 'canApprovePolicies', 'canReadAudit']), prisma }
    csr = { session: sessionFor(t.id, ['canAccessDashboard', 'canBook']), prisma }
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('loads the company once: a second load with a new key creates nothing, and a replay returns the first result', { timeout: 120_000 }, async () => {
    const key = uniqueKey('setup')
    const first = await loadCompanySetup(null, { idempotencyKey: key }, owner)
    expect(first.replay).toBe(false)
    const closed = FEDERAL_HOLIDAYS.filter(h => COMPANY_CLOSED_HOLIDAYS.includes(h.name)).length
    expect(first.created).toMatchObject({
      company: 1, roles: ROLES.length, staff: STAFF.length, licenses: LICENSES.length, brands: 1, branches: 1,
      businessUnits: BUSINESS_UNITS.length, serviceAreas: SERVICE_AREAS.length, calendars: 2, calendarExceptions: FEDERAL_HOLIDAYS.length + closed,
      approvalPolicies: APPROVAL_POLICIES.length, policyPacks: POLICY_PACKS.length, policyVersions: POLICY_PACKS.length + POLICY_PACKS.filter(p => p.next).length, policyBindings: POLICY_PACKS.length,
    })

    const replay = await loadCompanySetup(null, { idempotencyKey: key }, owner)
    expect(replay).toEqual({ ...first, replay: true })

    const again = await loadCompanySetup(null, { idempotencyKey: uniqueKey('setup') }, owner)
    expect(Object.values(again.created).every(n => n === 0)).toBe(true)

    const roles = await prisma.role.findMany({ where: { id: { startsWith: 'seed_' } } })
    expect(roles.some(role => (role as Record<string, unknown>).canBreakGlass === true)).toBe(false)
    const seeded = await prisma.user.findMany({ where: { id: { startsWith: 'seed_' } } })
    expect(seeded).toHaveLength(STAFF.length)
    expect(new Set(seeded.map(u => u.password)).size).toBe(1)
    expect(seeded[0].password).toMatch(/^\$2[aby]\$10\$/)

    const chain = await verifyAuditChain(prisma)
    expect(chain.ok).toBe(true)
    expect(chain.count).toBeGreaterThan(ROLES.length + STAFF.length)
  })

  it('refuses setup without canManageOnboarding', async () => {
    await expect(loadCompanySetup(null, { idempotencyKey: uniqueKey('setup') }, csr)).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })
  })

  it('resolves the Texas cancellation-right policy for an Austin ZIP, and fails closed where nothing applies', async () => {
    const tx = await resolvePolicyQuery(null, { kind: 'home_solicitation', state: 'US-TX', city: 'Austin', zip: '78704', on: '2026-11-07' }, csr)
    expect(tx.packCode).toBe('us-tx-home-solicitation')
    expect(tx.rules).toMatchObject({ rules: [{ code: 'ftc_cooling_off', thresholdAtResidenceMinor: '2500' }, { code: 'tx_601', thresholdComparison: 'more_than' }] })
    await expect(resolvePolicyQuery(null, { kind: 'privacy', state: 'US-TX', on: '2026-11-07' }, csr)).rejects.toMatchObject({ code: 'POLICY_MISSING' })
    await expect(resolvePolicyQuery(null, { kind: 'not_a_kind', on: '2026-11-07' }, csr)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    // Contact hours: Texas and federal intersect (Texas Sunday noon start is the stricter rule).
    const hours = await resolvePolicyFromDb(prisma, 'contact_hours', { state: 'US-TX' }, '2026-11-08')
    expect(hours.packCode).toBe('us-tx-contact-hours')
  })

  it('a second binding with the same scope and priority makes resolution ambiguous (fails closed)', async () => {
    const pack = await prisma.policyPack.create({ data: { code: uniqueKey('dup'), name: 'Duplicate Texas solicitation', kind: 'home_solicitation', jurisdictionCode: 'US-TX' } })
    const source = POLICY_PACKS.find(p => p.code === 'us-tx-home-solicitation')!
    await prisma.policyVersion.create({ data: { packId: pack.id, versionNumber: 1, effectiveFrom: new Date('2026-01-01T00:00:00Z'), rules: source.version.rules as never, sourceRefs: [] as never, status: 'active', contentHash: 'a'.repeat(64) } })
    const binding = await prisma.policyBinding.create({ data: { packId: pack.id, scope: source.binding.scope, scopeValue: source.binding.scopeValue, priority: source.binding.priority, status: 'active' } })
    await expect(resolvePolicyQuery(null, { kind: 'home_solicitation', state: 'US-TX', on: '2026-11-07' }, csr)).rejects.toMatchObject({ code: 'POLICY_AMBIGUOUS' })
    await prisma.policyBinding.update({ where: { id: binding.id }, data: { status: 'retired' } })
    const back = await resolvePolicyQuery(null, { kind: 'home_solicitation', state: 'US-TX', on: '2026-11-07' }, csr)
    expect(back.packCode).toBe('us-tx-home-solicitation')
  })

  it('company controls change only after a second person approves, and the approved payload is what applies', async () => {
    const before = await prisma.companySettings.findUniqueOrThrow({ where: { singletonKey: 'company' } })
    expect(before.discountApprovalThresholdBps).toBe(1000)

    await expect(requestCompanyControls(null, { changes: { discountApprovalThresholdBps: 20_000 }, reason: 'too high', idempotencyKey: uniqueKey('cc') }, owner)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(requestCompanyControls(null, { changes: { discountApprovalThresholdBps: 500 }, reason: '', idempotencyKey: uniqueKey('cc') }, owner)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(requestCompanyControls(null, { changes: { discountApprovalThresholdBps: 500 }, reason: 'tighten', idempotencyKey: uniqueKey('cc') }, csr)).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })

    const asked = await requestCompanyControls(null, { changes: { discountApprovalThresholdBps: 500 }, reason: 'Tighten discounts before the busy season', idempotencyKey: uniqueKey('cc') }, owner)
    expect(asked.status).toBe('pending')
    expect((await prisma.companySettings.findUniqueOrThrow({ where: { singletonKey: 'company' } })).discountApprovalThresholdBps).toBe(1000)

    // The requester holds canApprovePolicies too, but cannot approve their own request.
    await expect(decideApprovalRequest(null, { requestId: asked.id, decision: 'approve', expectedVersion: 0, idempotencyKey: uniqueKey('d') }, owner)).rejects.toMatchObject({ code: 'SELF_APPROVAL' })
    // A CSR lacks the permission.
    await expect(decideApprovalRequest(null, { requestId: asked.id, decision: 'approve', expectedVersion: 0, idempotencyKey: uniqueKey('d') }, csr)).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })
    // A stale version is refused.
    await expect(decideApprovalRequest(null, { requestId: asked.id, decision: 'approve', expectedVersion: 7, idempotencyKey: uniqueKey('d') }, controller)).rejects.toMatchObject({ code: 'STALE_STATE' })

    const key = uniqueKey('d')
    const approved = await decideApprovalRequest(null, { requestId: asked.id, decision: 'approve', expectedVersion: 0, idempotencyKey: key }, controller)
    expect(approved).toMatchObject({ status: 'approved', applied: { applied: ['discountApprovalThresholdBps'] }, replay: false })
    const after = await prisma.companySettings.findUniqueOrThrow({ where: { singletonKey: 'company' } })
    expect(after.discountApprovalThresholdBps).toBe(500)
    expect(after.version).toBe(before.version + 1)

    // A retried decision replays, and does not apply twice.
    const replay = await decideApprovalRequest(null, { requestId: asked.id, decision: 'approve', expectedVersion: 0, idempotencyKey: key }, controller)
    expect(replay.replay).toBe(true)
    expect((await prisma.companySettings.findUniqueOrThrow({ where: { singletonKey: 'company' } })).version).toBe(after.version)

    const request = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: asked.id } })
    expect(request.consumedAt).not.toBeNull()
    const events = await prisma.auditEvent.findMany({ where: { entityId: { in: [asked.id, '1'] } }, orderBy: { seq: 'asc' } })
    expect(events.map(e => e.eventType)).toEqual(expect.arrayContaining(['approval.requested', 'approval.approved', 'approval.consumed', 'company.controls_changed']))
    expect(events.find(e => e.eventType === 'approval.approved')?.approverId).toBeTruthy()
    expect((await verifyAuditChain(prisma)).ok).toBe(true)
  })

  it('a change approved against an old version is refused when applied after another change landed', async () => {
    const one = await requestCompanyControls(null, { changes: { discountApprovalThresholdBps: 750 }, reason: 'first', idempotencyKey: uniqueKey('cc') }, owner)
    const two = await requestCompanyControls(null, { changes: { refundApprovalThresholdMinor: '25000', discountApprovalThresholdBps: 300 }, reason: 'second', idempotencyKey: uniqueKey('cc') }, owner)
    await decideApprovalRequest(null, { requestId: one.id, decision: 'approve', expectedVersion: 0, idempotencyKey: uniqueKey('d') }, controller)
    await expect(decideApprovalRequest(null, { requestId: two.id, decision: 'approve', expectedVersion: 0, idempotencyKey: uniqueKey('d') }, controller)).rejects.toMatchObject({ code: 'STALE_STATE' })
    // The whole decision rolled back: the second request is still pending and nothing changed.
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: two.id } })).status).toBe('pending')
    expect((await prisma.companySettings.findUniqueOrThrow({ where: { singletonKey: 'company' } })).discountApprovalThresholdBps).toBe(750)
  })

  it('rejecting needs a reason; only the requester can withdraw', async () => {
    const asked = await requestCompanyControls(null, { changes: { poApprovalThresholdMinor: '100000' }, reason: 'try', idempotencyKey: uniqueKey('cc') }, owner)
    await expect(decideApprovalRequest(null, { requestId: asked.id, decision: 'reject', reason: ' ', expectedVersion: 0, idempotencyKey: uniqueKey('d') }, controller)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(cancelApprovalRequest(null, { requestId: asked.id, expectedVersion: 0, idempotencyKey: uniqueKey('c') }, controller)).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })
    const withdrawn = await cancelApprovalRequest(null, { requestId: asked.id, expectedVersion: 0, idempotencyKey: uniqueKey('c') }, owner)
    expect(withdrawn.status).toBe('cancelled')
  })

  it('an agent without a grant is refused with SCOPE_DENIED and the attempt is recorded; with a grant it acts and is recorded', async () => {
    const ownerId = (owner.session as { itemId: string }).itemId
    const clientId = uniqueKey('client')
    const app = await prisma.oAuthApp.create({ data: { name: 'Setup agent app', clientId } })
    const agent = await prisma.agentIdentity.create({ data: { name: uniqueKey('Setup agent'), kind: 'llm_agent', ownerId, oauthAppId: app.id, status: 'active' } })
    // An MCP bearer session for an app bound to the agent: the call acts as the agent, not the owner.
    const agentCtx = { session: { ...(owner.session as object), mcp: { clientId, scopes: ['mcp'], tokenId: 't' } }, prisma }
    await expect(loadCompanySetup(null, { idempotencyKey: uniqueKey('agent') }, agentCtx)).rejects.toMatchObject({ code: 'SCOPE_DENIED' })
    expect(await prisma.agentAction.count({ where: { agentId: agent.id, status: 'rejected', tool: 'loadCompanySetup' } })).toBe(1)

    await prisma.agentScopeGrant.create({ data: { agentId: agent.id, tool: 'loadCompanySetup', autonomy: 'auto_within_policy', status: 'active', grantedById: ownerId } })
    const key = uniqueKey('agent')
    const run = await loadCompanySetup(null, { idempotencyKey: key }, agentCtx)
    expect(Object.values(run.created).every(n => n === 0)).toBe(true)
    expect(await prisma.agentAction.count({ where: { agentId: agent.id, status: 'applied', tool: 'loadCompanySetup' } })).toBe(1)

    await prisma.agentIdentity.update({ where: { id: agent.id }, data: { killSwitch: true } })
    await expect(loadCompanySetup(null, { idempotencyKey: uniqueKey('agent') }, agentCtx)).rejects.toMatchObject({ code: 'AGENT_DISABLED' })
  })
})
