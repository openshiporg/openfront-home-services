import { graphql } from '@keystone-6/core'
import { json } from '@keystone-6/core/fields'
import { isSignedIn, type Permission, type Session } from '../access'

/** Whoever sets prices may read internal cost and margin; nobody else, in any field that carries them. */
const COST_PERMISSIONS: Permission[] = ['canManagePriceBook', 'canApprovePriceBook', 'canApproveDiscounts']

export const canReadCost = (session: Session | null | undefined) =>
  !!session && isSignedIn({ session }) && COST_PERMISSIONS.some(name => session.data?.role?.[name] === true)

const COSTLY = /cost|margin/i

/** Remove every cost or margin key, at any depth. Pure; the stored value is never changed. */
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
  const base = (json(config as never) as any)(meta)
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
