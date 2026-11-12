import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import { addDays } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { Permission } from '../access'
import { dayAt, termEnd } from '../domain/membershipTime'
import { asDate, companyToday, money } from './billingShared'

/*
 * Renewal notices, commercial service agreements and certificate expiry. Nothing is sent from here: a notice is a record plus a
 * message staff copy or export (CSV), and "coming up for renewal" is worked out from term dates and today whenever the page is read.
 */

const MANAGE: Permission[] = ['canManageMemberships']
const SELL: Permission[] = ['canSellMemberships', 'canManageMemberships']
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')
const clean = (v: unknown, field: string, min: number, max: number) => {
  const s = String(v ?? '').trim()
  if (s.length < min || s.length > max) throw new DomainError(Codes.INVALID_INPUT, min ? 'This is needed.' : 'Too long.', { field })
  return s
}

// ── Renewal notices ────────────────────────────────────────────────────────────────────────────────────────────────

export type RenewalRow = {
  membershipId: string; ref: string; customer: string; customerId: string; plan: string; phone: string; email: string; autoRenew: boolean
  termNumber: number; termEnds: string; daysLeft: number; priceMinor: string; noticeStatus: 'none' | 'drafted' | 'contacted' | 'dismissed'; noticeId: string | null
  cardLabel: string; address: string; message: string
}

