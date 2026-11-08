/**
 * `npm run policies:ensure`: the release step. Loads the federal and Texas policy packs, versions
 * and bindings into the database named by DATABASE_URL, then verifies every required one is
 * present and exits non-zero if not, so a release never goes live without them.
 *
 * Idempotent: rows are created by deterministic id and existing ones are never rewritten. The
 * command key includes a fingerprint of the packs, so adding a pack or version in code loads it on
 * the next release while an unchanged release replays and does nothing.
 */
import { PrismaClient } from '@prisma/client'
import { payloadHash } from '../features/keystone/lib/canonical'
import { systemActor } from '../features/keystone/lib/actor'
import { command } from '../features/keystone/lib/command'
import { POLICY_PACKS } from '../features/keystone/seed/policyPacks'
import { missingPolicies } from '../features/keystone/seed/policyReadiness'
import { seedPolicyPacks } from '../features/keystone/seed/platform'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database.')
  const prisma = new PrismaClient({ log: [] })
  try {
    const actor = systemActor('release')
    // A company that has not been loaded yet has nothing to attach packs to; packs are global, so load anyway.
    const fingerprint = payloadHash(POLICY_PACKS.map(p => [p.id, p.version.id, p.next?.id ?? null])).slice(0, 16)
    const before = await missingPolicies(prisma)
    if (before.length) {
      const result = await command(prisma, { name: 'setup.ensure_policies', actor, idempotencyKey: `release:policies:${fingerprint}:${before.length}`, params: {} }, uow => seedPolicyPacks(uow, actor))
      console.log(`policies:ensure loaded ${JSON.stringify(result.value)}${result.replay ? ' (replayed)' : ''}`)
    }
    const after = await missingPolicies(prisma)
    if (after.length) {
      console.error(`policies:ensure FAILED. Missing: ${after.join('; ')}`)
      process.exit(1)
    }
    console.log(`policies:ensure ok: ${POLICY_PACKS.length} packs bound and current`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
  process.exit(1)
})
