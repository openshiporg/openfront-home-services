import { canonicalJson, sha256 } from './canonical'
import { AUDIT_HASH_VERSION, appendAuditEvents, auditHash, auditHashBody, GENESIS_HASH, storedAuditOf, verifyAuditChain } from './audit'
import { advisoryLock, type Db } from './db'

/**
 * Re-chains the audit log under the keyed hash (review r5b m-new-1: a plain SHA-256 chain hash let a
 * reader who could not see cost brute-force the hidden numbers). Every row keeps its seq, content and
 * order; only prevHash and hash are rewritten, and the whole chain is verified before and after.
 *
 * The rows are append-only (trigger), so the one rewrite is made inside one transaction that holds
 * the chain lock, with only that trigger switched off, and is rolled back unless the whole chain
 * verifies. The run is recorded as an audit event. Idempotent: a chain that is already keyed is only verified.
 */
const legacyHash = (prevHash: string, row: Parameters<typeof auditHashBody>[0]) => sha256(`${prevHash}\n${canonicalJson(auditHashBody(row))}`)

export type RechainResult = { rewritten: number; total: number; verified: boolean; alreadyKeyed: boolean }

export async function rechainAuditLog(prisma: Db): Promise<RechainResult> {
  return prisma.$transaction(
    async tx => {
      await advisoryLock(tx, 'audit:chain')
      const rows = await tx.auditEvent.findMany({ orderBy: { seq: 'asc' } })
      let storedPrev = GENESIS_HASH
      let newPrev = GENESIS_HASH
      const changes: { id: string; prevHash: string; hash: string }[] = []
      for (const [index, row] of rows.entries()) {
        if (row.seq !== index + 1) throw new Error(`Audit log has a gap before seq ${row.seq}; refusing to re-chain`)
        if (row.prevHash !== storedPrev) throw new Error(`Audit chain is already broken at seq ${row.seq}; refusing to re-chain`)
        const stored = storedAuditOf(row)
        if (row.hash !== legacyHash(row.prevHash, stored) && row.hash !== auditHash(row.prevHash, stored)) {
          throw new Error(`Audit row ${row.seq} does not match its hash; refusing to re-chain`)
        }
        const hash = auditHash(newPrev, storedAuditOf({ ...row, prevHash: newPrev }))
        if (row.hash !== hash || row.prevHash !== newPrev) changes.push({ id: row.id, prevHash: newPrev, hash })
        storedPrev = row.hash
        newPrev = hash
      }
      if (!changes.length) {
        const check = await verifyAuditChain(tx)
        if (!check.ok) throw new Error(`Audit chain does not verify: ${check.problem}`)
        return { rewritten: 0, total: rows.length, verified: true, alreadyKeyed: true }
      }
      await tx.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_append_only"')
      for (const change of changes) {
        const updated = await tx.$executeRaw`UPDATE "AuditEvent" SET "prevHash" = ${change.prevHash}, "hash" = ${change.hash} WHERE id = ${change.id}`
        if (updated !== 1) throw new Error('Audit re-chain updated an unexpected number of rows')
      }
      await tx.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_append_only"')
      await appendAuditEvents(tx, [{
        eventType: 'audit.chain_rekeyed',
        entityType: 'AuditEvent',
        entityId: 'chain',
        reason: 'Chain hashes are now keyed so they cannot be used to test guesses at hidden values',
        metadata: { hashVersion: AUDIT_HASH_VERSION, rows: rows.length, rewritten: changes.length, firstSeq: rows[0]?.seq ?? null, lastSeq: rows.at(-1)?.seq ?? null },
      }])
      const check = await verifyAuditChain(tx)
      if (!check.ok || check.count !== rows.length + 1) throw new Error(`Audit chain does not verify after re-chain: ${check.problem ?? 'count mismatch'}`)
      return { rewritten: changes.length, total: rows.length + 1, verified: true, alreadyKeyed: false }
    },
    { maxWait: 30_000, timeout: 300_000 }
  )
}
