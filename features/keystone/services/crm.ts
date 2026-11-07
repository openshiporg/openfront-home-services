import { authorizeOperation, recordAgentAction, recordAgentRead } from '../lib/agentGate'
import { actorAgentId, actorUserId, can, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, transition } from '../lib/cas'
import { command } from '../lib/command'
import { runInTransaction } from '../lib/unitOfWork'
import type { Db } from '../lib/db'
import { DomainError, Codes } from '../lib/errors'
import { openSecret, sealSecret } from '../lib/secretBox'
import { nextReference } from '../lib/sequence'
import { contactHash, maskAddress, maskEmail, maskName, maskPhone, normalizeEmail, normalizePhone } from '../domain/contact'
import { geocoder } from '../../integrations/maps'
import { createCustomerInTx, createLocationInTx, serviceAreaFor, type NewCustomer, type NewLocation } from './booking'

/*
 * Customers, leads, calls and credentials (SM§1, SM§17, SCHEMA §3–§5). Agent reads are masked (I-A3):
 * an agent gets a customer id, a masked name/phone/address and the service history it needs to book,
 * never the full contact point or any access secret.
 */

const DUPLICATE_WINDOW_MS = 30 * 60_000

// ---------------------------------------------------------------------------------------------
// Customers

export async function createCustomer(db: Db, actor: Actor, args: { customer: NewCustomer; location?: NewLocation | null; smsConsent?: boolean | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'customer.create', ['canManageCustomers', 'canBook'], args)
  const phone = args.customer.phone ? normalizePhone(args.customer.phone) : null
  const email = args.customer.email ? normalizeEmail(args.customer.email) : null
  const geo = args.location ? await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? 'TX', postalCode: args.location.postalCode }) : null
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'customer.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    // Possible duplicates are reported, never merged automatically (merges are approved, I-C2).
    const hashes = [phone, email].filter(Boolean).map(v => contactHash(v!))
    const matches = hashes.length ? await uow.tx.contactPoint.findMany({ where: { valueHash: { in: hashes } }, select: { contact: { select: { customerId: true } } }, take: 5 }) : []
    const customer = await createCustomerInTx(uow, actor, { ...args.customer, phone, email }, { smsConsent: !!args.smsConsent, evidence: { source: 'office' } })
    const location = args.location ? await createLocationInTx(uow, actor, customer.id, args.location, geo!) : null
    return { customerId: customer.id, displayName: customer.displayName, locationId: location?.id ?? null, possibleDuplicates: [...new Set(matches.map(m => m.contact?.customerId).filter(Boolean))] }
  })
  return { replay: result.replay, ...result.value }
}

export async function addLocation(db: Db, actor: Actor, args: { customerId: string; location: NewLocation; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'location.create', ['canManageCustomers', 'canBook'], args)
  const geo = await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? 'TX', postalCode: args.location.postalCode })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'location.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    const customer = await uow.tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true, mergedIntoId: true } })
    if (!customer || customer.mergedIntoId) throw new DomainError(Codes.NOT_FOUND, 'Customer not found.', { field: 'customerId' })
    const location = await createLocationInTx(uow, actor, customer.id, args.location, geo)
    const area = await serviceAreaFor(uow.tx, null, location.postalCode)
    return { locationId: location.id, inServiceArea: !!area }
  })
  return { replay: result.replay, ...result.value }
}

