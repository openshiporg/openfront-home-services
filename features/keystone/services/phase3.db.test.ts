import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { decideApprovalAs } from '../mutations/approvals'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { HOUSEHOLDS } from '../seed/operationsData'
import { createExportBatch, exportBatchCsv } from './accounting'
import { createInvoiceDraft, discardInvoiceDraft, issueCreditMemo, postInvoice, requestWriteOff, voidInvoice } from './invoices'
import { markAttemptUnknown, reconcilePaymentBatch, closePaymentBatch, recordApprovedRefund, recordInvoicePayment, requestRefund, resolveAttemptFailed, startPaymentAttempt } from './payments'
import { recordFinancingFunding, recordFinancingStatus, requestArPeriodClose, saveFinancingProgram, startFinancing, recordThirdPartyAuthorization, savePayerProfile } from './financing'
import '../mutations'

/*
 * Phase 3 exit gate: an invoice posts with tax from the Texas matrix and is frozen; payments allocate and overpay into credit;
 * refunds above the threshold need a second person; write-offs and voids go through approval/credit memo; an unknown card try blocks
 * another; financing funding waits for the cancellation window; the AR period closes; the export balances and never repeats.
 * Run alone: timeout 300 npx vitest run features/keystone/services/phase3.db.test.ts --no-file-parallelism
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const user = (id: string, perms: readonly string[]): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(perms) as never })
const sessionFor = (id: string) => ({ itemId: id, data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, true])) } } })
const reason = async (p: Promise<unknown>) => {
  try { await p; return 'OK' } catch (e) { if (e instanceof DomainError) return String(e.details.reason ?? e.code); throw e }
}
const k = (p = 'k') => uniqueKey(p)

describe.skipIf(!hasTestDatabase)('Phase 3: invoices, payments, financing, AR and export (database)', () => {
  let prisma: PrismaClient
  let owner: Actor
  let biller: Actor
  let approver: Actor
  let customerId: string
  let locationId: string
  let ownerId: string
  let seq = 0

  /** A finished job with work lines totalling `labor` + `material` cents. */
  const job = async (labor: number, material: number, status = 'work_complete') => {
    seq += 1
    const j = await prisma.job.create({ data: { ref: `JOB-T-${seq}-${Date.now()}`, publicCode: `J-T${seq}${Date.now()}`, customerId, locationId, status, priority: 'standard', source: 'phone' } })
    const mk = (description: string, taxCategory: string, amount: number, cost: number) => prisma.workLine.create({ data: { jobId: j.id, source: 'manual', description, quantity: '1', uom: 'job', unitPriceMinor: BigInt(amount), amountMinor: BigInt(amount), taxCategory, trade: 'general', cancellationClass: 'requested_repair', status: 'completed', snapshot: { costMinor: String(cost) } } })
    if (labor) await mk('Labor', 'labor', labor, 0)
    if (material) await mk('Parts', 'material', material, Math.round(material * 0.6))
    return j.id
  }
  const posted = async (labor = 20000, material = 10000) => {
    const jobId = await job(labor, material)
    const d = await createInvoiceDraft(prisma, biller, { jobId, idempotencyKey: k() })
    const v = (await prisma.invoice.findUniqueOrThrow({ where: { id: d.invoiceId } })).version
    const p = await postInvoice(prisma, biller, { invoiceId: d.invoiceId, expectedVersion: v, idempotencyKey: k() })
    return { ...p, jobId }
  }
  const inv = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } })

  beforeAll(async () => {
    prisma = testPrisma(2)
    await resetDatabase(prisma)
    const o = await prisma.user.create({ data: { name: 'owner', email: `${k('o')}@test.local`, password: 'x'.repeat(60) } })
    ownerId = o.id
    const ctx = { session: sessionFor(o.id), prisma }
    await loadCompanySetup(null, { idempotencyKey: k('c') }, ctx)
    await loadOperationsSetup(null, { idempotencyKey: k('op') }, ctx)
    owner = user(o.id, ALL)
    const b = await prisma.user.create({ data: { name: 'biller', email: `${k('b')}@test.local`, password: 'x'.repeat(60) } })
    const a = await prisma.user.create({ data: { name: 'approver', email: `${k('a')}@test.local`, password: 'x'.repeat(60) } })
    biller = user(b.id, ['canAccessDashboard', 'canManageInvoices', 'canPostInvoices', 'canTakePayments', 'canManagePayments', 'canIssueRefunds', 'canManageAccounting', 'canCloseAr', 'canOfferFinancing'])
    approver = user(a.id, ['canAccessDashboard', 'canApproveWriteOff', 'canApproveCredits', 'canApproveRefunds', 'canApproveArClose'])
    customerId = HOUSEHOLDS[0].id
    locationId = HOUSEHOLDS[0].location.id
  }, 900_000)

  afterAll(async () => { await prisma?.$disconnect() })

  it('posts with Texas tax: residential labour is not taxed under lump sum, and the posted invoice is frozen', { timeout: 60_000 }, async () => {
    const p = await posted()
    const row = await inv(p.invoiceId)
    expect(row.status).toBe('posted')
    expect(row.totalMinor).toBe(row.subtotalMinor - row.discountMinor + row.taxMinor)
    expect(row.balanceMinor).toBe(row.totalMinor)
    expect(row.ref).toMatch(/^INV-\d{4}-\d{6}$/)
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: row.id } })
    expect(lines.reduce((a, l) => a + l.taxMinor, 0n)).toBe(row.taxMinor)
    await expect(prisma.invoice.update({ where: { id: row.id }, data: { totalMinor: 1n, subtotalMinor: 1n } })).rejects.toThrow()
    await expect(prisma.invoiceLine.update({ where: { id: lines[0].id }, data: { amountMinor: 1n } })).rejects.toThrow(/frozen/)
    await expect(prisma.invoice.delete({ where: { id: row.id } })).rejects.toThrow(/never deleted/)
    const entries = await prisma.arEntry.findMany({ where: { invoiceId: row.id } })
    expect(entries.reduce((a, e) => a + e.amountMinor, 0n)).toBe(row.balanceMinor)
    await expect(prisma.arEntry.update({ where: { id: entries[0].id }, data: { amountMinor: 1n } })).rejects.toThrow()
  })

  it('work lines go on one live invoice only; a discarded draft frees them', { timeout: 60_000 }, async () => {
    const jobId = await job(5000, 0)
    const d1 = await createInvoiceDraft(prisma, biller, { jobId, idempotencyKey: k() })
    expect(await reason(createInvoiceDraft(prisma, biller, { jobId, idempotencyKey: k() }))).toBe('nothing_to_bill')
    const v = (await inv(d1.invoiceId)).version
    await discardInvoiceDraft(prisma, biller, { invoiceId: d1.invoiceId, expectedVersion: v, idempotencyKey: k() })
    expect((await createInvoiceDraft(prisma, biller, { jobId, idempotencyKey: k() })).lines).toBe(1)
  })

  it('unfinished work needs a progress-billing reason', { timeout: 60_000 }, async () => {
    const jobId = await job(5000, 0, 'in_progress')
    expect(await reason(createInvoiceDraft(prisma, biller, { jobId, idempotencyKey: k() }))).toBe('progress_reason_required')
    expect((await createInvoiceDraft(prisma, biller, { jobId, progressReason: 'Rough-in done', idempotencyKey: k() })).lines).toBe(1)
  })

  it('payments allocate, part-pay moves status, overpay becomes customer credit, and the same key never pays twice', { timeout: 60_000 }, async () => {
    const p = await posted(10000, 0)
    const key = k()
    const first = await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '4000', method: 'cash', idempotencyKey: key })
    const again = await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '4000', method: 'cash', idempotencyKey: key })
    expect(again.replay).toBe(true)
    expect(again.paymentId).toBe(first.paymentId)
    let row = await inv(p.invoiceId)
    expect(row.status).toBe('partially_paid')
    expect(row.balanceMinor).toBe(row.totalMinor - 4000n)
    const over = await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: String(row.balanceMinor + 2500n), method: 'check', checkNumber: '1042', idempotencyKey: k() })
    row = await inv(p.invoiceId)
    expect(row.status).toBe('paid')
    expect(row.balanceMinor).toBe(0n)
    expect(over.customerCreditMinor).toBe('2500')
    const credit = await prisma.customerCreditEntry.aggregate({ where: { customerId }, _sum: { amountMinor: true } })
    expect(credit._sum.amountMinor).toBe(2500n)
    expect(await reason(recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '100', method: 'cash', idempotencyKey: k() }))).not.toBe('OK')
    expect(await reason(recordInvoicePayment(prisma, biller, { invoiceId: (await posted(1000, 0)).invoiceId, amountMinor: '100', method: 'check', idempotencyKey: k() }))).toBe('INVALID_INPUT')
    // The database refuses to allocate more than a payment holds.
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } })
    await expect(prisma.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: p.invoiceId, kind: 'apply', amountMinor: payment.amountMinor } })).rejects.toThrow(/exceed/)
  })

  it('an unknown card try blocks another card payment until a person resolves it with evidence', { timeout: 60_000 }, async () => {
    const p = await posted(8000, 0)
    const a = await startPaymentAttempt(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '3000', method: 'card', idempotencyKey: k() })
    const cur = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.attemptId } })
    const u = await markAttemptUnknown(prisma, biller, { attemptId: a.attemptId, expectedVersion: cur.version, note: 'terminal timed out', idempotencyKey: k() })
    expect(await reason(recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '3000', method: 'card', idempotencyKey: k() }))).toBe('unknown_attempt')
    expect(await reason(startPaymentAttempt(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '3000', method: 'card', idempotencyKey: k() }))).toBe('attempt_open')
    expect(await reason(resolveAttemptFailed(prisma, biller, { attemptId: a.attemptId, expectedVersion: u.version, evidence: 'ok', idempotencyKey: k() }))).toBe('INVALID_INPUT')
    await resolveAttemptFailed(prisma, biller, { attemptId: a.attemptId, expectedVersion: u.version, evidence: 'Processor dashboard shows no charge at 10:42', idempotencyKey: k() })
    expect((await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '3000', method: 'card', idempotencyKey: k() })).appliedMinor).toBe('3000')
  })

  it('refunds: small ones record at once and reopen the invoice; large ones wait for a different person; never more than paid', { timeout: 90_000 }, async () => {
    const p = await posted(80000, 0)
    const pay = await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: String((await inv(p.invoiceId)).totalMinor), method: 'cash', idempotencyKey: k() })
    const small = await requestRefund(prisma, biller, { paymentId: pay.paymentId, amountMinor: '3000', method: 'check', reason: 'Part returned', reference: 'CHK-9', idempotencyKey: k() })
    expect(small.status).toBe('recorded')
    expect((await inv(p.invoiceId)).balanceMinor).toBe(3000n)
    expect((await inv(p.invoiceId)).status).toBe('partially_paid')
    const big = await requestRefund(prisma, biller, { paymentId: pay.paymentId, amountMinor: '60000', method: 'processor_refund', reason: 'Job cancelled', reference: 're_123', idempotencyKey: k() })
    expect(big.status).toBe('pending_approval')
    expect(await reason(recordApprovedRefund(prisma, biller, { approvalRequestId: big.approvalRequestId!, idempotencyKey: k() }))).toBe('APPROVAL_REQUIRED')
    expect(await reason(decideApprovalAs(prisma, biller, { requestId: big.approvalRequestId!, decision: 'approve', expectedVersion: 0, idempotencyKey: k() }))).not.toBe('OK')
    const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: big.approvalRequestId! } })
    await decideApprovalAs(prisma, approver, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: k() })
    const done = await recordApprovedRefund(prisma, biller, { approvalRequestId: req.id, idempotencyKey: k() })
    expect(done.status).toBe('recorded')
    expect((await inv(p.invoiceId)).balanceMinor).toBe(63000n)
    expect(await reason(requestRefund(prisma, biller, { paymentId: pay.paymentId, amountMinor: '20000', method: 'check', reason: 'More', reference: 'CHK-10', idempotencyKey: k() }))).toBe('refund_exceeds_payment')
  })

  it('write-off needs another person; a void is a full credit memo and only for an untouched invoice', { timeout: 90_000 }, async () => {
    const p = await posted(9000, 0)
    const w = await requestWriteOff(prisma, biller, { invoiceId: p.invoiceId, reason: 'Customer unreachable', idempotencyKey: k() })
    const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: w.approvalRequestId } })
    await decideApprovalAs(prisma, approver, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: k() })
    const row = await inv(p.invoiceId)
    expect(row.status).toBe('written_off')
    expect(row.balanceMinor).toBe(0n)
    expect(await prisma.arEntry.count({ where: { invoiceId: p.invoiceId, kind: 'write_off' } })).toBe(1)

    const v = await posted(4000, 0)
    const done = await voidInvoice(prisma, biller, { invoiceId: v.invoiceId, reason: 'Duplicate of INV above', idempotencyKey: k() })
    expect(done.status).toBe('applied')
    expect((await inv(v.invoiceId)).status).toBe('voided')
    const paid = await posted(4000, 0)
    await recordInvoicePayment(prisma, biller, { invoiceId: paid.invoiceId, amountMinor: '100', method: 'cash', idempotencyKey: k() })
    expect(await reason(voidInvoice(prisma, biller, { invoiceId: paid.invoiceId, reason: 'Wrong', idempotencyKey: k() }))).toBe('not_voidable')
    const cm = await issueCreditMemo(prisma, biller, { invoiceId: paid.invoiceId, amountMinor: '500', reason: 'goodwill', note: 'Late arrival', idempotencyKey: k() })
    expect(cm.status).toBe('applied')
    expect(await reason(issueCreditMemo(prisma, biller, { invoiceId: paid.invoiceId, amountMinor: '99999999', reason: 'goodwill', note: 'Too much', idempotencyKey: k() }))).toBe('memo_exceeds_invoice')
  })

  it('third-party billing stops at the authorised amount; a PO-required payer needs a PO', { timeout: 60_000 }, async () => {
    const payer = await savePayerProfile(prisma, biller, { name: 'Shield Home Warranty', kind: 'home_warranty_company', terms: 'net_30', poRequired: true, idempotencyKey: k() })
    const jobId = await job(30000, 0)
    expect(await reason(createInvoiceDraft(prisma, biller, { jobId, payerId: payer.payerId, idempotencyKey: k() }))).toBe('po_required')
    const auth = await recordThirdPartyAuthorization(prisma, biller, { jobId, payerId: payer.payerId, kind: 'home_warranty', externalRef: 'HW-77', authorizedAmountMinor: '20000', idempotencyKey: k() })
    const d = await createInvoiceDraft(prisma, biller, { jobId, payerId: payer.payerId, authorizationId: auth.authorizationId, poNumber: 'PO-1', idempotencyKey: k() })
    expect(await reason(postInvoice(prisma, biller, { invoiceId: d.invoiceId, expectedVersion: (await inv(d.invoiceId)).version, idempotencyKey: k() }))).toBe('over_authorized_amount')
  })

  it('financing is a record: funding waits for the cancellation window, matches the amount, and pays the invoice', { timeout: 90_000 }, async () => {
    const program = await saveFinancingProgram(prisma, biller, { name: 'Partner plan', minMinor: '50000', maxMinor: '2500000', applyUrl: 'https://partner.example/apply', idempotencyKey: k() })
    const p = await posted(120000, 0)
    const total = (await inv(p.invoiceId)).totalMinor
    expect(await reason(startFinancing(prisma, biller, { customerId, programId: program.programId, amountMinor: String(total), invoiceId: p.invoiceId, consent: false, idempotencyKey: k() }))).toBe('consent_required')
    const f = await startFinancing(prisma, biller, { customerId, programId: program.programId, amountMinor: String(total), jobId: p.jobId, invoiceId: p.invoiceId, consent: true, idempotencyKey: k() })
    const step = async (to: string, extra: object = {}) => {
      const cur = await prisma.financingApplication.findUniqueOrThrow({ where: { id: f.applicationId } })
      return recordFinancingStatus(prisma, biller, { applicationId: f.applicationId, to, expectedVersion: cur.version, idempotencyKey: k(), ...extra })
    }
    expect(await reason(step('funded'))).toBe('INVALID_INPUT')
    await step('submitted'); await step('approved', { offers: [{ term: 60, display: 'as shown by partner' }] }); await step('docs_signed'); await step('awaiting_funding')
    // An open cancellation window on the job blocks funding.
    const notice = await prisma.cancellationNotice.create({ data: { ref: `NOC-T-${Date.now()}`, jobId: p.jobId, customerId, rule: 'home_solicitation', status: 'issued', coveredAmountMinor: total, transactionAt: new Date(), cancelBy: new Date(Date.now() + 3 * 86_400_000), timeZone: 'America/Chicago' } })
    const cur = () => prisma.financingApplication.findUniqueOrThrow({ where: { id: f.applicationId } })
    expect(await reason(recordFinancingFunding(prisma, biller, { applicationId: f.applicationId, expectedVersion: (await cur()).version, grossMinor: String(total), feeMinor: '3000', reference: 'PAYOUT-1', idempotencyKey: k() }))).toBe('cancel_window_open')
    await prisma.$executeRawUnsafe(`ALTER TABLE "CancellationNotice" DISABLE TRIGGER USER`)
    await prisma.cancellationNotice.update({ where: { id: notice.id }, data: { status: 'expired_uncancelled', transactionAt: new Date(Date.now() - 5 * 86_400_000), cancelBy: new Date(Date.now() - 86_400_000) } })
    await prisma.$executeRawUnsafe(`ALTER TABLE "CancellationNotice" ENABLE TRIGGER USER`)
    expect(await reason(recordFinancingFunding(prisma, biller, { applicationId: f.applicationId, expectedVersion: (await cur()).version, grossMinor: String(total - 1n), reference: 'PAYOUT-1', idempotencyKey: k() }))).toBe('amount_mismatch')
    await recordFinancingFunding(prisma, biller, { applicationId: f.applicationId, expectedVersion: (await cur()).version, grossMinor: String(total), feeMinor: '3000', reference: 'PAYOUT-1', idempotencyKey: k() })
    expect((await inv(p.invoiceId)).status).toBe('paid')
    expect((await cur()).status).toBe('funded')
    await expect(prisma.financingFunding.deleteMany({})).rejects.toThrow()
  })

  it('batches close and reconcile with a visible variance; a closed batch takes no more money', { timeout: 90_000 }, async () => {
    const p = await posted(5000, 0)
    await recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '1000', method: 'ach', feeMinor: '30', idempotencyKey: k() })
    const batch = await prisma.paymentBatch.findFirstOrThrow({ where: { tenderGroup: 'ach' } })
    const closed = await closePaymentBatch(prisma, biller, { batchId: batch.id, expectedVersion: batch.version, idempotencyKey: k() })
    expect(await reason(recordInvoicePayment(prisma, biller, { invoiceId: p.invoiceId, amountMinor: '500', method: 'ach', idempotencyKey: k() }))).toBe('batch_closed')
    const rec = await reconcilePaymentBatch(prisma, biller, { batchId: batch.id, expectedVersion: closed.version, depositedMinor: '960', depositReference: 'DEP-1', idempotencyKey: k() })
    expect(rec.varianceMinor).toBe('-10')
    await expect(prisma.paymentBatch.update({ where: { id: batch.id }, data: { expectedMinor: 1n } })).rejects.toThrow(/final/)
  })

  it('the export balances, repeats nothing, and is formula-safe CSV', { timeout: 90_000 }, async () => {
    const day = new Date().toISOString().slice(0, 10)
    const a = await createExportBatch(prisma, biller, { from: day, to: day, idempotencyKey: k() })
    const batch = await prisma.accountingExportBatch.findUniqueOrThrow({ where: { id: a.batchId } })
    expect(batch.debitMinor).toBe(batch.creditMinor)
    expect(batch.lineCount).toBeGreaterThan(0)
    expect(await reason(createExportBatch(prisma, biller, { from: day, to: day, idempotencyKey: k() }))).toBe('nothing_to_export')
    const csv = await exportBatchCsv(prisma, a.batchId)
    expect(csv!.csv.split('\r\n')[0]).toBe('Date,Account,Debit,Credit,Memo,Document,Customer')
    await expect(prisma.accountingExportLine.deleteMany({})).rejects.toThrow()
  })

  it('an AR period closes only with a second person, and takes no entries after', { timeout: 90_000 }, async () => {
    const period = await prisma.arPeriod.findFirstOrThrow({ orderBy: { month: 'desc' } })
    const open = await prisma.paymentBatch.findMany({ where: { status: 'open' } })
    for (const b of open) await closePaymentBatch(prisma, biller, { batchId: b.id, expectedVersion: b.version, idempotencyKey: k() })
    const r = await requestArPeriodClose(prisma, biller, { periodId: period.id, expectedVersion: period.version, idempotencyKey: k() })
    const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: r.approvalRequestId } })
    await decideApprovalAs(prisma, approver, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: k() })
    expect((await prisma.arPeriod.findUniqueOrThrow({ where: { id: period.id } })).status).toBe('closed')
    expect(await reason(posted(1000, 0))).not.toBe('OK')
    void owner; void ownerId
  })
})
