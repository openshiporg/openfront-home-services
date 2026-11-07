import { verifyAuditChain as verify } from '../lib/audit'
import { authorizeOperation } from '../lib/agentGate'
import { actorFor } from './actorFor'

/** Recompute the whole audit hash chain. */
export async function verifyAuditChain(_root: unknown, _args: unknown, context: any) {
  const actor = await actorFor(context)
  await authorizeOperation(context.prisma, actor, 'verifyAuditChain', ['canReadAudit'])
  return verify(context.prisma)
}
