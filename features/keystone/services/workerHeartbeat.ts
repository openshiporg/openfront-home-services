import type { Db } from '../lib/db'

/*
 * The worker leaves one row (ScheduledJob kind worker.heartbeat) each pass, so /api/health can say
 * whether the outbox, expiry and price-book activation are actually running.
 */
export const HEARTBEAT_KEY = 'worker:heartbeat'
export const STALE_AFTER_MS = 90_000

type Pass = { ok: true; result: Record<string, unknown> } | { ok: false; error: string }

export async function recordHeartbeat(db: Db, pass: Pass, now = new Date()) {
  const payload = (pass.ok ? { ok: true, at: now.toISOString(), result: JSON.parse(JSON.stringify(pass.result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))) } : { ok: false, at: now.toISOString(), error: pass.error }) as never
  await db.scheduledJob.upsert({
    where: { key: HEARTBEAT_KEY },
    create: { kind: 'worker.heartbeat', key: HEARTBEAT_KEY, dueAt: now, status: pass.ok ? 'done' : 'failed', lastRunAt: now, payload, intervalSeconds: 15, lastError: pass.ok ? '' : pass.error },
    update: { status: pass.ok ? 'done' : 'failed', lastRunAt: now, dueAt: now, payload, lastError: pass.ok ? '' : pass.error, attempts: { increment: 1 } },
  })
}

export async function workerStatus(db: Db, now = new Date()) {
  const [beat, pending, oldest] = await Promise.all([
    db.scheduledJob.findUnique({ where: { key: HEARTBEAT_KEY }, select: { status: true, lastRunAt: true, payload: true, attempts: true } }),
    db.outboxMessage.count({ where: { status: 'pending' } }),
    db.outboxMessage.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])
  const ageMs = beat?.lastRunAt ? now.getTime() - beat.lastRunAt.getTime() : null
  const state = !beat ? 'never_ran' : ageMs! > STALE_AFTER_MS ? 'stale' : beat.status === 'done' ? 'running' : 'failing'
  return { state, lastRunAt: beat?.lastRunAt?.toISOString() ?? null, passes: beat?.attempts ?? 0, lastResult: (beat?.payload as { result?: unknown } | null)?.result ?? null, outboxPending: pending, oldestPendingAt: oldest?.createdAt.toISOString() ?? null }
}
