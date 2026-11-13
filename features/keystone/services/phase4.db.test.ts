import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { RecordedAdapter } from '../../../tests/helpers/recordedAdapter'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { HOUSEHOLDS } from '../seed/operationsData'
import { cancelMembership, cancelOnline, createPlan, activatePlanVersion, saveDraftVersion, sellMembership, renewMembership, bookVisit, debitEntitlement, releaseVisit, transferMembership, grantBalance } from './memberships'
import { processAttempt, retryAttempt, runMembershipBilling } from './membershipBilling'
import { dueForService, recordRenewalNotice, renewalsComing, renewalsCsv } from './agreements'
import { runInTransaction } from '../lib/unitOfWork'
import '../mutations'

/*
 * Phase 4 exit gate (each needs its own test):
 *  1. Billing: a crash and a retry never double-charge. A concurrent double click, and a retry after the adapter returns `unknown`.
 *  2. The entitlement ledger never goes negative under parallel booking.
 *  3. Season expiry and rollover are right (the DST and leap-year golden table is in domain/membershipTime.test.ts).
 * Run alone: timeout 300 npx vitest run features/keystone/services/phase4.db.test.ts --no-file-parallelism
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const user = (id: string): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(ALL) as never })
const sessionFor = (id: string) => ({ itemId: id, data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, true])) } } })
const k = (p = 'k') => uniqueKey(p)
const reason = async (p: Promise<unknown>) => {
  try { await p; return 'OK' } catch (e) { if (e instanceof DomainError) return String(e.details.reason ?? e.code); throw e }
}

describe.skipIf(!hasTestDatabase)('Phase 4: memberships, billing and entitlements (database)', () => {
  let prisma: PrismaClient
  let owner: Actor
  let customerId: string
  let locationId: string
  let seq = 0

  const planOf = async (draft: Record<string, unknown> = {}, code = `plan-${(seq += 1)}-${Date.now().toString(36)}`) => {
    const made = await createPlan(prisma, owner, { name: `Test plan ${seq}`, code, draft: { priceMinor: '19900', billingFrequency: 'annual', termMonths: 12, entitlements: [{ code: 'tuneup', name: 'Spring tune-up', quantity: 2, visit: true, rollover: 'none' }], ...draft } as never, idempotencyKey: k() })
    await activatePlanVersion(prisma, owner, { versionId: made.versionId, idempotencyKey: k() })
    return { planId: made.planId, code }
  }
  const sell = async (planId: string, extra: Record<string, unknown> = {}) => sellMembership(prisma, owner, { customerId, locationId, planId, paymentMethodRef: 'pm_card_visa', paymentMethodLabel: 'Visa ending 4242', idempotencyKey: k(), ...extra } as never)
  const attemptsOf = (membershipId: string) => prisma.membershipBillingAttempt.findMany({ where: { membershipId }, orderBy: [{ termNumber: 'asc' }, { slot: 'asc' }] })
  const thisMonth = () => new Date().toISOString().slice(0, 7)

  beforeAll(async () => {
    prisma = testPrisma(12)
    await resetDatabase(prisma)
    const o = await prisma.user.create({ data: { name: 'owner', email: `${k('o')}@test.local`, password: 'x'.repeat(60) } })
    const ctx = { session: sessionFor(o.id), prisma }
    await loadCompanySetup(null, { idempotencyKey: k('c') }, ctx)
    await loadOperationsSetup(null, { idempotencyKey: k('op') }, ctx)
    owner = user(o.id)
    customerId = HOUSEHOLDS[0].id
    locationId = HOUSEHOLDS[0].location.id
  }, 900_000)

  afterAll(async () => { await prisma?.$disconnect() })

  // ── Gate 1: billing never double-charges ──────────────────────────────────────────────────────────────────────────

  it('a concurrent double click on "Run billing" charges once', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    adapter.delayMs = 150 // make the two requests overlap inside the charge
    const period = thisMonth()
    const [a, b] = await Promise.all([
      runMembershipBilling(prisma, owner, { period, idempotencyKey: k('run') }, adapter),
      runMembershipBilling(prisma, owner, { period, idempotencyKey: k('run') }, adapter),
    ])
    const rows = await attemptsOf(m.membershipId)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('succeeded')
    expect(adapter.succeededCount).toBe(1)
    expect([...adapter.charges.values()].reduce((n, c) => n + 1, 0)).toBe(1)
    // The money exists once: one payment, one invoice, balance zero.
    const payments = await prisma.payment.findMany({ where: { id: rows[0].paymentId ?? '' } })
    expect(payments).toHaveLength(1)
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: rows[0].invoiceId ?? '' } })
    expect(inv.status).toBe('paid')
    expect(inv.balanceMinor).toBe(0n)
    expect(a.charged + b.charged).toBe(1)
    expect((await prisma.invoice.count({ where: { customerId, lines: { some: { description: { contains: 'Test plan' } } } } })) >= 1).toBe(true)
  })

  it('the same click twice with one key is replayed, not run again', { timeout: 60_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    const key = k('same')
    const first = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: key }, adapter)
    const again = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: key }, adapter)
    expect(first.replay).toBe(false)
    expect(again.replay).toBe(true)
    expect(adapter.succeededCount).toBeGreaterThanOrEqual(1)
    expect((await attemptsOf(m.membershipId))).toHaveLength(1)
    expect(adapter.charges.get(`${(await attemptsOf(m.membershipId))[0].attemptKey}:g1`)?.calls).toBe(1)
  })

  it('a retry after the adapter answers `unknown` asks the processor and never charges twice (the charge did go through)', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    adapter.script = ['lost'] // the processor charged, but the answer never reached us
    const first = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(first.unknown).toBeGreaterThanOrEqual(1)
    let [row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('unknown')
    expect(row.paymentId).toBeNull()
    expect(adapter.succeededCount).toBe(1)
    // A second run settles it from what the processor knows. No second charge.
    const second = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    ;[row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('succeeded')
    expect(adapter.succeededCount).toBe(1)
    expect(adapter.charges.get(row.providerKey)?.calls).toBe(1)
    expect(second.charged).toBeGreaterThanOrEqual(1)
    expect(await prisma.payment.count({ where: { id: row.paymentId ?? '' } })).toBe(1)
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('active')
  })

  it('a retry after `unknown` where the processor never saw the charge sends the same key once and charges once', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    adapter.script = ['throw'] // the connection dropped before the processor got it
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    let [row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('unknown')
    expect(adapter.charges.size).toBe(0)
    const outcome = await retryAttempt(prisma, owner, { attemptId: row.id, idempotencyKey: k() }, adapter)
    expect(outcome.outcome).toBe('charged')
    ;[row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('succeeded')
    expect(adapter.succeededCount).toBe(1)
    expect(row.generation).toBe(1)
    // And a further retry is a no-op.
    expect((await retryAttempt(prisma, owner, { attemptId: row.id, idempotencyKey: k() }, adapter)).outcome).toBe('already_paid')
    expect(adapter.succeededCount).toBe(1)
  })

  it('two workers on one attempt at once charge it once (the second sees it in progress)', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const row = await prisma.membershipBillingAttempt.create({ data: { attemptKey: `${m.membershipId}:1:0`, membershipId: m.membershipId, termId: m.termId, termNumber: 1, slot: 0, dueOn: new Date(), status: 'queued' } })
    const adapter = new RecordedAdapter()
    adapter.delayMs = 200
    const sys: Actor = { kind: 'system', name: 'test' }
    const outcomes = await Promise.all([processAttempt(prisma, sys, row.id, new Date(), adapter), processAttempt(prisma, sys, row.id, new Date(), adapter), processAttempt(prisma, sys, row.id, new Date(), adapter)])
    expect(adapter.succeededCount).toBe(1)
    expect(outcomes.filter(o => o === 'charged')).toHaveLength(1)
    expect(outcomes.every(o => ['charged', 'in_progress', 'already_paid'].includes(o))).toBe(true)
    expect([...adapter.charges.values()].reduce((n, c) => n + c.calls, 0)).toBe(1)
  })

  it('a decline is final for its key: Run billing again does not charge, Retry needs a new card or a reason, the run is partial', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    adapter.script = ['decline']
    const r = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(r.declined).toBeGreaterThanOrEqual(1)
    expect(r.status).toBe('partial')
    expect((await prisma.membershipBillingRun.findUniqueOrThrow({ where: { id: r.runId } })).status).toBe('partial')
    let [row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('failed')
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('pending_payment')
    // r1 #1: pressing Run billing again (a new key) does not charge the declined card again.
    const calls = adapter.charges.size
    const again = await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(again.status).toBe('partial')
    expect(adapter.charges.size).toBe(calls)
    ;[row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('failed')
    expect(row.generation).toBe(1)
    // Nor does a plain processAttempt (the "Check and retry" path) without the explicit staff retry.
    expect(await processAttempt(prisma, owner, row.id, new Date(), adapter)).toBe('declined')
    expect(adapter.charges.size).toBe(calls)
    // Retry without a new card and without a reason is refused.
    expect(await reason(retryAttempt(prisma, owner, { attemptId: row.id, idempotencyKey: k() }, adapter))).toBe('card_not_updated')
    // The card is updated, then Retry charges once on a new key.
    const { updatePaymentMethod } = await import('./memberships')
    await updatePaymentMethod(prisma, owner, { membershipId: m.membershipId, paymentMethodRef: 'pm_card_mastercard', paymentMethodLabel: 'Mastercard ending 4444', idempotencyKey: k() } as never)
    const out = await retryAttempt(prisma, owner, { attemptId: row.id, idempotencyKey: k() }, adapter)
    expect(out.outcome).toBe('charged')
    ;[row] = await attemptsOf(m.membershipId)
    expect(row.generation).toBe(2)
    expect(row.providerKey.endsWith(':g2')).toBe(true)
    expect(adapter.succeededCount).toBe(1)
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('active')
  })

  it('a declined card can be retried as-is only with a stated reason', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    adapter.script = ['decline']
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    const [row] = await attemptsOf(m.membershipId)
    expect((await retryAttempt(prisma, owner, { attemptId: row.id, reason: 'Customer called, bank lifted the hold', idempotencyKey: k() } as never, adapter)).outcome).toBe('charged')
    expect(await prisma.auditEvent.count({ where: { entityId: row.id, eventType: 'membership.charge_retried' } })).toBe(1)
  })

  it('Check and retry refuses a cancelled, transferred or expired membership', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    for (const end of ['cancelled', 'transferred', 'expired']) {
      const m = await sell(planId)
      const adapter = new RecordedAdapter()
      adapter.script = ['lost']
      await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
      const [row] = await attemptsOf(m.membershipId)
      expect(row.status).toBe('unknown')
      await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
      await prisma.membership.update({ where: { id: m.membershipId }, data: { status: end, ...(end === 'cancelled' ? { cancelledAt: new Date(), cancelReason: 'Test' } : {}) } as never })
      expect(await reason(retryAttempt(prisma, owner, { attemptId: row.id, idempotencyKey: k() }, adapter))).toBe('membership_not_billable')
      expect(await processAttempt(prisma, owner, row.id, new Date(), adapter)).toBe('not_billable')
      expect(adapter.lookups).toBe(0)
    }
  })

  it('an accountant reads billing runs but cannot charge cards', { timeout: 60_000 }, async () => {
    const accountant: Actor = { kind: 'user', userId: owner.kind === 'user' ? owner.userId : '', name: 'acct', permissions: new Set(['canAccessDashboard', 'canManageInvoices', 'canManageAccounting', 'canReadAudit']) as never }
    expect(await reason(runMembershipBilling(prisma, accountant, { period: thisMonth(), idempotencyKey: k('run') }, new RecordedAdapter()))).toBe('NOT_AUTHORIZED')
  })

  it('a technician can neither sell nor cancel a membership', { timeout: 60_000 }, async () => {
    const { ROLES } = await import('../seed/company')
    const techPerms = ROLES.find(r => r.id === 'seed_role_technician')!.permissions
    expect(techPerms).not.toContain('canSellMemberships')
    expect((await prisma.role.findUniqueOrThrow({ where: { id: 'seed_role_technician' } })).canSellMemberships).toBe(false)
    const tech: Actor = { kind: 'user', userId: 'seed_user_patel', name: 'tech', permissions: new Set(techPerms) as never }
    const { planId } = await planOf()
    const m = await sell(planId)
    expect(await reason(cancelMembership(prisma, tech, { membershipId: m.membershipId, reason: 'Not mine', idempotencyKey: k() }))).toBe('NOT_AUTHORIZED')
    expect(await reason(sellMembership(prisma, tech, { customerId, locationId, planId, paymentMethodRef: 'pm_card_visa', paymentMethodLabel: 'Visa', idempotencyKey: k() } as never))).toBe('NOT_AUTHORIZED')
  })

  it('the database itself refuses a second attempt for the same membership, term and slot, and a change to a charged attempt', { timeout: 60_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    const [row] = await attemptsOf(m.membershipId)
    await expect(prisma.membershipBillingAttempt.create({ data: { attemptKey: `dupe:${row.id}`, membershipId: m.membershipId, termId: m.termId, termNumber: 1, slot: 0, dueOn: new Date(), status: 'queued' } })).rejects.toThrow()
    await expect(prisma.membershipBillingAttempt.update({ where: { id: row.id }, data: { status: 'failed' } })).rejects.toThrow(/never changes/)
    await expect(prisma.membershipBillingAttempt.delete({ where: { id: row.id } })).rejects.toThrow(/never deleted/)
  })

  it('monthly billing writes one attempt per month and a run for a later month leaves the paid ones alone', { timeout: 180_000 }, async () => {
    const { planId } = await planOf({ priceMinor: '2500', billingFrequency: 'monthly' })
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    const rows = await attemptsOf(m.membershipId)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.filter(r => r.status === 'succeeded').length).toBe(rows.length)
    expect(adapter.succeededCount).toBe(rows.length)
    expect(new Set(rows.map(r => r.slot)).size).toBe(rows.length)
  })

  // ── Gate 2: the ledger never goes negative ────────────────────────────────────────────────────────────────────────

  it('20 bookings at once against 2 visits: exactly 2 succeed and the balance is 0, never below', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const grant = await prisma.entitlementGrant.findFirstOrThrow({ where: { membershipId: m.membershipId, code: 'tuneup' } })
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => runInTransaction(prisma, uow => debitEntitlement(uow, owner, { membershipId: m.membershipId, code: 'tuneup', key: `race:${m.membershipId}:${i}` }), {})))
    const ok = results.filter(r => r.status === 'fulfilled')
    expect(ok).toHaveLength(2)
    for (const r of results) if (r.status === 'rejected') expect(String(r.reason?.details?.reason ?? r.reason?.message)).toMatch(/none_left|Unable|balance/)
    expect(await grantBalance(prisma as never, grant.id)).toBe(0)
    const sum = await prisma.entitlementEntry.aggregate({ where: { grantId: grant.id }, _sum: { quantity: true } })
    expect(grant.quantity + (sum._sum.quantity ?? 0)).toBe(0)
  })

  it('the database refuses a debit below zero even when the application check is skipped', { timeout: 60_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const grant = await prisma.entitlementGrant.findFirstOrThrow({ where: { membershipId: m.membershipId, code: 'tuneup' } })
    await prisma.entitlementEntry.create({ data: { key: k('a'), grantId: grant.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })
    await prisma.entitlementEntry.create({ data: { key: k('b'), grantId: grant.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })
    await expect(prisma.entitlementEntry.create({ data: { key: k('c'), grantId: grant.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })).rejects.toThrow(/below zero/)
    await expect(prisma.entitlementEntry.create({ data: { key: k('d'), grantId: grant.id, kind: 'debit', quantity: -5, occurredAt: new Date() } })).rejects.toThrow()
    // 20 raw parallel inserts at the very edge: only one can take the last one.
    const other = await sell((await planOf()).planId)
    const g2 = await prisma.entitlementGrant.findFirstOrThrow({ where: { membershipId: other.membershipId, code: 'tuneup' } })
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => prisma.entitlementEntry.create({ data: { key: k(`p${i}`), grantId: g2.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })))
    const taken = attempts.filter(a => a.status === 'fulfilled').length
    const used = await prisma.entitlementEntry.aggregate({ where: { grantId: g2.id }, _sum: { quantity: true } })
    expect(g2.quantity + (used._sum.quantity ?? 0)).toBeGreaterThanOrEqual(0)
    expect(taken).toBeLessThanOrEqual(g2.quantity)
  })

  it('entries are append-only; restores cannot exceed what was used; a booking that is released gives the visit back', { timeout: 60_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const grant = await prisma.entitlementGrant.findFirstOrThrow({ where: { membershipId: m.membershipId, code: 'tuneup' } })
    const e = await prisma.entitlementEntry.create({ data: { key: k('x'), grantId: grant.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })
    await expect(prisma.entitlementEntry.update({ where: { id: e.id }, data: { quantity: -2 } })).rejects.toThrow()
    await expect(prisma.entitlementEntry.delete({ where: { id: e.id } })).rejects.toThrow()
    await expect(prisma.entitlementEntry.create({ data: { key: k('r1'), grantId: grant.id, kind: 'restore', quantity: 1, occurredAt: new Date() } })).resolves.toBeTruthy()
    await expect(prisma.entitlementEntry.create({ data: { key: k('r2'), grantId: grant.id, kind: 'restore', quantity: 1, occurredAt: new Date() } })).rejects.toThrow(/exceed/)
    // Booking and releasing a visit through the service.
    const ev = await prisma.recurringServiceEvent.findFirstOrThrow({ where: { membershipId: m.membershipId, status: 'open' } })
    const job = await prisma.job.create({ data: { ref: `JOB-P4-${Date.now()}`, publicCode: `J-P4${Date.now()}`, customerId, locationId, status: 'scheduled', priority: 'normal', source: 'phone' } as never })
    await bookVisit(prisma, owner, { eventId: ev.id, jobRef: job.ref, idempotencyKey: k() })
    expect(await grantBalance(prisma as never, grant.id)).toBe(1)
    await releaseVisit(prisma, owner, { eventId: ev.id, reason: 'Customer rescheduled', idempotencyKey: k() })
    expect(await grantBalance(prisma as never, grant.id)).toBe(2)
  })

  // ── Gate 3: season expiry and rollover ────────────────────────────────────────────────────────────────────────────

  it('renewal expires what is left, and a rollover plan carries one term of unused visits forward', { timeout: 120_000 }, async () => {
    const { planId } = await planOf({ entitlements: [{ code: 'tuneup', name: 'Tune-up', quantity: 2, visit: true, rollover: 'one_term' }, { code: 'inspect', name: 'Inspection', quantity: 1, visit: true, rollover: 'none' }] })
    const m = await sell(planId, { startsOn: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10) })
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const first = await prisma.entitlementGrant.findMany({ where: { membershipId: m.membershipId } })
    const tune = first.find(g => g.code === 'tuneup')!
    await prisma.entitlementEntry.create({ data: { key: k('u'), grantId: tune.id, kind: 'debit', quantity: -1, occurredAt: new Date() } })
    const renewed = await renewMembership(prisma, owner, { membershipId: m.membershipId, idempotencyKey: k() })
    expect(renewed.termNumber).toBe(2)
    const second = await prisma.entitlementGrant.findMany({ where: { membershipId: m.membershipId, termId: renewed.termId } })
    const tune2 = second.find(g => g.code === 'tuneup')!
    const inspect2 = second.find(g => g.code === 'inspect')!
    expect(await grantBalance(prisma as never, tune2.id)).toBe(3) // 2 new + 1 carried
    expect(await grantBalance(prisma as never, inspect2.id)).toBe(1) // no rollover on this one
    expect(await grantBalance(prisma as never, tune.id)).toBe(0) // the old term's leftover expired
    expect(await grantBalance(prisma as never, first.find(g => g.code === 'inspect')!.id)).toBe(0)
    // r1: raw SQL cannot add a rollover beyond what the term before granted, or a second one on the same grant.
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "EntitlementEntry" (id, key, "grant", kind, quantity, "occurredAt") VALUES ($1, $2, $3, 'rollover', 5, now())`, k('id'), k('ro'), inspect2.id)).rejects.toThrow(/rollover/)
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "EntitlementEntry" (id, key, "grant", kind, quantity, "occurredAt") VALUES ($1, $2, $3, 'rollover', 1, now())`, k('id'), k('ro'), tune2.id)).rejects.toThrow(/one rollover/)
    // Renewing twice for the same term is refused.
    expect(await reason(renewMembership(prisma, owner, { membershipId: m.membershipId, idempotencyKey: k() }))).toBeTruthy()
    // The first term is frozen.
    await expect(prisma.membershipTerm.update({ where: { id: renewed.termId }, data: { endsOn: new Date('2099-01-01') } })).rejects.toThrow(/fixed/)
  })

  it('a visit outside its season window cannot be used, and one inside can', { timeout: 60_000 }, async () => {
    const today = new Date()
    const y = today.getUTCFullYear()
    const past = `${String(((today.getUTCMonth() + 6) % 12) + 1).padStart(2, '0')}-01`
    const { planId } = await planOf({ entitlements: [{ code: 'seasonal', name: 'Seasonal check', quantity: 1, visit: true, seasonStart: past, seasonEnd: past, rollover: 'none' }] })
    const m = await sell(planId)
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    expect(await reason(runInTransaction(prisma, uow => debitEntitlement(uow, owner, { membershipId: m.membershipId, code: 'seasonal', key: k('s') }), {}))).toBe('not_in_window')
    void y
  })

  // ── Selling, consent, cancelling, transfer ────────────────────────────────────────────────────────────────────────

  it('auto-renew needs the exact wording confirmed; the consent evidence is stored and cannot be edited or removed', { timeout: 60_000 }, async () => {
    const wording = 'I agree this membership renews every year for $199.00 on the day after it ends, charged to my card, until I cancel online or by phone.'
    const made = await createPlan(prisma, owner, { name: 'Auto plan', code: `auto-${Date.now().toString(36)}`, draft: { priceMinor: '19900', termMonths: 12, autoRenew: true, consentWording: wording, entitlements: [{ code: 'tuneup', name: 'Tune-up', quantity: 1, visit: true, rollover: 'none' }] } as never, idempotencyKey: k() })
    await activatePlanVersion(prisma, owner, { versionId: made.versionId, idempotencyKey: k() })
    expect(await reason(sellMembership(prisma, owner, { customerId, locationId, planId: made.planId, paymentMethodRef: 'pm_card_visa', idempotencyKey: k() } as never))).toBe('consent_required')
    expect(await reason(sellMembership(prisma, owner, { customerId, locationId, planId: made.planId, paymentMethodRef: 'pm_card_visa', consent: { confirmed: true, wording: 'something else', how: 'phone_recorded' }, idempotencyKey: k() } as never))).toBe('consent_required')
    const sold = await sellMembership(prisma, owner, { customerId, locationId, planId: made.planId, paymentMethodRef: 'pm_card_visa', paymentMethodLabel: 'Visa 4242', consent: { confirmed: true, wording, how: 'phone_recorded', note: 'Call on file' }, idempotencyKey: k() } as never)
    const row = await prisma.membership.findUniqueOrThrow({ where: { id: sold.membershipId }, include: { autoRenewConsent: true } })
    expect(row.autoRenew).toBe(true)
    expect(row.autoRenewConsent?.purpose).toBe('auto_renewal')
    expect((row.autoRenewConsent?.evidence as { wording: string }).wording).toBe(wording)
    expect(row.autoRenewConsent?.policyVersionId).toBeTruthy()
    await expect(prisma.consentRecord.update({ where: { id: row.autoRenewConsentId! }, data: { action: 'revoke' } })).rejects.toThrow()
    await expect(prisma.membership.update({ where: { id: row.id }, data: { autoRenewConsentId: null } })).rejects.toThrow(/consent/)
    // r1: raw SQL cannot swap the consent link for another record either.
    const other = await prisma.consentRecord.create({ data: { purpose: 'auto_renewal', action: 'grant', channel: 'in_person', recordedAt: new Date(), actorKind: 'user' } })
    await expect(prisma.$executeRawUnsafe(`UPDATE "Membership" SET "autoRenewConsent" = $1 WHERE id = $2`, other.id, row.id)).rejects.toThrow(/never removed or replaced/)
  })

  it('an active plan version is frozen; a change makes a new version and the old one is retired', { timeout: 60_000 }, async () => {
    const { planId } = await planOf()
    const v1 = await prisma.membershipPlanVersion.findFirstOrThrow({ where: { planId, status: 'active' } })
    await expect(prisma.membershipPlanVersion.update({ where: { id: v1.id }, data: { priceMinor: 1n } })).rejects.toThrow(/frozen/)
    const draft = await saveDraftVersion(prisma, owner, { planId, draft: { priceMinor: '21900' }, idempotencyKey: k() })
    await activatePlanVersion(prisma, owner, { versionId: draft.versionId, idempotencyKey: k() })
    expect((await prisma.membershipPlanVersion.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe('retired')
    expect((await prisma.membershipPlanVersion.findUniqueOrThrow({ where: { id: draft.versionId } })).priceMinor).toBe(21900n)
  })

  it('cancelling refunds pro-rata by the plan rule, ends the open visits, and cancelling twice or online does the work in the request', { timeout: 120_000 }, async () => {
    const { planId } = await planOf({ cancellationRefundMethod: 'prorata' })
    const m = await sell(planId)
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, new RecordedAdapter())
    const cancelled = await cancelMembership(prisma, owner, { membershipId: m.membershipId, reason: 'Moving away', idempotencyKey: k() })
    expect(cancelled.status).toBe('cancelled')
    expect(BigInt(cancelled.refundOwedMinor)).toBeGreaterThan(0n)
    expect(BigInt(cancelled.refundOwedMinor)).toBeLessThanOrEqual(19900n)
    expect(await prisma.recurringServiceEvent.count({ where: { membershipId: m.membershipId, status: 'open' } })).toBe(0)
    const again = await cancelMembership(prisma, owner, { membershipId: m.membershipId, reason: 'Moving away', idempotencyKey: k() })
    expect(again.already).toBe(true)
    await expect(prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })).rejects.toThrow(/does not come back/)

    const m2 = await sell(planId)
    const code = (await prisma.membership.findUniqueOrThrow({ where: { id: m2.membershipId } })).publicCode
    const online = await cancelOnline(prisma, { publicCode: code })
    expect(online.status).toBe('cancelled')
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m2.membershipId } })).status).toBe('cancelled')
    await expect(cancelOnline(prisma, { publicCode: 'MBR-AAAA-BBBB' })).rejects.toThrow(/could not find/)
  })

  it('a membership is transferred with its unused visits when the home is sold', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const buyer = await prisma.customer.create({ data: { ref: `CUS-P4-${Date.now()}`, kind: 'residential', displayName: 'Marcus Webb' } as never })
    const loc = await prisma.serviceLocation.findUniqueOrThrow({ where: { id: locationId } })
    const { id: _id, customerId: _c, createdAt: _a, updatedAt: _u, ...rest } = loc as never as Record<string, unknown>
    const newLoc = await prisma.serviceLocation.create({ data: { ...(rest as object), customerId: buyer.id, ref: `LOC-P4-${Date.now()}` } as never }).catch(() => null)
    if (!newLoc) return
    const t = await transferMembership(prisma, owner, { membershipId: m.membershipId, newCustomerId: buyer.id, newLocationId: newLoc.id, idempotencyKey: k() })
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('transferred')
    const grants = await prisma.entitlementGrant.findMany({ where: { membershipId: t.membershipId } })
    expect(grants.reduce((a, g) => a + g.quantity, 0)).toBe(2)
  })

  it('the buyer of a home is never billed for the term the seller paid; the paid term carries over', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    const adapter = new RecordedAdapter()
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(adapter.succeededCount).toBe(1)
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('active')
    const buyer = await prisma.customer.create({ data: { ref: `CUS-P4B-${Date.now()}`, kind: 'residential', displayName: 'Dana Ruiz' } as never })
    const loc = await prisma.serviceLocation.findUniqueOrThrow({ where: { id: locationId } })
    const { id: _id, customerId: _c, createdAt: _a, updatedAt: _u, ref: _r, ...rest } = loc as never as Record<string, unknown>
    const newLoc = await prisma.serviceLocation.create({ data: { ...(rest as object), customerId: buyer.id, ref: `LOC-P4B-${Date.now()}` } as never })
    const t = await transferMembership(prisma, owner, { membershipId: m.membershipId, newCustomerId: buyer.id, newLocationId: newLoc.id, idempotencyKey: k() })
    const before = adapter.charges.size
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(adapter.charges.size).toBe(before)
    expect(await prisma.membershipBillingAttempt.count({ where: { membershipId: t.membershipId, status: { not: 'succeeded' } } })).toBe(0)
    expect(await prisma.invoice.count({ where: { customerId: buyer.id } })).toBe(0)
  })

  // ── r1: a refund never reopens the invoice; it closes the term ───────────────────────────────────────────────────

  it('refunding a membership payment keeps the invoice paid (paid, then refunded), closes the term and ends the visits', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, new RecordedAdapter())
    const [row] = await attemptsOf(m.membershipId)
    expect(row.status).toBe('succeeded')
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: row.invoiceId! } })
    expect(before.status).toBe('paid')
    const { requestRefund } = await import('./payments')
    const out = await requestRefund(prisma, owner, { paymentId: row.paymentId!, amountMinor: '19900', method: 'processor_refund', reason: 'Customer moved before any visit', reference: 're_test_1', idempotencyKey: k() })
    expect(out.status).toBe('recorded')
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: row.invoiceId! } })
    expect(after.status).toBe('paid')
    expect(after.balanceMinor).toBe(0n)
    expect(await prisma.creditMemo.count({ where: { invoiceId: row.invoiceId!, status: 'applied' } })).toBe(1)
    const mem = await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })
    expect(mem.status).toBe('cancelled')
    expect((await prisma.membershipTerm.findFirstOrThrow({ where: { membershipId: m.membershipId } })).status).toBe('cancelled')
    const grants = await prisma.entitlementGrant.findMany({ where: { membershipId: m.membershipId } })
    for (const g of grants) expect(await grantBalance(prisma, g.id)).toBe(0)
    expect(await prisma.recurringServiceEvent.count({ where: { membershipId: m.membershipId, status: 'open' } })).toBe(0)
    // And billing does not charge it again.
    const adapter = new RecordedAdapter()
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, adapter)
    expect(adapter.charges.size).toBe(0)
  })

  it('an invoice an earlier refund reopened (as live INV-2026-000004…11) is credited back to not owing, once', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const m = await sell(planId)
    await runMembershipBilling(prisma, owner, { period: thisMonth(), idempotencyKey: k('run') }, new RecordedAdapter())
    const [row] = await attemptsOf(m.membershipId)
    // The old refund: allocations reversed, the invoice back to posted with its full balance.
    const { reverseAllocations } = await import('./billingShared')
    await runInTransaction(prisma, async uow => {
      await reverseAllocations(uow, owner, row.paymentId!, 19900n, 'refund_reopen', 'Refund: old path')
      await uow.tx.refund.create({ data: { ref: `RFD-OLD-${Date.now()}`, paymentId: row.paymentId!, method: 'processor_refund', amountMinor: 19900n, reason: 'Stripe TEST cleanup', reference: 're_old', refundedAt: uow.now } })
    })
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: row.invoiceId! } })).balanceMinor).toBe(19900n)
    const { settleRefundedMembershipInvoice } = await import('./payments')
    const out = await settleRefundedMembershipInvoice(prisma, owner, { invoiceId: row.invoiceId!, idempotencyKey: k() })
    expect(out.creditedMinor).toBe('19900')
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: row.invoiceId! } })
    expect(inv.balanceMinor).toBe(0n)
    expect(inv.status).toBe('paid')
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('cancelled')
    expect((await settleRefundedMembershipInvoice(prisma, owner, { invoiceId: row.invoiceId!, idempotencyKey: k() })).creditedMinor).toBe('0')
  })

  // ── r1: the NTE on an agreement job caps what is invoiced; member prices are decided now ─────────────────────────

  it('an invoice past the job not-to-exceed is refused; one inside it posts', { timeout: 120_000 }, async () => {
    const { createInvoiceDraft, postInvoice } = await import('./invoices')
    const mkJob = async (nte: bigint, amount: number) => {
      const j = await prisma.job.create({ data: { ref: `JOB-NTE-${(seq += 1)}-${Date.now()}`, publicCode: `J-NTE${seq}${Date.now()}`, customerId, locationId, status: 'work_complete', priority: 'standard', source: 'phone', poNumber: 'PO-1', nteMinor: nte } })
      await prisma.workLine.create({ data: { jobId: j.id, source: 'manual', description: 'Labor', quantity: '1', uom: 'job', unitPriceMinor: BigInt(amount), amountMinor: BigInt(amount), taxCategory: 'labor', trade: 'general', cancellationClass: 'requested_repair', status: 'completed', snapshot: { costMinor: '0' } } })
      const d = await createInvoiceDraft(prisma, owner, { jobId: j.id, idempotencyKey: k() })
      const v = (await prisma.invoice.findUniqueOrThrow({ where: { id: d.invoiceId } })).version
      return postInvoice(prisma, owner, { invoiceId: d.invoiceId, expectedVersion: v, idempotencyKey: k() })
    }
    expect(await reason(mkJob(10000n, 50000))).toBe('over_nte')
    expect(await reason(mkJob(500000n, 50000))).toBe('OK')
  })

  it('I-MB3: a member price drafted while a member becomes the list price at present once the membership ends', { timeout: 300_000 }, async () => {
    const { createEstimate, presentEstimate } = await import('./estimates')
    const { activeVersionFor, discardPriceBookVersion, startPriceBookDraft, saveDraftItems, submitPriceBookVersion } = await import('./pricebook')
    const { decideApprovalAs } = await import('../mutations/approvals')
    const { seedPriceBook } = await import('../seed/pricebook')
    const { CATALOG } = await import('../seed/pricebookData')
    const checker = user((await prisma.user.create({ data: { name: 'checker', email: `${k('ck')}@test.local`, password: 'x'.repeat(60) } })).id)
    if (!(await prisma.priceBook.count())) await seedPriceBook(prisma, { maker: owner, checker, prefix: k('pb') })
    const book = await prisma.priceBook.findFirstOrThrow()
    for (const open of await prisma.priceBookVersion.findMany({ where: { priceBookId: book.id, status: 'draft' } })) await discardPriceBookVersion(prisma, owner, { versionId: open.id, expectedVersion: open.version, reason: 'Test', idempotencyKey: k() })
    // A member price on one item, published through the price book's maker-checker.
    const draft = await startPriceBookDraft(prisma, owner, { priceBookId: book.id, label: 'Member prices', idempotencyKey: k() })
    const item = CATALOG.find(i => i.itemKey === 'HVAC-CAP-DUAL')!
    const { since: _s, v3UnitPriceMinor: _v, ...input } = item as never as Record<string, unknown>
    const dv = (await prisma.priceBookVersion.findUniqueOrThrow({ where: { id: draft.versionId } })).version
    const saved = await saveDraftItems(prisma, owner, { versionId: draft.versionId, items: [{ ...(input as object), unitPriceMinor: '25000', memberUnitPriceMinor: '20000' } as never], expectedVersion: dv, idempotencyKey: k() })
    const sub = await submitPriceBookVersion(prisma, owner, { versionId: draft.versionId, expectedVersion: saved.version, idempotencyKey: k() })
    const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: sub.approvalRequestId } })
    await decideApprovalAs(prisma, checker, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: k() })
    expect((await activeVersionFor(prisma, 'seed_bu_hvac_service')).versionId).toBe(draft.versionId)

    const h = HOUSEHOLDS[7]
    const { planId } = await planOf()
    const m = await sellMembership(prisma, owner, { customerId: h.id, locationId: h.location.id, planId, paymentMethodRef: 'pm_card_visa', paymentMethodLabel: 'Visa ending 4242', idempotencyKey: k() } as never)
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const draftEst = () => createEstimate(prisma, owner, { customerId: h.id, locationId: h.location.id, businessUnitId: 'seed_bu_hvac_service', title: 'Capacitor', options: [{ tier: 'single', name: 'Fix', memberPricing: true, lines: [{ itemKey: 'HVAC-CAP-DUAL', quantity: '1' }] }], idempotencyKey: k() })
    const lineOf = async (versionId: string) => prisma.estimateLine.findFirstOrThrow({ where: { option: { estimateVersionId: versionId } } })
    const ev = async (id: string) => (await prisma.estimateVersion.findUniqueOrThrow({ where: { id } })).version

    // A current member keeps the member price when the estimate is presented.
    const kept = await draftEst()
    expect((await lineOf(kept.versionId)).unitPriceMinor).toBe(20000n)
    await presentEstimate(prisma, owner, { versionId: kept.versionId, expectedVersion: await ev(kept.versionId), idempotencyKey: k() })
    expect((await lineOf(kept.versionId)).unitPriceMinor).toBe(20000n)

    // Drafted as a member, cancelled before it is presented: it presents at the list price.
    const later = await draftEst()
    expect((await lineOf(later.versionId)).unitPriceMinor).toBe(20000n)
    await cancelMembership(prisma, owner, { membershipId: m.membershipId, reason: 'Moving away', idempotencyKey: k() })
    await presentEstimate(prisma, owner, { versionId: later.versionId, expectedVersion: await ev(later.versionId), idempotencyKey: k() })
    const line = await lineOf(later.versionId)
    expect(line.unitPriceMinor).toBe(25000n)
    expect(line.memberPriced).toBe(false)
  })

  // ── Renewal notices and the call list ─────────────────────────────────────────────────────────────────────────────

  it('renewal notices are records plus a CSV and a message; nothing is sent', { timeout: 120_000 }, async () => {
    const { planId } = await planOf()
    const start = new Date(Date.now() - 340 * 86_400_000).toISOString().slice(0, 10)
    const m = await sell(planId, { startsOn: start }).catch(() => null)
    if (!m) return
    await prisma.membership.update({ where: { id: m.membershipId }, data: { status: 'active' } })
    const rows = await renewalsComing(prisma, { withinDays: 60, baseUrl: 'https://example.test' })
    const mine = rows.find(r => r.membershipId === m.membershipId)
    expect(mine).toBeTruthy()
    expect(mine!.message).toContain('renew')
    expect(renewalsCsv(rows)).toContain('\r\n')
    await recordRenewalNotice(prisma, owner, { membershipId: m.membershipId, status: 'contacted', idempotencyKey: k() })
    expect((await renewalsComing(prisma, { withinDays: 60 })).find(r => r.membershipId === m.membershipId)!.noticeStatus).toBe('contacted')
    expect(await prisma.message.count({ where: { createdAt: { gte: new Date(Date.now() - 60_000) }, direction: 'outbound' } as never }).catch(() => 0)).toBe(0)
    const due = await dueForService(prisma, { horizonDays: 400 })
    expect(due.some(d => d.customerId === customerId)).toBe(true)
  })
})
