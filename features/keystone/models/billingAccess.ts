import { isSignedIn, sys, type Permission, type Session } from '../access'
import { jobFilter } from './scope'

/*
 * Read access for money rows (invoices, payments, refunds, credit memos). Shared by billing.ts and sales.ts (Payment and
 * Refund live there) so both follow the billing permissions, not the sales ones.
 */

type Args = { session?: Session | null }
const has = (session: Session | null | undefined, names: Permission[]) => names.some(name => session?.data?.role?.[name] === true)

/** People who run billing see every row. */
export const BILLING_OFFICE: Permission[] = [
  'canManageInvoices', 'canPostInvoices', 'canManagePayments', 'canIssueRefunds', 'canApproveWriteOff', 'canApproveCredits', 'canApproveRefunds', 'canManageAccounting', 'canCloseAr', 'canApproveArClose',
]
/** Counter staff who take payments and offer financing see billing rows too; a technician sees only their own jobs'. */
const COUNTER: Permission[] = ['canTakePayments', 'canOfferFinancing']

const billingQuery = ({ session }: Args) => isSignedIn({ session }) && (has(session, BILLING_OFFICE) || has(session, COUNTER))
export const officeOnlyQuery = ({ session }: Args) => isSignedIn({ session }) && has(session, BILLING_OFFICE)

/** Rows that hang off a job: office sees all, counter staff all except a technician, who sees assigned jobs. */
export const jobScoped = (path: (own: Record<string, unknown>) => Record<string, unknown>) => ({
  operation: { query: billingQuery, create: sys, update: sys, delete: sys },
  filter: {
    query: ({ session }: Args) => {
      if (!isSignedIn({ session })) return false
      if (has(session, BILLING_OFFICE)) return true
      if (has(session, ['canWorkVisits'])) return path(jobFilter(session!.itemId))
      return has(session, COUNTER) ? true : false
    },
  },
})
