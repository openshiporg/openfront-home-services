import Image from 'next/image'
import Link from 'next/link'
import { Check, ContactRound, FileText, MapPin, Minus, Tag, Wrench } from 'lucide-react'
import {
  getCompany, getDiagnostic, getDiagnostics, getLadders, getLeadTechnicians, getOnlineJobTypes, getTechnicians, getPlans, getSeason, photo, servedPlaces, TRADE_COPY, TRADES,
  type Ladder, type Plan,
} from '../lib/data'
import { dollars } from '../lib/format'
import { BookingWidget } from './BookingWidget'

/** The booking widget with the company's live job types, ready for a page. */
export async function Booking({ trade, jobTypeId }: { trade?: string; jobTypeId?: string }) {
  const [company, jobTypes, diagnostics] = await Promise.all([getCompany(), getOnlineJobTypes(), getDiagnostics()])
  const trades = TRADES.filter(t => jobTypes.some(j => j.trade === t)).map(t => {
    const d = diagnostics.find(x => x.trade === t)
    return { key: t, name: TRADE_COPY[t].name, short: TRADE_COPY[t].short, diagnostic: d ? `${d.name}: ${dollars(d.priceMinor)}.` : '' }
  })
  // The ZIP the widget starts with comes from the store's own service area: the branch's ZIP when an area covers it, else the first area's first ZIP.
  const branchZip = company.address?.postalCode?.trim().slice(0, 5) ?? ''
  const defaultZip = company.areas.some(a => a.zips.includes(branchZip)) ? branchZip : (company.areas.find(a => a.zips.length)?.zips[0] ?? '')
  return (
    <BookingWidget
      defaultZip={defaultZip}
      jobTypes={jobTypes.map(j => ({ id: j.id, name: j.name, trade: j.trade }))} trades={trades} phone={company.phone} phoneHref={company.phoneHref}
      placeTime={company.address?.city ? `${company.address.city} time` : 'local time'} defaultState={company.address?.region || 'TX'} initialTrade={trade} initialJobTypeId={jobTypeId}
    />
  )
}

/** The tall photograph beside the booking widget. Shown when the company has supplied it. */
export async function HeroPhoto({ className = '' }: { className?: string }) {
  const src = photo('technician.jpg')
  if (!src) return null
  const lead = (await getLeadTechnicians())[0]
  return (
    <div className={`relative overflow-hidden bg-[#e9ebed] ${className}`}>
      <Image src={src} alt="A technician servicing an outdoor air conditioning unit" fill priority sizes="(min-width: 1024px) 36vw, 100vw" className="object-cover" />
      {lead ? (
        <p className="absolute bottom-4 right-4 rounded-[5px] bg-[#1f2326]/90 px-4 py-2.5 text-white">
          <span className="block text-[18px] font-bold leading-tight">{lead.name}</span>
          {lead.title ? <span className="block text-[14px]">{lead.title}</span> : null}
        </p>
      ) : null}
    </div>
  )
}

export async function InfoStrip() {
  const [company, diagnostic, ladders] = await Promise.all([getCompany(), getDiagnostic(), getLadders()])
  const places = servedPlaces(company)
  const licence = company.licences[0]
  const items = [
    places ? { Icon: MapPin, a: `Serving ${places}.` } : null,
    diagnostic ? { Icon: Tag, a: `Diagnostic visit ${dollars(diagnostic.priceMinor)}.`, b: /credited/i.test(diagnostic.description) ? 'Credited toward the repair.' : undefined } : null,
    ladders.length ? { Icon: Wrench, a: 'Upfront options, always.', b: 'Know the price before we start.' } : { Icon: Wrench, a: 'Upfront price, always.', b: 'You approve it before we start.' },
    licence ? { Icon: ContactRound, a: `${licence.issuer} licence`, b: licence.number } : null,
  ].filter(Boolean) as { Icon: typeof MapPin; a: string; b?: string }[]
  return (
    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:flex lg:items-center lg:gap-0">
      {items.map(({ Icon, a, b }, i) => (
        <li key={a} className={`flex items-center gap-4 lg:flex-1 ${i ? 'lg:border-l lg:border-[#c9cdd1] lg:pl-10' : ''} lg:pr-6`}>
          <Icon className="size-8 shrink-0 text-[#e8641c]" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[16px] leading-[1.25] lg:max-w-[16rem]">{a}{b ? <><br />{b}</> : null}</p>
        </li>
      ))}
    </ul>
  )
}

