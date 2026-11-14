'use client'

import { useActionState, useState, useTransition } from 'react'
import { ArrowRight } from 'lucide-react'
import { checkZip, openByCode, startInvoicePayment, type AreaAnswer } from '../actions'

const field = 'h-12 w-full rounded-[5px] border border-[#8b9196] bg-white px-3.5 text-[17px] text-[#1f2326] outline-none placeholder:text-[#8b9196] focus:border-[#e8641c] focus:ring-2 focus:ring-[#e8641c]/25'
const cta = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] bg-[#e8641c] px-6 text-[17px] font-bold text-white hover:bg-[#d2560f] disabled:cursor-not-allowed disabled:bg-[#f0b596]'

/** "Do you come to my ZIP?" on the service area page. */
export function ZipCheck({ phone, phoneHref }: { phone: string; phoneHref: string }) {
  const [zip, setZip] = useState('')
  const [answer, setAnswer] = useState<(AreaAnswer & { zip: string }) | null>(null)
  const [pending, start] = useTransition()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => setAnswer({ ...(await checkZip(zip)), zip }))
  }
  return (
    <form onSubmit={submit} className="max-w-md">
      <label htmlFor="sf-area-zip" className="block text-[17px] font-bold">Your ZIP code</label>
      <div className="mt-2 flex gap-3">
        <input id="sf-area-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} className={field} aria-describedby="sf-area-answer" />
        <button type="submit" disabled={pending || zip.length !== 5} className={cta}>{pending ? 'Checking…' : 'Check'}</button>
      </div>
      <p id="sf-area-answer" role="status" className="mt-3 flex min-h-6 items-center gap-2 text-[16px]">
        {answer ? (
          <>
            <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${answer.inArea ? 'bg-[#1e9e4a]' : 'bg-[#c8321e]'}`} />
            {!answer.valid ? <span>Enter a five-digit ZIP code.</span>
              : answer.inArea ? <span>{answer.zip}: we serve your area{answer.area ? ` (${answer.area})` : ''}. <a href="/book" className="font-bold underline underline-offset-2">Book a visit</a></span>
                : <span>{answer.zip} is outside our service area.{phone ? <> Call <a href={phoneHref} className="font-bold underline">{phone}</a> and we will point you to someone who can help.</> : null}</span>}
          </>
        ) : null}
      </p>
    </form>
  )
}

/** The code box on the sign-in page: opens the visit, invoice or membership the code belongs to. */
export function CodeForm() {
  const [state, action, pending] = useActionState(openByCode, null)
  return (
    <form action={action} className="max-w-md">
      <label htmlFor="sf-code" className="block text-[17px] font-bold">Your code</label>
      <input id="sf-code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="J-7K2Q-9MXD" required maxLength={24} className={`${field} mt-2 uppercase placeholder:normal-case`} aria-describedby="sf-code-error" />
      <p id="sf-code-error" role="alert" className="mt-2 min-h-5 text-[15px] font-bold text-[#b3261e]">{state?.error}</p>
      <button type="submit" disabled={pending} className={`${cta} mt-2`}>{pending ? 'Looking…' : 'Open'}{pending ? null : <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" />}</button>
    </form>
  )
}

/** Opens Stripe's card page for the invoice's balance. */
export function PayButton({ code, amount }: { code: string; amount: string }) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const pay = () => {
    setError('')
    start(async () => {
      const r = await startInvoicePayment(code)
      if (r.ok) { window.location.assign(r.url); return }
      setError(r.error)
    })
  }
  return (
    <div>
      <button type="button" onClick={pay} disabled={pending} className={`${cta} w-full sm:w-auto`}>{pending ? 'Opening the card page…' : `Pay ${amount} by card`}{pending ? null : <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" />}</button>
      {error ? <p role="alert" className="mt-3 text-[15px] font-bold text-[#b3261e]">{error}</p> : null}
    </div>
  )
}
