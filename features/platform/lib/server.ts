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
