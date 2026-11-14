import { existsSync } from 'node:fs'
import path from 'node:path'
import { cache } from 'react'
import { keystoneContext } from '@/features/keystone/context'
import { systemActor } from '@/features/keystone/lib/actor'
import { addDays, localDate } from '@/features/keystone/lib/calendar'
import { dec } from '@/features/keystone/lib/decimal'
import { availableWindows, materializeWindows } from '@/features/keystone/services/booking'
import { advanceTimedStates } from '@/features/keystone/services/maintenance'

/*
 * What the customer site reads. Everything comes from the company's own records (settings, brand,
 * branch, service areas, job types, arrival windows, price book, membership plans, licences), so the
 * site says what the office set up. Only customer-safe columns are selected: no cost, no staff notes.
 */

const db = () => keystoneContext.prisma as any
export const ONLINE = systemActor('online-booking')

export const TRADES = ['hvac', 'plumbing', 'electrical'] as const
export type Trade = (typeof TRADES)[number]
export const TRADE_COPY: Record<Trade, { slug: string; name: string; short: string; about: string }> = {
  hvac: { slug: 'heating-cooling', name: 'Heating & cooling', short: 'AC repair, heating repair, tune-ups and new systems', about: 'Air conditioners, heat pumps, furnaces and ductwork: diagnosed, repaired, tuned up and replaced by licensed technicians.' },
  plumbing: { slug: 'plumbing-drains', name: 'Plumbing & drains', short: 'Leaks, clogs, water heaters and more', about: 'Leaks, clogged drains, water heaters, fixtures and sewer lines, handled by licensed plumbers.' },
  electrical: { slug: 'electrical', name: 'Electrical', short: 'Repairs, upgrades, safety checks and more', about: 'Outlets, breakers, panels, lighting and car chargers, wired by licensed electricians.' },
}
export const tradeBySlug = (slug: string) => TRADES.find(t => TRADE_COPY[t].slug === slug) ?? null

export type Company = {
  name: string; legalName: string; timeZone: string; phone: string; phoneHref: string; email: string
  address: { line1: string; city: string; region: string; postalCode: string } | null
  licences: { issuer: string; number: string; trade: string; licenseClass: string }[]
  areas: { id: string; name: string; travelZone: string; zips: string[] }[]
}

