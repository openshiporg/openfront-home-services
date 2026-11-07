import { authorizeOperation, recordAgentAction } from '../lib/agentGate'
import { actorAgentId, actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { DomainError, Codes } from '../lib/errors'
import type { ClaimedMessage, OutboxHandlers } from '../lib/outbox'
import { runInTransaction } from '../lib/unitOfWork'
import { contactHash, normalizePhone } from '../domain/contact'
import { resolvePolicyFromDb } from '../domain/policy'
import type { ContactHoursRules } from '../domain/policySchemas'
import { classifyKeyword, evaluateSend, type MessagePurpose } from '../domain/sendGuard'
import { localDate } from '../lib/calendar'
import { CONSENT_PURPOSES } from '../models/crm'
import { telephony } from '../../integrations/telephony'

/*
 * Messaging (SM§17, I-K1, I-K2). Outbound messages are queued in the command transaction; the
 * outbox worker runs the send-time guard and then the telephony adapter. A message moves
 * queued → sending (claimed, CAS) → sent | manual | blocked | failed, so a redelivered outbox message
 * never sends twice. Inbound STOP-family keywords revoke consent before anything else runs.
 */

/** Effective consent per purpose for a contact point: the latest event wins. */
export async function effectiveConsent(db: Db, contactPointId: string) {
  const events = await db.consentRecord.findMany({ where: { contactPointId }, orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }], select: { purpose: true, action: true } })
  const state: Record<string, 'grant' | 'revoke'> = {}
  for (const e of events) if (!state[e.purpose]) state[e.purpose] = e.action as 'grant' | 'revoke'
  return state
}

async function contactHoursFor(db: Db, place: { state: string | null; zip: string | null }, on: string): Promise<ContactHoursRules | null> {
  try {
    return (await resolvePolicyFromDb<ContactHoursRules>(db, 'contact_hours', { state: place.state, zip: place.zip }, on)).rules
  } catch (error) {
    if (error instanceof DomainError) return null
    throw error
  }
}

/**
 * May SMS go out through the current adapter? 10DLC registration applies to application-to-person
 * texting through a provider: the messaging IntegrationConnection carries its state. The manual
 * adapter (a person texts from the office phone) is not A2P, so registration doesn't gate it.
 */
async function tenDlcApproved(db: Db) {
  if (telephony().key === 'manual') return true
  const conn = await db.integrationConnection.findFirst({ where: { area: 'messaging', status: 'connected' }, select: { config: true } })
  return (conn?.config as { tenDlc?: string } | null)?.tenDlc === 'approved'
}

export type SendOutcome = { messageId: string; status: string; reason?: string }

