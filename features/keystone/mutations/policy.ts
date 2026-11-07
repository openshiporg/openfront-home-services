import { authorizeOperation } from '../lib/agentGate'
import { actorFor } from './actorFor'
import { resolvePolicyFromDb } from '../domain/policy'
import { DomainError, Codes } from '../lib/errors'
import { POLICY_KINDS, type PolicyKind } from '../models/policy'

/** Which policy version governs a place on a date (read-only; fails closed on ambiguity). */
export async function resolvePolicyQuery(_root: unknown, args: { kind: string; state?: string | null; county?: string | null; city?: string | null; zip?: string | null; branchId?: string | null; on: string }, context: any) {
  const actor = await actorFor(context)
  await authorizeOperation(context.prisma, actor, 'policy.resolve', ['canAccessDashboard'], args)
  if (!(POLICY_KINDS as readonly string[]).includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, `Unknown policy kind ${args.kind}.`, { field: 'kind' })
  return resolvePolicyFromDb(context.prisma, args.kind as PolicyKind, { state: args.state, county: args.county, city: args.city, zip: args.zip, branchId: args.branchId }, args.on)
}
