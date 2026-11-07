import { DomainError, Codes } from './errors'
import { registerApplier } from './approvalAppliers'
import { requestApproval } from './approval'
import type { Actor } from './actor'
import type { UnitOfWork } from './unitOfWork'

/**
 * Company-wide money controls (the discount, refund and purchase-order approval thresholds; SCHEMA
 * §1.1) change only through maker-checker. One person requests, a second person with
 * canApprovePolicies approves, then the change applies against the version that was approved
 * (STATE-MACHINES §0). Loosening a control is a policy decision, so it is never self-service.
 */

export type CompanyControls = {
  discountApprovalThresholdBps?: number
  refundApprovalThresholdMinor?: string
  poApprovalThresholdMinor?: string
}

const CONTROL_KEYS = ['discountApprovalThresholdBps', 'refundApprovalThresholdMinor', 'poApprovalThresholdMinor'] as const

const minorIn = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${name} must be whole cents as a string, e.g. "50000".`, { field: name })
  return BigInt(value)
}

export function validateCompanyControls(input: CompanyControls) {
  const keys = Object.keys(input ?? {})
  if (!keys.length) throw new DomainError(Codes.INVALID_INPUT, 'Nothing to change.')
  for (const key of keys) if (!(CONTROL_KEYS as readonly string[]).includes(key)) throw new DomainError(Codes.INVALID_INPUT, `${key} is not a company control.`, { field: key })
  const out: Record<string, number | string> = {}
  if (input.discountApprovalThresholdBps !== undefined) {
    const v = input.discountApprovalThresholdBps
    if (!Number.isSafeInteger(v) || v < 0 || v > 10_000) throw new DomainError(Codes.INVALID_INPUT, 'discountApprovalThresholdBps must be a whole number from 0 to 10000.', { field: 'discountApprovalThresholdBps' })
    out.discountApprovalThresholdBps = v
  }
  if (input.refundApprovalThresholdMinor !== undefined) out.refundApprovalThresholdMinor = minorIn(input.refundApprovalThresholdMinor, 'refundApprovalThresholdMinor').toString()
  if (input.poApprovalThresholdMinor !== undefined) out.poApprovalThresholdMinor = minorIn(input.poApprovalThresholdMinor, 'poApprovalThresholdMinor').toString()
  return out as CompanyControls
}

const toData = (changes: CompanyControls) => ({
  ...(changes.discountApprovalThresholdBps !== undefined ? { discountApprovalThresholdBps: changes.discountApprovalThresholdBps } : {}),
  ...(changes.refundApprovalThresholdMinor !== undefined ? { refundApprovalThresholdMinor: BigInt(changes.refundApprovalThresholdMinor) } : {}),
  ...(changes.poApprovalThresholdMinor !== undefined ? { poApprovalThresholdMinor: BigInt(changes.poApprovalThresholdMinor) } : {}),
})

export async function requestCompanyControlsChange(uow: UnitOfWork, actor: Actor, input: CompanyControls, reason: string) {
  const changes = validateCompanyControls(input)
  const company = await uow.tx.companySettings.findUnique({ where: { singletonKey: 'company' } })
  if (!company) throw new DomainError(Codes.NOT_FOUND, 'Company settings are not set up yet.')
  return requestApproval(uow, actor, {
    action: 'company.controls',
    targetList: 'CompanySettings',
    targetId: String(company.id),
    payload: { changes, baseVersion: company.version },
    requiredPermission: 'canApprovePolicies',
    summary: `Change company controls: ${Object.keys(changes).join(', ')}${reason ? ` (${reason})` : ''}`,
  })
}

registerApplier('company.controls', async (uow, actor, request) => {
  const [company] = await uow.tx.$queryRaw<{ id: number; version: number }[]>`SELECT id, version FROM "CompanySettings" WHERE "singletonKey" = 'company' FOR UPDATE`
  if (!company) throw new DomainError(Codes.NOT_FOUND, 'Company settings are not set up yet.')
  const { changes, baseVersion } = request.payload as { changes: CompanyControls; baseVersion: number }
  if (company.version !== baseVersion) throw new DomainError(Codes.STALE_STATE, 'Company settings changed after this was approved. Request the change again.', { currentVersion: company.version })
  const before = await uow.tx.companySettings.findUnique({ where: { id: company.id }, select: { discountApprovalThresholdBps: true, refundApprovalThresholdMinor: true, poApprovalThresholdMinor: true } })
  const updated = await uow.tx.companySettings.updateMany({ where: { id: company.id, version: baseVersion }, data: { ...toData(changes), version: { increment: 1 } } })
  if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, 'Company settings changed while applying.')
  uow.audit({
    eventType: 'company.controls_changed', entityType: 'CompanySettings', entityId: String(company.id), actorUserId: actor.kind === 'user' ? actor.userId : null,
    before: before ? { ...before, refundApprovalThresholdMinor: before.refundApprovalThresholdMinor.toString(), poApprovalThresholdMinor: before.poApprovalThresholdMinor.toString() } : null,
    after: changes,
  })
  return { applied: Object.keys(changes) }
})
