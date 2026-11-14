'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, Droplets, Fan, Zap } from 'lucide-react'
import { confirmBooking, loadWindows, type WindowsResult } from '../actions'
import { dayHeading, SMS_WORDING } from '../lib/format'

export type WidgetJobType = { id: string; name: string; trade: string }
export type WidgetTrade = { key: string; name: string; short: string; diagnostic: string }

type Props = {
  jobTypes: WidgetJobType[]
  trades: WidgetTrade[]
  phone: string
  phoneHref: string
  /** "Austin time": how the company's time zone is said to a customer. */
  placeTime: string
  defaultState: string
  initialTrade?: string
  initialJobTypeId?: string
}

const ICONS: Record<string, typeof Fan> = { hvac: Fan, plumbing: Droplets, electrical: Zap }
const STEPS = ['Problem', 'Address', 'Arrival window', 'Confirm'] as const
const field = 'h-12 w-full rounded-[5px] border border-[#8b9196] bg-white px-3.5 text-[17px] text-[#1f2326] outline-none placeholder:text-[#8b9196] focus:border-[#e8641c] focus:ring-2 focus:ring-[#e8641c]/25'
const cta = 'inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[5px] bg-[#e8641c] px-6 text-[18px] font-bold text-white hover:bg-[#d2560f] disabled:cursor-not-allowed disabled:bg-[#f0b596] sm:w-auto'
const back = 'inline-flex min-h-[52px] items-center justify-center rounded-[5px] border border-[#8b9196] bg-white px-5 text-[16px] font-bold hover:bg-[#f5f6f7]'

