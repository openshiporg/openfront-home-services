import { graphql } from '@keystone-6/core'
import { json, text } from '@keystone-6/core/fields'
import { isSignedIn, type Permission, type Session } from '../access'

/** Whoever sets prices may read internal cost and margin; nobody else, in any field that carries them. */
export const COST_PERMISSIONS: Permission[] = ['canManagePriceBook', 'canApprovePriceBook', 'canApproveDiscounts']

/**
 * An agent session (an MCP token whose OAuth app is bound to an AgentIdentity) is marked by
 * `session.agent` and gets the least-privilege "AI Agent" role, so it never reads cost; the explicit
 * check here keeps that true even if someone later widens that role.
 */
export const canReadCost = (session: (Session & { agent?: unknown }) | null | undefined) =>
  !!session && !session.agent && isSignedIn({ session }) && COST_PERMISSIONS.some(name => session.data?.role?.[name] === true)

/** The same rule for a domain actor (a person with a price-setting permission; never an agent). */
export const actorCanReadCost = (actor: { kind: string; permissions?: ReadonlySet<string> }) =>
  actor.kind === 'user' && COST_PERMISSIONS.some(name => actor.permissions?.has(name))

/**
 * Field options for any column that carries cost or margin. Hiding the value is not enough: a
 * filter or sort on a hidden field still answers "is it below N?", so a binary search recovers it.
 * Read, filter and order all follow the one rule.
 */
const costRule = ({ session }: { session?: Session | null }) => canReadCost(session)
export const costOnly = { access: { read: costRule }, isFilterable: costRule, isOrderable: costRule }

/**
 * A server-written hash that covers cost (older rows are plain SHA-256 over lines that include the unit
 * cost, so anyone who could read one could try numbers until it matched). Readable, filterable and
 * orderable only by the people who may read cost; filtering by it would be a guessing oracle.
 */
export const costHash = (options: { required?: boolean } = {}) =>
  text({
    validation: { isRequired: options.required ?? false },
    access: { create: () => false, update: () => false, read: costRule },
    isFilterable: costRule,
    isOrderable: costRule,
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

// Cost and margin keys, plus the hashes that were computed over cost (see costHash).
const COSTLY = /cost|margin|^(contentHash|quoteHash)$/i

/** Remove every cost, margin or cost-bound hash key, at any depth. Pure; the stored value is never changed. */
export function withoutCost(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCost)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !COSTLY.test(key)).map(([key, v]) => [key, withoutCost(v)]))
  }
  return value
}

/**
 * A JSON field for frozen price snapshots. The stored snapshot keeps the unit cost (the quote hash
 * binds to it), but the API returns it with cost and margin removed unless the reader sets prices.
 * This is the one read path for GraphQL, the dashboard and MCP queryData.
 */
export const costGuardedJson = (config: Parameters<typeof json>[0] = {}) => (meta: any) => {
  const base = (json({ ...config, isFilterable: false, isOrderable: false } as never) as any)(meta)
  return {
    ...base,
    output: graphql.field({
      type: graphql.JSON,
      resolve({ value }: { value: unknown }, _args: unknown, context: { session?: Session }): any {
        return canReadCost(context.session) ? value : withoutCost(value)
      },
    }),
  }
}
