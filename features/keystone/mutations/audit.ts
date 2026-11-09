import { verifyAuditChain as verify } from '../lib/audit'
import { authorizeOperation } from '../lib/agentGate'
import { actorCanReadCost } from '../models/costHidden'
import { actorFor } from './actorFor'

/** Recompute the whole audit hash chain. */
export async function verifyAuditChain(_root: unknown, _args: unknown, context: any) {
  const actor = await actorFor(context)
  await authorizeOperation(context.prisma, actor, 'verifyAuditChain', ['canReadAudit'])
  const result = await verify(context.prisma)
  // The head hash is a chain hash like any other: only people who may read cost see it.
  return actorCanReadCost(actor) ? result : { ...result, lastHash: '' }
}
