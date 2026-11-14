import type { PrismaClient } from '@prisma/client'
import { getContext } from '@keystone-6/core/context'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { decideApprovalAs } from '../mutations/approvals'
import { ROLES } from '../seed/company'
import {
  addPayAdjustment, addSegment, adjustTimesheet, approvePayPeriod, approveTimesheet, assignPayPlan, calculatePayPeriod, createPayPlan, exportPayPeriod,
  openPayPeriod, proposeTimesheet, publishPayPlanVersion, reopenPayPeriod, requestPayPeriodApproval, requestPayPlanPublish, setAttribution, submitTimesheet,
} from './labour'
import { createInvoiceDraft, postInvoice } from './invoices'
import { recordInvoicePayment, requestRefund } from './payments'
import { HOUSEHOLDS } from '../seed/operationsData'
import config from '../index'
import * as PrismaModule from '@prisma/client'
import '../mutations'

/*
 * Phase 6 exit gate (each item has its own test):
 *  1. deterministic recalculation: the same inputs give the same lines and the same hash;
 *  2. attribution sums to 100%;
 *  3. a clawback references the original line;
 *  4. the export is locked, and a late fact goes to the next period.
 * Plus: you cannot approve your own time or your own pay plan, a technician sees only their own pay, and weekly overtime.
 * Run alone: timeout 300 npx vitest run features/keystone/services/phase6.db.test.ts --no-file-parallelism
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const role = (id: string) => ROLES.find(r => r.id === id)!.permissions as Permission[]
const actorWith = (id: string, perms: readonly Permission[]): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(perms) as never })
const sessionWith = (id: string, perms: readonly Permission[]) => ({ itemId: id, listKey: 'User', data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, perms.includes(p)])) } } })
const k = (p = 'k') => uniqueKey(p)
const reason = async (p: Promise<unknown>) => {
  try { await p; return 'OK' } catch (e) { if (e instanceof DomainError) return String(e.details.reason ?? e.code); return `RAW:${e instanceof Error ? e.message : String(e)}` }
}

// Weeks: Mon 2026-10-05 .. Sun 2026-10-18 is period A; Mon 2026-10-19 .. Sun 2026-11-01 is period B.
const A = { startsOn: '2026-10-05', endsOn: '2026-10-18', payDate: '2026-10-23' }
const B = { startsOn: '2026-10-19', endsOn: '2026-11-01', payDate: '2026-11-06' }
const TERMS = { hourlyRates: { default: '2800' }, overtime: { weeklyThresholdHours: '40', multiplier: '1.5' }, commission: { basis: 'invoice_posted', rules: [{ scope: 'all', kind: 'percent_of_sold', value: '10', splitBasis: 'sold_by' }] }, spiffs: { membership: '5000' }, clawbacks: { windowDays: 90, recallPercent: '0', refund: true, chargeback: true, membershipCancel: true } }

describe.skipIf(!hasTestDatabase)('Phase 6: labour and pay (database)', () => {
  let prisma: PrismaClient
  let ctx: ReturnType<typeof getContext>
  let owner: Actor
  let payroll: Actor // runs pay
  let payApprover: Actor // approves plans and periods
  let timeApprover: Actor
  let techUser: string
  let tech: Actor
  let techEmp: string
  let sellerEmp: string
  let seq = 0

  const as = (userId: string, perms: readonly Permission[]) => async (query: string, variables?: Record<string, unknown>) => {
    const r = await ctx.withSession(sessionWith(userId, perms) as never).graphql.raw({ query, variables })
    if (r.errors?.length) throw new Error(r.errors.map(e => e.message).join('; '))
    return r.data as any
  }
  const approve = async (requestId: string, by: Actor) => {
    const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId } })
    await decideApprovalAs(prisma, by, { requestId, decision: 'approve', expectedVersion: req.version, idempotencyKey: k('dec') })
  }

  /** A sold, posted line with credit to the seller. The commission code and amounts are real rows, paid on by the real calculation. */
  const sale = async (postedAt: string, amountMinor: bigint, shares: { employeeId: string; sharePct: string }[] = [{ employeeId: sellerEmp, sharePct: '100' }]) => {
    seq += 1
    const job = await prisma.job.create({ data: { ref: `JOB-P6-${seq}-${Date.now()}`, publicCode: `J-P6${seq}${Date.now()}`, customerId: HOUSEHOLDS[0].id, locationId: HOUSEHOLDS[0].location.id, status: 'work_complete', priority: 'standard', source: 'phone' } as never })
    const wl = await prisma.workLine.create({ data: { jobId: job.id, source: 'manual', description: `Install ${seq}`, quantity: '1', uom: 'job', unitPriceMinor: amountMinor, amountMinor, taxCategory: 'labor', trade: 'general', cancellationClass: 'requested_repair', status: 'completed', snapshot: {} } as never })
    const now = new Date(`${postedAt}T15:00:00Z`)
    const d = await createInvoiceDraft(prisma, owner, { jobId: job.id, idempotencyKey: k(), now })
    const v = (await prisma.invoice.findUniqueOrThrow({ where: { id: d.invoiceId } })).version
    await postInvoice(prisma, owner, { invoiceId: d.invoiceId, expectedVersion: v, idempotencyKey: k(), now })
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: d.invoiceId } })
    const line = await prisma.invoiceLine.findFirstOrThrow({ where: { invoiceId: invoice.id } })
    await setAttribution(prisma, payroll, { workLineId: wl.id, role: 'sold_by', shares, idempotencyKey: k() })
    return { invoice, line, wl, job }
  }

  const periodWithPlan = async (dates: typeof A) => (await openPayPeriod(prisma, payroll, { ...dates, idempotencyKey: k() })).id

  beforeAll(async () => {
    prisma = testPrisma(2)
    await resetDatabase(prisma)
    const o = await prisma.user.create({ data: { name: 'owner', email: `${k('o')}@test.local`, password: 'x'.repeat(60) } })
    await loadCompanySetup(null, { idempotencyKey: k('c') }, { session: sessionWith(o.id, ALL), prisma })
    await loadOperationsSetup(null, { idempotencyKey: k('op') }, { session: sessionWith(o.id, ALL), prisma })
    owner = actorWith(o.id, ALL)
    const mk = async (name: string, roleId: string) => (await prisma.user.create({ data: { name, email: `${k(name)}@test.local`, password: 'x'.repeat(60), roleId } })).id
    payroll = actorWith(await mk('Payroll Pat', 'seed_role_payroll'), role('seed_role_payroll'))
    payApprover = actorWith(await mk('Approver Alex', 'seed_role_owner'), role('seed_role_owner'))
    timeApprover = actorWith(await mk('Manager Mo', 'seed_role_payroll'), role('seed_role_payroll'))
    techUser = await mk('Tech Tess', 'seed_role_technician')
    tech = actorWith(techUser, role('seed_role_technician'))
    const emp = (n: number, userId: string | null, name: string) => prisma.employee.create({ data: { userId, employeeNumber: `P6-${n}-${Date.now()}`, firstName: name, lastName: 'T', displayName: name, kind: 'technician', status: 'active' } as never })
    techEmp = (await emp(1, techUser, 'Tech Tess')).id
    sellerEmp = (await emp(2, null, 'Seller Sam')).id
    const created = await createPayPlan(prisma, payroll, { name: 'Field plan', terms: TERMS, idempotencyKey: k() })
    const req = await requestPayPlanPublish(prisma, payroll, { versionId: created.versionId, idempotencyKey: k() })
    // You cannot approve your own pay plan.
    await expect(decideApprovalAs(prisma, payroll, { requestId: req.requestId, decision: 'approve', expectedVersion: 0, idempotencyKey: k() })).rejects.toThrow()
    await approve(req.requestId, payApprover)
    await publishPayPlanVersion(prisma, payroll, { versionId: created.versionId, requestId: req.requestId, idempotencyKey: k() })
    for (const e of [techEmp, sellerEmp]) await assignPayPlan(prisma, payroll, { employeeId: e, planVersionId: created.versionId, from: '2026-01-05', idempotencyKey: k() })
    ctx = getContext({ ...config, db: { ...config.db, url: process.env.HS_TEST_DATABASE_URL! } } as never, PrismaModule) as never
  }, 900_000)

  afterAll(async () => { await (ctx as unknown as { prisma?: PrismaClient })?.prisma?.$disconnect(); await prisma?.$disconnect() })

  /** A day of approved hours for the technician, entered by hand and approved by someone else. */
  const day = async (date: string, startHour: number, hours: number) => {
    const s = await proposeTimesheet(prisma, tech, { workDate: date, idempotencyKey: k() })
    const from = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`)
    await addSegment(prisma, tech, { timesheetId: s.id, kind: 'shop', startsAt: from.toISOString(), endsAt: new Date(from.getTime() + hours * 3_600_000).toISOString(), idempotencyKey: k() })
    const sheet = await prisma.timesheet.findUniqueOrThrow({ where: { id: s.id } })
    await submitTimesheet(prisma, tech, { timesheetId: s.id, expectedVersion: sheet.version, idempotencyKey: k() })
    const sub = await prisma.timesheet.findUniqueOrThrow({ where: { id: s.id } })
    await approveTimesheet(prisma, timeApprover, { timesheetId: s.id, expectedVersion: sub.version, idempotencyKey: k() })
    return s.id
  }

  // ── Timesheets: separation of duties ──────────────────────────────────────────────────────────────────────────────

  it('nobody approves their own time, and only an approver can approve', { timeout: 120_000 }, async () => {
    const date = '2026-09-28'
    const s = await proposeTimesheet(prisma, tech, { workDate: date, idempotencyKey: k() })
    const from = new Date(`${date}T14:00:00Z`)
    await addSegment(prisma, tech, { timesheetId: s.id, kind: 'shop', startsAt: from.toISOString(), endsAt: new Date(from.getTime() + 3_600_000).toISOString(), idempotencyKey: k() })
    const v = (await prisma.timesheet.findUniqueOrThrow({ where: { id: s.id } })).version
    await submitTimesheet(prisma, tech, { timesheetId: s.id, expectedVersion: v, idempotencyKey: k() })
    const v2 = (await prisma.timesheet.findUniqueOrThrow({ where: { id: s.id } })).version
    // The technician is not an approver at all; and a technician who also held the permission still could not approve their own day.
    expect(await reason(approveTimesheet(prisma, tech, { timesheetId: s.id, expectedVersion: v2, idempotencyKey: k() }))).not.toBe('OK')
    const both = actorWith(techUser, [...role('seed_role_technician'), 'canApproveTimesheets'])
    expect(await reason(approveTimesheet(prisma, both, { timesheetId: s.id, expectedVersion: v2, idempotencyKey: k() }))).toBe('separation_of_duties')
    await approveTimesheet(prisma, timeApprover, { timesheetId: s.id, expectedVersion: v2, idempotencyKey: k() })
    expect((await prisma.timesheet.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('approved')
  })

  it('a timesheet is proposed from the technician\'s own status moves, which carry their sign-in', { timeout: 60_000 }, async () => {
    const job = await prisma.visit.create({ data: { ref: `P6-EVT-${Date.now()}`, status: 'done', capacityHours: '1' } })
    await prisma.visitAssignment.create({ data: { visitId: job.id, employeeId: techEmp, role: 'lead', active: true } })
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 3, h, m))
    const moves: [string, Date][] = [['en_route', at(14)], ['on_site', at(14, 30)], ['working', at(14, 35)], ['done', at(16, 5)]]
    for (const [toStatus, occurredAt] of moves) await prisma.visitStatusEvent.create({ data: { visitId: job.id, actorUserId: techUser, fromStatus: 'x', toStatus, kind: 'transition', occurredAt, idempotencyKey: `p6evt:${job.id}:${toStatus}` } })
    const s = await proposeTimesheet(prisma, tech, { workDate: '2026-06-03', idempotencyKey: k() })
    expect(s.added).toBe(2)
    const segs = await prisma.timeSegment.findMany({ where: { timesheetId: s.id }, orderBy: { startsAt: 'asc' } })
    expect(segs.map(x => x.kind)).toEqual(['drive', 'job'])
  })

  it('overlapping entries are refused', { timeout: 60_000 }, async () => {
    const date = '2026-09-29'
    const s = await proposeTimesheet(prisma, tech, { workDate: date, idempotencyKey: k() })
    const from = new Date(`${date}T14:00:00Z`)
    await addSegment(prisma, tech, { timesheetId: s.id, kind: 'shop', startsAt: from.toISOString(), endsAt: new Date(from.getTime() + 2 * 3_600_000).toISOString(), idempotencyKey: k() })
    expect(await reason(addSegment(prisma, tech, { timesheetId: s.id, kind: 'training', startsAt: new Date(from.getTime() + 3_600_000).toISOString(), endsAt: new Date(from.getTime() + 3 * 3_600_000).toISOString(), idempotencyKey: k() }))).not.toBe('OK')
  })

  // ── Gate 2: attribution sums to 100 ───────────────────────────────────────────────────────────────────────────────

  it('GATE 2: attribution must add up to exactly 100, in the command and in the database', { timeout: 60_000 }, async () => {
    const { wl } = await sale('2026-10-06', 100_000n)
    const bad = (shares: { employeeId: string; sharePct: string }[]) => reason(setAttribution(prisma, payroll, { workLineId: wl.id, role: 'sold_by', shares, idempotencyKey: k() }))
    expect(await bad([{ employeeId: sellerEmp, sharePct: '60' }, { employeeId: techEmp, sharePct: '30' }])).toBe('INVALID_INPUT')
    expect(await bad([{ employeeId: sellerEmp, sharePct: '100.000001' }])).toBe('INVALID_INPUT')
    await setAttribution(prisma, payroll, { workLineId: wl.id, role: 'sold_by', shares: [{ employeeId: sellerEmp, sharePct: '60' }, { employeeId: techEmp, sharePct: '40' }], idempotencyKey: k() })
    const sum = await prisma.commissionAttribution.aggregate({ where: { workLineId: wl.id, role: 'sold_by' }, _sum: { sharePct: true } })
    expect(sum._sum.sharePct?.toString()).toBe('100')
    // Behind the command, the database itself refuses a split that does not add up when the transaction commits.
    await expect(prisma.commissionAttribution.create({ data: { workLineId: wl.id, role: 'sold_by', employeeId: sellerEmp, sharePct: '10' } as never })).rejects.toThrow(/add up to 100/)
    await expect(prisma.commissionAttribution.deleteMany({ where: { workLineId: wl.id, employeeId: techEmp } })).rejects.toThrow(/add up to 100/)
  })

  // ── Gate 1: deterministic recalculation ───────────────────────────────────────────────────────────────────────────

  it('GATE 1: the same inputs give the same lines and the same hash; weekly overtime past 40 hours is at 1.5x', { timeout: 300_000 }, async () => {
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) await day(d, 12, 9)
    await sale('2026-10-07', 200_001n)
    const id = await periodWithPlan(A)
    const first = await calculatePayPeriod(prisma, payroll, { payPeriodId: id, idempotencyKey: k() })
    const lines1 = await prisma.earningLine.findMany({ where: { payPeriodId: id }, orderBy: { lineKey: 'asc' } })
    const hour = lines1.filter(l => l.employeeId === techEmp && ['regular', 'overtime'].includes(l.kind))
    // The 09-28 day approved in the first test is unpaid, so it arrives here as a late fact (1 regular hour).
    expect(hour.map(l => [l.kind, l.hours?.toString(), l.amountMinor.toString()])).toEqual(expect.arrayContaining([['overtime', '5', '21000'], ['regular', '40', '112000'], ['regular', '1', '2800']]))
    expect(hour).toHaveLength(3)
    // 10% of the 200 001 cent sale, rounded half-up once = 20 000.1 -> 20 000; a second person with 100% share gets that.
    expect(lines1.filter(l => l.kind === 'commission').map(l => [l.employeeId, l.amountMinor.toString()])).toEqual(expect.arrayContaining([[sellerEmp, '20000']]))
    const again = await calculatePayPeriod(prisma, payroll, { payPeriodId: id, idempotencyKey: k() })
    const lines2 = await prisma.earningLine.findMany({ where: { payPeriodId: id }, orderBy: { lineKey: 'asc' } })
    expect(again.inputsHash).toBe(first.inputsHash)
    expect(lines2.map(l => [l.lineKey, l.kind, l.hours?.toString(), l.amountMinor.toString()])).toEqual(lines1.map(l => [l.lineKey, l.kind, l.hours?.toString(), l.amountMinor.toString()]))
    // A different fact changes the hash.
    await sale('2026-10-08', 50_000n)
    const third = await calculatePayPeriod(prisma, payroll, { payPeriodId: id, idempotencyKey: k() })
    expect(third.inputsHash).not.toBe(first.inputsHash)
    // Overtime in a week that also has commission is flagged for the regular-rate review.
    expect((await prisma.earningLine.findMany({ where: { payPeriodId: id, kind: 'overtime' } })).every(l => l.regularRateReview)).toBe(true)
  })

  // ── Gates 3 and 4: clawback references the original; export locks; late facts go to the next period ──────────────

  it('GATE 3 and 4: a refund claws back against the original line; an exported period is locked and late facts land in the next period', { timeout: 300_000 }, async () => {
    const id = (await prisma.payPeriod.findFirstOrThrow({ where: { startsOn: new Date('2026-10-05T00:00:00Z') } })).id
    await calculatePayPeriod(prisma, payroll, { payPeriodId: id, idempotencyKey: k() })
    const original = await prisma.earningLine.findFirstOrThrow({ where: { payPeriodId: id, kind: 'commission', employeeId: sellerEmp, amountMinor: 20000n } })

    // Approval: a second person, and the figures they approved are the ones locked.
    const req = await requestPayPeriodApproval(prisma, payroll, { payPeriodId: id, idempotencyKey: k() })
    expect(await reason(decideApprovalAs(prisma, payroll, { requestId: req.requestId, decision: 'approve', expectedVersion: 0, idempotencyKey: k() }))).not.toBe('OK')
    expect(await reason(exportPayPeriod(prisma, payroll, { payPeriodId: id, target: 'csv', idempotencyKey: k() }))).not.toBe('OK')
    await approve(req.requestId, payApprover)
    const p = await prisma.payPeriod.findUniqueOrThrow({ where: { id } })
    await approvePayPeriod(prisma, payroll, { payPeriodId: id, requestId: req.requestId, expectedVersion: p.version, idempotencyKey: k() })

    // Approved: its lines are fixed.
    await expect(prisma.earningLine.updateMany({ where: { payPeriodId: id }, data: { amountMinor: 1n } })).rejects.toThrow(/never changed/)
    await expect(prisma.earningLine.deleteMany({ where: { payPeriodId: id } })).rejects.toThrow(/never deleted/)
    expect(await reason(calculatePayPeriod(prisma, payroll, { payPeriodId: id, idempotencyKey: k() }))).not.toBe('OK')

    const exported = await exportPayPeriod(prisma, payroll, { payPeriodId: id, target: 'csv', idempotencyKey: k() })
    const gusto = await exportPayPeriod(prisma, payroll, { payPeriodId: id, target: 'gusto', idempotencyKey: k() })
    expect(exported.sha256).toHaveLength(64)
    expect(gusto.sha256).not.toBe(exported.sha256)
    expect((await prisma.payPeriod.findUniqueOrThrow({ where: { id } })).status).toBe('exported')
    expect((await prisma.timesheet.findMany({ where: { workDate: { gte: new Date('2026-10-05T00:00:00Z'), lte: new Date('2026-10-09T00:00:00Z') } } })).every(t => t.status === 'locked')).toBe(true)
    const lockedSheet = await prisma.timesheet.findFirstOrThrow({ where: { status: 'locked' } })
    // A locked day takes no change, in the command or behind it.
    expect(await reason(adjustTimesheet(prisma, timeApprover, { timesheetId: lockedSheet.id, kind: 'shop', startsAt: '2026-10-05T01:00:00Z', endsAt: '2026-10-05T02:00:00Z', reason: 'missed', idempotencyKey: k() }))).not.toBe('OK')
    await expect(prisma.timesheet.update({ where: { id: lockedSheet.id }, data: { totalHours: '7' } })).rejects.toThrow(/locked/)
    expect(await reason(reopenPayPeriod(prisma, payroll, { payPeriodId: id, reason: 'x', expectedVersion: 99, idempotencyKey: k() }))).not.toBe('OK')
    await expect(prisma.payPeriod.update({ where: { id }, data: { status: 'review' } })).rejects.toThrow(/does not reopen/)
    expect(await reason(addPayAdjustment(prisma, payroll, { payPeriodId: id, employeeId: techEmp, amountMinor: '100', reason: 'late', idempotencyKey: k() }))).not.toBe('OK')
    // The stored export still matches the lines it was made from.
    const batch = await prisma.payrollExportBatch.findFirstOrThrow({ where: { payPeriodId: id, target: 'csv' } })
    await expect(prisma.payrollExportBatch.update({ where: { id: batch.id }, data: { sha256: 'x' } })).rejects.toThrow(/keeps what it exported/)

    // Late facts. A refund of half the sale arrives after the lock, and an hour of missed time turns up: both go to period B.
    const orig = await prisma.invoiceLine.findFirstOrThrow({ where: { amountMinor: 200_001n }, include: { invoice: true } })
    const pay = await recordInvoicePayment(prisma, owner, { invoiceId: orig.invoiceId!, amountMinor: '200001', method: 'check', checkNumber: '1001', receivedAt: '2026-10-08T12:00:00Z', idempotencyKey: k(), now: new Date('2026-10-08T12:00:00Z') })
    const paymentId = (await prisma.paymentAllocation.findFirstOrThrow({ where: { invoiceId: orig.invoiceId! } })).paymentId
    expect(pay.replay).toBe(false)
    await requestRefund(prisma, owner, { paymentId: paymentId!, amountMinor: '50000', method: 'check', reason: 'Customer refund', reference: 'CHK-9', idempotencyKey: k(), now: new Date('2026-10-21T15:00:00Z') })
    const b = await periodWithPlan(B)
    // B cannot be worked out while A is unfinished; A is exported so it can.
    const calc = await calculatePayPeriod(prisma, payroll, { payPeriodId: b, idempotencyKey: k() })
    const claw = await prisma.earningLine.findMany({ where: { payPeriodId: b, kind: 'clawback' } })
    expect(claw).toHaveLength(1)
    expect(claw[0].reversesId).toBe(original.id)
    expect(claw[0].amountMinor < 0n).toBe(true)
    expect(claw[0].amountMinor.toString()).toBe('-5000')
    expect(claw[0].employeeId).toBe(sellerEmp)
    // Period A itself did not move.
    const aLines = await prisma.earningLine.count({ where: { payPeriodId: id } })
    expect(aLines).toBeGreaterThan(0)
    expect(await prisma.earningLine.count({ where: { payPeriodId: id, kind: 'clawback' } })).toBe(0)
    // And calculating B again does not take the clawback twice or touch A.
    const again = await calculatePayPeriod(prisma, payroll, { payPeriodId: b, idempotencyKey: k() })
    expect(again.inputsHash).toBe(calc.inputsHash)
    expect(await prisma.earningLine.count({ where: { kind: 'clawback' } })).toBe(1)
  })

  it('a technician sees their own approved pay and time, and nothing of anyone else', { timeout: 120_000 }, async () => {
    const q = as(techUser, role('seed_role_technician'))
    const mine = await q(`{ earningLines { id kind amountMinor employee { displayName } payPeriod { status } } }`)
    expect(mine.earningLines.length).toBeGreaterThan(0)
    expect(mine.earningLines.every((l: any) => l.employee.displayName === 'Tech Tess' && ['approved', 'exported', 'closed'].includes(l.payPeriod.status))).toBe(true)
    expect((await q(`{ timesheets { employee { displayName } } }`)).timesheets.every((t: any) => t.employee.displayName === 'Tech Tess')).toBe(true)
    // Pay plans, attribution and the periods' totals are not theirs.
    expect((await q(`{ payPlans { id } }`).catch(() => ({ payPlans: [] }))).payPlans).toEqual([])
    expect((await q(`{ commissionAttributions { id } }`).catch(() => ({ commissionAttributions: [] }))).commissionAttributions).toEqual([])
    expect(((await q(`{ payPeriods { inputsHash } }`).catch(() => ({ payPeriods: [] }))).payPeriods as { inputsHash: unknown }[]).every(p => p.inputsHash == null)).toBe(true)
    // A person with no pay role at all sees nothing.
    const clerk = as(await prisma.user.create({ data: { name: 'c', email: `${k('c')}@test.local`, password: 'x'.repeat(60), roleId: 'seed_role_dispatcher' } }).then(u => u.id), role('seed_role_dispatcher'))
    expect((await clerk(`{ earningLines { id } }`).catch(() => ({ earningLines: [] }))).earningLines).toEqual([])
    expect((await clerk(`{ timesheets { id } }`).catch(() => ({ timesheets: [] }))).timesheets).toEqual([])
  })

  it('deleting a person is not blocked by the pay guards, even with locked sheets and exported lines', { timeout: 60_000 }, async () => {
    // By now the technician has locked timesheets and exported earning lines; the approver approved sheets and an exported period.
    expect(await prisma.timesheet.count({ where: { employeeId: techEmp, status: 'locked' } })).toBeGreaterThan(0)
    const lines = await prisma.earningLine.count({ where: { employeeId: techEmp } })
    expect(lines).toBeGreaterThan(0)
    await prisma.employee.delete({ where: { id: techEmp } })
    // Deleting a User is refused by the older append-only audit guard once they have acted, so the pay side is proved by the update the
    // delete would cascade to: the approver and creator detached from locked sheets, segments, the exported batch and the plan assignments.
    await prisma.timesheet.updateMany({ where: { status: 'locked' }, data: { approvedById: null } })
    await prisma.payrollExportBatch.updateMany({ data: { createdById: null } })
    await prisma.timeSegment.updateMany({ data: { createdById: null } })
    await prisma.payPlanAssignment.updateMany({ data: { createdById: null } })
    await prisma.commissionAttribution.updateMany({ data: { createdById: null } })
    expect(await prisma.earningLine.count({ where: { employeeId: null } })).toBeGreaterThanOrEqual(lines)
    // The lines are still never edited.
    await expect(prisma.earningLine.updateMany({ where: { employeeId: null }, data: { amountMinor: 1n } })).rejects.toThrow()
  })
})
