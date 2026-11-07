import { isSignedIn, type Permission, type Session } from '../access'

/*
 * Row filters for staff who see only their own work (SCHEMA §19). Office roles with any of the broad
 * permissions see every row; a technician (canWorkVisits only) sees visits they are actively assigned
 * to, the jobs of those visits, and the customers and locations of jobs within ±7 days.
 */

type Args = { session?: Session | null }

const has = (session: Session | null | undefined, names: Permission[]) => names.some(name => session?.data.role?.[name] === true)

export const OFFICE_READ: Permission[] = ['canManageCustomers', 'canBook', 'canViewBoard', 'canDispatch', 'canManageInvoices', 'canManageLeads']

const assignedTo = (userId: string) => ({ some: { active: { equals: true }, employee: { user: { id: { equals: userId } } } } })

/** Visits the signed-in technician is assigned to. */
export const visitFilter = (userId: string) => ({ assignments: assignedTo(userId) })

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Jobs with a visit the technician is assigned to, optionally limited to ±7 days of now. */
export const jobFilter = (userId: string, windowed = false) => ({
  visits: { some: { ...visitFilter(userId), ...(windowed ? { plannedStart: { gte: new Date(Date.now() - WEEK_MS), lte: new Date(Date.now() + WEEK_MS) } } : {}) } },
})

/** Query rule: office readers, plus technicians (row-filtered). */
export const officeOrTech = (extra: Permission[] = []) => ({ session }: Args) =>
  isSignedIn({ session }) && (has(session, [...OFFICE_READ, ...extra]) || has(session, ['canWorkVisits']))

/** Builds the row filter: everything for office readers, `own(userId)` for technicians. */
export const scoped = (own: (userId: string) => Record<string, unknown>, extra: Permission[] = []) => ({ session }: Args) => {
  if (!isSignedIn({ session })) return false
  if (has(session, [...OFFICE_READ, ...extra])) return true
  if (has(session, ['canWorkVisits'])) return own(session!.itemId)
  return false
}
