'use server'

import { redirect } from 'next/navigation'
import { keystoneContext } from '@/features/keystone/context'
import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl'
import { contactHash, normalizeEmail, normalizePhone } from '@/features/keystone/domain/contact'
import { isDomainError } from '@/features/keystone/lib/errors'
import { bookJob } from '@/features/keystone/services/booking'
import { startPaymentAttempt } from '@/features/keystone/services/payments'
import { stripeAdapter } from '@/features/keystone/services/stripeCards'
import { areaForZip, getCompany, getOnlineJobTypes, ONLINE, today, windowsFor, type WindowsAnswer } from './lib/data'
import { SMS_WORDING, zoneLabel } from './lib/format'
import { INVOICE_CODE, invoiceByCode, ONLINE_PAYMENTS, settleOpenAttempt } from './lib/payments'

const db = () => keystoneContext.prisma as any
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export type AreaAnswer = { valid: boolean; inArea: boolean; area: string | null; extended: boolean }

/** Service-area check for a ZIP (the same areas the office books against). */
export async function checkZip(postalCode: string): Promise<AreaAnswer> {
  const zip = clean(postalCode, 10).slice(0, 5)
  if (!/^\d{5}$/.test(zip)) return { valid: false, inArea: false, area: null, extended: false }
  const area = await areaForZip(zip)
  return { valid: true, inArea: !!area, area: area?.name ?? null, extended: area?.travelZone === 'extended' }
}

export type WindowsResult = WindowsAnswer & { today: string; zone: string; error?: string }

/** Open arrival windows for a problem at a ZIP: live capacity, next seven days. */
export async function loadWindows(jobTypeId: string, postalCode: string): Promise<WindowsResult> {
  const company = await getCompany()
  const base = { today: today(company.timeZone), zone: zoneLabel(company.timeZone) }
  const zip = clean(postalCode, 10).slice(0, 5)
  const offered = (await getOnlineJobTypes()).some(j => j.id === jobTypeId)
  if (!offered || !/^\d{5}$/.test(zip)) return { ...base, inArea: false, area: null, extended: false, slots: [] }
  try {
    return { ...base, ...(await windowsFor(jobTypeId, zip)) }
  } catch (e) {
    console.error(JSON.stringify({ component: 'storefront-windows', status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'unknown error' }))
    return { ...base, inArea: false, area: null, extended: false, slots: [], error: 'We could not load arrival windows just now. Please try again, or call us.' }
  }
}

export type BookingInput = {
  key: string; jobTypeId: string; windowId: string
  firstName: string; lastName: string; phone: string; email: string
  address1: string; address2: string; city: string; state: string; postalCode: string
  notes: string; smsConsent: boolean; website?: string
}
export type BookingResult = { ok: true; code: string } | { ok: false; error: string; field?: string; step?: 1 | 2 | 3 | 4 }

/**
 * Book the visit. Runs the office's booking command with source "online": it takes the hours out of the
 * arrival window (a full window is refused), creates the customer and address, the job and its first visit.
 */
export async function confirmBooking(input: BookingInput): Promise<BookingResult> {
  // A field people never see; filled only by form robots.
  if (clean(input.website, 200)) return { ok: false, error: 'That did not go through. Please call us to book.' }
  const key = clean(input.key, 64)
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) return { ok: false, error: 'Please reload the page and try again.' }
  const firstName = clean(input.firstName, 60), lastName = clean(input.lastName, 60)
  const address1 = clean(input.address1, 120), address2 = clean(input.address2, 60), city = clean(input.city, 60)
  const state = clean(input.state, 2).toUpperCase(), postalCode = clean(input.postalCode, 10), notes = clean(input.notes, 500)
  if (!firstName || !lastName) return { ok: false, error: 'Enter your first and last name.', field: 'firstName', step: 2 }
  if (!address1 || !/\d/.test(address1)) return { ok: false, error: 'Enter the street address, with the house number.', field: 'address1', step: 2 }
  if (!city) return { ok: false, error: 'Enter the city.', field: 'city', step: 2 }
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, error: 'Enter the two-letter state.', field: 'state', step: 2 }
  if (!/^\d{5}$/.test(postalCode)) return { ok: false, error: 'Enter the five-digit ZIP code.', field: 'postalCode', step: 2 }
  let phone: string, email: string | null
  try { phone = normalizePhone(input.phone) } catch { return { ok: false, error: 'Enter a ten-digit phone number so the technician can reach you.', field: 'phone', step: 2 } }
  try { email = clean(input.email, 254) ? normalizeEmail(input.email) : null } catch { return { ok: false, error: 'That email address does not look right.', field: 'email', step: 2 } }
  const jobType = (await getOnlineJobTypes()).find(j => j.id === input.jobTypeId)
  if (!jobType) return { ok: false, error: 'Choose what you need help with.', step: 1 }
  if (!clean(input.windowId, 64)) return { ok: false, error: 'Choose an arrival window.', step: 3 }

  // A returning customer (same phone, same address) keeps their record; anyone else gets a new one.
  const points = await db().contactPoint.findMany({ where: { valueHash: contactHash(phone), kind: { in: ['mobile', 'landline'] } }, take: 20, select: { contact: { select: { customerId: true } } } })
  const customerIds = [...new Set(points.map((p: any) => p.contact?.customerId).filter(Boolean))] as string[]
  const known = customerIds.length
    ? await db().serviceLocation.findFirst({ where: { customerId: { in: customerIds }, postalCode: { startsWith: postalCode }, address1: { equals: address1, mode: 'insensitive' } }, select: { id: true, customerId: true } })
    : null

  try {
    const r = await bookJob(keystoneContext.prisma as never, ONLINE, {
      windowId: input.windowId, jobTypeId: jobType.id, source: 'online', summary: notes,
      ...(known
        ? { customerId: known.customerId, locationId: known.id }
        : { customer: { firstName, lastName, kind: 'residential' as const, phone, ...(email ? { email } : {}) }, location: { address1, ...(address2 ? { address2 } : {}), city, state, postalCode } }),
      smsConsent: !!input.smsConsent, consentEvidence: { source: 'online', wording: input.smsConsent ? SMS_WORDING : '', page: 'booking' },
      idempotencyKey: `online-booking:${key}`,
    })
    return { ok: true, code: r.publicCode }
  } catch (e) {
    if (isDomainError(e)) {
      if (e.code === 'CAPACITY_FULL') return { ok: false, error: 'That arrival window just filled up. Please pick another one.', step: 3 }
      if (e.code === 'OUT_OF_AREA') return { ok: false, error: `ZIP ${postalCode} is outside our service area for this work. Please call us.`, field: 'postalCode', step: 2 }
      if (e.details?.reason === 'do_not_service') return { ok: false, error: 'We could not book this online. Please call us.' }
      if (e.code === 'INVALID_INPUT' || e.code === 'GUARD_FAILED' || e.code === 'NOT_FOUND') return { ok: false, error: e.message, field: typeof e.details?.field === 'string' ? e.details.field : undefined }
    }
    console.error(JSON.stringify({ component: 'storefront-booking', status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'unknown error' }))
    return { ok: false, error: 'The booking did not go through. Nothing was booked. Please try again, or call us.' }
  }
}

