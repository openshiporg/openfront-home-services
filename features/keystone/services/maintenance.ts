import type { Db } from '../lib/db'
import { expireHolds } from './booking'
import { activateDuePriceBookVersions } from './pricebook'
import { expireDueEstimates } from './estimates'
import { expireCancellationNotices } from './cancellation'
import { advanceWarrantyStates } from './warranty'

/*
 * Time-based states: lapsed holds, due price-book versions, expired estimates and cancellation
 * notices. There is no timer, worker or cron. Every step is an idempotent command that is run on the
 * request that touches these records (every dashboard read and every booking, price book, estimate
 * and cancellation call), and by the staff "Refresh" button. Running it twice, or on several
 * replicas at once, is safe.
 */
export async function runMaintenancePass(db: Db, options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date())
  const holds = await expireHolds(db, clock())
  const priceBooks = await activateDuePriceBookVersions(db, clock())
  const estimates = await expireDueEstimates(db, clock())
  const notices = await expireCancellationNotices(db, clock())
  const warranty = await advanceWarrantyStates(db, clock())
  return { holds, priceBooks, estimates, notices, warranty }
}

const MIN_GAP_MS = 5_000
const state = globalThis as unknown as { homeServicesAdvance?: { at: number; running: Promise<unknown> | null } }

/**
 * Advance the time-based states for the request in hand. Calls within five seconds of the last pass
 * share its result (no repeat queries on a busy page); `force` is the staff Refresh button. A failed
 * pass is logged and never fails the request that triggered it.
 */
export async function advanceTimedStates(db: Db, options: { force?: boolean } = {}) {
  const s = (state.homeServicesAdvance ??= { at: 0, running: null })
  if (s.running) {
    await s.running.catch(() => undefined)
    if (!options.force) return null
  }
  if (!options.force && Date.now() - s.at < MIN_GAP_MS) return null
  const run = runMaintenancePass(db)
  s.running = run
  try {
    const result = await run
    s.at = Date.now()
    return result
  } catch (error) {
    console.error(JSON.stringify({ component: 'timed-states', status: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'unknown error' }))
    return null
  } finally {
    s.running = null
  }
}