export function phoneText(e164: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

export const getCompany = cache(async (): Promise<Company> => {
  const [settings, brand, branch, licences, areas] = await Promise.all([
    db().companySettings.findFirst({ select: { displayName: true, legalName: true, homeTimeZone: true } }),
    db().brand.findFirst({ orderBy: { createdAt: 'asc' }, select: { name: true, phone: true, email: true } }),
    db().branch.findFirst({ orderBy: { createdAt: 'asc' }, select: { line1: true, city: true, region: true, postalCode: true } }),
    db().contractorLicense.findMany({ where: { displayOnDocuments: true }, orderBy: { createdAt: 'asc' }, select: { issuer: true, licenseNumber: true, trade: true, licenseClass: true, expiresOn: true } }),
    db().serviceArea.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, travelZone: true, zips: true } }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const phone = brand?.phone || ''
  return {
    name: settings?.displayName || brand?.name || settings?.legalName || 'Home services',
    legalName: settings?.legalName || settings?.displayName || '',
    timeZone: settings?.homeTimeZone || 'America/Chicago',
    phone: phone ? phoneText(phone) : '', phoneHref: phone ? `tel:${phone}` : '', email: brand?.email || '',
    address: branch?.line1 ? { line1: branch.line1, city: branch.city, region: branch.region, postalCode: branch.postalCode } : null,
    licences: licences.filter((l: any) => l.licenseNumber && (!l.expiresOn || l.expiresOn.toISOString().slice(0, 10) >= today)).map((l: any) => ({ issuer: l.issuer, number: l.licenseNumber, trade: l.trade, licenseClass: l.licenseClass })),
    areas: areas.map((a: any) => ({ id: a.id, name: a.name, travelZone: a.travelZone, zips: Array.isArray(a.zips) ? (a.zips as string[]) : [] })),
  }
})

/** "Austin, Round Rock, Pflugerville and Cedar Park" from the branch city and the service area names. */
export function servedPlaces(company: Company) {
  const names: string[] = []
  const add = (n: string) => { const v = n.trim(); if (v && !names.some(x => x.toLowerCase() === v.toLowerCase())) names.push(v) }
  if (company.address?.city) add(company.address.city)
  for (const a of company.areas) {
    if (a.travelZone !== 'standard') continue
    for (const part of a.name.replace(/\(.*?\)/g, '').split(/,|&| and /)) add(part.replace(/\b(core|area|metro)\b/gi, ''))
  }
  if (!names.length) return ''
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export type OnlineJobType = { id: string; code: string; name: string; trade: Trade; priority: string; minutes: number; emergencyScript: string }

/** The problems a customer can book online, by trade. */
export const getOnlineJobTypes = cache(async (): Promise<OnlineJobType[]> => {
  const rows = await db().jobType.findMany({
    where: { active: true, bookableOnline: true, businessUnit: { active: true, capacityEnabled: true } },
    select: { id: true, code: true, name: true, trade: true, priority: true, defaultDurationMinutes: true, emergencyPolicy: true },
  })
  const rank: Record<string, number> = { emergency: 0, urgent: 1, standard: 2, maintenance: 3 }
  return rows
    .filter((r: any) => (TRADES as readonly string[]).includes(r.trade))
    .map((r: any) => ({ id: r.id, code: r.code, name: r.name, trade: r.trade as Trade, priority: r.priority, minutes: r.defaultDurationMinutes, emergencyScript: typeof r.emergencyPolicy?.script === 'string' ? r.emergencyPolicy.script : '' }))
    .sort((a: OnlineJobType, b: OnlineJobType) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || a.name.localeCompare(b.name))
})

/** Every job type the company offers (online or by phone), for the services pages. */
export const getAllJobTypes = cache(async () => {
  const rows = await db().jobType.findMany({ where: { active: true, businessUnit: { active: true } }, orderBy: { name: 'asc' }, select: { id: true, name: true, trade: true, priority: true, defaultDurationMinutes: true, bookableOnline: true } })
  return rows as { id: string; name: string; trade: string; priority: string; defaultDurationMinutes: number; bookableOnline: boolean }[]
})

export const today = (timeZone: string, at: Date = new Date()) => localDate({ timeZone }, at)

const kept = globalThis as unknown as { storefrontWindowsDay?: string }

/**
 * Arrival windows are made from the weekly templates by a command, not a timer. The booking pages run
 * it for the next two weeks once a day (same command the office uses; it only adds what is missing).
 */
export async function ensureWindows(timeZone: string) {
  const day = today(timeZone)
  if (kept.storefrontWindowsDay === day) return
  try {
    await materializeWindows(keystoneContext.prisma as never, ONLINE, { from: day, days: 14, idempotencyKey: `storefront:windows:${day}` })
    kept.storefrontWindowsDay = day
  } catch (error) {
    console.error(JSON.stringify({ component: 'storefront-windows', status: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'unknown error' }))
  }
}

export type Slot = { windowId: string; date: string; label: string; startsAt: string; endsAt: string; left: number }
export type WindowsAnswer = { inArea: boolean; area: string | null; extended: boolean; slots: Slot[] }

/** Is the ZIP served, and which windows still have room for this job type (next 7 days)? */
export async function windowsFor(jobTypeId: string, postalCode: string): Promise<WindowsAnswer> {
  const company = await getCompany()
  await advanceTimedStates(keystoneContext.prisma as never)
  await ensureWindows(company.timeZone)
  const r = await availableWindows(keystoneContext.prisma as never, ONLINE, { jobTypeId, postalCode, from: today(company.timeZone), days: 8 })
  if (!r.inArea) return { inArea: false, area: null, extended: false, slots: [] }
  const jobType = await db().jobType.findUnique({ where: { id: jobTypeId }, select: { capacityHours: true } })
  const need = dec(jobType.capacityHours.toString())
  return {
    inArea: true, area: r.serviceArea?.name ?? null, extended: r.serviceArea?.travelZone === 'extended',
    slots: r.windows.map(w => ({ windowId: w.windowId, date: w.date, label: w.label, startsAt: w.startsAt, endsAt: w.endsAt, left: Math.floor(dec(w.remainingHours).div(need).toNumber()) })),
  }
}

/** Is a ZIP inside any service area? */
export async function areaForZip(postalCode: string) {
  const zip = postalCode.trim().slice(0, 5)
  if (!/^\d{5}$/.test(zip)) return null
  const company = await getCompany()
  return company.areas.find(a => a.zips.includes(zip)) ?? null
}

// ── Price book (customer prices only) ─────────────────────────────────────────

const activeBookVersion = cache(async () => {
  const v = await db().priceBookVersion.findFirst({ where: { status: 'active' }, orderBy: { activatedAt: 'desc' }, select: { id: true } })
  return (v?.id as string | undefined) ?? null
})

export type PricedItem = { key: string; name: string; description: string; priceMinor: string; trade: string; warranty: string; tier: string }
const priced = (i: any): PricedItem => ({ key: i.itemKey, name: i.name, description: i.customerDescription, priceMinor: i.unitPriceMinor.toString(), trade: i.trade, warranty: i.warrantyText, tier: i.tier })
const ITEM = { itemKey: true, name: true, customerDescription: true, unitPriceMinor: true, trade: true, warrantyText: true, tier: true, ladderKey: true, categoryKey: true } as const

/** The lowest regular-hours diagnostic price in the price book in force. */
export const getDiagnostic = cache(async (): Promise<PricedItem | null> => {
  const versionId = await activeBookVersion()
  if (!versionId) return null
  const rows = await db().priceBookItem.findMany({ where: { priceBookVersionId: versionId, active: true, kind: 'service_task', categoryKey: { endsWith: 'diagnostic' }, unitPriceMinor: { gt: 0 } }, orderBy: { unitPriceMinor: 'asc' }, take: 1, select: ITEM })
  return rows[0] ? priced(rows[0]) : null
})

export const getDiagnostics = cache(async (): Promise<PricedItem[]> => {
  const versionId = await activeBookVersion()
  if (!versionId) return []
  const rows = await db().priceBookItem.findMany({ where: { priceBookVersionId: versionId, active: true, kind: 'service_task', categoryKey: { endsWith: 'diagnostic' }, unitPriceMinor: { gt: 0 } }, orderBy: { unitPriceMinor: 'asc' }, select: ITEM })
  const seen = new Set<string>()
  return rows.filter((r: any) => (seen.has(r.trade) ? false : (seen.add(r.trade), true))).map(priced)
})

export type Ladder = { key: string; title: string; trade: string; rungs: PricedItem[] }
const TIER_ORDER = ['good', 'better', 'best']

/** Good / better / best option sets from the price book in force (installed prices). */
export const getLadders = cache(async (): Promise<Ladder[]> => {
  const versionId = await activeBookVersion()
  if (!versionId) return []
  const rows = await db().priceBookItem.findMany({ where: { priceBookVersionId: versionId, active: true, ladderKey: { not: '' }, tier: { in: TIER_ORDER } }, orderBy: [{ ladderKey: 'asc' }, { unitPriceMinor: 'asc' }], select: ITEM })
  const byKey = new Map<string, any[]>()
  for (const r of rows) byKey.set(r.ladderKey, [...(byKey.get(r.ladderKey) ?? []), r])
  return [...byKey.entries()].filter(([, items]) => items.length >= 2).map(([key, items]) => {
    const sorted = items.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    return { key, title: String(sorted[0].name).split(',')[0].replace(/\s*\([^)]*$/, '').trim(), trade: sorted[0].trade, rungs: sorted.map(priced) }
  })
})

// ── Memberships ───────────────────────────────────────────────────────────────

export type Plan = {
  id: string; code: string; name: string; description: string; priceMinor: string; per: string; termMonths: number; autoRenew: boolean
  entitlements: { code: string; name: string; quantity: number; seasonStart: string | null; seasonEnd: string | null }[]
  benefits: { title: string; text: string }[]
}

export const getPlans = cache(async (): Promise<Plan[]> => {
  const rows = await db().membershipPlan.findMany({
    where: { status: 'active', versions: { some: { status: 'active' } } }, orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, name: true, description: true, versions: { where: { status: 'active' }, take: 1, select: { priceMinor: true, billingFrequency: true, termMonths: true, autoRenew: true, entitlements: true, benefits: true } } },
  })
  return rows.map((p: any) => {
    const v = p.versions[0]
    const per = v.billingFrequency === 'monthly' ? 'month' : v.billingFrequency === 'quarterly' ? 'quarter' : v.termMonths === 12 ? 'year' : `${v.termMonths} months`
    return {
      id: p.id, code: p.code, name: p.name, description: p.description, priceMinor: v.priceMinor.toString(), per, termMonths: v.termMonths, autoRenew: v.autoRenew,
      entitlements: (Array.isArray(v.entitlements) ? v.entitlements : []).map((e: any) => ({ code: String(e.code ?? ''), name: String(e.name ?? ''), quantity: Number(e.quantity ?? 1), seasonStart: e.seasonStart ?? null, seasonEnd: e.seasonEnd ?? null })),
      benefits: (Array.isArray(v.benefits) ? v.benefits : []).map((b: any) => ({ title: String(b.title ?? ''), text: String(b.text ?? '') })),
    }
  })
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthDay = (md: string) => { const [m, d] = md.split('-').map(Number); return `${MONTHS[m - 1]} ${d}` }

/** The seasonal tune-up that is in season now, or the next one to open (from the plans' entitlements). */
export async function getSeason(): Promise<{ name: string; range: string; open: boolean } | null> {
  const [plans, company] = await Promise.all([getPlans(), getCompany()])
  const md = today(company.timeZone).slice(5)
  const seasons = plans.flatMap(p => p.entitlements).filter(e => e.seasonStart && e.seasonEnd && /^\d{2}-\d{2}$/.test(e.seasonStart) && /^\d{2}-\d{2}$/.test(e.seasonEnd))
  if (!seasons.length) return null
  const open = seasons.find(e => e.seasonStart! <= md && md <= e.seasonEnd!)
  const next = open ?? [...seasons].sort((a, b) => a.seasonStart!.localeCompare(b.seasonStart!)).find(e => e.seasonStart! > md) ?? seasons[0]
  return { name: next.name, range: `${monthDay(next.seasonStart!)} – ${monthDay(next.seasonEnd!)}`, open: !!open }
}

// ── People ────────────────────────────────────────────────────────────────────

export const getTechnicians = cache(async () => {
  const rows = await db().employee.findMany({
    where: { status: 'active', kind: 'technician', dispatchable: true }, orderBy: { hireDate: 'asc' }, take: 60,
    select: { id: true, firstName: true, lastName: true, displayName: true, user: { select: { title: true } }, businessUnits: { select: { trade: true } } },
  })
  return rows.map((e: any) => ({ id: e.id as string, name: (e.displayName || `${e.firstName} ${e.lastName}`).trim() as string, title: (e.user?.title || '') as string, trade: (e.businessUnits[0]?.trade || '') as string }))
})

/** One lead person per trade, masters first, for the short "Our technicians" row. */
export async function getLeadTechnicians() {
  const all = await getTechnicians()
  const picked: typeof all = []
  for (const trade of TRADES) {
    const inTrade = all.filter((t: { trade: string }) => t.trade === trade)
    const lead = inTrade.find((t: { title: string }) => /master/i.test(t.title)) ?? inTrade[0]
    if (lead) picked.push(lead)
  }
  return picked
}

// ── Photographs ───────────────────────────────────────────────────────────────

/** A photo under public/storefront, or null when the company has not supplied it (the layout closes up). */
export function photo(name: string): string | null {
  return existsSync(path.join(process.cwd(), 'public', 'storefront', name)) ? `/storefront/${name}` : null
}

export { addDays }

// ── Header strip and headline ─────────────────────────────────────────────────

/** Someone is on call right now (the on-call rota covers this moment): the strip may promise a person answers. */
export const hasOnCall = cache(async () => {
  const now = new Date()
  return (await db().onCallRotation.count({ where: { startsAt: { lte: now }, endsAt: { gt: now } } })) > 0
})

/** The first day with an open arrival window: "today", "tomorrow" or a weekday name. Null when none is open. */
export const nextOpenDay = cache(async (): Promise<string | null> => {
  const company = await getCompany()
  await ensureWindows(company.timeZone)
  const rows = await db().$queryRaw`SELECT date FROM "ArrivalWindow" WHERE NOT closed AND "startsAt" > now() AND "bookedHours" < "capacityHours" ORDER BY "startsAt" ASC LIMIT 1`
  const first = rows[0]?.date as Date | undefined
  if (!first) return null
  const date = first.toISOString().slice(0, 10)
  const day = today(company.timeZone)
  if (date === day) return 'today'
  if (date === addDays(day, 1)) return 'tomorrow'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T12:00:00Z`))
})