/** The outbox handler for `message.send`. Idempotent: a message that left `queued` is never sent again. */
export async function deliverMessage(db: Db, messageId: string, now = new Date()): Promise<SendOutcome> {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { id: true, status: true, version: true, purpose: true, channel: true, body: true, template: true, jobId: true, contactPoint: { select: { id: true, value: true, valueHash: true, contact: { select: { customer: { select: { id: true, locations: { select: { state: true, postalCode: true, timeZone: true }, take: 1, orderBy: { createdAt: 'asc' } } } } } } } } },
  })
  if (!message) throw new Error(`Message ${messageId} not found`)
  if (message.status !== 'queued') return { messageId, status: message.status }
  const actor: Actor = { kind: 'system', name: 'messaging-worker' }
  const point = message.contactPoint
  const job = message.jobId ? await db.job.findUnique({ where: { id: message.jobId }, select: { location: { select: { state: true, postalCode: true, timeZone: true } } } }) : null
  const place = job?.location ?? point?.contact?.customer?.locations[0] ?? null
  const timeZone = place?.timeZone || 'America/Chicago'
  const [consent, dnc, hours, registered] = await Promise.all([
    point ? effectiveConsent(db, point.id) : Promise.resolve({}),
    point ? db.dncEntry.count({ where: { valueHash: point.valueHash } }) : Promise.resolve(0),
    contactHoursFor(db, { state: place?.state ? `US-${place.state}` : 'US-TX', zip: place?.postalCode ?? null }, localDate({ timeZone }, now)),
    tenDlcApproved(db),
  ])
  const verdict = evaluateSend({ purpose: message.purpose as MessagePurpose, channel: message.channel as 'sms' | 'email', consent, onInternalDnc: dnc > 0, contactHours: hours, recipientTimeZone: timeZone, at: now, tenDlcApproved: registered })

  // Claim: queued → sending (or → blocked) by CAS. Only the winner reaches the provider.
  const claimed = await runInTransaction(db, async uow => {
    if (!verdict.allowed) {
      await casUpdate(uow, { model: 'Message', id: message.id, version: message.version, from: ['queued'], to: 'blocked', actor, eventType: 'message.blocked', reason: verdict.reason, data: { blockedReason: verdict.reason, guardFindings: { reason: verdict.reason, detail: verdict.detail, consentPurpose: verdict.consentPurpose, at: now.toISOString() } } })
      await uow.tx.task.create({ data: { kind: 'message.blocked', title: `Text not sent (${verdict.reason.replaceAll('_', ' ')}): ${message.template}`, detail: verdict.detail, subjectType: 'Message', subjectId: message.id, status: 'open', priority: 'normal', dedupeKey: `message.blocked:${message.id}` } })
      return 'blocked' as const
    }
    await casUpdate(uow, { model: 'Message', id: message.id, version: message.version, from: ['queued'], to: 'sending', actor, eventType: 'message.sending', data: { guardFindings: { allowed: true, consentPurpose: verdict.consentPurpose, at: now.toISOString() } } })
    return 'sending' as const
  }, { now }).catch(error => {
    if (error instanceof DomainError && error.code === Codes.STALE_STATE) return 'lost' as const
    throw error
  })
  if (claimed === 'lost') return { messageId, status: 'claimed_elsewhere' }
  if (claimed === 'blocked') return { messageId, status: 'blocked', reason: verdict.allowed ? undefined : verdict.reason }

  const brand = await db.brand.findFirst({ select: { phone: true } })
  const sent = await telephony().sendSms({ to: point!.value, from: brand?.phone ?? '', body: message.body ?? '', idempotencyKey: `message:${message.id}` })
  await runInTransaction(db, async uow => {
    const current = await uow.tx.message.findUniqueOrThrow({ where: { id: message.id }, select: { version: true } })
    if (sent.status === 'accepted') {
      await casUpdate(uow, { model: 'Message', id: message.id, version: current.version, from: ['sending'], to: 'sent', actor, eventType: 'message.sent', data: { providerMessageId: sent.providerMessageId, sentAt: now } })
    } else {
      await casUpdate(uow, { model: 'Message', id: message.id, version: current.version, from: ['sending'], to: 'manual', actor, eventType: 'message.handed_off', reason: sent.reason })
      await uow.tx.task.create({ data: { kind: 'message.manual_send', title: `Send this text by hand: ${message.template}`, detail: sent.reason, subjectType: 'Message', subjectId: message.id, status: 'open', priority: 'normal', dedupeKey: `message.manual:${message.id}` } })
    }
  }, { now })
  return { messageId, status: sent.status === 'accepted' ? 'sent' : 'manual' }
}

/** Page on-call (emergency escalation, SM§17): ring the first person on the rotation now. */
export async function deliverPage(db: Db, payload: { pageId: string; businessUnitId?: string | null; summary: string }, now = new Date()) {
  const onCall = await db.onCallRotation.findMany({ where: { startsAt: { lte: now }, endsAt: { gt: now }, ...(payload.businessUnitId ? { businessUnitId: payload.businessUnitId } : {}) }, orderBy: { escalationOrder: 'asc' }, select: { phoneE164: true, employee: { select: { displayName: true } } }, take: 1 })
  const target = onCall[0]
  const brand = await db.brand.findFirst({ select: { phone: true } })
  if (!target) {
    await db.task.upsert({ where: { dedupeKey: `page.no_on_call:${payload.pageId}` }, create: { kind: 'page.no_on_call', title: 'Emergency call with nobody on call', detail: payload.summary, subjectType: 'Call', subjectId: payload.pageId, status: 'open', priority: 'urgent', dedupeKey: `page.no_on_call:${payload.pageId}` }, update: {} })
    return { paged: null }
  }
  const result = await telephony().placeCall({ to: target.phoneE164, from: brand?.phone ?? '', say: `Emergency call for Summit. ${payload.summary}`.slice(0, 500), idempotencyKey: `page:${payload.pageId}` })
  return { paged: target.employee?.displayName ?? target.phoneE164, result }
}