function Dot({ tone }: { tone: 'ok' | 'no' | 'wait' }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${tone === 'ok' ? 'bg-[#1e9e4a]' : tone === 'no' ? 'bg-[#c8321e]' : 'bg-[#b4b9bd]'}`} />
}

export function BookingWidget({ jobTypes, trades, phone, phoneHref, placeTime, defaultState, initialTrade, initialJobTypeId }: Props) {
  const router = useRouter()
  const firstJob = (trade: string) => jobTypes.find(j => j.trade === trade)?.id ?? ''
  const startTrade = (initialJobTypeId && jobTypes.find(j => j.id === initialJobTypeId)?.trade) || (initialTrade && trades.some(t => t.key === initialTrade) ? initialTrade : trades[0]?.key) || ''
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [trade, setTrade] = useState(startTrade)
  const [jobTypeId, setJobTypeId] = useState(initialJobTypeId && jobTypes.some(j => j.id === initialJobTypeId) ? initialJobTypeId : firstJob(startTrade))
  const [zip, setZip] = useState('')
  const [answer, setAnswer] = useState<WindowsResult | null>(null)
  const [answerFor, setAnswerFor] = useState('')
  const [windowId, setWindowId] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address1: '', address2: '', city: '', state: defaultState, notes: '', website: '' })
  const [sms, setSms] = useState(false)
  const [error, setError] = useState<{ text: string; field?: string } | null>(null)
  const [loading, startLoading] = useTransition()
  const [booking, startBooking] = useTransition()
  const [key] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-booking`))
  const request = useRef(0)
  const top = useRef<HTMLDivElement>(null)

  // The ZIP typed last time is offered again on this device.
  useEffect(() => {
    try { const saved = window.localStorage.getItem('sf-zip'); if (saved && /^\d{5}$/.test(saved)) setZip(saved) } catch { /* private window */ }
  }, [])

  const zipReady = /^\d{5}$/.test(zip)
  const query = zipReady && jobTypeId ? `${jobTypeId}:${zip}` : ''
  useEffect(() => {
    if (!query) return
    const id = ++request.current
    const [jt, z] = query.split(':')
    const timer = setTimeout(() => {
      startLoading(async () => {
        const r = await loadWindows(jt, z)
        if (id !== request.current) return
        setAnswer(r)
        setAnswerFor(query)
        setWindowId(current => (r.slots.some(s => s.windowId === current) ? current : ''))
        try { window.localStorage.setItem('sf-zip', z) } catch { /* private window */ }
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const live = query && answerFor === query ? answer : null
  const inArea = !!live?.inArea
  const days = useMemo(() => {
    const map = new Map<string, WindowsResult['slots']>()
    for (const s of live?.slots ?? []) map.set(s.date, [...(map.get(s.date) ?? []), s])
    return [...map.entries()]
  }, [live])
  const chosen = live?.slots.find(s => s.windowId === windowId) ?? null
  const job = jobTypes.find(j => j.id === jobTypeId)
  const tradeInfo = trades.find(t => t.key === trade)
  const zone = live?.zone ?? ''
  const slotLabel = (label: string) => `${label}${zone ? ` ${zone}` : ''}`

  const go = (n: 1 | 2 | 3 | 4) => { setError(null); setStep(n); top.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
  const set = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [name]: e.target.value }))

  const pickTrade = (t: string) => { setTrade(t); setJobTypeId(firstJob(t)); setError(null) }

  const toAddress = () => {
    if (!job) return setError({ text: 'Choose what you need help with.' })
    if (!zipReady) return setError({ text: 'Enter your five-digit ZIP code.', field: 'zip' })
    if (!live) return setError({ text: 'One moment: we are checking your ZIP.' })
    if (!inArea) return setError({ text: `ZIP ${zip} is outside our service area.${phone ? ` Call ${phone} and we will point you to someone who can help.` : ''}`, field: 'zip' })
    go(2)
  }
  const toWindow = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return setError({ text: 'Enter your first and last name.', field: 'firstName' })
    if (form.phone.replace(/\D/g, '').replace(/^1/, '').length !== 10) return setError({ text: 'Enter a ten-digit phone number so the technician can reach you.', field: 'phone' })
    if (!form.address1.trim() || !/\d/.test(form.address1)) return setError({ text: 'Enter the street address, with the house number.', field: 'address1' })
    if (!form.city.trim()) return setError({ text: 'Enter the city.', field: 'city' })
    if (!zipReady || !inArea) return setError({ text: zipReady ? `ZIP ${zip} is outside our service area.` : 'Enter your five-digit ZIP code.', field: 'zip' })
    go(chosen ? 4 : 3)
  }
  const toConfirm = () => (chosen ? go(4) : setError({ text: 'Choose an arrival window.' }))

  const book = () => {
    if (!chosen || !job) return go(3)
    setError(null)
    startBooking(async () => {
      const r = await confirmBooking({ key, jobTypeId: job.id, windowId: chosen.windowId, ...form, postalCode: zip, smsConsent: sms })
      if (r.ok) return router.push(`/visit/${r.code}?booked=1`)
      if (r.step === 3) {
        // The window filled while they were typing: fetch the live list again.
        const fresh = await loadWindows(job.id, zip)
        setAnswer(fresh); setAnswerFor(`${job.id}:${zip}`); setWindowId('')
      }
      if (r.step) setStep(r.step)
      setError({ text: r.error, field: r.field })
    })
  }

  const zipStatus = !zipReady
    ? { tone: 'wait' as const, text: 'Enter your ZIP to see open arrival windows.' }
    : !live
      ? { tone: 'wait' as const, text: `Checking ${zip}…` }
      : live.error
        ? { tone: 'no' as const, text: live.error }
        : inArea
          ? { tone: 'ok' as const, text: `${zip}: we serve your area.${live.extended ? ' A trip fee applies this far out.' : ''}` }
          : { tone: 'no' as const, text: `${zip} is outside our service area.` }

  const slots = (list: [string, WindowsResult['slots']][]) => list.map(([date, daySlots]) => (
    <div key={date} className="mt-3 first:mt-2">
      <p className="text-[14px] text-[#3d4347]">{dayHeading(date, live!.today)} ({placeTime})</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {daySlots.map(s => {
          const on = s.windowId === windowId
          return (
            <button key={s.windowId} type="button" aria-pressed={on} onClick={() => { setWindowId(s.windowId); setError(null) }}
              className={`flex min-h-[50px] flex-col items-center justify-center rounded-[5px] border bg-white px-1.5 py-1.5 text-center leading-tight ${on ? 'border-[#e8641c] shadow-[inset_0_0_0_1px_#e8641c]' : 'border-[#8b9196] hover:border-[#1f2326]'}`}>
              <span className="text-[14px] font-bold sm:text-[15px]">{slotLabel(s.label)}</span>
              {s.left <= 3 ? <span className="text-[13px] text-[#3d4347]">({s.left} left)</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  ))

  const noWindows = live && inArea && !live.slots.length
    ? <p className="mt-2 text-[15px] leading-snug text-[#3d4347]">No open windows in the next week for this.{phone ? <> Call <a href={phoneHref} className="font-bold underline">{phone}</a> and we will fit you in.</> : null}</p>
    : null

  if (!trades.length || !jobTypes.length) {
    return (
      <div className="rounded-[10px] border border-[#d9dcdf] p-6">
        <p className="text-[20px] font-bold">Book by phone</p>
        <p className="mt-2 text-[17px] text-[#3d4347]">Online booking is not open yet.{phone ? <> Call <a href={phoneHref} className="font-bold underline">{phone}</a> and we will set up your visit.</> : null}</p>
      </div>
    )
  }

  return (
    <div ref={top} className="scroll-mt-4 rounded-[10px] border border-[#d9dcdf] bg-white">
      <ol className="flex items-center justify-between gap-1.5 border-b border-[#eceef0] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4
          const state = n === step ? 'on' : n < step ? 'done' : 'todo'
          return (
            <li key={label} className={`flex min-w-0 items-center gap-2 sm:gap-3 ${i < 3 ? 'sm:flex-1' : ''}`} aria-current={state === 'on' ? 'step' : undefined}>
              <button type="button" disabled={state !== 'done'} onClick={() => go(n)} className="flex min-w-0 items-center gap-1 text-left disabled:cursor-default sm:gap-3">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold sm:size-9 sm:text-[16px] ${state === 'on' ? 'bg-[#e8641c] text-white' : state === 'done' ? 'border-2 border-[#e8641c] text-[#e8641c]' : 'border-2 border-[#b4b9bd] text-[#6b7176]'}`}>{n}</span>
                <span className={`text-[12px] leading-[1.1] sm:text-[17px] ${state === 'on' ? 'font-bold' : 'text-[#3d4347]'}`}>{label}</span>
              </button>
              {i < 3 ? <span aria-hidden="true" className="hidden h-px flex-1 bg-[#c9cdd1] sm:block" /> : null}
            </li>
          )
        })}
      </ol>

      <div className="p-4 sm:p-6">
        {step === 1 ? (
          <div className="grid gap-6 lg:grid-cols-[1.12fr_1fr] lg:gap-0">
            <div className="lg:border-r lg:border-[#d9dcdf] lg:pr-6">
              <h2 className="text-[21px] font-bold tracking-[-0.02em] sm:text-[23px]"><span className="lg:hidden">What needs fixing?</span><span className="hidden lg:inline">What do you need help with?</span></h2>
              <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                {trades.map(t => {
                  const Icon = ICONS[t.key] ?? Fan
                  const on = t.key === trade
                  const problems = jobTypes.filter(j => j.trade === t.key)
                  return (
                    <div key={t.key} className={`rounded-[5px] border ${on ? 'border-[#e8641c] bg-[#fff5ee] shadow-[inset_4px_0_0_#e8641c]' : 'border-[#c9cdd1] bg-white hover:border-[#1f2326]'}`}>
                      <button type="button" aria-pressed={on} onClick={() => pickTrade(t.key)} className="flex min-h-[58px] w-full items-center gap-4 px-4 py-2.5 text-left sm:min-h-[74px] sm:gap-5 sm:px-5">
                        <Icon className={`size-7 shrink-0 sm:size-9 ${on ? 'text-[#e8641c] lg:text-[#1f2326]' : ''}`} strokeWidth={1.75} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[19px] font-bold leading-tight tracking-[-0.01em] sm:text-[21px]">{t.name}</span>
                          <span className="mt-0.5 hidden text-[14px] leading-snug text-[#3d4347] sm:block">{t.short}</span>
                        </span>
                        <ChevronRight className="size-5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                      </button>
                      {on && problems.length > 1 ? (
                        <fieldset className="border-t border-[#f3cdb6] px-4 pb-3 pt-2.5 sm:px-5">
                          <legend className="sr-only">What is going on?</legend>
                          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                            {problems.map(p => (
                              <label key={p.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px] leading-tight">
                                <input type="radio" name="problem" value={p.id} checked={p.id === jobTypeId} onChange={() => { setJobTypeId(p.id); setError(null) }} className="size-4 shrink-0 accent-[#e8641c]" />
                                <span>{p.name}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="lg:pl-6">
              <label htmlFor="sf-zip" className="block text-[17px] font-bold"><span className="lg:hidden">Your ZIP code</span><span className="hidden lg:inline">Your address</span></label>
              <input id="sf-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="ZIP code" value={zip} aria-invalid={error?.field === 'zip'} aria-describedby="sf-zip-status"
                onChange={e => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setError(null) }} className={`${field} mt-2`} />
              <p id="sf-zip-status" role="status" className="mt-2 flex items-center gap-2 text-[15px] leading-snug"><Dot tone={zipStatus.tone} /><span>{zipStatus.text}</span></p>

              <p className="mt-5 text-[17px] font-bold"><span className="lg:hidden">Next arrival windows</span><span className="hidden lg:inline">Choose an arrival window</span></p>
              {live && inArea ? (noWindows ?? slots(days.slice(0, 2))) : <p className="mt-2 text-[15px] text-[#3d4347]">{loading && zipReady ? 'Loading open windows…' : `Shown in ${placeTime} once we know your ZIP.`}</p>}
              {live && inArea && days.length > 2 ? <p className="mt-2 text-[14px] text-[#3d4347]">More days on the arrival window step.</p> : null}

              {error ? <p role="alert" className="mt-4 text-[15px] font-bold text-[#b3261e]">{error.text}</p> : null}
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={toAddress} className={cta}><span className="lg:hidden">Book a visit</span><span className="hidden lg:inline">Continue to address</span><ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" /></button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <form onSubmit={e => { e.preventDefault(); toWindow() }} noValidate>
            <h2 className="text-[23px] font-bold tracking-[-0.02em]">Where should we come, and who do we ask for?</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="First name" id="sf-first"><input id="sf-first" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} aria-invalid={error?.field === 'firstName'} className={field} /></Field>
              <Field label="Last name" id="sf-last"><input id="sf-last" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} className={field} /></Field>
              <Field label="Mobile phone" id="sf-phone"><input id="sf-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} aria-invalid={error?.field === 'phone'} className={field} /></Field>
              <Field label="Email (optional)" id="sf-email"><input id="sf-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={error?.field === 'email'} className={field} /></Field>
              <Field label="Street address" id="sf-address1"><input id="sf-address1" autoComplete="address-line1" value={form.address1} onChange={set('address1')} aria-invalid={error?.field === 'address1'} className={field} /></Field>
              <Field label="Apartment or unit (optional)" id="sf-address2"><input id="sf-address2" autoComplete="address-line2" value={form.address2} onChange={set('address2')} className={field} /></Field>
              <Field label="City" id="sf-city"><input id="sf-city" autoComplete="address-level2" value={form.city} onChange={set('city')} aria-invalid={error?.field === 'city'} className={field} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="State" id="sf-state"><input id="sf-state" autoComplete="address-level1" maxLength={2} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} aria-invalid={error?.field === 'state'} className={field} /></Field>
                <Field label="ZIP code" id="sf-zip2"><input id="sf-zip2" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} aria-invalid={error?.field === 'zip' || error?.field === 'postalCode'} className={field} /></Field>
              </div>
              <div className="sm:col-span-2">
                <p className="flex items-center gap-2 text-[15px]"><Dot tone={zipStatus.tone} /><span>{zipStatus.text}</span></p>
              </div>
              <div className="sm:col-span-2">
                <Field label="Anything we should know? (optional)" id="sf-notes"><textarea id="sf-notes" rows={3} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="What is happening, gate code, pets, where to park" className={`${field} h-auto py-3`} /></Field>
              </div>
              <div aria-hidden="true" className="absolute left-[-9999px] top-auto size-px overflow-hidden">
                <label htmlFor="sf-website">Website</label><input id="sf-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </div>
            </div>
            {error ? <p role="alert" className="mt-4 text-[15px] font-bold text-[#b3261e]">{error.text}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => go(1)} className={back}>Back</button>
              <button type="submit" className={cta}>Continue to arrival window<ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" /></button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-[23px] font-bold tracking-[-0.02em]">Choose an arrival window</h2>
            <p className="mt-1 text-[16px] text-[#3d4347]">Your technician arrives inside the window. Times are {placeTime}.</p>
            <div className="mt-2 max-w-2xl">
              {live && inArea ? (noWindows ?? slots(days)) : <p className="mt-3 text-[15px] text-[#3d4347]">{loading ? 'Loading open windows…' : zipStatus.text}</p>}
            </div>
            {error ? <p role="alert" className="mt-4 text-[15px] font-bold text-[#b3261e]">{error.text}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => go(2)} className={back}>Back</button>
              <button type="button" onClick={toConfirm} className={cta}>Continue to confirm<ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" /></button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h2 className="text-[23px] font-bold tracking-[-0.02em]">Check it over, then book</h2>
            <dl className="mt-4 divide-y divide-[#e3e5e7] border-y border-[#e3e5e7] text-[17px]">
              <Row label="Problem" onEdit={() => go(1)}>{tradeInfo?.name}{job ? `: ${job.name}` : ''}</Row>
              <Row label="Address" onEdit={() => go(2)}>{form.address1}{form.address2 ? `, ${form.address2}` : ''}, {form.city}, {form.state} {zip}</Row>
              <Row label="Arrival window" onEdit={() => go(3)}>{chosen && live ? `${dayHeading(chosen.date, live.today)}, ${slotLabel(chosen.label)} (${placeTime})` : 'Not chosen yet'}</Row>
              <Row label="Contact" onEdit={() => go(2)}>{form.firstName} {form.lastName}, {form.phone}{form.email ? `, ${form.email}` : ''}</Row>
              {form.notes.trim() ? <Row label="Notes" onEdit={() => go(2)}>{form.notes}</Row> : null}
            </dl>
            {tradeInfo?.diagnostic ? <p className="mt-4 text-[16px] leading-snug text-[#3d4347]">{tradeInfo.diagnostic} Nothing is charged now: you see the price of any repair and approve it before work starts.</p> : <p className="mt-4 text-[16px] leading-snug text-[#3d4347]">Nothing is charged now: you see the price and approve it before work starts.</p>}
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
              <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#e8641c]" />
              <span>{SMS_WORDING}</span>
            </label>
            {error ? <p role="alert" className="mt-4 text-[15px] font-bold text-[#b3261e]">{error.text}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => go(3)} disabled={booking} className={back}>Back</button>
              <button type="button" onClick={book} disabled={booking || !chosen} className={cta}>{booking ? 'Booking your visit…' : 'Book my visit'}{booking ? null : <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" />}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-[15px] font-bold">{label}</label>{children}</div>
}

function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <dt className="w-32 shrink-0 text-[15px] text-[#3d4347] sm:w-40">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-bold">{children}</dd>
      <button type="button" onClick={onEdit} className="shrink-0 text-[15px] font-bold underline underline-offset-2 hover:text-[#e8641c]">Change</button>
    </div>
  )
}
