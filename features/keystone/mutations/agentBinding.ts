import { actorFor } from './actorFor'
import { op } from './op'
import { command } from '../lib/command'
import { requirePermission, actorUserId } from '../lib/actor'
import { DomainError, Codes } from '../lib/errors'
import { auditCreate } from '../lib/cas'
import { AGENT_ROLE_ID, agentUserId } from '../mcp-oauth/agentSession'

const graphql = String.raw
// A bcrypt hash of 32 discarded random bytes: the agent's service user can never sign in with a password.
const UNUSABLE_PASSWORD_HASH = '$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya'

/*
 * Binding an AI agent to an OAuth app (INTEGRATIONS §6). Tokens issued to a bound app act as the
 * agent: its own least-privilege "AI Agent" role (no permissions, so no cost or margin and no
 * approvals), plus only the tool grants that were approved. They never carry the owner's role.
 */
export const agentBindingTypeDefs = graphql`
  type Query { agentBindings: JSON }
  type Mutation {
    bindAgentApp(agentId: ID!, oauthAppId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    unbindAgentApp(agentId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
  }
`

/** Revoke every live token (access, refresh, unused code) of an OAuth app. */
async function revokeAppTokens(tx: any, appId: string): Promise<number> {
  const app = await tx.oAuthApp.findUnique({ where: { id: appId }, select: { clientId: true } })
  if (!app) return 0
  const result = await tx.oAuthToken.updateMany({ where: { clientId: app.clientId, isRevoked: 'false' }, data: { isRevoked: 'true' } })
  return result.count
}

type Ctx = { session: unknown; prisma: any }

export const agentBindingResolvers = {
  Query: {
    agentBindings: op(async (_root: unknown, _args: unknown, context: Ctx) => {
      const actor = await actorFor(context)
      requirePermission(actor, 'canManageAgents')
      const [agents, apps] = await Promise.all([
        context.prisma.agentIdentity.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true, status: true, killSwitch: true, version: true, owner: { select: { name: true } }, oauthApp: { select: { id: true, name: true, clientId: true, status: true } }, grants: { where: { status: 'active', revokedAt: null }, select: { tool: true } } } }),
        context.prisma.oAuthApp.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, clientId: true, status: true, from_AgentIdentity_oauthApp: { select: { id: true } } } }),
      ])
      return {
        agents: agents.map((a: any) => ({ id: a.id, name: a.name, kind: a.kind, status: a.status, killSwitch: a.killSwitch, version: a.version, owner: a.owner?.name ?? null, app: a.oauthApp, grants: a.grants.length })),
        apps: apps.map((a: any) => ({ id: a.id, name: a.name, clientId: a.clientId, status: a.status, boundTo: a.from_AgentIdentity_oauthApp?.[0]?.id ?? null })),
      }
    }),
  },
  Mutation: {
    bindAgentApp: op(async (_root: unknown, args: { agentId: string; oauthAppId: string; expectedVersion: number; idempotencyKey: string }, context: Ctx) => {
      const actor = await actorFor(context)
      requirePermission(actor, 'canManageAgents')
      const result = await command(context.prisma, { name: 'agent.bind_app', actor, idempotencyKey: args.idempotencyKey, params: { agentId: args.agentId, oauthAppId: args.oauthAppId, expectedVersion: args.expectedVersion } }, async uow => {
        const { tx } = uow
        const agent = await tx.agentIdentity.findUnique({ where: { id: args.agentId }, select: { id: true, name: true, version: true, oauthAppId: true } })
        if (!agent) throw new DomainError(Codes.NOT_FOUND, 'Agent not found.')
        if (agent.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'The agent changed since you loaded it. Reload and try again.', { currentVersion: agent.version })
        const app = await tx.oAuthApp.findUnique({ where: { id: args.oauthAppId }, select: { id: true, name: true } })
        if (!app) throw new DomainError(Codes.NOT_FOUND, 'App not found.')
        const taken = await tx.agentIdentity.findFirst({ where: { oauthAppId: app.id, id: { not: agent.id } }, select: { name: true } })
        if (taken) throw new DomainError(Codes.GUARD_FAILED, `${app.name} is already connected to ${taken.name}.`, { reason: 'app_already_bound' })
        const userId = agentUserId(agent.id)
        const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
        if (existing) await tx.user.update({ where: { id: userId }, data: { roleId: AGENT_ROLE_ID } })
        else await tx.user.create({ data: { id: userId, name: `${agent.name} (agent)`, email: `agent-${agent.id}@agents.invalid`, password: UNUSABLE_PASSWORD_HASH, kind: 'staff', roleId: AGENT_ROLE_ID, title: 'AI agent', onboardingStatus: 'dismissed' } })
        const updated = await tx.agentIdentity.updateMany({ where: { id: agent.id, version: agent.version }, data: { oauthAppId: app.id, version: { increment: 1 } } })
        if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, 'The agent changed since you loaded it. Reload and try again.')
        // Whatever tokens the app had were issued to someone else (or to nobody): none may act as this agent.
        let revoked = await revokeAppTokens(tx, app.id)
        if (agent.oauthAppId && agent.oauthAppId !== app.id) revoked += await revokeAppTokens(tx, agent.oauthAppId)
        auditCreate(uow, actor, 'AgentIdentity', agent.id, 'agent.app_bound', { revokedTokens: revoked, agentId: agent.id, oauthAppId: app.id, previousAppId: agent.oauthAppId, role: AGENT_ROLE_ID, boundBy: actorUserId(actor) })
        return { agentId: agent.id, oauthAppId: app.id, version: agent.version + 1 }
      })
      return { replay: result.replay, ...result.value }
    }),
    unbindAgentApp: op(async (_root: unknown, args: { agentId: string; expectedVersion: number; idempotencyKey: string }, context: Ctx) => {
      const actor = await actorFor(context)
      requirePermission(actor, 'canManageAgents')
      const result = await command(context.prisma, { name: 'agent.unbind_app', actor, idempotencyKey: args.idempotencyKey, params: { agentId: args.agentId, expectedVersion: args.expectedVersion } }, async uow => {
        const { tx } = uow
        const agent = await tx.agentIdentity.findUnique({ where: { id: args.agentId }, select: { id: true, version: true, oauthAppId: true } })
        if (!agent) throw new DomainError(Codes.NOT_FOUND, 'Agent not found.')
        if (agent.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'The agent changed since you loaded it. Reload and try again.', { currentVersion: agent.version })
        const updated = await tx.agentIdentity.updateMany({ where: { id: agent.id, version: agent.version }, data: { oauthAppId: null, version: { increment: 1 } } })
        if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, 'The agent changed since you loaded it. Reload and try again.')
        // Disconnecting ends the app's access at once: every token it holds is revoked in this same transaction.
        const revoked = agent.oauthAppId ? await revokeAppTokens(tx, agent.oauthAppId) : 0
        auditCreate(uow, actor, 'AgentIdentity', agent.id, 'agent.app_unbound', { revokedTokens: revoked, agentId: agent.id, previousAppId: agent.oauthAppId })
        return { agentId: agent.id, version: agent.version + 1 }
      })
      return { replay: result.replay, ...result.value }
    }),
  },
}
