import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma } from '../../../tests/helpers/db'
import { auditHashBody, GENESIS_HASH, verifyAuditChain } from './audit'
import { rechainAuditLog } from './auditRechain'
import { canonicalJson, sha256 } from './canonical'

describe.skipIf(!hasTestDatabase)('audit re-chain (database)', () => {
  let prisma: PrismaClient
  beforeAll(async () => {
    prisma = testPrisma(4)
    await resetDatabase(prisma)
    let prev = GENESIS_HASH
    for (let seq = 1; seq <= 12; seq++) {
      const at = new Date(Date.UTC(2026, 10, 7, 12, seq))
      const row = { seq, eventKey: `legacy-${seq}`, eventType: 'pricebook_version.settings_saved', entityType: 'PriceBookVersion', entityId: 'v1', actorUserId: null, actorAgentId: null, approverId: null, reason: null, before: null, after: { tiers: [{ toCostMinor: String(seq * 500) }] }, metadata: null, requestId: null, prevHash: prev, at }
      const hash = sha256(`${prev}\n${canonicalJson(auditHashBody(row))}`)
      await prisma.auditEvent.create({ data: { seq, eventKey: row.eventKey, eventType: row.eventType, entityType: row.entityType, entityId: row.entityId, after: row.after, prevHash: prev, hash, at } })
      prev = hash
    }
  })
  afterAll(async () => { await prisma?.$disconnect() })

  it('keeps every row and its order, keys every hash, verifies, and is idempotent', async () => {
    const before = await prisma.auditEvent.findMany({ orderBy: { seq: 'asc' } })
    expect((await verifyAuditChain(prisma)).ok).toBe(false) // plain hashes no longer count as a valid chain
    const first = await rechainAuditLog(prisma)
    expect(first).toMatchObject({ rewritten: 12, verified: true, alreadyKeyed: false })
    const after = await prisma.auditEvent.findMany({ orderBy: { seq: 'asc' } })
    expect(after).toHaveLength(13)
    expect(after.slice(0, 12).map(r => [r.seq, r.eventKey, r.after, r.at.toISOString()])).toEqual(before.map(r => [r.seq, r.eventKey, r.after, r.at.toISOString()]))
    expect(after.every(r => /^v2:[0-9a-f]{64}$/.test(r.hash))).toBe(true)
    expect(after.at(-1)?.eventType).toBe('audit.chain_rekeyed')
    expect((await verifyAuditChain(prisma)).ok).toBe(true)
    expect(await rechainAuditLog(prisma)).toMatchObject({ rewritten: 0, alreadyKeyed: true })
    expect(await prisma.auditEvent.count()).toBe(13)
  })

  it('refuses to re-chain a log that was already tampered with, and changes nothing', async () => {
    await prisma.$transaction([
      prisma.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER USER'),
      prisma.$executeRawUnsafe(`UPDATE "AuditEvent" SET reason = 'quietly edited' WHERE seq = 4`),
      prisma.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER USER'),
    ])
    const hashes = (await prisma.auditEvent.findMany({ orderBy: { seq: 'asc' }, select: { hash: true } })).map(r => r.hash)
    await expect(rechainAuditLog(prisma)).rejects.toThrow(/does not match its hash/)
    expect((await prisma.auditEvent.findMany({ orderBy: { seq: 'asc' }, select: { hash: true } })).map(r => r.hash)).toEqual(hashes)
  })
})