export async function addContactPoint(db: Db, actor: Actor, args: { contactId: string; kind: 'mobile' | 'landline' | 'email'; value: string; isPrimary?: boolean | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'contact_point.create', ['canManageCustomers', 'canBook'], args)
  const value = args.kind === 'email' ? normalizeEmail(args.value) : normalizePhone(args.value)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'contact_point.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    const existing = await uow.tx.contactPoint.findFirst({ where: { contactId: args.contactId, kind: args.kind, value }, select: { id: true } })
    if (existing) return { contactPointId: existing.id, created: false }
    const row = await uow.tx.contactPoint.create({ data: { contactId: args.contactId, kind: args.kind, value, valueHash: contactHash(value), isPrimary: !!args.isPrimary, carrierLineType: 'unknown' }, select: { id: true } })
    auditCreate(uow, actor, 'ContactPoint', row.id, 'contact_point.created', { contactId: args.contactId, kind: args.kind, masked: args.kind === 'email' ? maskEmail(value) : maskPhone(value) })
    return { contactPointId: row.id, created: true }
  })
  return { replay: result.replay, ...result.value }
}

/** Masked lookup for the AI receptionist and the booking screen (I-A3). */
export async function lookupCustomer(db: Db, actor: Actor, args: { phone?: string | null; email?: string | null; name?: string | null; postalCode?: string | null }) {
  await authorizeOperation(db, actor, 'customer.lookup', ['canBook', 'canManageCustomers', 'canReadCustomerPII'], args)
  const hashes: string[] = []
  if (args.phone) hashes.push(contactHash(normalizePhone(args.phone)))
  if (args.email) hashes.push(contactHash(normalizeEmail(args.email)))
  if (!hashes.length && !(args.name && args.postalCode)) throw new DomainError(Codes.INVALID_INPUT, 'Look up by phone, email, or name and ZIP.', { field: 'phone' })
  const customers = await db.customer.findMany({
    where: {
      mergedIntoId: null,
      ...(hashes.length
        ? { contacts: { some: { points: { some: { valueHash: { in: hashes } } } } } }
        : { displayName: { contains: args.name!.trim(), mode: 'insensitive' }, locations: { some: { postalCode: { startsWith: args.postalCode!.trim().slice(0, 5) } } } }),
    },
    take: 5,
    select: { id: true, ref: true, kind: true, displayName: true, doNotService: true, contacts: { take: 1, select: { firstName: true, lastName: true, points: { where: { kind: 'mobile' }, take: 1, select: { value: true } } } }, locations: { where: { mergedIntoId: null }, take: 5, select: { id: true, address1: true, city: true, postalCode: true, serviceAreaId: true } } },
  })
  const full = actor.kind === 'user' && can(actor, 'canReadCustomerPII')
  const out = customers.map(c => ({
    customerId: c.id, ref: c.ref, kind: c.kind, doNotService: c.doNotService,
    name: full ? c.displayName : maskName(c.contacts[0]?.firstName ?? c.displayName, c.contacts[0]?.lastName ?? ''),
    phone: full ? c.contacts[0]?.points[0]?.value ?? null : maskPhone(c.contacts[0]?.points[0]?.value ?? null),
    locations: c.locations.map(l => ({ locationId: l.id, address: full ? l.address1 : maskAddress(l.address1), city: l.city, postalCode: l.postalCode, inServiceArea: !!l.serviceAreaId })),
  }))
  await recordAgentRead(db, actor, { tool: 'customer.lookup', inputs: { byPhone: !!args.phone, byEmail: !!args.email, byName: !!args.name }, output: { matches: out.length } })
  return { matches: out }
}

