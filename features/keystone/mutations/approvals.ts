import { requirePermission } from '../lib/actor'
import { actorFor } from './actorFor'
import { command } from '../lib/command'
import { consumeApproval, decideApproval } from '../lib/approval'
import { applierFor } from '../lib/approvalAppliers'
import { transition } from '../lib/cas'
import { DomainError, Codes } from '../lib/errors'
import { requestCompanyControlsChange, type CompanyControls } from '../lib/companyControls'

type Ctx = { session: any; prisma: any }

/** Approve or reject a pending request. An approval whose action applies on approval runs now, in the same transaction. */
export async function decideApprovalRequest(_root: unknown, args: { requestId: string; decision: 'approve' | 'reject'; reason?: string | null; expectedVersion: number; idempotencyKey: string }, context: Ctx) {
  const actor = await actorFor(context)
  requirePermission(actor, 'canAccessDashboard')
  if (args.decision !== 'approve' && args.decision !== 'reject') throw new DomainError(Codes.INVALID_INPUT, 'Decision must be approve or reject.')
  if (args.decision === 'reject' && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why you are rejecting it.', { field: 'reason' })
  const result = await command(context.prisma, { name: 'approval.decide', actor, idempotencyKey: args.idempotencyKey, params: { requestId: args.requestId, decision: args.decision, reason: args.reason ?? '', expectedVersion: args.expectedVersion } }, async uow => {
    const decided = await decideApproval(uow, actor, { requestId: args.requestId, decision: args.decision, reason: args.reason ?? undefined, expectedVersion: args.expectedVersion, strictAgentOwner: true })
    let applied: unknown = null
    const registration = applierFor(String(decided.action))
    if (args.decision === 'approve' && registration?.applyOnApprove) {
      const request = await uow.tx.approvalRequest.findUniqueOrThrow({ where: { id: args.requestId } })
      await consumeApproval(uow, { requestId: request.id, action: request.action, targetList: request.targetList, targetId: request.targetId, payload: request.payload })
      applied = await registration.apply(uow, actor, request)
    }
    return { id: decided.id, status: decided.status, applied }
  })
  return { replay: result.replay, ...result.value }
}

/** The requester withdraws a pending request. */
export async function cancelApprovalRequest(_root: unknown, args: { requestId: string; expectedVersion: number; idempotencyKey: string; reason?: string | null }, context: Ctx) {
  const actor = await actorFor(context)
  requirePermission(actor, 'canAccessDashboard')
  const result = await command(context.prisma, { name: 'approval.cancel', actor, idempotencyKey: args.idempotencyKey, params: args }, async uow => {
    const row = await transition<{ id: string; status: string; requestedById: string | null }>(uow, {
      model: 'ApprovalRequest', id: args.requestId, from: ['pending'], to: 'cancelled', expectedVersion: args.expectedVersion, actor,
      eventType: 'approval.cancelled', reason: args.reason ?? null,
      guard: request => {
        if (actor.kind !== 'user' || request.requestedById !== actor.userId) throw new DomainError(Codes.NOT_AUTHORIZED, 'Only the person who asked can withdraw a request.')
      },
    })
    return { id: row.id, status: row.status }
  })
  return { replay: result.replay, ...result.value }
}

/** Ask for a change to the company-wide approval thresholds; a second person with canApprovePolicies approves it. */
export async function requestCompanyControls(_root: unknown, args: { changes: CompanyControls; reason: string; idempotencyKey: string }, context: Ctx) {
  const actor = await actorFor(context)
  requirePermission(actor, 'canManageCompany', 'canManagePolicies')
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why the controls should change.', { field: 'reason' })
  const result = await command(context.prisma, { name: 'company.controls.request', actor, idempotencyKey: args.idempotencyKey, params: args }, async uow => {
    const request = await requestCompanyControlsChange(uow, actor, args.changes, args.reason.trim())
    return { id: request.id, status: request.status }
  })
  return { replay: result.replay, ...result.value }
}