export const messagingHandlers = (db: Db): OutboxHandlers => ({
  'message.send': async (m: ClaimedMessage) => { await deliverMessage(db, (m.payload as { messageId: string }).messageId) },
  'page.on_call': async (m: ClaimedMessage) => { await deliverPage(db, m.payload as { pageId: string; businessUnitId?: string | null; summary: string }) },
})

// ---------------------------------------------------------------------------------------------
// Inbound SMS and consent

/** A provider-delivered inbound text. STOP revokes every SMS purpose for that number first (I-K2). */
export async function receiveInboundSms(db: Db, args: { from: string; to: string; body: string; providerMessageId: string; receivedAt?: Date }) {
  const from = normalizePhone(args.from)
  const hash = contactHash(from)
  const now = args.receivedAt ?? new Date()
  const keyword = classifyKeyword(args.body)
  const actor: Actor = { kind: 'system', name: 'sms-webhook' }
  return runInTransaction(db, async uow => {
    const seen = await uow.tx.message.findFirst({ where: { providerMessageId: args.providerMessageId, direction: 'inbound' }, select: { id: true } })
    if (seen) return { messageId: seen.id, keyword, duplicate: true }
    const points = await uow.tx.contactPoint.findMany({ where: { valueHash: hash }, select: { id: true } })
    if (keyword === 'stop' || keyword === 'start') {
      const action = keyword === 'stop' ? 'revoke' : 'grant'
      const purposes = keyword === 'stop' ? ['transactional_sms', 'marketing_sms'] : ['transactional_sms']
      if (points.length) {
        await uow.tx.consentRecord.createMany({ data: points.flatMap(p => purposes.map(purpose => ({ contactPointId: p.id, purpose, action, channel: 'sms_keyword', evidence: { keyword: args.body.trim().slice(0, 20), providerMessageId: args.providerMessageId } as never, wordingVersion: 'ctia-keywords', recordedAt: now, actorKind: 'customer', actorId: '' }))) })
      }
      if (keyword === 'stop') {
        await uow.tx.dncEntry.createMany({ data: [{ valueHash: hash, kind: 'internal', source: 'sms_stop', addedAt: now }], skipDuplicates: true })
        // Anything still waiting to go to this number stops now.
        await uow.tx.message.updateMany({ where: { status: 'queued', contactPoint: { valueHash: hash } }, data: { status: 'blocked', blockedReason: 'opted_out', version: { increment: 1 } } })
      } else {
        await uow.tx.dncEntry.deleteMany({ where: { valueHash: hash, source: 'sms_stop' } })
      }
      uow.audit({ eventType: `consent.sms_${keyword}`, entityType: 'ContactPoint', entityId: points[0]?.id ?? hash.slice(0, 16), after: { purposes, points: points.length } })
    }
    const message = await uow.tx.message.create({ data: { contactPointId: points[0]?.id ?? null, direction: 'inbound', channel: 'sms', purpose: 'transactional', template: keyword ? `keyword_${keyword}` : 'inbound', body: args.body.slice(0, 1600), status: 'received', providerMessageId: args.providerMessageId, sentAt: now }, select: { id: true } })
    auditCreate(uow, actor, 'Message', message.id, 'message.received', { keyword, matchedPoints: points.length })
    return { messageId: message.id, keyword, duplicate: false }
  }, { now })
}

export type ConsentArgs = { contactPointId?: string | null; customerId?: string | null; phone?: string | null; purpose: string; action: 'grant' | 'revoke'; channel: string; evidence?: Record<string, unknown> | null; wordingVersion?: string | null; idempotencyKey: string; now?: Date }