/** What the caller's had done here (masked), so the agent can say "we were out in March for your AC". */
export async function customerHistory(db: Db, actor: Actor, args: { customerId: string; limit?: number | null }) {
  await authorizeOperation(db, actor, 'customer.history', ['canBook', 'canManageCustomers', 'canDispatch'], args)
  const jobs = await db.job.findMany({
    where: { customerId: args.customerId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(args.limit ?? 10, 25),
    select: { id: true, ref: true, status: true, summary: true, createdAt: true, jobType: { select: { name: true } }, location: { select: { id: true, city: true, postalCode: true } }, visits: { orderBy: { plannedStart: 'desc' }, take: 1, select: { status: true, plannedStart: true, window: { select: { label: true, date: true } } } } },
  })
  const out = jobs.map(j => ({ jobId: j.id, ref: j.ref, status: j.status, jobType: j.jobType?.name ?? null, summary: j.summary, createdAt: j.createdAt.toISOString(), location: j.location ? { locationId: j.location.id, city: j.location.city, postalCode: j.location.postalCode } : null, nextVisit: j.visits[0] ? { status: j.visits[0].status, date: j.visits[0].window?.date?.toISOString().slice(0, 10) ?? null, window: j.visits[0].window?.label ?? null } : null }))
  await recordAgentRead(db, actor, { tool: 'customer.history', inputs: args, output: { jobs: out.length } })
  return { customerId: args.customerId, jobs: out }
}

// ---------------------------------------------------------------------------------------------
// Access secrets (gate codes): stored sealed; revealed only to an assigned tech, logged (I-C3)

export async function storeAccessSecret(db: Db, actor: Actor, args: { locationId: string; kind: string; label?: string | null; secret: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'access_secret.store', ['canManageCustomers', 'canBook'], {})
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents never handle access codes.')
  if (!args.secret.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Enter the code.', { field: 'secret' })
  // The plaintext is not part of the receipt parameters.
  const result = await command(db, { name: 'access_secret.store', actor, idempotencyKey: args.idempotencyKey, params: { locationId: args.locationId, kind: args.kind, label: args.label ?? '' }, now: args.now }, async uow => {
    const ref = await sealSecret(uow.tx, 'access_secret', args.secret.trim(), actorUserId(actor))
    const row = await uow.tx.accessSecret.create({ data: { locationId: args.locationId, kind: args.kind, label: args.label ?? '', secretRef: ref, status: 'active' }, select: { id: true } })
    auditCreate(uow, actor, 'AccessSecret', row.id, 'access_secret.stored', { locationId: args.locationId, kind: args.kind })
    return { accessSecretId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function revealAccessSecret(db: Db, actor: Actor, args: { accessSecretId: string; visitId: string; reason?: string | null; now?: Date }) {
  if (actor.kind !== 'user') throw new DomainError(Codes.NOT_AUTHORIZED, 'Only a signed-in person can see an access code.')
  const now = args.now ?? new Date()
  const secret = await db.accessSecret.findUnique({ where: { id: args.accessSecretId }, select: { id: true, status: true, secretRef: true, locationId: true } })
  if (!secret || secret.status !== 'active') throw new DomainError(Codes.NOT_FOUND, 'Access code not found.')
  const visit = await db.visit.findUnique({ where: { id: args.visitId }, select: { id: true, status: true, window: { select: { startsAt: true, endsAt: true } }, job: { select: { locationId: true } }, assignments: { where: { active: true }, select: { employee: { select: { userId: true } } } } } })
  if (!visit || visit.job?.locationId !== secret.locationId) throw new DomainError(Codes.NOT_FOUND, 'That code is not for this visit.')
  const assigned = visit.assignments.some(a => a.employee?.userId === actor.userId)
  const office = can(actor, 'canRevealAccessSecret')
  if (!assigned && !office) throw new DomainError(Codes.NOT_AUTHORIZED, 'Only the assigned technician sees this code.')
  if (assigned && !office) {
    if (!['dispatched', 'en_route', 'on_site', 'working', 'paused'].includes(visit.status)) throw new DomainError(Codes.GUARD_FAILED, 'The code opens once the visit is dispatched.', { reason: 'not_dispatched' })
  }
  if (office && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why you need the code.', { field: 'reason' })
  const plaintext = await runInTransaction(db, async uow => {
    const value = await openSecret(uow.tx, secret.secretRef!, 'access_secret')
    const reveal = await uow.tx.accessSecretReveal.create({ data: { secretId: secret.id, revealedToId: actor.userId, visitId: visit.id, revealedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000), reason: args.reason?.trim() || 'assigned technician' }, select: { id: true } })
    auditCreate(uow, actor, 'AccessSecretReveal', reveal.id, 'access_secret.revealed', { secretId: secret.id, visitId: visit.id, asOffice: !assigned })
    return value
  }, { now })
  return { accessSecretId: secret.id, value: plaintext, visibleUntil: new Date(now.getTime() + 15 * 60_000).toISOString() }
}

// ---------------------------------------------------------------------------------------------
// Leads (SM§1)

export type LeadIngest = { source: string; externalId?: string | null; campaignId?: string | null; trackingNumberId?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; summary?: string | null; requestedJobTypeId?: string | null; postalCode?: string | null; idempotencyKey: string; now?: Date }

export async function ingestLead(db: Db, actor: Actor, args: LeadIngest) {
  await authorizeOperation(db, actor, 'lead.ingest', ['canManageLeads', 'canBook'], args)
  const phone = args.phone ? normalizePhone(args.phone) : null
  const email = args.email ? normalizeEmail(args.email) : null
  if (!phone && !email) throw new DomainError(Codes.INVALID_INPUT, 'A lead needs a phone number or an email.', { field: 'phone' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'lead.ingest', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx, now } = uow
    // Dedupe (SM§1): the same source + external id, or the same contact within 30 minutes.
    const dup = args.externalId
      ? await tx.lead.findFirst({ where: { source: args.source, externalId: args.externalId }, select: { id: true, ref: true } })
      : await tx.lead.findFirst({ where: { createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) }, status: { in: ['new', 'contacted', 'qualified'] }, OR: [...(phone ? [{ phoneE164: phone }] : []), ...(email ? [{ email }] : [])] }, select: { id: true, ref: true } })
    if (dup) return { leadId: dup.id, ref: dup.ref, duplicate: true, customerId: null as string | null }
    const hashes = [phone, email].filter(Boolean).map(v => contactHash(v!))
    const match = await tx.contactPoint.findFirst({ where: { valueHash: { in: hashes } }, select: { contact: { select: { customerId: true } } } })
    const settings = await tx.companySettings.findFirst({ select: { features: true } })
    const slaMinutes = Number((settings?.features as { leadFirstResponseMinutes?: number } | null)?.leadFirstResponseMinutes ?? 5)
    const ref = await nextReference(tx, 'LEAD', now)
    const lead = await tx.lead.create({
      data: { ref, createdAt: now, source: args.source, externalId: args.externalId ?? '', campaignId: args.campaignId ?? null, trackingNumberId: args.trackingNumberId ?? null, customerId: match?.contact?.customerId ?? null, contactName: args.contactName ?? '', phoneE164: phone ?? '', email: email ?? '', requestedJobTypeId: args.requestedJobTypeId ?? null, summary: args.summary ?? '', status: 'new', respondDueAt: new Date(now.getTime() + slaMinutes * 60_000) },
      select: { id: true, ref: true },
    })
    auditCreate(uow, actor, 'Lead', lead.id, 'lead.created', { ref, source: args.source, matchedCustomer: !!match, campaignId: args.campaignId ?? null })
    uow.emit({ topic: 'lead.first_response_due', aggregateType: 'Lead', aggregateId: lead.id, payload: { leadId: lead.id }, availableAt: new Date(now.getTime() + slaMinutes * 60_000), dedupeKey: `lead.sla:${lead.id}` })
    await recordAgentAction(uow, actor, { tool: 'lead.ingest', idempotencyKey, inputs: params, output: { leadId: lead.id } })
    return { leadId: lead.id, ref: lead.ref, duplicate: false, customerId: match?.contact?.customerId ?? null }
  })
  return { replay: result.replay, ...result.value }
}

export async function markLeadContacted(db: Db, actor: Actor, args: { leadId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lead.contact', ['canManageLeads', 'canBook'], args)
  const result = await command(db, { name: 'lead.contact', actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number; createdAt: Date }>(uow, { model: 'Lead', id: args.leadId, from: ['new'], to: 'contacted', expectedVersion: args.expectedVersion, actor, eventType: 'lead.contacted', data: r => ({ firstResponseSeconds: Math.max(0, Math.round((uow.now.getTime() - r.createdAt.getTime()) / 1000)) }) })
    return { leadId: args.leadId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function qualifyLead(db: Db, actor: Actor, args: { leadId: string; expectedVersion: number; requestedJobTypeId: string; locationId?: string | null; postalCode?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lead.qualify', ['canManageLeads', 'canBook'], args)
  const result = await command(db, { name: 'lead.qualify', actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, requestedJobTypeId: args.requestedJobTypeId, locationId: args.locationId ?? null, postalCode: args.postalCode ?? null }, now: args.now }, async uow => {
    const jobType = await uow.tx.jobType.findUnique({ where: { id: args.requestedJobTypeId }, select: { id: true, businessUnitId: true, active: true } })
    if (!jobType?.active) throw new DomainError(Codes.NOT_FOUND, 'That job type is not offered.', { field: 'requestedJobTypeId' })
    const zip = args.locationId ? (await uow.tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { postalCode: true } }))?.postalCode : args.postalCode
    if (!zip) throw new DomainError(Codes.INVALID_INPUT, 'Give the service address or ZIP.', { field: 'postalCode' })
    if (!(await serviceAreaFor(uow.tx, jobType.businessUnitId, zip))) throw new DomainError(Codes.OUT_OF_AREA, `ZIP ${zip} is outside the service area.`, { reason: 'out_of_area' })
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Lead', id: args.leadId, from: ['new', 'contacted'], to: 'qualified', expectedVersion: args.expectedVersion, actor, eventType: 'lead.qualified', data: { requestedJobTypeId: jobType.id, ...(args.locationId ? { locationId: args.locationId } : {}) } })
    return { leadId: args.leadId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function loseLead(db: Db, actor: Actor, args: { leadId: string; expectedVersion: number; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lead.lose', ['canManageLeads', 'canBook'], args)
  const reasons = ['price', 'timing', 'out_of_area', 'no_answer', 'competitor', 'not_serviceable', 'duplicate', 'other']
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason must be one of ${reasons.join(', ')}.`, { field: 'reason' })
  const result = await command(db, { name: 'lead.lose', actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Lead', id: args.leadId, from: ['new', 'contacted', 'qualified'], to: 'lost', expectedVersion: args.expectedVersion, actor, eventType: 'lead.lost', reason: args.reason, data: { lostReason: args.reason } })
    return { leadId: args.leadId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function markLeadSpam(db: Db, actor: Actor, args: { leadId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lead.spam', ['canManageLeads'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Only a person marks a lead as spam.')
  const result = await command(db, { name: 'lead.spam', actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number; source: string; externalId: string }>(uow, { model: 'Lead', id: args.leadId, from: ['new', 'contacted', 'qualified'], to: 'spam', expectedVersion: args.expectedVersion, actor, eventType: 'lead.spam' })
    if (row.source === 'lsa' && row.externalId) uow.emit({ topic: 'lsa.dispute', aggregateType: 'Lead', aggregateId: args.leadId, payload: { leadId: args.leadId, externalId: row.externalId }, dedupeKey: `lsa.dispute:${args.leadId}` })
    return { leadId: args.leadId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

/** Merge a duplicate lead into another (people only; the target must be open). */
export async function mergeLead(db: Db, actor: Actor, args: { leadId: string; expectedVersion: number; intoLeadId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'lead.merge', ['canManageLeads'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents never merge records.')
  if (args.leadId === args.intoLeadId) throw new DomainError(Codes.INVALID_INPUT, 'Pick a different lead to merge into.', { field: 'intoLeadId' })
  const result = await command(db, { name: 'lead.merge', actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, intoLeadId: args.intoLeadId }, now: args.now }, async uow => {
    const target = await uow.tx.lead.findUnique({ where: { id: args.intoLeadId }, select: { status: true } })
    if (!target || ['merged', 'spam'].includes(target.status)) throw new DomainError(Codes.GUARD_FAILED, 'The lead to merge into is closed.', { reason: 'target_closed' })
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Lead', id: args.leadId, from: ['new', 'contacted', 'qualified', 'lost'], to: 'merged', expectedVersion: args.expectedVersion, actor, eventType: 'lead.merged', data: { mergedIntoId: args.intoLeadId } })
    return { leadId: args.leadId, status: row.status, version: row.version, mergedIntoId: args.intoLeadId }
  })
  return { replay: result.replay, ...result.value }
}

// ---------------------------------------------------------------------------------------------
// Job-type matching for the AI receptionist

type EmergencyPolicy = { keywords?: string[]; script?: string; page?: boolean }

export async function matchJobType(db: Db, actor: Actor, args: { description: string; postalCode?: string | null }) {
  await authorizeOperation(db, actor, 'jobtype.match', ['canBook'], args)
  const text = args.description.toLowerCase()
  const types = await db.jobType.findMany({ where: { active: true }, select: { id: true, code: true, name: true, trade: true, priority: true, keywords: true, emergencyPolicy: true, bookableByAi: true, bookingQuestions: true, businessUnitId: true } })
  const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean))
  const scored = types.map(t => {
    const keys = ((t.keywords as string[] | null) ?? []).map(k => k.toLowerCase())
    const hits = keys.filter(k => (k.includes(' ') ? text.includes(k) : words.has(k)))
    const emergency = t.emergencyPolicy as EmergencyPolicy | null
    const emergencyHits = (emergency?.keywords ?? []).filter(k => text.includes(k.toLowerCase()))
    return { jobTypeId: t.id, code: t.code, name: t.name, trade: t.trade, priority: t.priority, bookableByAi: t.bookableByAi, score: hits.length * 10 + emergencyHits.length * 25, matched: hits, emergency: emergencyHits.length ? { matched: emergencyHits, script: emergency?.script ?? '', page: !!emergency?.page } : null, questions: (t.bookingQuestions as unknown[]) ?? [], businessUnitId: t.businessUnitId }
  }).filter(t => t.score > 0).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, 3)
  let inArea: boolean | null = null
  if (args.postalCode && scored[0]) inArea = !!(await serviceAreaFor(db, scored[0].businessUnitId, args.postalCode))
  await recordAgentRead(db, actor, { tool: 'jobtype.match', inputs: { length: args.description.length, postalCode: args.postalCode ?? null }, output: { top: scored[0]?.code ?? null, emergency: !!scored[0]?.emergency } })
  return { matches: scored.map(({ businessUnitId: _bu, ...rest }) => rest), inArea, emergency: scored.find(s => s.emergency)?.emergency ?? null }
}

// ---------------------------------------------------------------------------------------------
// Calls (SM§17)

export async function startInboundCall(db: Db, args: { providerCallId: string; provider: string; from: string; to: string; answeredBy: 'human' | 'ai_agent' | 'voicemail' | 'ivr'; recordingDisclosurePlayed?: boolean; startedAt?: Date }) {
  const from = normalizePhone(args.from)
  const actor: Actor = { kind: 'system', name: 'voice-webhook' }
  const startedAt = args.startedAt ?? new Date()
  const result = await command(db, { name: 'call.start', actor, idempotencyKey: `call:${args.provider}:${args.providerCallId}`, params: { providerCallId: args.providerCallId }, now: startedAt }, async uow => {
    const tracking = await uow.tx.trackingNumber.findFirst({ where: { phoneE164: normalizePhone(args.to) }, select: { id: true, campaignId: true } })
    const point = await uow.tx.contactPoint.findFirst({ where: { valueHash: contactHash(from) }, select: { id: true, contact: { select: { customerId: true } } } })
    const conversation = await uow.tx.conversation.create({ data: { customerId: point?.contact?.customerId ?? null, contactPointId: point?.id ?? null, channel: 'voice', status: 'open' }, select: { id: true } })
    const call = await uow.tx.call.create({
      data: { conversationId: conversation.id, direction: 'inbound', providerCallId: args.providerCallId, provider: args.provider, from, fromMasked: maskPhone(from), to: normalizePhone(args.to), trackingNumberId: tracking?.id ?? null, startedAt, answeredBy: args.answeredBy, recordingDisclosurePlayed: !!args.recordingDisclosurePlayed, status: args.answeredBy === 'ai_agent' ? 'ai_answering' : args.answeredBy === 'human' ? 'human_answering' : 'ringing' },
      select: { id: true },
    })
    auditCreate(uow, actor, 'Call', call.id, 'call.started', { answeredBy: args.answeredBy, knownCaller: !!point, trackingNumberId: tracking?.id ?? null })
    return { callId: call.id, conversationId: conversation.id, customerId: point?.contact?.customerId ?? null, campaignId: tracking?.campaignId ?? null }
  })
  return result.value
}

/** The AI receptionist asks for a person (SM§17). Raises a task; never fails the call. */
export async function handoffToHuman(db: Db, actor: Actor, args: { callId: string; reason: string; summary?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'handoff.to_human', ['canBook'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'handoff.to_human', actor, idempotencyKey, params, now: args.now }, async uow => {
    const call = await uow.tx.call.findUnique({ where: { id: args.callId }, select: { id: true, status: true, version: true, fromMasked: true } })
    if (!call) throw new DomainError(Codes.NOT_FOUND, 'Call not found.')
    if (['ai_answering', 'ringing'].includes(call.status)) {
      await casUpdate(uow, { model: 'Call', id: call.id, version: call.version, from: [call.status], to: 'handoff_requested', actor, eventType: 'call.handoff_requested', reason: args.reason, data: { summary: args.summary ?? '' } })
    }
    const task = await uow.tx.task.upsert({ where: { dedupeKey: `call.handoff:${call.id}` }, create: { kind: 'call.handoff', title: `Caller ${call.fromMasked} needs a person: ${args.reason}`.slice(0, 200), detail: args.summary ?? '', subjectType: 'Call', subjectId: call.id, status: 'open', priority: 'high', dueAt: new Date(uow.now.getTime() + 5 * 60_000), dedupeKey: `call.handoff:${call.id}` }, update: {}, select: { id: true } })
    const value = { callId: call.id, status: 'handoff_requested', taskId: task.id }
    await recordAgentAction(uow, actor, { tool: 'handoff.to_human', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

/** Emergency escalation (SM§17): page on-call through the outbox. */
export async function pageOnCall(db: Db, actor: Actor, args: { callId?: string | null; businessUnitId?: string | null; summary: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'page.on_call', ['canBook', 'canDispatch'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'page.on_call', actor, idempotencyKey, params, now: args.now }, async uow => {
    const pageId = args.callId ?? `page-${idempotencyKey}`
    if (args.callId) {
      const call = await uow.tx.call.findUnique({ where: { id: args.callId }, select: { id: true, version: true, status: true } })
      if (call) await uow.tx.call.update({ where: { id: call.id }, data: { emergency: { paged: true, summary: args.summary, at: uow.now.toISOString() } as never, disposition: 'emergency_paged' } })
    }
    uow.emit({ topic: 'page.on_call', aggregateType: 'Call', aggregateId: pageId, payload: { pageId, businessUnitId: args.businessUnitId ?? null, summary: args.summary.slice(0, 300) }, dedupeKey: `page.on_call:${pageId}`, partitionKey: 'paging' })
    uow.audit({ eventType: 'call.on_call_paged', entityType: 'Call', entityId: pageId, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { businessUnitId: args.businessUnitId ?? null } })
    const value = { paged: true, pageId }
    await recordAgentAction(uow, actor, { tool: 'page.on_call', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

export async function completeCall(db: Db, args: { providerCallId: string; provider: string; endedAt?: Date; disposition?: string | null; jobId?: string | null; leadId?: string | null; transcript?: unknown }) {
  const actor: Actor = { kind: 'system', name: 'voice-webhook' }
  const endedAt = args.endedAt ?? new Date()
  const result = await command(db, { name: 'call.complete', actor, idempotencyKey: `call-end:${args.provider}:${args.providerCallId}`, params: { providerCallId: args.providerCallId, disposition: args.disposition ?? null }, now: endedAt }, async uow => {
    const call = await uow.tx.call.findFirst({ where: { provider: args.provider, providerCallId: args.providerCallId }, select: { id: true, status: true, version: true, startedAt: true, disposition: true } })
    if (!call) throw new DomainError(Codes.NOT_FOUND, 'Call not found.')
    if (call.status === 'completed') return { callId: call.id, status: 'completed' }
    await casUpdate(uow, { model: 'Call', id: call.id, version: call.version, from: [call.status], to: 'completed', actor, eventType: 'call.completed', data: { endedAt, durationSeconds: call.startedAt ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000)) : 0, disposition: call.disposition || args.disposition || 'not_booked', jobId: args.jobId ?? null, leadId: args.leadId ?? null, ...(args.transcript ? { transcript: args.transcript } : {}) }, audit: { disposition: call.disposition || args.disposition || 'not_booked' } })
    return { callId: call.id, status: 'completed' }
  })
  return result.value
}

// ---------------------------------------------------------------------------------------------
// Credentials (SCHEMA §2): verified by an office person, never self-verified

export async function verifyCredential(db: Db, actor: Actor, args: { credentialId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'credential.verify', ['canManagePeople'], args)
  if (actor.kind !== 'user') throw new DomainError(Codes.NOT_AUTHORIZED, 'A person verifies credentials.')
  const result = await command(db, { name: 'credential.verify', actor, idempotencyKey: args.idempotencyKey, params: { credentialId: args.credentialId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number; employeeId: string | null; number: string; expiresOn: Date | null }>(uow, {
      model: 'Credential', id: args.credentialId, from: ['pending_verification', 'expired'], to: 'verified', expectedVersion: args.expectedVersion, actor, eventType: 'credential.verified',
      guard: async r => {
        const own = await uow.tx.employee.findFirst({ where: { id: r.employeeId ?? '', userId: actor.userId }, select: { id: true } })
        if (own) throw new DomainError(Codes.NOT_AUTHORIZED, 'You cannot verify your own credential.')
        if (!r.number.trim()) throw new DomainError(Codes.GUARD_FAILED, 'Enter the license number first.', { reason: 'number_missing' })
        if (r.expiresOn && r.expiresOn.getTime() < uow.now.getTime()) throw new DomainError(Codes.GUARD_FAILED, 'This credential has expired. Record the renewal first.', { reason: 'expired' })
      },
      data: { verifiedById: actor.userId, verifiedAt: uow.now },
    })
    return { credentialId: args.credentialId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function revokeCredential(db: Db, actor: Actor, args: { credentialId: string; expectedVersion: number; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'credential.revoke', ['canManagePeople'], args)
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Give a reason.', { field: 'reason' })
  const result = await command(db, { name: 'credential.revoke', actor, idempotencyKey: args.idempotencyKey, params: { credentialId: args.credentialId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async uow => {
    const row = await transition<{ status: string; version: number }>(uow, { model: 'Credential', id: args.credentialId, from: ['pending_verification', 'verified', 'expired'], to: 'revoked', expectedVersion: args.expectedVersion, actor, eventType: 'credential.revoked', reason: args.reason })
    return { credentialId: args.credentialId, status: row.status, version: row.version }
  })
  return { replay: result.replay, ...result.value }
}
