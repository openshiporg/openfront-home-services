import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Phone } from 'lucide-react'
import { keystoneContext } from '@/features/keystone/context'
import { CodeForm, PayButton, ZipCheck } from '../components/ClientBits'
import { Booking, HeroPhoto, InfoStrip, LadderPrices, LicenceLine, MembershipsBand, MembershipTable, Technicians } from '../components/Sections'
import { container, PageTitle, primaryButton, quietButton } from '../components/Shell'
import { getAllJobTypes, getCompany, getDiagnostics, getLadders, getPlans, hasOnCall, nextOpenDay, servedPlaces, TRADE_COPY, TRADES, tradeBySlug, type Trade } from '../lib/data'
import { dayText, dollars, dollarsExact, timeText, zoneLabel } from '../lib/format'
import { invoiceByCode, settleOpenAttempt } from '../lib/payments'

const db = () => keystoneContext.prisma as any
const h2 = 'text-[26px] font-extrabold tracking-[-0.025em] sm:text-[30px]'
const link = 'font-bold underline underline-offset-2 hover:text-[#e8641c]'

// ── Home ──────────────────────────────────────────────────────────────────────

export async function HomeScreen() {
  const [day, ladders] = await Promise.all([nextOpenDay(), getLadders()])
  const ladder = ladders.find(l => /water heater/i.test(l.title)) ?? ladders[0]
  return (
    <>
      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(0,1fr)_35%] lg:grid-rows-[auto_1fr]">
        <h1 className="px-4 pt-5 text-[clamp(34px,9.4vw,46px)] font-extrabold leading-[1.02] tracking-[-0.045em] sm:px-6 sm:text-[56px] lg:col-span-2 lg:row-start-1 lg:pl-10 lg:pr-6 lg:pt-6 xl:text-[68px]">Book a visit. {day ? `We’ll be there ${day}.` : 'We’ll be right there.'}</h1>
        <div className="min-w-0 px-4 pt-4 sm:px-6 lg:row-start-2 lg:pl-10 lg:pr-6 lg:pt-6">
          <Booking />
        </div>
        <HeroPhoto className="mx-4 mt-5 aspect-[4/3] sm:mx-6 lg:col-start-2 lg:row-start-2 lg:mx-0 lg:mt-6 lg:aspect-auto" />
      </div>
      <div className={`${container} mt-6 lg:mt-7`}><InfoStrip /></div>
      <div className={`${container} mt-10 lg:mt-12`}><MembershipsBand /></div>
      {ladder ? (
        <section className={`${container} mt-10 lg:hidden`}>
          <div className="grid gap-4 border-y border-[#d9dcdf] py-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] sm:items-center">
            <h2 className="text-[19px] font-bold leading-tight">Upfront options example:<span className="block font-normal">{ladder.title}</span></h2>
            <LadderPrices ladder={ladder} />
          </div>
        </section>
      ) : null}
      <div className={`${container} mt-10 lg:mt-14`}><Technicians /></div>
      <div className={`${container} mt-8`}><LicenceLine /></div>
    </>
  )
}

// ── Book ──────────────────────────────────────────────────────────────────────

export async function BookScreen({ trade, job }: { trade?: string; job?: string }) {
  const company = await getCompany()
  return (
    <>
      <PageTitle title="Book a visit" lead="Pick the problem, tell us where, choose an arrival window and confirm. Nothing is charged to book." />
      <div className={`${container} mt-6 max-w-[1100px]`}>
        <Booking trade={tradeBySlug(trade ?? '') ?? undefined} jobTypeId={job} />
        {company.phone ? <p className="mt-5 text-[16px]">Rather talk to someone? Call <a href={company.phoneHref} className={link}>{company.phone}</a>.</p> : null}
      </div>
    </>
  )
}

// ── Services ──────────────────────────────────────────────────────────────────

const priorityNote: Record<string, string> = { emergency: 'Same-day emergency', urgent: 'Usually same day', standard: '', maintenance: 'Seasonal maintenance' }

