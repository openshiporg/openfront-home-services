import Link from 'next/link'
import { ChevronDown, Phone } from 'lucide-react'
import { getCompany, hasOnCall, TRADE_COPY, TRADES, type Company } from '../lib/data'
import { MobileMenu } from './MobileMenu'

export const ORANGE = '#e8641c'
export const INK = '#1f2326'

/** The faceted mark: an angular gem outline in the brand colour. */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 3 34.5 11.5v17L20 37 5.5 28.500v-17L20 3Z" />
      <path d="M5.5 11.5 20 17l14.5-5.5M20 17l-8.5 13.500M20 17l8.500 13.500M11.500 30.500h17M5.500 28.500l6-9.500M34.500 28.500l-6-9.500" />
    </svg>
  )
}

/** Lowercase name: leading words medium, the last word (with its "&") light. */
export function Wordmark({ name, className = '' }: { name: string; className?: string }) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean)
  let cut = Math.max(words.length - 1, 1)
  if (cut > 1 && words[cut - 1] === '&') cut -= 1
  const lead = words.slice(0, cut).join(' ')
  const tail = words.slice(cut).join(' ')
  return (
    <span className={`font-[family-name:var(--font-sf-logo)] tracking-[-0.01em] ${className}`}>
      <span className="font-semibold">{lead}</span>{tail ? <span className="font-normal"> {tail}</span> : null}
    </span>
  )
}

export function Logo({ name, dark = false }: { name: string; dark?: boolean }) {
  return (
    <Link href="/" aria-label={`${name} home`} className={`flex items-center gap-2.5 ${dark ? 'text-white' : 'text-[#1f2326]'}`}>
      <Mark size={32} />
      <Wordmark name={name} className="text-[21px] leading-none sm:text-[23px]" />
    </Link>
  )
}

export const NAV = [
  { href: '/memberships', label: 'Memberships' },
  { href: '/service-area', label: 'Service area' },
  { href: '/about', label: 'About' },
] as const

async function EmergencyStrip({ company }: { company: Company }) {
  if (!company.phone) return null
  const onCall = await hasOnCall()
  return (
    <a href={company.phoneHref} className="flex min-h-10 items-center justify-center gap-2 bg-[#e8641c] px-4 py-2 text-center text-[15px] font-bold leading-tight text-white sm:text-[17px]">
      <Phone className="size-4 shrink-0 sm:hidden" fill="currentColor" strokeWidth={0} aria-hidden="true" />
      {onCall ? <span>24/7 emergency: {company.phone}, a person answers.</span> : <span>Emergency? Call {company.phone}.</span>}
    </a>
  )
}

