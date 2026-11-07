import { randomUUID } from 'node:crypto'
import { payloadHash, toJsonValue } from './canonical'
import { requirePermission, type Actor } from './actor'
import { DomainError, Codes } from './errors'
import type { Db } from './db'
import type { Permission } from '../access'
import type { UnitOfWork } from './unitOfWork'

/*
 * Who may run a domain operation (INTEGRATIONS §11, SCHEMA §16). A person needs one of the
 * permissions. An agent needs an active, non-disabled AgentScopeGrant for the tool: its owner's
 * permissions never carry over. A refused agent call is still written down as an AgentAction
 * (status rejected, SCOPE_DENIED), in its own transaction, so the attempt survives the rollback.
 */

export async function authorizeOperation(db: Db, actor: Actor, tool: string, permissions: Permission[], inputs: unknown = {}) {
  if (actor.kind !== 'agent') return requirePermission(actor, ...permissions)
  if (actor.scopes.has(tool)) return
  await db.agentAction.create({
    data: {
      agentId: actor.agentId, tool, idempotencyKey: `denied:${randomUUID()}`, inputsHash: payloadHash(inputs),
      status: 'rejected', output: toJsonValue({ code: Codes.SCOPE_DENIED }) as never,
    },
  })
  throw new DomainError(Codes.SCOPE_DENIED, `The agent has no active ${tool} grant.`)
}

/** Record an agent's applied call in the command's own transaction (it commits with the effects). */
export async function recordAgentAction(uow: UnitOfWork, actor: Actor, spec: { tool: string; idempotencyKey: string; inputs: unknown; output: unknown }) {
  if (actor.kind !== 'agent') return null
  const row = await uow.tx.agentAction.create({
    data: {
      agentId: actor.agentId, tool: spec.tool, idempotencyKey: `${actor.agentId}:${spec.idempotencyKey}`, inputsHash: payloadHash(spec.inputs),
      status: 'applied', output: toJsonValue(spec.output) as never, appliedEffects: toJsonValue({ auditEvents: uow.pendingAuditCount() }) as never,
    },
  })
  return row.id
}
