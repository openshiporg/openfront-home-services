import { requirePermission } from '../lib/actor'
import { authorizeOperation, recordAgentAction } from '../lib/agentGate'
import { actorFor } from './actorFor'
import { command } from '../lib/command'
import { DomainError, Codes } from '../lib/errors'
import { seedCompanyPlatform } from '../seed/platform'
import { seedOperations } from '../seed/operations'
import { materializeWindows } from '../services/booking'
import { localDate } from '../lib/calendar'

/** Onboarding: load the Summit Plumbing & Air company spine. Idempotent per key and per record. */
export async function loadCompanySetup(_root: unknown, args: { idempotencyKey: string }, context: any) {
  const actor = await actorFor(context)
  await authorizeOperation(context.prisma, actor, 'loadCompanySetup', ['canManageOnboarding'])
  const result = await command(context.prisma, { name: 'setup.load_company', actor, idempotencyKey: args.idempotencyKey, params: {} }, async uow => {
    const created = await seedCompanyPlatform(uow, actor)
    await recordAgentAction(uow, actor, { tool: 'loadCompanySetup', idempotencyKey: args.idempotencyKey, inputs: {}, output: created })
    return created
  })
  return { replay: result.replay, created: result.value }
}

/**
 * Onboarding step 2: Summit's technicians, licences, job types, arrival windows, on-call, campaigns
 * and households, then the next 21 days of windows and shifts. Needs the company spine first.
 */
export async function loadOperationsSetup(_root: unknown, args: { idempotencyKey: string }, context: any) {
  const actor = await actorFor(context)
  await authorizeOperation(context.prisma, actor, 'loadOperationsSetup', ['canManageOnboarding'])
  if (!(await context.prisma.businessUnit.count({ where: { id: { startsWith: 'seed_bu_' } } }))) throw new DomainError(Codes.GUARD_FAILED, 'Load the company first.', { reason: 'company_missing' })
  const result = await command(context.prisma, { name: 'setup.load_operations', actor, idempotencyKey: args.idempotencyKey, params: {} }, async uow => {
    const created = await seedOperations(uow, actor)
    await recordAgentAction(uow, actor, { tool: 'loadOperationsSetup', idempotencyKey: args.idempotencyKey, inputs: {}, output: created })
    return created
  })
  const systemActorForWindows = actor.kind === 'agent' ? { kind: 'system' as const, name: 'setup' } : actor
  const windows = await materializeWindows(context.prisma, systemActorForWindows, { from: localDate({ timeZone: 'America/Chicago' }, new Date()), days: 21, idempotencyKey: `${args.idempotencyKey}:windows` })
  return { replay: result.replay, created: { ...result.value, windows: windows.created, shifts: windows.shifts } }
}

const ONBOARDING = ['not_started', 'in_progress', 'completed', 'dismissed']

/** Finish or dismiss onboarding (vertical-builder §06). CAS on the company row. */
export async function setCompanyOnboardingStatus(_root: unknown, args: { status: string; expectedVersion: number; idempotencyKey: string }, context: any) {
  const actor = await actorFor(context)
  requirePermission(actor, 'canManageOnboarding')
  if (!ONBOARDING.includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, 'Unknown onboarding status.', { field: 'status' })
  const result = await command(context.prisma, { name: 'company.onboarding_status', actor, idempotencyKey: args.idempotencyKey, params: { status: args.status, expectedVersion: args.expectedVersion } }, async uow => {
    const [company] = await uow.tx.$queryRaw<{ id: number; version: number; onboardingStatus: string }[]>`SELECT id, version, "onboardingStatus" FROM "CompanySettings" WHERE "singletonKey" = 'company' FOR UPDATE`
    if (!company) throw new DomainError(Codes.NOT_FOUND, 'Company settings are not set up yet.')
    if (company.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'Company settings changed since you loaded them. Reload and try again.', { currentVersion: company.version })
    if (company.onboardingStatus === args.status) return { status: args.status, version: company.version }
    const updated = await uow.tx.companySettings.updateMany({ where: { id: company.id, version: company.version }, data: { onboardingStatus: args.status, version: { increment: 1 } } })
    if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, 'Company settings changed since you loaded them. Reload and try again.')
    uow.audit({ eventType: 'company.onboarding_status_changed', entityType: 'CompanySettings', entityId: String(company.id), actorUserId: actor.kind === 'user' ? actor.userId : null, before: { onboardingStatus: company.onboardingStatus, version: company.version }, after: { onboardingStatus: args.status, version: company.version + 1 } })
    return { status: args.status, version: company.version + 1 }
  })
  return { replay: result.replay, ...result.value }
}
