import { authorizeOperation, recordAgentAction } from '../lib/agentGate'
import { actorAgentId, actorUserId, type Actor } from '../lib/actor'
import { auditCreate } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { DomainError, Codes } from '../lib/errors'
import { runInTransaction } from '../lib/unitOfWork'
import { contactHash, normalizePhone } from '../domain/contact'
import { classifyKeyword } from '../domain/smsKeywords'
import { CONSENT_PURPOSES } from '../models/crm'

/*
 * Consent records and inbound texts (SM§17, I-K2). Nothing is sent from here: STOP-family keywords
 * revoke consent before anything else runs.
 */

/** Effective consent per purpose for a contact point: the latest event wins. */
export async function effectiveConsent(db: Db, contactPointId: string) {
  const events = await db.consentRecord.findMany({ where: { contactPointId }, orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }], select: { purpose: true, action: true } })
  const state: Record<string, 'grant' | 'revoke'> = {}
  for (const e of events) if (!state[e.purpose]) state[e.purpose] = e.action as 'grant' | 'revoke'
  return state
}

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