/** Record a consent grant or revocation (append-only, I-C4). Agents may record what the caller said. */
export async function recordConsent(db: Db, actor: Actor, args: ConsentArgs) {
  await authorizeOperation(db, actor, 'consent.record', ['canManageCustomers', 'canBook', 'canSendMessages'], args)
  if (!(CONSENT_PURPOSES as readonly string[]).includes(args.purpose)) throw new DomainError(Codes.INVALID_INPUT, 'Unknown consent purpose.', { field: 'purpose' })
  if (!['grant', 'revoke'].includes(args.action)) throw new DomainError(Codes.INVALID_INPUT, 'Action must be grant or revoke.', { field: 'action' })
  // An agent can record a revocation of anything, but a grant only for transactional texts and recording.
  if (actor.kind === 'agent' && args.action === 'grant' && !['transactional_sms', 'call_recording'].includes(args.purpose)) throw new DomainError(Codes.NOT_AUTHORIZED, 'An agent can only record consent to booking texts. Marketing consent is collected in writing.')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'consent.record', actor, idempotencyKey, params, now: args.now }, async uow => {
    let pointId = args.contactPointId ?? null
    if (!pointId && args.phone && args.customerId) {
      const hash = contactHash(normalizePhone(args.phone))
      pointId = (await uow.tx.contactPoint.findFirst({ where: { valueHash: hash, contact: { customerId: args.customerId } }, select: { id: true } }))?.id ?? null
    }
    if (!pointId) throw new DomainError(Codes.NOT_FOUND, 'No matching phone number or email on that customer.', { field: 'contactPointId' })
    const row = await uow.tx.consentRecord.create({ data: { contactPointId: pointId, purpose: args.purpose, action: args.action, channel: args.channel, evidence: (args.evidence ?? {}) as never, wordingVersion: args.wordingVersion ?? '', recordedAt: uow.now, actorKind: actor.kind === 'agent' ? 'agent' : actor.kind === 'user' ? 'user' : 'system', actorId: actorAgentId(actor) ?? actorUserId(actor) ?? '' }, select: { id: true } })
    auditCreate(uow, actor, 'ConsentRecord', row.id, `consent.${args.action}`, { contactPointId: pointId, purpose: args.purpose, channel: args.channel })
    const value = { consentRecordId: row.id, contactPointId: pointId, purpose: args.purpose, action: args.action }
    await recordAgentAction(uow, actor, { tool: 'consent.record', idempotencyKey, inputs: params, output: value })
    return value
  })
  return { replay: result.replay, ...result.value }
}

/** A person re-queues a blocked or manual message after fixing the cause (never automatic). */
export async function requeueMessage(db: Db, actor: Actor, args: { messageId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'message.requeue', ['canSendMessages', 'canDispatch'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Only a person can re-send a blocked message.')
  const result = await command(db, { name: 'message.requeue', actor, idempotencyKey: args.idempotencyKey, params: { messageId: args.messageId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const version = await casUpdate(uow, { model: 'Message', id: args.messageId, version: args.expectedVersion, from: ['blocked', 'failed'], to: 'queued', actor, eventType: 'message.requeued', data: { blockedReason: '' } })
    uow.emit({ topic: 'message.send', aggregateType: 'Message', aggregateId: args.messageId, payload: { messageId: args.messageId }, dedupeKey: `message.send:${args.messageId}:${version}`, partitionKey: 'messaging' })
    return { messageId: args.messageId, status: 'queued', version }
  })
  return { replay: result.replay, ...result.value }
}

/** A person marks a hand-off text as sent from the office phone. */
export async function markMessageSent(db: Db, actor: Actor, args: { messageId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'message.mark_sent', ['canSendMessages', 'canDispatch', 'canBook'], args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Only a person can confirm a hand-sent text.')
  const result = await command(db, { name: 'message.mark_sent', actor, idempotencyKey: args.idempotencyKey, params: { messageId: args.messageId, expectedVersion: args.expectedVersion }, now: args.now }, async uow => {
    const version = await casUpdate(uow, { model: 'Message', id: args.messageId, version: args.expectedVersion, from: ['manual'], to: 'sent', actor, eventType: 'message.sent_by_hand', data: { sentAt: uow.now } })
    return { messageId: args.messageId, status: 'sent', version }
  })
  return { replay: result.replay, ...result.value }
}