/** The message the office reads or pastes. Plain words, the exact price and the date, and how to cancel. */
export function renewalMessage(row: { customer: string; plan: string; termEnds: string; priceMinor: bigint; autoRenew: boolean; company: string; cancelUrl: string; cardLabel: string }) {
  const first = row.customer.split(' ')[0]
  const date = new Date(`${row.termEnds}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return row.autoRenew
    ? `Hi ${first}, this is ${row.company}. Your ${row.plan} membership ends on ${date}. On the next day it renews for ${money(row.priceMinor)}, charged to your ${row.cardLabel || 'card on file'}. You do not need to do anything. To cancel before then, use ${row.cancelUrl} or call us.`
    : `Hi ${first}, this is ${row.company}. Your ${row.plan} membership ends on ${date}. To keep your member prices and visits, renew for ${money(row.priceMinor)}; call us and we will take care of it. Thank you!`
}

/** Memberships whose current term ends within `withinDays` (or has just ended and can still be renewed). Worked out now, not stored. */
export async function renewalsComing(db: Tx | Db, args: { withinDays?: number; baseUrl?: string } = {}): Promise<RenewalRow[]> {
  const within = args.withinDays ?? 60
  const company = await db.companySettings.findFirst({ select: { legalName: true, displayName: true, homeTimeZone: true } as never }) as { displayName?: string; legalName?: string; homeTimeZone?: string } | null
  const today = dayAt(company?.homeTimeZone || 'America/Chicago', new Date())
  const rows = await db.membership.findMany({
    where: { status: { in: ['active', 'past_due'] } },
    select: {
      id: true, ref: true, publicCode: true, autoRenew: true, paymentMethodLabel: true,
      customer: { select: { id: true, displayName: true, primaryContact: { select: { points: { select: { kind: true, value: true, isPrimary: true } } } } } },
      location: { select: { address1: true, city: true } }, plan: { select: { name: true } },
      terms: { where: { status: 'active' }, orderBy: { termNumber: 'desc' }, take: 1, select: { id: true, termNumber: true, endsOn: true, priceMinor: true, planVersion: { select: { priceMinor: true } } } },
    } as never,
  }) as unknown as Array<{
    id: string; ref: string; publicCode: string; autoRenew: boolean; paymentMethodLabel: string
    customer: { id: string; displayName: string; primaryContact: { points: { kind: string; value: string; isPrimary: boolean }[] } | null } | null
    location: { address1: string; city: string } | null; plan: { name: string } | null
    terms: { id: string; termNumber: number; endsOn: Date; priceMinor: bigint }[]
  }>
  const noticeRows = await db.renewalNotice.findMany({ where: { membershipId: { in: rows.map(r => r.id) } }, select: { id: true, status: true, membershipId: true, term: { select: { termNumber: true } } } })
  const out: RenewalRow[] = []
  for (const m of rows) {
    const t = m.terms[0]
    if (!t || !m.customer) continue
    const ends = ymd(t.endsOn)
    const daysLeft = Math.round((Date.parse(`${ends}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    if (daysLeft > within || daysLeft < -30) continue
    const points = m.customer.primaryContact?.points ?? []
    const phone = points.find(p => p.kind === 'phone' || p.kind === 'mobile')?.value ?? ''
    const email = points.find(p => p.kind === 'email')?.value ?? ''
    const notice = noticeRows.find(n => n.membershipId === m.id && n.term?.termNumber === t.termNumber)
    const cancelUrl = `${args.baseUrl ?? ''}/membership/${m.publicCode}`
    out.push({
      membershipId: m.id, ref: m.ref, customer: m.customer.displayName, customerId: m.customer.id, plan: m.plan?.name ?? 'Membership', phone, email, autoRenew: m.autoRenew, termNumber: t.termNumber,
      termEnds: ends, daysLeft, priceMinor: t.priceMinor.toString(), noticeStatus: (notice?.status as RenewalRow['noticeStatus']) ?? 'none', noticeId: notice?.id ?? null, cardLabel: m.paymentMethodLabel,
      address: m.location ? `${m.location.address1}, ${m.location.city}` : '',
      message: renewalMessage({ customer: m.customer.displayName, plan: m.plan?.name ?? 'Membership', termEnds: ends, priceMinor: t.priceMinor, autoRenew: m.autoRenew, company: company?.displayName || company?.legalName || 'our team', cancelUrl, cardLabel: m.paymentMethodLabel }),
    })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

/** Note that the customer was told (or the notice dismissed). Writes one record per membership and term. */
export async function recordRenewalNotice(db: Db, actor: Actor, args: { membershipId: string; status: 'drafted' | 'contacted' | 'dismissed'; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.renewal_notice', SELL, args)
  if (!['drafted', 'contacted', 'dismissed'].includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, 'Choose what happened.', { field: 'status' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.renewal_notice', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const m = await tx.membership.findUnique({ where: { id: args.membershipId }, select: { id: true, autoRenew: true } })
    if (!m) throw new DomainError(Codes.NOT_FOUND, 'Membership not found.')
    const term = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, status: 'active' }, orderBy: { termNumber: 'desc' }, select: { id: true, endsOn: true, termNumber: true } })
    if (!term) throw new DomainError(Codes.GUARD_FAILED, 'This membership has no current term.')
    const noticeKey = `${m.id}:${term.termNumber}:${m.autoRenew ? 'auto_renew_reminder' : 'renewal_coming'}`
    const existing = await tx.renewalNotice.findUnique({ where: { noticeKey }, select: { id: true, status: true, version: true } })
    if (existing) {
      if (existing.status === args.status) return { noticeId: existing.id }
      await casUpdate(uow, { model: 'RenewalNotice', id: existing.id, version: existing.version, from: [existing.status], to: args.status, actor, eventType: 'membership.renewal_notice_updated' })
      return { noticeId: existing.id }
    }
    const row = await tx.renewalNotice.create({ data: { noticeKey, membershipId: m.id, termId: term.id, kind: m.autoRenew ? 'auto_renew_reminder' : 'renewal_coming', dueOn: term.endsOn, status: args.status, preparedById: actorUserId(actor) }, select: { id: true } })
    auditCreate(uow, actor, 'RenewalNotice', row.id, 'membership.renewal_notice_recorded', { membershipId: m.id, status: args.status })
    return { noticeId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function renewalsCsv(rows: RenewalRow[]) {
  const head = ['Membership', 'Customer', 'Plan', 'Phone', 'Email', 'Term ends', 'Days left', 'Renews itself', 'Price', 'Told', 'Message']
  const told = (s: RenewalRow['noticeStatus']) => ({ none: 'No', drafted: 'Drafted', contacted: 'Yes', dismissed: 'Dismissed' })[s]
  const lines = rows.map(r => [r.ref, r.customer, r.plan, r.phone, r.email, r.termEnds, r.daysLeft, r.autoRenew ? 'Yes' : 'No', (Number(r.priceMinor) / 100).toFixed(2), told(r.noticeStatus), r.message].map(csvCell).join(','))
  return [head.join(','), ...lines].join('\r\n') + '\r\n'
}

// ── Due for service (the call list) ──────────────────────────────────────────────────────────────────────────────

export type DueRow = {
  eventId: string; name: string; customer: string; customerId: string; phone: string; address: string; source: 'membership' | 'agreement'; sourceRef: string
  dueFrom: string; dueBy: string; state: 'upcoming' | 'due' | 'overdue'; daysToGo: number
}

export async function dueForService(db: Tx | Db, args: { horizonDays?: number; take?: number } = {}): Promise<DueRow[]> {
  const company = await db.companySettings.findFirst({ select: { homeTimeZone: true } })
  const today = dayAt(company?.homeTimeZone || 'America/Chicago', new Date())
  const horizon = addDays(today, args.horizonDays ?? 30)
  const events = await db.recurringServiceEvent.findMany({
    where: { status: 'open', dueFrom: { lte: asDate(horizon) }, OR: [{ membership: { status: { in: ['active', 'past_due'] } } }, { agreement: { status: 'active' } }] },
    orderBy: { dueBy: 'asc' }, take: Math.min(args.take ?? 300, 500),
    select: {
      id: true, name: true, dueFrom: true, dueBy: true,
      membership: { select: { ref: true, customer: { select: { id: true, displayName: true, primaryContact: { select: { points: { select: { kind: true, value: true } } } } } }, location: { select: { address1: true, city: true } } } },
      agreement: { select: { ref: true, customer: { select: { id: true, displayName: true, primaryContact: { select: { points: { select: { kind: true, value: true } } } } } }, location: { select: { address1: true, city: true } } } },
    },
  })
  return events.flatMap(e => {
    const src = e.membership ?? e.agreement
    if (!src?.customer) return []
    const from = ymd(e.dueFrom), by = ymd(e.dueBy)
    const state: DueRow['state'] = by < today ? 'overdue' : from > today ? 'upcoming' : 'due'
    return [{
      eventId: e.id, name: e.name, customer: src.customer.displayName, customerId: src.customer.id, phone: src.customer.primaryContact?.points.find(p => p.kind === 'phone' || p.kind === 'mobile')?.value ?? '',
      address: src.location ? `${src.location.address1}, ${src.location.city}` : '', source: e.membership ? 'membership' as const : 'agreement' as const, sourceRef: src.ref, dueFrom: from, dueBy: by, state,
      daysToGo: Math.round((Date.parse(`${by}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
    }]
  })
}

// ── Service agreements (commercial / planned maintenance) ──────────────────────────────────────────────────────────

export async function saveAgreement(db: Db, actor: Actor, args: { agreementId?: string | null; name: string; customerId: string; locationId: string; payerId?: string | null; startsOn: string; endsOn: string; scope: string; visitMonths: number[]; poNumber?: string | null; nteMinor?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'agreement.save', MANAGE, args)
  const name = clean(args.name, 'name', 3, 120)
  const scope = clean(args.scope, 'scope', 10, 800)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startsOn ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(args.endsOn ?? '') || args.endsOn < args.startsOn) throw new DomainError(Codes.INVALID_INPUT, 'The agreement runs from a start day to a later end day.', { field: 'endsOn' })
  const months = [...new Set((args.visitMonths ?? []).map(Number))].sort((a, b) => a - b)
  if (!months.length || months.some(m => !Number.isInteger(m) || m < 1 || m > 12)) throw new DomainError(Codes.INVALID_INPUT, 'Pick the months a visit is due.', { field: 'visitMonths' })
  const nte = args.nteMinor ? BigInt(args.nteMinor) : 0n
  if (nte < 0n) throw new DomainError(Codes.INVALID_INPUT, 'The not-to-exceed amount is zero or more.', { field: 'nteMinor' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'agreement.save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const location = await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, customerId: true } })
    if (!location || location.customerId !== args.customerId) throw new DomainError(Codes.NOT_FOUND, 'That address is not on this customer.', { field: 'locationId' })
    if (args.payerId && !(await tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true } }))) throw new DomainError(Codes.NOT_FOUND, 'Payer not found.', { field: 'payerId' })
    const data = { name, customerId: args.customerId, locationId: location.id, payerId: args.payerId ?? null, startsOn: asDate(args.startsOn), endsOn: asDate(args.endsOn), scope, visitMonths: months as never, poNumber: args.poNumber?.trim() ?? '', nteMinor: nte }
    if (args.agreementId) {
      const a = await lockRow<{ id: string; status: string }>(tx, 'ServiceAgreement', args.agreementId)
      if (a.status !== 'draft') throw new DomainError(Codes.GUARD_FAILED, 'Only a draft agreement is edited. End it and write a new one.', { reason: 'not_draft' })
      await tx.serviceAgreement.update({ where: { id: a.id }, data })
      auditCreate(uow, actor, 'ServiceAgreement', a.id, 'agreement.edited', { name })
      return { agreementId: a.id }
    }
    const row = await tx.serviceAgreement.create({ data: { ...data, ref: await nextReference(tx, 'AGR', uow.now), status: 'draft' }, select: { id: true } })
    auditCreate(uow, actor, 'ServiceAgreement', row.id, 'agreement.created', { name })
    return { agreementId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Start the agreement: one open visit per chosen month inside its dates. */
export async function activateAgreement(db: Db, actor: Actor, args: { agreementId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'agreement.activate', MANAGE, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'agreement.activate', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const a = await lockRow<{ id: string; status: string; version: number; name: string; startsOn: Date; endsOn: Date; visitMonths: number[] }>(tx, 'ServiceAgreement', args.agreementId)
    if (a.status !== 'draft') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a draft agreement is started.')
    const start = ymd(a.startsOn), end = ymd(a.endsOn)
    let made = 0
    for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y += 1) {
      for (const m of a.visitMonths) {
        const from = `${y}-${String(m).padStart(2, '0')}-01`
        const to = addDays(termEnd(from, 1, 1), 0)
        if (to < start || from > end) continue
        await tx.recurringServiceEvent.create({ data: { eventKey: `${a.id}:${y}-${String(m).padStart(2, '0')}`, agreementId: a.id, code: 'planned_maintenance', name: `${a.name}: ${new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} visit`, dueFrom: asDate(from < start ? start : from), dueBy: asDate(to > end ? end : to), status: 'open' } })
        made += 1
      }
    }
    if (!made) throw new DomainError(Codes.GUARD_FAILED, 'None of the chosen months fall inside the agreement dates.', { reason: 'no_visits' })
    await casUpdate(uow, { model: 'ServiceAgreement', id: a.id, version: a.version, from: ['draft'], to: 'active', actor, eventType: 'agreement.activated', data: {}, audit: { visits: made } })
    return { agreementId: a.id, visits: made }
  })
  return { replay: result.replay, ...result.value }
}

export async function endAgreement(db: Db, actor: Actor, args: { agreementId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'agreement.end', MANAGE, args)
  const reason = clean(args.reason, 'reason', 3, 300)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'agreement.end', actor, idempotencyKey, params, now: args.now }, async uow => {
    const a = await lockRow<{ id: string; status: string; version: number }>(uow.tx, 'ServiceAgreement', args.agreementId)
    await casUpdate(uow, { model: 'ServiceAgreement', id: a.id, version: a.version, from: ['active', 'draft'], to: 'ended', actor, eventType: 'agreement.ended', reason })
    await uow.tx.recurringServiceEvent.updateMany({ where: { agreementId: a.id, status: 'open' }, data: { status: 'skipped' } })
    return { agreementId: a.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Certificates (P3 backlog): staff set or renew a document's expiry ───────────────────────────────────────────────

export async function setDocumentExpiry(db: Db, actor: Actor, args: { documentId: string; expiresOn: string | null; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'document.set_expiry', ['canManageCustomers', 'canManageInvoices', 'canManageMemberships'], args)
  const reason = clean(args.reason, 'reason', 3, 200)
  if (args.expiresOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(args.expiresOn ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'The expiry is a day, or empty for none.', { field: 'expiresOn' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'document.set_expiry', actor, idempotencyKey, params, now: args.now }, async uow => {
    const doc = await lockRow<{ id: string; title: string; expiresAt: Date | null }>(uow.tx, 'Document', args.documentId)
    const today = await companyToday(uow.tx, uow.now)
    if (args.expiresOn && args.expiresOn < addDays(today, -365)) throw new DomainError(Codes.INVALID_INPUT, 'That expiry is more than a year ago.', { field: 'expiresOn' })
    await uow.tx.document.update({ where: { id: doc.id }, data: { expiresAt: args.expiresOn ? asDate(args.expiresOn) : null } })
    uow.audit({ eventType: 'document.expiry_set', entityType: 'Document', entityId: doc.id, actorUserId: actorUserId(actor), reason, before: { expiresAt: ymd(doc.expiresAt) || null }, after: { expiresAt: args.expiresOn } })
    return { documentId: doc.id, expiresOn: args.expiresOn }
  })
  return { replay: result.replay, ...result.value }
}
