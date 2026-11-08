import type { Db } from '../lib/db'
import { drainOutbox, type ClaimedMessage, type OutboxHandlers } from '../lib/outbox'
import { expireHolds } from './booking'
import { messagingHandlers } from './comms'
import { activateDuePriceBookVersions } from './pricebook'
import { expireDueEstimates } from './estimates'
import { expireCancellationNotices } from './cancellation'

/*
 * Background work: one pass drains the outbox (every topic has a handler, so nothing dead-letters for
 * want of one) and runs the timers. Run it on a schedule (Railway cron, `npm run worker`), or in a
 * loop. Several workers at once are safe: the outbox is leased and fenced, holds expire by CAS.
 */

const raiseTask = (db: Db, kind: string, title: (m: ClaimedMessage) => Promise<string | null>) => async (m: ClaimedMessage) => {
  const text = await title(m)
  if (!text) return
  await db.task.upsert({ where: { dedupeKey: `${kind}:${m.dedupeKey}` }, create: { kind, title: text.slice(0, 200), subjectType: m.aggregateType, subjectId: m.aggregateId, status: 'open', priority: kind === 'lead.first_response' ? 'high' : 'normal', dedupeKey: `${kind}:${m.dedupeKey}` }, update: {} })
}

export function workerHandlers(db: Db): OutboxHandlers {
  return {
    ...messagingHandlers(db),
    // Speed-to-lead: only if nobody has responded by the deadline.
    'lead.first_response_due': raiseTask(db, 'lead.first_response', async m => {
      const lead = await db.lead.findUnique({ where: { id: m.aggregateId }, select: { ref: true, status: true, contactName: true } })
      return lead && lead.status === 'new' ? `Respond to lead ${lead.ref}${lead.contactName ? ` (${lead.contactName})` : ''}: past the first-response target` : null
    }),
    // LSA dispute: manual by default (I§5): a person files it in the Google LSA console.
    'lsa.dispute': raiseTask(db, 'lead.lsa_dispute', async m => {
      const lead = await db.lead.findUnique({ where: { id: m.aggregateId }, select: { ref: true } })
      return lead ? `Dispute ${lead.ref} as spam in Local Services Ads` : null
    }),
    // Tech notifications: the tech app reads assignments live; no external push provider yet.
    'notify.tech_assignment': async () => undefined,
    'push.dispatch': async () => undefined,
    // Approvers work from the approvals queue on the dashboard; there is no separate push channel.
    'notify.approval': async () => undefined,
    // A presented estimate sent by email: the office sends it from the estimate screen (the PDF link is staff-only until the portal ships).
    'notify.estimate': raiseTask(db, 'estimate.send', async m => {
      const est = await db.estimate.findUnique({ where: { id: String((m.payload as { estimateId?: string }).estimateId ?? '') }, select: { ref: true, customer: { select: { displayName: true } } } })
      return est ? `Email estimate ${est.ref} to ${est.customer?.displayName ?? 'the customer'}` : null
    }),
  }
}

export async function runWorkerPass(db: Db, options: { workerId?: string; now?: () => Date; maxMessages?: number } = {}) {
  const clock = options.now ?? (() => new Date())
  const holds = await expireHolds(db, clock())
  const priceBooks = await activateDuePriceBookVersions(db, clock())
  const estimates = await expireDueEstimates(db, clock())
  const notices = await expireCancellationNotices(db, clock())
  const outbox = await drainOutbox(db, { workerId: options.workerId ?? `worker-${process.pid}`, handlers: workerHandlers(db), now: clock, maxMessages: options.maxMessages ?? 200 })
  return { holds, priceBooks, estimates, notices, outbox }
}
