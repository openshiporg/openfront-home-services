import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

/** Staff reads go through the signed-in session, so list access rules still apply. */
export async function q<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
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