export async function Header() {
  const company = await getCompany()
  const services = TRADES.map(t => ({ href: `/services/${TRADE_COPY[t].slug}`, label: TRADE_COPY[t].name }))
  return (
    <header className="relative bg-white">
      <div className="hidden lg:block"><EmergencyStrip company={company} /></div>
      <div className="border-b border-[#e3e5e7]">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <Logo name={company.name} />
          <nav aria-label="Main" className="hidden items-center gap-10 text-[16px] font-medium lg:flex">
            <div className="group relative">
              <Link href="/services" className="flex items-center gap-1 py-4 hover:text-[#e8641c]">Services <ChevronDown className="size-4" strokeWidth={2.5} aria-hidden="true" /></Link>
              <div className="invisible absolute left-1/2 top-full z-30 w-60 -translate-x-1/2 border border-[#d9dcdf] bg-white py-2 opacity-0 shadow-[0_8px_24px_rgba(31,35,38,0.10)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {services.map(s => <Link key={s.href} href={s.href} className="block px-4 py-2.5 hover:bg-[#f5f6f7]">{s.label}</Link>)}
                <Link href="/services" className="block border-t border-[#e3e5e7] px-4 py-2.5 hover:bg-[#f5f6f7]">All services</Link>
              </div>
            </div>
            {NAV.map(n => <Link key={n.href} href={n.href} className="py-4 hover:text-[#e8641c]">{n.label}</Link>)}
          </nav>
          <div className="hidden items-center lg:flex">
            <Link href="/sign-in" className="px-5 text-[16px] font-medium hover:text-[#e8641c]">Sign in</Link>
            <span className="mr-5 h-6 w-px bg-[#d9dcdf]" aria-hidden="true" />
            <Link href="/book" className="inline-flex h-10 items-center rounded-[5px] bg-[#e8641c] px-5 text-[16px] font-bold text-white hover:bg-[#d2560f]">Book a visit</Link>
          </div>
          <MobileMenu links={[{ href: '/book', label: 'Book a visit' }, { href: '/services', label: 'Services' }, ...services.map(s => ({ ...s, sub: true })), ...NAV, { href: '/sign-in', label: 'Sign in' }]} phone={company.phone} phoneHref={company.phoneHref} />
        </div>
      </div>
      <div className="lg:hidden"><EmergencyStrip company={company} /></div>
    </header>
  )
}

export async function Footer() {
  const company = await getCompany()
  const onCall = await hasOnCall()
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 bg-[#1f2326] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Logo name={company.name} dark />
          {company.phone ? (
            <a href={company.phoneHref} className="flex items-center gap-3">
              <Phone className="size-5" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              <span><span className="block text-[20px] font-bold leading-tight">{company.phone}</span><span className="block text-[14px] text-white/80">{onCall ? 'Answered 24/7 by a person.' : 'Call the office.'}</span></span>
            </a>
          ) : null}
        </div>
        <div className="mt-8 grid gap-8 border-t border-white/15 pt-8 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-bold">Services</p>
            <ul className="mt-3 space-y-2 text-white/80">
              {TRADES.map(t => <li key={t}><Link href={`/services/${TRADE_COPY[t].slug}`} className="hover:text-white">{TRADE_COPY[t].name}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="font-bold">Company</p>
            <ul className="mt-3 space-y-2 text-white/80">
              {NAV.map(n => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
              <li><Link href="/book" className="hover:text-white">Book a visit</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold">Your account</p>
            <ul className="mt-3 space-y-2 text-white/80">
              <li><Link href="/sign-in" className="hover:text-white">Find a visit, invoice or membership</Link></li>
              <li><Link href="/dashboard/signin" className="hover:text-white">Team sign in</Link></li>
            </ul>
          </div>
          <div className="text-white/80">
            <p className="font-bold text-white">{company.legalName || company.name}</p>
            {company.address ? <p className="mt-3">{company.address.line1}<br />{company.address.city}, {company.address.region} {company.address.postalCode}</p> : null}
            {company.email ? <p className="mt-2"><a href={`mailto:${company.email}`} className="hover:text-white">{company.email}</a></p> : null}
          </div>
        </div>
        <p className="mt-8 text-[13px] leading-relaxed text-white/65">
          {company.licences.map(l => `${l.issuer} licence ${l.number}`).join(' · ')}{company.licences.length ? ' · ' : ''}© {year} {company.legalName || company.name}
        </p>
      </div>
    </footer>
  )
}

/** Inner pages: a plain title block in the same type as the home headline. */
export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <h1 className="text-[38px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[52px]">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-[18px] leading-snug text-[#3d4347]">{lead}</p> : null}
    </div>
  )
}

export const container = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10'
export const primaryButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] bg-[#e8641c] px-6 text-[17px] font-bold text-white hover:bg-[#d2560f] disabled:cursor-not-allowed disabled:bg-[#f0b596]'
export const quietButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] border border-[#1f2326] bg-white px-5 text-[16px] font-bold text-[#1f2326] hover:bg-[#f5f6f7]'
export const field = 'h-12 w-full rounded-[5px] border border-[#8b9196] bg-white px-3.5 text-[17px] text-[#1f2326] outline-none placeholder:text-[#8b9196] focus:border-[#e8641c] focus:ring-2 focus:ring-[#e8641c]/25'
