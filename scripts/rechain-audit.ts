/**
 * `npm run audit:rechain`: re-keys the audit hash chain (see features/keystone/lib/auditRechain.ts).
 * Needs DATABASE_URL and SESSION_SECRET. Idempotent; run on every release before the app starts.
 */
import { PrismaClient } from '@prisma/client'
import { rechainAuditLog } from '../features/keystone/lib/auditRechain'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database.')
  const prisma = new PrismaClient({ log: [] })
  try {
    const r = await rechainAuditLog(prisma)
    console.log(`audit:rechain ${r.alreadyKeyed ? 'already keyed' : `rewrote ${r.rewritten} of ${r.total - 1} rows`}; chain of ${r.total} verified`)
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error(e instanceof Error ? `${e.name}: ${e.message}` : e); process.exit(1) })