export type PayResult = { ok: true; url: string } | { ok: false; error: string }

/** Open Stripe's card page for an invoice's balance. One open card try per invoice: an unfinished one is reused. */
export async function startInvoicePayment(code: string): Promise<PayResult> {
  const publicCode = clean(code, 20).toUpperCase()
  const company = await getCompany()
  const call = company.phone ? ` Please call ${company.phone}.` : ' Please call the office.'
  let invoice = await invoiceByCode(publicCode)
  if (!invoice) return { ok: false, error: 'That invoice was not found.' }
  const stripe = stripeAdapter()
  if (!stripe) return { ok: false, error: `Card payment is not switched on for this company yet.${call}` }
  if (invoice.openAttempt && (await settleOpenAttempt(invoice))) return { ok: false, error: 'This invoice is already paid. Reload the page to see the receipt.' }
  invoice = (await invoiceByCode(publicCode))!
  if (!['posted', 'partially_paid'].includes(invoice.status) || BigInt(invoice.balanceMinor) <= 0n) return { ok: false, error: 'This invoice has nothing left to pay.' }
  if (invoice.openAttempt?.status === 'unknown') return { ok: false, error: `An earlier card payment on this invoice is still being checked, so we cannot take another one yet.${call}` }
  let attemptId = invoice.openAttempt?.id
  let amount = invoice.openAttempt ? BigInt(invoice.openAttempt.amountMinor) : BigInt(invoice.balanceMinor)
  if (attemptId && amount > BigInt(invoice.balanceMinor)) return { ok: false, error: `The balance changed while a card payment was open.${call}` }
  try {
    if (!attemptId) {
      const started = await startPaymentAttempt(keystoneContext.prisma as never, ONLINE_PAYMENTS, { invoiceId: invoice.id, amountMinor: invoice.balanceMinor, method: 'card', idempotencyKey: `online:${crypto.randomUUID()}` })
      attemptId = started.attemptId
      amount = BigInt(invoice.balanceMinor)
    }
    const origin = await getBaseUrl()
    const session = await stripe.paymentCheckout({
      amountMinor: amount, name: `${company.name} invoice ${invoice.ref}`,
      successUrl: `${origin}/api/storefront/pay-return?session_id={CHECKOUT_SESSION_ID}&code=${encodeURIComponent(invoice.code)}`, cancelUrl: `${origin}/pay/${encodeURIComponent(invoice.code)}`,
      metadata: { kind: 'invoice_online', invoiceId: invoice.id, attemptId: attemptId! },
    })
    return { ok: true, url: session.url }
  } catch (e) {
    console.error(JSON.stringify({ component: 'storefront-pay', status: 'start_failed', error: e instanceof Error ? e.message.slice(0, 300) : 'unknown error' }))
    return { ok: false, error: isDomainError(e) ? e.message : `The card page did not open. Nothing was charged.${call}` }
  }
}

/** "Find my visit, invoice or membership": the code printed on the confirmation, the invoice or the membership letter. */
export async function openByCode(_: { error: string } | null, formData: FormData): Promise<{ error: string }> {
  const code = clean(formData.get('code'), 24).toUpperCase().replace(/\s/g, '')
  if (/^J-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code) && (await db().job.findUnique({ where: { publicCode: code }, select: { id: true } }))) redirect(`/visit/${code}`)
  if (INVOICE_CODE.test(code) && (await invoiceByCode(code))) redirect(`/pay/${code}`)
  if (/^MBR-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code) && (await db().membership.findUnique({ where: { publicCode: code }, select: { id: true } }))) redirect(`/membership/${code}`)
  return { error: 'We could not find that code. Check it against your confirmation, invoice or membership letter (for example J-7K2Q-9MXD).' }
}