export async function ServicesScreen() {
  const [jobTypes, diagnostics] = await Promise.all([getAllJobTypes(), getDiagnostics()])
  return (
    <>
      <PageTitle title="Services" lead="One company for heating and cooling, plumbing and electrical. Licensed technicians, upfront prices, arrival windows you choose." />
      <div className={`${container} mt-8 divide-y divide-[#d9dcdf] border-y border-[#d9dcdf]`}>
        {TRADES.map(t => {
          const list = jobTypes.filter(j => j.trade === t)
          const d = diagnostics.find(x => x.trade === t)
          return (
            <section key={t} className="grid gap-4 py-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] lg:gap-10">
              <div>
                <h2 className={h2}><Link href={`/services/${TRADE_COPY[t].slug}`} className="hover:text-[#e8641c]">{TRADE_COPY[t].name}</Link></h2>
                <p className="mt-2 text-[17px] leading-snug text-[#3d4347]">{TRADE_COPY[t].about}</p>
                {d ? <p className="mt-2 text-[16px]">{d.name}: <span className="font-bold">{dollars(d.priceMinor)}</span></p> : null}
              </div>
              <ul className="grid content-start gap-x-8 text-[17px] sm:grid-cols-2">
                {list.map(j => <li key={j.id} className="border-b border-[#eceef0] py-2.5">{j.name}</li>)}
                {!list.length ? <li className="py-2.5 text-[#3d4347]">Call us about {TRADE_COPY[t].name.toLowerCase()} work.</li> : null}
              </ul>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href={`/book?trade=${TRADE_COPY[t].slug}`} className={primaryButton}>Book a visit</Link>
                <Link href={`/services/${TRADE_COPY[t].slug}`} className={quietButton}>Details and prices</Link>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

export async function TradeScreen({ slug }: { slug: string }) {
  const trade = tradeBySlug(slug) as Trade | null
  if (!trade) notFound()
  const [company, jobTypes, diagnostics, ladders] = await Promise.all([getCompany(), getAllJobTypes(), getDiagnostics(), getLadders()])
  const list = jobTypes.filter(j => j.trade === trade)
  const d = diagnostics.find(x => x.trade === trade)
  const sets = ladders.filter(l => l.trade === trade)
  return (
    <>
      <PageTitle title={TRADE_COPY[trade].name} lead={TRADE_COPY[trade].about} />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
        <section>
          <h2 className={h2}>What we come out for</h2>
          <ul className="mt-4 divide-y divide-[#e3e5e7] border-y border-[#d9dcdf]">
            {list.map(j => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3.5">
                <span><span className="block text-[19px] font-bold leading-tight">{j.name}</span><span className="text-[15px] text-[#3d4347]">About {j.defaultDurationMinutes} minutes on site{priorityNote[j.priority] ? ` · ${priorityNote[j.priority]}` : ''}</span></span>
                {j.bookableOnline
                  ? <Link href={`/book?job=${j.id}`} className={`${link} flex items-center gap-1 text-[16px]`}>Book online <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden="true" /></Link>
                  : company.phone ? <a href={company.phoneHref} className={`${link} text-[16px]`}>Call to book</a> : null}
              </li>
            ))}
            {!list.length ? <li className="py-3.5 text-[17px]">Call us and we will tell you what we can do.</li> : null}
          </ul>
        </section>
        <aside className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          {d ? (
            <section className="border-b border-[#d9dcdf] pb-6">
              <h2 className="text-[18px] font-bold">{d.name}</h2>
              <p className="text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-[#e8641c]">{dollars(d.priceMinor)}</p>
              {d.description ? <p className="mt-1 text-[16px] leading-snug">{d.description}</p> : null}
            </section>
          ) : null}
          <div className={d ? 'pt-6' : ''}>
            <Link href={`/book?trade=${TRADE_COPY[trade].slug}`} className={`${primaryButton} w-full`}>Book a visit</Link>
            {company.phone ? <a href={company.phoneHref} className={`${quietButton} mt-3 w-full`}><Phone className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />{company.phone}</a> : null}
          </div>
        </aside>
      </div>
      {sets.length ? (
        <section className={`${container} mt-12`}>
          <h2 className={h2}>Upfront options</h2>
          <p className="mt-2 max-w-2xl text-[17px] leading-snug text-[#3d4347]">For a replacement you get options side by side, each with its installed price, before any work starts.</p>
          <div className="mt-5 divide-y divide-[#d9dcdf] border-y border-[#d9dcdf]">
            {sets.map(l => (
              <div key={l.key} className="grid gap-5 py-6 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,2fr)]">
                <h3 className="text-[20px] font-bold leading-tight">{l.title}</h3>
                <ul className="grid gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#c9cdd1]">
                  {l.rungs.map(r => (
                    <li key={r.key} className="sm:px-6 sm:first:pl-0">
                      <span className="block text-[16px] font-bold capitalize">{r.tier}</span>
                      <span className="block text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[#e8641c]">{dollars(r.priceMinor)}</span>
                      <span className="block text-[15px]">installed</span>
                      <span className="mt-2 block text-[16px] font-bold leading-snug">{r.name}</span>
                      {r.description ? <span className="mt-1 block text-[15px] leading-snug text-[#3d4347]">{r.description}</span> : null}
                      {r.warranty ? <span className="mt-1 block text-[15px] leading-snug">{r.warranty}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

// ── Memberships ───────────────────────────────────────────────────────────────

const monthDay = (md: string) => { const [m, d] = md.split('-').map(Number); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}` }

export async function MembershipsScreen() {
  const [plans, company] = await Promise.all([getPlans(), getCompany()])
  return (
    <>
      <PageTitle title="Memberships" lead="Keep your home comfortable, safe and running smoothly all year." />
      <div className={`${container} mt-8`}>
        {plans.length ? <div className="max-w-[900px]"><MembershipTable plans={plans} /></div> : <p className="text-[18px]">We are not selling memberships online right now.{company.phone ? ` Call ${company.phone} to ask about one.` : ''}</p>}
        <div className="mt-10 divide-y divide-[#d9dcdf] border-y border-[#d9dcdf]">
          {plans.map(p => (
            <section key={p.id} id={p.code} className="grid scroll-mt-6 gap-5 py-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-10">
              <div>
                <h2 className={h2}>{p.name}</h2>
                <p className="mt-1 text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-[#e8641c]">{dollars(p.priceMinor)}<span className="text-[18px] font-bold text-[#1f2326]">/{p.per}</span></p>
                {p.description ? <p className="mt-2 text-[17px] leading-snug">{p.description}</p> : null}
                <p className="mt-2 text-[15px] leading-snug text-[#3d4347]">{p.termMonths}-month term. {p.autoRenew ? 'Renews automatically if you agree to that when you join; cancel online any time.' : 'Does not renew by itself.'}</p>
              </div>
              <ul className="grid content-start gap-x-10 text-[17px] sm:grid-cols-2">
                {p.entitlements.map(e => (
                  <li key={e.code || e.name} className="border-b border-[#eceef0] py-2.5">
                    <span className="font-bold">{e.quantity > 1 ? `${e.quantity} × ` : ''}{e.name}</span>
                    {e.seasonStart && e.seasonEnd ? <span className="block text-[15px] text-[#3d4347]">Season: {monthDay(e.seasonStart)} – {monthDay(e.seasonEnd)}</span> : null}
                  </li>
                ))}
                {p.benefits.map(b => <li key={b.title} className="border-b border-[#eceef0] py-2.5"><span className="font-bold">{b.title}</span>{b.text ? <span className="block text-[15px] text-[#3d4347]">{b.text}</span> : null}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-[20px] font-bold">How to join</h2>
            <p className="mt-2 max-w-xl text-[17px] leading-snug">Join with your technician at your visit, or by phone{company.phone ? <> at <a href={company.phoneHref} className={link}>{company.phone}</a></> : null}. Your card is entered on a secure card page; we never take it over text.</p>
            <p className="mt-4"><Link href="/book" className={primaryButton}>Book a visit</Link></p>
          </section>
          <section>
            <h2 className="text-[20px] font-bold">Already a member?</h2>
            <p className="mt-2 max-w-xl text-[17px] leading-snug">Open your membership with the code on your membership letter (it starts with MBR) to see it or cancel it online.</p>
            <p className="mt-4"><Link href="/sign-in" className={quietButton}>Open my membership</Link></p>
          </section>
        </div>
      </div>
    </>
  )
}

// ── Service area ──────────────────────────────────────────────────────────────

export async function ServiceAreaScreen() {
  const company = await getCompany()
  const places = servedPlaces(company)
  return (
    <>
      <PageTitle title="Service area" lead={places ? `Serving ${places}.` : undefined} />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]`}>
        <section>
          <h2 className={h2}>Do we come to you?</h2>
          <div className="mt-4"><ZipCheck phone={company.phone} phoneHref={company.phoneHref} /></div>
          {company.address ? <p className="mt-6 text-[16px] leading-snug">Our trucks leave from<br /><span className="font-bold">{company.address.line1}, {company.address.city}, {company.address.region} {company.address.postalCode}</span></p> : null}
        </section>
        <section className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          <h2 className={h2}>ZIP codes we serve</h2>
          <div className="mt-4 divide-y divide-[#e3e5e7] border-y border-[#d9dcdf]">
            {company.areas.map(a => (
              <div key={a.id} className="py-4">
                <h3 className="text-[19px] font-bold">{a.name}</h3>
                <p className="mt-1 text-[17px] leading-relaxed tabular-nums">{a.zips.join(' · ')}</p>
              </div>
            ))}
            {!company.areas.length ? <p className="py-4 text-[17px]">Call us and we will tell you whether we reach you.</p> : null}
          </div>
        </section>
      </div>
    </>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

const tradeWord: Record<string, string> = { hvac: 'Air conditioning and heating', plumbing: 'Plumbing', electrical: 'Electrical' }

export async function AboutScreen() {
  const [company, onCall] = await Promise.all([getCompany(), hasOnCall()])
  const places = servedPlaces(company)
  return (
    <>
      <PageTitle title={`About ${company.name}`} lead={`Licensed heating, cooling, plumbing and electrical work${places ? ` for ${places}` : ''}. One number, one truck in your driveway, one price you approve before we start.`} />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`}>
        <section>
          <h2 className={h2}>How a visit works</h2>
          <ol className="mt-4 divide-y divide-[#e3e5e7] border-y border-[#d9dcdf] text-[17px] leading-snug">
            {[
              ['You pick an arrival window', 'Online or by phone. We hold that window for you; you get a confirmation code right away.'],
              ['A licensed technician comes out', 'Licensed for the trade you booked. Your visit page shows who is coming and when they are on the way.'],
              ['You see options and prices first', 'The diagnosis comes with upfront options. Nothing starts until you approve one.'],
              ['Pay when the work is done', 'By card from the invoice link, or with your technician.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-5 py-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[#e8641c] text-[16px] font-bold text-[#e8641c]">{i + 1}</span><span><span className="block text-[19px] font-bold">{t}</span>{d}</span></li>
            ))}
          </ol>
          <p className="mt-6"><Link href="/book" className={primaryButton}>Book a visit</Link></p>
        </section>
        <aside className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          <h2 className="text-[20px] font-bold">Find us</h2>
          <p className="mt-2 text-[17px] leading-snug">
            {company.legalName || company.name}
            {company.address ? <><br />{company.address.line1}<br />{company.address.city}, {company.address.region} {company.address.postalCode}</> : null}
          </p>
          {company.phone ? <p className="mt-3 text-[17px]"><a href={company.phoneHref} className={link}>{company.phone}</a>{onCall ? <span className="block text-[15px] text-[#3d4347]">Answered 24/7 by a person.</span> : null}</p> : null}
          {company.email ? <p className="mt-1 text-[17px]"><a href={`mailto:${company.email}`} className={link}>{company.email}</a></p> : null}
          {company.licences.length ? (
            <>
              <h2 className="mt-8 text-[20px] font-bold">Licences</h2>
              <ul className="mt-2 divide-y divide-[#e3e5e7] border-y border-[#d9dcdf] text-[17px]">
                {company.licences.map(l => <li key={l.number} className="py-2.5"><span className="block font-bold">{l.issuer} {l.number}</span><span className="text-[15px] text-[#3d4347]">{tradeWord[l.trade] ?? l.trade}{l.licenseClass ? ` · ${l.licenseClass.length <= 2 ? `Class ${l.licenseClass}` : l.licenseClass}` : ''}</span></li>)}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
      <div className={`${container} mt-12`}><Technicians all /></div>
    </>
  )
}

// ── Sign in (by code) ─────────────────────────────────────────────────────────

export async function SignInScreen() {
  const company = await getCompany()
  return (
    <>
      <PageTitle title="Sign in" lead="No password to remember. Open your visit, invoice or membership with the code we gave you." />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
        <section>
          <CodeForm />
          <ul className="mt-6 max-w-md divide-y divide-[#e3e5e7] border-y border-[#d9dcdf] text-[16px]">
            <li className="py-3"><span className="font-bold">Visit</span>: starts with J, on your booking confirmation.</li>
            <li className="py-3"><span className="font-bold">Invoice</span>: starts with INV, on your invoice. Pay it by card here.</li>
            <li className="py-3"><span className="font-bold">Membership</span>: starts with MBR, on your membership letter.</li>
          </ul>
          {company.phone ? <p className="mt-5 text-[16px]">Lost your code? Call <a href={company.phoneHref} className={link}>{company.phone}</a>.</p> : null}
        </section>
        <aside className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          <h2 className="text-[20px] font-bold">Work at {company.name}?</h2>
          <p className="mt-2 max-w-md text-[17px] leading-snug">The office and field apps have their own sign-in.</p>
          <p className="mt-4"><Link href="/dashboard/signin" className={quietButton}>Team sign in</Link></p>
        </aside>
      </div>
    </>
  )
}

// ── Your visit ────────────────────────────────────────────────────────────────

const VISIT_TEXT: Record<string, { head: string; body: string }> = {
  unassigned: { head: 'Booked', body: 'Your arrival window is held. We are choosing the technician for your visit.' },
  scheduled: { head: 'Scheduled', body: 'Your technician is assigned. This page shows when they are on the way.' },
  dispatched: { head: 'Scheduled', body: 'Your technician has the visit. This page shows when they are on the way.' },
  en_route: { head: 'On the way', body: 'Your technician is driving to you now.' },
  on_site: { head: 'At your home', body: 'Your technician has arrived.' },
  working: { head: 'Work under way', body: 'Your technician is working on it.' },
  paused: { head: 'Paused', body: 'The work is paused. The office will tell you what happens next.' },
  done: { head: 'Visit finished', body: 'Thank you. Your invoice link is on the paperwork your technician sent.' },
  cancelled: { head: 'Cancelled', body: 'This visit was cancelled. Book another one any time.' },
  no_access: { head: 'We could not get in', body: 'Nobody was home when we arrived. Call us and we will set a new window.' },
}

export async function VisitScreen({ code, booked }: { code: string; booked: boolean }) {
  if (!/^J-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) notFound()
  const [company, job] = await Promise.all([
    getCompany(),
    db().job.findUnique({
      where: { publicCode: code },
      select: {
        publicCode: true, status: true, summary: true, jobType: { select: { name: true } }, customer: { select: { displayName: true } }, location: { select: { address1: true, address2: true, city: true, state: true, postalCode: true } },
        visits: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, etaMinutes: true, window: { select: { date: true, label: true, startsAt: true, endsAt: true } }, assignments: { where: { active: true }, take: 3, select: { role: true, employee: { select: { displayName: true, firstName: true, lastName: true, user: { select: { title: true } } } } } } } },
      },
    }),
  ])
  if (!job) notFound()
  const visit = job.visits[0]
  const cancelled = job.status === 'cancelled' || visit?.status === 'cancelled'
  const state = cancelled ? VISIT_TEXT.cancelled : ['completed', 'closed', 'work_complete'].includes(job.status) ? VISIT_TEXT.done : VISIT_TEXT[visit?.status ?? 'unassigned'] ?? VISIT_TEXT.unassigned
  const zone = zoneLabel(company.timeZone)
  const place = company.address?.city ? `${company.address.city} time` : 'local time'
  const windowText = visit?.window ? `${dayText(visit.window.date.toISOString().slice(0, 10), 'long')}, ${visit.window.label} ${zone} (${place})` : ''
  const lead = visit?.assignments.find((a: any) => a.role === 'lead') ?? visit?.assignments[0]
  const tech = lead?.employee ? { name: lead.employee.displayName || `${lead.employee.firstName} ${lead.employee.lastName}`, title: lead.employee.user?.title || '' } : null
  const first = String(job.customer?.displayName ?? '').split(' ')[0]
  return (
    <>
      <PageTitle title={booked && !cancelled ? `You’re booked${first ? `, ${first}` : ''}.` : 'Your visit'} lead={booked && !cancelled ? 'Keep this code. It opens this page any time from Sign in.' : undefined} />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`}>
        <section>
          <p className="flex items-center gap-2.5 text-[20px] font-bold"><span aria-hidden="true" className={`inline-block size-3 rounded-full ${cancelled ? 'bg-[#c8321e]' : 'bg-[#1e9e4a]'}`} />{state.head}</p>
          <p className="mt-1 text-[17px] leading-snug">{state.body}</p>
          <dl className="mt-5 divide-y divide-[#e3e5e7] border-y border-[#d9dcdf] text-[17px]">
            <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Confirmation code</dt><dd className="font-bold tabular-nums">{job.publicCode}</dd></div>
            {job.jobType?.name ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Problem</dt><dd className="font-bold">{job.jobType.name}</dd></div> : null}
            {windowText ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Arrival window</dt><dd className="font-bold">{windowText}</dd></div> : null}
            {job.location ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Address</dt><dd className="font-bold">{job.location.address1}{job.location.address2 ? `, ${job.location.address2}` : ''}, {job.location.city}, {job.location.state} {job.location.postalCode}</dd></div> : null}
            {tech ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Technician</dt><dd className="font-bold">{tech.name}{tech.title ? <span className="block text-[15px] font-normal">{tech.title}</span> : null}</dd></div> : null}
            {visit?.status === 'en_route' && visit.etaMinutes ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Arriving in</dt><dd className="font-bold">About {visit.etaMinutes} minutes</dd></div> : null}
            {visit?.window && !cancelled ? <div className="flex gap-4 py-3"><dt className="w-36 shrink-0 text-[15px] text-[#3d4347] sm:w-44">Window opens</dt><dd>{timeText(visit.window.startsAt.toISOString(), company.timeZone)}</dd></div> : null}
          </dl>
        </section>
        <aside className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          <h2 className="text-[20px] font-bold">Need to change or cancel?</h2>
          <p className="mt-2 text-[17px] leading-snug">Call us with your code and we will move the window or cancel it.</p>
          {company.phone ? <a href={company.phoneHref} className={`${quietButton} mt-4`}><Phone className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />{company.phone}</a> : null}
          <h2 className="mt-8 text-[20px] font-bold">Before we arrive</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[17px] leading-snug">
            <li>Have an adult (18 or older) at home for the visit.</li>
            <li>Clear a path to the equipment and put pets in another room.</li>
            <li>You approve the price before any work starts.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}

// ── Pay an invoice ────────────────────────────────────────────────────────────

const INVOICE_TEXT: Record<string, string> = { posted: 'Due', partially_paid: 'Partly paid', paid: 'Paid', written_off: 'Closed', voided: 'Voided' }

export async function PayScreen({ code, notice }: { code: string; notice?: string }) {
  let invoice = await invoiceByCode(code)
  if (!invoice) notFound()
  // The customer may have paid and closed the card page before it came back: ask Stripe once, on the read.
  if (invoice.openAttempt?.status === 'pending' && (await settleOpenAttempt(invoice).catch(() => false))) invoice = (await invoiceByCode(code))!
  const company = await getCompany()
  const due = BigInt(invoice.balanceMinor) > 0n && ['posted', 'partially_paid'].includes(invoice.status)
  const paidSoFar = (BigInt(invoice.totalMinor) - BigInt(invoice.balanceMinor)).toString()
  const amountToPay = invoice.openAttempt?.status === 'pending' ? invoice.openAttempt.amountMinor : invoice.balanceMinor
  return (
    <>
      <PageTitle title={due ? `Invoice ${invoice.ref}` : invoice.status === 'paid' ? 'Paid. Thank you.' : `Invoice ${invoice.ref}`} lead={`${company.name}${invoice.customer ? ` · ${invoice.customer}` : ''}${invoice.address ? ` · ${invoice.address}` : ''}`} />
      <div className={`${container} mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
        <section>
          {notice ? <p role="status" className="mb-5 border-l-4 border-[#e8641c] bg-[#fff5ee] px-4 py-3 text-[16px] font-bold">{notice}</p> : null}
          <table className="w-full border-collapse text-left text-[17px]">
            <thead><tr className="border-y border-[#d9dcdf] bg-[#f5f6f7] text-[15px]"><th scope="col" className="px-3 py-2.5 font-bold">Work</th><th scope="col" className="px-3 py-2.5 text-right font-bold">Amount</th></tr></thead>
            <tbody>
              {invoice.lines.map((l, i) => (
                <tr key={i} className="border-b border-[#e3e5e7]"><td className="px-3 py-3">{l.description}{Number(l.quantity) !== 1 ? <span className="text-[15px] text-[#3d4347]"> × {l.quantity.replace(/\.?0+$/, '')}</span> : null}</td><td className="px-3 py-3 text-right tabular-nums">{dollarsExact(l.amountMinor)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-[17px]">
            <div className="flex justify-between gap-6"><dt>Subtotal</dt><dd className="tabular-nums">{dollarsExact(invoice.subtotalMinor)}</dd></div>
            {BigInt(invoice.discountMinor) > 0n ? <div className="flex justify-between gap-6"><dt>Discount</dt><dd className="tabular-nums">−{dollarsExact(invoice.discountMinor)}</dd></div> : null}
            <div className="flex justify-between gap-6"><dt>Sales tax</dt><dd className="tabular-nums">{dollarsExact(invoice.taxMinor)}</dd></div>
            <div className="flex justify-between gap-6 border-t border-[#d9dcdf] pt-1.5 font-bold"><dt>Total</dt><dd className="tabular-nums">{dollarsExact(invoice.totalMinor)}</dd></div>
            {BigInt(paidSoFar) > 0n ? <div className="flex justify-between gap-6"><dt>Paid</dt><dd className="tabular-nums">−{dollarsExact(paidSoFar)}</dd></div> : null}
          </dl>
        </section>
        <aside className="lg:border-l lg:border-[#d9dcdf] lg:pl-9">
          <p className="flex items-center gap-2.5 text-[17px] font-bold"><span aria-hidden="true" className={`inline-block size-3 rounded-full ${due ? 'bg-[#e8641c]' : 'bg-[#1e9e4a]'}`} />{INVOICE_TEXT[invoice.status] ?? invoice.status}{invoice.dueDate && due ? ` · due ${dayText(invoice.dueDate, 'long')}` : ''}</p>
          <p className="mt-2 text-[15px] text-[#3d4347]">Balance</p>
          <p className="text-[44px] font-extrabold leading-none tracking-[-0.035em] tabular-nums">{dollarsExact(invoice.balanceMinor)}</p>
          {due ? (
            invoice.openAttempt?.status === 'unknown'
              ? <p className="mt-5 text-[16px] leading-snug">A card payment on this invoice is still being checked, so we cannot take another one yet.{company.phone ? <> Call <a href={company.phoneHref} className={link}>{company.phone}</a>.</> : null}</p>
              : <div className="mt-5"><PayButton code={invoice.code} amount={dollarsExact(amountToPay)} /><p className="mt-3 text-[15px] leading-snug text-[#3d4347]">Your card is entered on Stripe&apos;s secure page. We never see or keep the card number.</p></div>
          ) : invoice.status === 'paid' ? <p className="mt-5 text-[17px] leading-snug">This invoice is paid in full. Keep this page as your receipt.</p> : null}
          {company.phone ? <p className="mt-6 text-[16px]">Question about this invoice? Call <a href={company.phoneHref} className={link}>{company.phone}</a>.</p> : null}
        </aside>
      </div>
    </>
  )
}
