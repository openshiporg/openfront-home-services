import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { keystoneContext } from '@/features/keystone/context'
import { advanceTimedStates } from '@/features/keystone/services/maintenance'

/** Staff reads go through the signed-in session, so list access rules still apply. */
export async function q<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  // Holds, price book versions, estimates and notices that have run out are brought up to date by the
  // request that reads them (no background timer exists).
  await advanceTimedStates(keystoneContext.prisma as never)
  const r = await keystoneClient<T>(query, variables)
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

/** The company's home time zone (CompanySettings.homeTimeZone), Central by default. */
export async function companyTimeZone(): Promise<string> {
  try {
    const d: any = await q(`{ companySettings { homeTimeZone } }`)
    return d.companySettings?.homeTimeZone || 'America/Chicago'
  } catch {
    return 'America/Chicago'
  }
}

/** Today's date (YYYY-MM-DD) in the company's time zone. */
export function localToday(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

/** A calendar date plus n days (pure date arithmetic, no time zone). */
export function plusDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The request time, read once per render (kept out of components so renders stay pure). */
export const requestTime = () => Date.now()

/** The signed-in person and their role flags, for deciding which controls (and which internal fields) a screen asks for. */
export async function viewer(): Promise<{ id: string; name: string; can: (permission: string) => boolean }> {
  try {
    const d: any = await q(`{ authenticatedItem { ... on User { id name role { canManagePriceBook canApprovePriceBook canApproveDiscounts canPresentEstimates canSellEstimates canManageCustomers canBook canDispatch canManageInvoices canApprovePolicies canPostInvoices canTakePayments canManagePayments canIssueRefunds canOfferFinancing canManageAccounting canCloseAr canApproveWriteOff canApproveCredits canApproveRefunds canReadAudit canManageMemberships canSellMemberships canManageCustomers } } } }`)
    const u = d.authenticatedItem
    const role: Record<string, boolean> = u?.role ?? {}
    return { id: u?.id ?? '', name: u?.name ?? '', can: (permission: string) => role[permission] === true }
  } catch {
    return { id: '', name: '', can: () => false }
  }
}
