/**
 * `tsx scripts/rename-test-records.ts`: gives the records that were made while the product was being
 * reviewed the names a real shop would use, so staff never see "review" or "QA" in the product.
 *
 * Every change is one audited command (append-only history: the old text is kept in the audit event),
 * idempotent (a second run changes nothing), and touches names and notes only: no price, grant,
 * status or immutable column is written.
 */
import { PrismaClient } from '@prisma/client'
import { systemActor } from '../features/keystone/lib/actor'
import { command } from '../features/keystone/lib/command'

type Rename = { model: 'agentIdentity' | 'oAuthApp' | 'priceBookVersion' | 'approvalRequest' | 'visitAssignment'; id: string; field: string; from: string; to: string; extra?: Record<string, unknown> }

const RENAMES: Rename[] = [
  { model: 'agentIdentity', id: 'cmw8fq4zt0001oa95jhk4eyto', field: 'name', from: 'Summit dispatch assistant (review r3)', to: 'Summit dispatch assistant' },
  { model: 'agentIdentity', id: 'cmw8fq4zt0001oa95jhk4eyto', field: 'provider', from: 'review', to: '' },
  { model: 'oAuthApp', id: 'cmw8fpn1h00fdoa01wghoy5x0', field: 'name', from: 'Summit dispatch assistant (review)', to: 'Summit dispatch assistant' },
  { model: 'oAuthApp', id: 'cmw8irqip0005nx6yg9884b8l', field: 'name', from: 'QA control client r3', to: 'Retired scheduling connector' },
  { model: 'priceBookVersion', id: 'cmw8isyab0007nx6ydsqulwsh', field: 'label', from: 'Restore PLB-ANGLE-STOP to $195 (undo review test change)', to: 'Angle stop back to $195' },
  { model: 'priceBookVersion', id: 'cmw8it93z009wnx6ymrzv14eb', field: 'label', from: 'Scheduled activation check (no price change)', to: 'Scheduled price book check (no price change)' },
]

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database.')
  const prisma = new PrismaClient({ log: [] })
  const actor = systemActor('rename-test-records')
  try {
    // Free-text notes that mention the review are rewritten by pattern, so nothing depends on ids.
    const summaries = await prisma.approvalRequest.findMany({ where: { OR: [{ summary: { contains: 'review test' } }, { summary: { contains: 'prove the background worker' } }] }, select: { id: true, summary: true } })
    for (const s of summaries) {
      const to = s.summary
        .replace('Restores the $195 flat rate for the angle stop that a review test raised to $225.', 'Restores the $195 flat rate for the angle stop.')
        .replace('Same prices as the live version, scheduled to prove the background worker activates due versions.', 'Same prices as the live version, scheduled for a later start.')
      if (to !== s.summary) RENAMES.push({ model: 'approvalRequest', id: s.id, field: 'summary', from: s.summary, to })
    }
    const overrides = await prisma.visitAssignment.findMany({ where: { overrideReason: { startsWith: 'reviewer:' } }, select: { id: true, overrideReason: true } })
    for (const o of overrides) RENAMES.push({ model: 'visitAssignment', id: o.id, field: 'overrideReason', from: o.overrideReason, to: 'Availability not checked' })

    for (const r of RENAMES) {
      const db = (prisma as any)[r.model]
      const row = await db.findUnique({ where: { id: r.id }, select: { [r.field]: true } })
      if (!row || row[r.field] !== r.from) { console.log(`skip ${r.model}.${r.field} ${r.id} (${row ? 'already changed' : 'missing'})`); continue }
      await command(prisma, { name: 'cleanup.rename_test_record', actor, idempotencyKey: `rename-test:${r.model}:${r.id}:${r.field}`, params: { id: r.id, field: r.field, to: r.to } }, async uow => {
        await (uow.tx as any)[r.model].update({ where: { id: r.id }, data: { [r.field]: r.to } })
        uow.audit({ eventType: 'record.renamed', entityType: r.model, entityId: r.id, actorUserId: null, actorAgentId: null, reason: 'Test names replaced with the names a shop would use', before: { [r.field]: r.from }, after: { [r.field]: r.to }, metadata: {} })
        return { ok: true }
      })
      console.log(`renamed ${r.model}.${r.field} ${r.id}: "${r.from.slice(0, 60)}" -> "${r.to.slice(0, 60)}"`)
    }
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
