import { PrismaClient } from '@prisma/client'
import { missingPolicies } from '@/features/keystone/seed/policyReadiness'

export const dynamic = 'force-dynamic'

let prisma: PrismaClient | undefined

/** Healthy only when the database answers and every required policy pack and binding is loaded. */
export async function GET() {
  try {
    prisma ??= new PrismaClient({ log: [] })
    const missing = await missingPolicies(prisma)
    if (missing.length) return Response.json({ status: 'unhealthy', reason: 'policy_missing', missing }, { status: 503 })
    return Response.json({ status: 'ok', policies: 'complete' })
  } catch {
    return Response.json({ status: 'unhealthy', reason: 'database_unavailable' }, { status: 503 })
  }
}
