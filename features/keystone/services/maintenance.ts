import type { Db } from '../lib/db'
import { expireHolds } from './booking'
import { activateDuePriceBookVersions } from './pricebook'
import { expireDueEstimates } from './estimates'
import { expireCancellationNotices } from './cancellation'

/*
 * Timers: lapsed holds, due price-book versions, expired estimates and cancellation notices. Run
 * inside the web process by instrumentation.ts. Every step is an idempotent command, so several
 * replicas running it at once is safe.
 */
export async function runMaintenancePass(db: Db, options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date())
  const holds = await expireHolds(db, clock())
  const priceBooks = await activateDuePriceBookVersions(db, clock())
  const estimates = await expireDueEstimates(db, clock())
  const notices = await expireCancellationNotices(db, clock())
  return { holds, priceBooks, estimates, notices }
}
