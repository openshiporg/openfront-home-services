import { isSignedIn, type Permission, type Session } from '../access'
import { canReadCost } from './costHidden'

type Args = { session?: (Session & { agent?: unknown }) | null }
const has = (session: Args['session'], names: readonly Permission[]) => names.some(name => session?.data?.role?.[name] === true)

/**
 * Row access for Phase 5 lists (equipment, stock, permits, refrigerant). Staff holding any of `all` see every row. A technician
 * (canWorkVisits) sees only rows `own(userId)` selects: a real field or relationship, never a loose "signed in". Nobody else sees
 * the list at all. Writes are never open: every change goes through a command.
 */
export const rowAccess = (all: readonly Permission[], own?: (userId: string) => Record<string, unknown>) => ({
  operation: {
    query: ({ session }: Args) => isSignedIn({ session }) && (has(session, all) || (!!own && has(session, ['canWorkVisits']))),
    create: () => false, update: () => false, delete: () => false,
  },
  filter: {
    query: ({ session }: Args) => {
      if (!isSignedIn({ session })) return false
      if (has(session, all)) return true
      if (own && has(session, ['canWorkVisits'])) return own(session!.itemId)
      return false
    },
  },
})

/** The people who buy and receive stock, and those who set prices, may read what stock cost. Agents never do. */
export const PURCHASING: readonly Permission[] = ['canPurchase', 'canApprovePurchases', 'canManageAccounting']
export const purchaseCostRule = ({ session }: Args) => !!session && !session.agent && isSignedIn({ session }) && (canReadCost(session) || has(session, PURCHASING))

/** Cost columns of stock and purchasing: read, filter and order all follow one rule (a filter on a hidden cost is a guessing oracle). */
export const purchaseCost = { access: { read: purchaseCostRule }, isFilterable: purchaseCostRule, isOrderable: purchaseCostRule }