/** Rows of the comparison: every entitlement and benefit any plan has, in first-seen order. */
function planRows(plans: Plan[]) {
  const rows: { key: string; label: string }[] = []
  const add = (key: string, label: string) => { if (label && !rows.some(r => r.key === key)) rows.push({ key, label }) }
  for (const p of plans) {
    for (const e of p.entitlements) add(`e:${e.code || e.name}`, e.name)
    for (const b of p.benefits) add(`b:${b.title.toLowerCase()}`, b.title)
  }
  const has = (p: Plan, key: string) => p.entitlements.some(e => `e:${e.code || e.name}` === key) || p.benefits.some(b => `b:${b.title.toLowerCase()}` === key)
  return { rows, has }
}

export function MembershipTable({ plans, links = true }: { plans: Plan[]; links?: boolean }) {
  const { rows, has } = planRows(plans)
  if (!plans.length) return null
  return (
    <div className="overflow-x-auto rounded-[6px] border border-[#d9dcdf]">
      <table className="w-full min-w-[min(100%,560px)] border-collapse text-left text-[15px] sm:text-[16px]">
        <thead>
          <tr className="bg-[#f5f6f7]">
            <th scope="col" className="px-3 py-3 text-[16px] font-bold sm:px-5 sm:text-[17px]">What&apos;s included</th>
            {plans.map(p => (
              <th key={p.id} scope="col" className="border-l border-[#d9dcdf] px-2 py-3 text-center align-middle font-bold leading-tight sm:px-4">
                {links ? <Link href={`/memberships#${p.code}`} className="hover:underline">{p.name}</Link> : p.name}
                <span className="block text-[#e8641c] lg:text-[#1f2326]">{dollars(p.priceMinor)}/{p.per}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-t border-[#e3e5e7]">
              <th scope="row" className="px-3 py-2 font-medium sm:px-5">{r.label}</th>
              {plans.map(p => (
                <td key={p.id} className="border-l border-[#d9dcdf] px-2 py-2 text-center">
                  {has(p, r.key)
                    ? <><Check className="mx-auto size-5 text-[#e8641c]" strokeWidth={3} aria-hidden="true" /><span className="sr-only">Included</span></>
                    : <><Minus className="mx-auto size-4 text-[#3d4347]" strokeWidth={2.5} aria-hidden="true" /><span className="sr-only">Not included</span></>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LadderPrices({ ladder, stacked = false }: { ladder: Ladder; stacked?: boolean }) {
  const label = (tier: string, name: string) => (tier === 'best' && /tankless/i.test(name) ? 'Tankless' : tier.replace(/^./, c => c.toUpperCase()))
  if (stacked) {
    return (
      <ul className="mt-1 text-[18px] leading-[1.3]">
        {ladder.rungs.map(r => <li key={r.key}>{label(r.tier, r.name)}: {dollars(r.priceMinor)}</li>)}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-3 divide-x divide-[#c9cdd1]">
      {ladder.rungs.map(r => (
        <li key={r.key} className="px-3 first:pl-0 sm:px-6">
          <span className="block text-[16px] font-bold">{label(r.tier, r.name)}</span>
          <span className="block text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[#e8641c]">{dollars(r.priceMinor)}</span>
          <span className="block text-[15px]">installed</span>
        </li>
      ))}
    </ul>
  )
}

/** Home page, lower half: memberships table with the season note, the upfront example and a house photo. */
export async function MembershipsBand() {
  const [plans, season, ladders] = await Promise.all([getPlans(), getSeason(), getLadders()])
  const ladder = ladders.find(l => /water heater/i.test(l.title)) ?? ladders[0]
  const house = photo('home.jpg')
  const shown = plans.slice(0, 2)
  if (!shown.length && !ladder) return null
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-0">
      {shown.length ? (
        <section aria-labelledby="sf-memberships" className="lg:pr-8">
          <h2 id="sf-memberships" className="text-[34px] font-extrabold leading-none tracking-[-0.03em] sm:text-[42px]">Memberships</h2>
          <p className="mt-2 text-[18px] leading-snug">Keep your home comfortable, safe and running smoothly all year.</p>
          <div className="mt-5"><MembershipTable plans={shown} /></div>
          <p className="mt-3 text-[15px]"><Link href="/memberships" className="font-bold underline underline-offset-2 hover:text-[#e8641c]">Compare memberships in full</Link></p>
        </section>
      ) : null}
      <div className={`grid gap-6 lg:border-l lg:border-[#d9dcdf] lg:pl-9 ${house ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]' : ''}`}>
        <div>
          {season ? (
            <section className="pb-2 lg:border-b lg:border-[#d9dcdf] lg:pb-6">
              <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[30px]">{season.name} season:<br />{season.range}.</h2>
              <p className="mt-3 max-w-sm text-[17px] leading-snug">{season.open ? 'In season now. Members have this tune-up included; book it for any open window.' : 'Members have this tune-up included. Booking opens with the season.'}</p>
              <p className="mt-3"><Link href="/book" className="text-[16px] font-bold underline underline-offset-2 hover:text-[#e8641c]">Book a tune-up</Link></p>
            </section>
          ) : null}
          {ladder ? (
            <section className={`hidden lg:block ${season ? 'pt-6' : ''}`}>
              <h2 className="text-[18px] font-bold leading-[1.2]">Upfront options example:<br />{ladder.title}<br /><span className="font-normal">(installed)</span></h2>
              <LadderPrices ladder={ladder} stacked />
            </section>
          ) : null}
        </div>
        {house ? <div className="relative min-h-[260px] overflow-hidden bg-[#e9ebed]"><Image src={house} alt="A stone house in the service area" fill sizes="(min-width: 1024px) 22vw, 100vw" className="object-cover" /></div> : null}
      </div>
    </div>
  )
}

export async function Technicians({ all = false }: { all?: boolean }) {
  const people = all ? await getTechnicians() : await getLeadTechnicians()
  if (!people.length) return null
  return (
    <section aria-labelledby="sf-technicians">
      <h2 id="sf-technicians" className="text-[26px] font-extrabold tracking-[-0.025em] sm:text-[30px]">Our technicians</h2>
      <ul className={`mt-4 grid gap-x-8 gap-y-5 ${all ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {people.map((p: { id: string; name: string; title: string }) => {
          const src = photo(`team/${p.name.toLowerCase().replace(/[^a-z]+/g, '-')}.jpg`)
          const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')
          return (
            <li key={p.id} className="flex items-center gap-4">
              {src
                ? <span className="relative size-[84px] shrink-0 overflow-hidden bg-[#e9ebed]"><Image src={src} alt="" fill sizes="84px" className="object-cover" /></span>
                : <span aria-hidden="true" className="flex size-[84px] shrink-0 items-center justify-center bg-[#1f2326] text-[26px] font-bold tracking-[-0.02em] text-white">{initials}</span>}
              <span><span className="block text-[19px] font-bold leading-tight">{p.name}</span><span className="block text-[16px]">{p.title}</span></span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export async function LicenceLine() {
  const company = await getCompany()
  const licence = company.licences[0]
  if (!licence && !company.address) return null
  return (
    <ul className="flex flex-col gap-3 border-t border-[#d9dcdf] pt-5 text-[16px] sm:flex-row sm:items-center sm:gap-0">
      {licence ? <li className="flex items-center gap-3 sm:flex-1"><FileText className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />{licence.issuer} licence {licence.number}.</li> : null}
      {company.address ? <li className={`flex items-center gap-3 sm:flex-1 ${licence ? 'sm:border-l sm:border-[#c9cdd1] sm:pl-10' : ''}`}><MapPin className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />{company.address.line1}, {company.address.city}, {company.address.region}.</li> : null}
    </ul>
  )
}
