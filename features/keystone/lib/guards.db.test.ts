import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'

/*
 * Database backstops from the init_home_services raw SQL (SCHEMA G8, §21). These hold even for
 * someone writing straight to the database, not only through the application.
 */
describe.skipIf(!hasTestDatabase)('database guards (raw SQL)', () => {
  let prisma: PrismaClient
  const H = 'a'.repeat(64)

  beforeAll(async () => {
    prisma = testPrisma(4)
    await resetDatabase(prisma)
  })
  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('an active policy version cannot change its rules or be deleted; it may only be retired', async () => {
    const pack = await prisma.policyPack.create({ data: { code: uniqueKey('pack'), name: 'Test pack', kind: 'lien', jurisdictionCode: 'US-TX' } })
    const v = await prisma.policyVersion.create({ data: { packId: pack.id, versionNumber: 1, effectiveFrom: new Date('2026-01-01T00:00:00Z'), rules: { a: 1 }, sourceRefs: [], status: 'active', contentHash: H } })
    await expect(prisma.policyVersion.update({ where: { id: v.id }, data: { rules: { a: 2 } } })).rejects.toThrow(/immutable/)
    await expect(prisma.policyVersion.delete({ where: { id: v.id } })).rejects.toThrow(/cannot be deleted/)
    await prisma.policyVersion.update({ where: { id: v.id }, data: { status: 'retired', effectiveTo: new Date('2026-12-31T00:00:00Z') } })
    await expect(prisma.policyVersion.update({ where: { id: v.id }, data: { status: 'active' } })).rejects.toThrow(/reactivated/)
    // A draft is still editable.
    const draft = await prisma.policyVersion.create({ data: { packId: pack.id, versionNumber: 2, effectiveFrom: new Date('2027-01-01T00:00:00Z'), rules: { a: 3 }, sourceRefs: [], status: 'draft', contentHash: '' } })
    await prisma.policyVersion.update({ where: { id: draft.id }, data: { rules: { a: 4 } } })
  })

  it('a provider observation keeps its content; appliedAt is set once', async () => {
    const o = await prisma.providerObservation.create({ data: { source: 'stripe', kind: 'webhook', externalId: uniqueKey('evt'), contentHash: H, signatureVerified: true, payload: { amount: 100 } } })
    await expect(prisma.providerObservation.update({ where: { id: o.id }, data: { payload: { amount: 1 } } })).rejects.toThrow(/immutable/)
    await prisma.providerObservation.update({ where: { id: o.id }, data: { appliedAt: new Date() } })
    await expect(prisma.providerObservation.update({ where: { id: o.id }, data: { appliedAt: new Date(Date.now() + 1000) } })).rejects.toThrow(/already applied/)
    await expect(prisma.providerObservation.delete({ where: { id: o.id } })).rejects.toThrow(/evidence/)
  })

  it('agent grants keep agent and tool, cannot be deleted, stay revoked, and only one is active per tool', async () => {
    const owner = await prisma.user.create({ data: { name: 'Owner', email: `${uniqueKey('o')}@test.local`, password: 'x'.repeat(60) } })
    const agent = await prisma.agentIdentity.create({ data: { name: uniqueKey('agent'), ownerId: owner.id, status: 'active' } })
    const g = await prisma.agentScopeGrant.create({ data: { agentId: agent.id, tool: 'booking.hold', autonomy: 'propose_only', status: 'active' } })
    await expect(prisma.agentScopeGrant.create({ data: { agentId: agent.id, tool: 'booking.hold', autonomy: 'propose_only', status: 'active' } })).rejects.toThrow(/AgentScopeGrant_one_active|Unique constraint/)
    await expect(prisma.agentScopeGrant.update({ where: { id: g.id }, data: { tool: 'refund.issue' } })).rejects.toThrow(/immutable/)
    await expect(prisma.agentScopeGrant.delete({ where: { id: g.id } })).rejects.toThrow(/revoke instead/)
    await prisma.agentScopeGrant.update({ where: { id: g.id }, data: { status: 'revoked', revokedAt: new Date() } })
    await expect(prisma.agentScopeGrant.update({ where: { id: g.id }, data: { status: 'active' } })).rejects.toThrow(/stays revoked/)
  })

  it('document versions are append-only', async () => {
    const doc = await prisma.document.create({ data: { title: 'Notice', kind: 'cancellation_notice' } })
    const v = await prisma.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, storageKey: 'k', sha256: H, mimeType: 'application/pdf' } })
    await expect(prisma.documentVersion.update({ where: { id: v.id }, data: { storageKey: 'other' } })).rejects.toThrow(/append-only/)
    await expect(prisma.documentVersion.delete({ where: { id: v.id } })).rejects.toThrow(/append-only/)
  })

  it('status values are closed sets and thresholds stay in range', async () => {
    await expect(prisma.task.create({ data: { kind: 'x', title: 'x', status: 'whatever' } })).rejects.toThrow(/Task_status_valid/)
    await expect(prisma.companySettings.create({ data: { id: 1, discountApprovalThresholdBps: 20_000 } })).rejects.toThrow(/CompanySettings_thresholds/)
  })
})
