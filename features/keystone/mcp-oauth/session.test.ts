import { describe, expect, it } from 'vitest'
import { digestToken } from './core'
import { resolveMcpAccessToken } from './session'

/*
 * Review r4 B2: after an app was unbound from its agent, the agent's old token acted as the person who
 * approved it (the owner). A token now names the agent it was issued to, and never falls back.
 */

const TOKEN = 'mcp_at_example-token'
type Rec = Record<string, unknown>

function contextWith(opts: { token?: Rec; app?: Rec | null; agent?: Rec | null }) {
  const token = { id: 't1', tokenType: 'access_token', isRevoked: 'false', userId: 'owner-user', clientId: 'c1', agentId: '', scopes: ['mcp:read'], expiresAt: new Date(Date.now() + 60_000), token: digestToken(TOKEN), ...opts.token }
  const app = opts.app === undefined ? { id: 'app1', clientId: 'c1', status: 'active' } : opts.app
  const agent = opts.agent === undefined ? null : opts.agent
  return {
    sudo: () => ({ db: {
      OAuthToken: { findOne: async () => token },
      OAuthApp: { findOne: async () => app },
      AgentIdentity: { findMany: async () => (agent ? [agent] : []) },
    } }),
  }
}
const agent = (over: Rec = {}) => ({ id: 'agent1', status: 'active', killSwitch: false, ...over })

describe('resolveMcpAccessToken', () => {
  it('acts as the agent while the app is bound to the agent the token was issued to', async () => {
    const s = await resolveMcpAccessToken(contextWith({ token: { agentId: 'agent1' }, agent: agent() }), TOKEN)
    expect(s?.itemId).toBe('agent_user_agent1')
    expect(s?.mcp.agentId).toBe('agent1')
  })
  it('has NO access once the app is unbound: it never falls back to the approving owner', async () => {
    expect(await resolveMcpAccessToken(contextWith({ token: { agentId: 'agent1' }, agent: null }), TOKEN)).toBeUndefined()
  })
  it('has no access when the app is now bound to a different agent', async () => {
    expect(await resolveMcpAccessToken(contextWith({ token: { agentId: 'agent1' }, agent: agent({ id: 'agent2' }) }), TOKEN)).toBeUndefined()
  })
  it('refuses a token with no agent on an app that is bound to an agent', async () => {
    expect(await resolveMcpAccessToken(contextWith({ token: { agentId: '' }, agent: agent() }), TOKEN)).toBeUndefined()
  })
  it('refuses a stopped or paused agent', async () => {
    expect(await resolveMcpAccessToken(contextWith({ token: { agentId: 'agent1' }, agent: agent({ killSwitch: true }) }), TOKEN)).toBeUndefined()
    expect(await resolveMcpAccessToken(contextWith({ token: { agentId: 'agent1' }, agent: agent({ status: 'paused' }) }), TOKEN)).toBeUndefined()
  })
  it('still lets a person use their own connection to an app no agent is bound to', async () => {
    const s = await resolveMcpAccessToken(contextWith({ token: { agentId: '' }, agent: null }), TOKEN)
    expect(s?.itemId).toBe('owner-user')
  })
  it('refuses revoked, expired and suspended-app tokens', async () => {
    expect(await resolveMcpAccessToken(contextWith({ token: { isRevoked: 'true' } }), TOKEN)).toBeUndefined()
    expect(await resolveMcpAccessToken(contextWith({ token: { expiresAt: new Date(Date.now() - 1) } }), TOKEN)).toBeUndefined()
    expect(await resolveMcpAccessToken(contextWith({ app: { id: 'app1', clientId: 'c1', status: 'suspended' } }), TOKEN)).toBeUndefined()
  })
})
