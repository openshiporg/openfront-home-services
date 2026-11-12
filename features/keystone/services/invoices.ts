import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, can, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { auditCreate, casUpdate } from '../lib/cas'
import { command } from '../lib/command'
import { addDays, localDate } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { allocateMinor } from '../lib/money'
import { nextReference, publicCode } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { estimateSalesTax, PricingError, type SalesTaxRulesLike } from '../domain/pricing'
import { resolvePolicyFromDb } from '../domain/policy'
import { placeOfLocation } from './salesShared'
import { activeVersionFor, quoteFromVersion } from './pricebook'
import { arPeriodFor, asDate, companyToday, dayOf, lockInvoice, money, postArEntry, settleInvoice, TERMS_DAYS, type InvoiceRow } from './billingShared'

/*
 * Invoices and credit memos (SM§7, I-M1, I-M2, I-M3, I-M7, I-M8). A draft is built from the job's work lines (their frozen
 * estimate prices) plus price-book items at the active version; posting runs the tax matrix once and freezes every line.
 */

const BILL: Permission[] = ['canManageInvoices', 'canPostInvoices']
const REVENUE_ACCOUNT: Record<string, string> = { labor: '4000', material: '4100', equipment: '4100', fee: '4300', disposal: '4300', permit_passthrough: '2300', warranty_reimbursed: '4200', membership: '4400', maintenance: '4400' }
const BILLABLE_JOB = ['work_complete', 'awaiting_inspection', 'completed', 'closed']
const mustReason = (text: string | null | undefined, field = 'reason') => {
  const v = String(text ?? '').trim()
  if (v.length < 3) throw new DomainError(Codes.INVALID_INPUT, 'Say why, in a few words.', { field })
  return v
}
const costOf = (snapshot: unknown) => {
  const raw = (snapshot as { costMinor?: string } | null)?.costMinor
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : 0n
}

async function taxContext(tx: Tx | Db, loc: { state: string; postalCode: string; city: string; timeZone: string; propertyClass: string } | null, on: Date) {
  if (!loc) throw new DomainError(Codes.GUARD_FAILED, 'The job has no service address; sales tax depends on it.', { reason: 'no_location' })
  const place = placeOfLocation(loc)
  const policy = await resolvePolicyFromDb<SalesTaxRulesLike>(tx, 'sales_tax', place, localDate({ timeZone: loc.timeZone }, on))
  const company = await tx.companySettings.findFirst({ select: { features: true } })
  const mode = (company?.features as { contractTaxMode?: string } | null)?.contractTaxMode === 'separated' ? 'separated' : 'lump_sum'
  return { propertyClass: loc.propertyClass, contractTaxMode: mode as 'lump_sum' | 'separated', cityCode: place.city, rules: policy.rules }
}

export type CreateInvoiceArgs = {
  jobId: string; workLineIds?: string[] | null; items?: { itemKey: string; quantity: string; description?: string | null }[] | null
  payerId?: string | null; authorizationId?: string | null; poNumber?: string | null; progressReason?: string | null; discountMinor?: string | null
  idempotencyKey: string; now?: Date
}

/** Draft an invoice for a job: frozen work-line prices, plus any price-book items, split to the payer when one is named. */
export async function createInvoiceDraft(db: Db, actor: Actor, args: CreateInvoiceArgs) {
  await authorizeOperation(db, actor, 'invoice.draft', BILL, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.draft', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true, customerId: true, locationId: true, businessUnitId: true, poNumber: true, location: { select: { id: true } } } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'Job not found.')
    if (job.status === 'cancelled') throw new DomainError(Codes.GUARD_FAILED, 'A cancelled job is not invoiced.')
    const finished = BILLABLE_JOB.includes(job.status)
    const progressReason = args.progressReason?.trim() ?? ''
    if (!finished && progressReason.length < 3) throw new DomainError(Codes.GUARD_FAILED, 'Work is not finished. Say why you are billing part of it now (progress billing).', { reason: 'progress_reason_required' })
    if (!job.customerId) throw new DomainError(Codes.GUARD_FAILED, 'The job has no customer to bill.')

    let payer = null as null | { id: string; kind: string; terms: string; poRequired: boolean }
    if (args.payerId) {
      payer = await tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true, kind: true, terms: true, poRequired: true } })
      if (!payer) throw new DomainError(Codes.NOT_FOUND, 'Payer not found.')
    }
    if (args.authorizationId) {
      const auth = await tx.thirdPartyAuthorization.findUnique({ where: { id: args.authorizationId }, select: { jobId: true, status: true } })
      if (!auth || auth.jobId !== job.id) throw new DomainError(Codes.NOT_FOUND, 'That authorization is not on this job.')
      if (auth.status !== 'authorized') throw new DomainError(Codes.GUARD_FAILED, `The authorization is ${auth.status.replace(/_/g, ' ')}, not authorized.`)
    }
    const poNumber = (args.poNumber ?? job.poNumber ?? '').trim()
    if (payer?.poRequired && !poNumber) throw new DomainError(Codes.GUARD_FAILED, `${payer.kind.replace(/_/g, ' ')} payers need a PO number on the invoice.`, { reason: 'po_required' })

    const already = await tx.invoiceLine.findMany({ where: { workLineId: { not: null }, invoice: { status: { notIn: ['discarded', 'voided'] } } }, select: { workLineId: true } })
    const taken = new Set(already.map(l => l.workLineId))
    const work = await tx.workLine.findMany({ where: { jobId: job.id, status: { in: ['planned', 'completed'] }, ...(args.workLineIds?.length ? { id: { in: args.workLineIds } } : {}) }, orderBy: { createdAt: 'asc' } })
    if (args.workLineIds?.length) for (const id of args.workLineIds) if (!work.some(w => w.id === id)) throw new DomainError(Codes.GUARD_FAILED, 'A chosen work line is not billable (removed or cancelled).', { workLineId: id })
    const open = work.filter(w => !taken.has(w.id))
    if (args.workLineIds?.length && open.length !== work.length) throw new DomainError(Codes.GUARD_FAILED, 'A chosen work line is already on another invoice.', { reason: 'already_invoiced' })

    const lines: { workLineId: string | null; description: string; quantity: string; uom: string; unitPriceMinor: bigint; amountMinor: bigint; taxCategory: string; costMinor: bigint }[] = open.map(w => ({
      workLineId: w.id, description: w.description, quantity: w.quantity.toFixed(), uom: w.uom, unitPriceMinor: w.unitPriceMinor, amountMinor: w.amountMinor, taxCategory: w.taxCategory, costMinor: costOf(w.snapshot),
    }))
    if (args.items?.length) {
      const active = await activeVersionFor(tx, job.businessUnitId)
      const quoted = await quoteFromVersion(tx, active.versionId, args.items.map(i => ({ itemKey: i.itemKey, quantity: i.quantity, description: i.description })), false)
      for (const q of quoted) lines.push({ workLineId: null, description: q.description || q.name, quantity: q.quantity, uom: q.uom, unitPriceMinor: BigInt(q.unitPriceMinor), amountMinor: q.amountMinor, taxCategory: q.taxCategory, costMinor: BigInt(q.costMinor) })
    }
    if (!lines.length) throw new DomainError(Codes.GUARD_FAILED, 'Nothing to bill: every work line is already invoiced.', { reason: 'nothing_to_bill' })

    const subtotal = lines.reduce((a, l) => a + l.amountMinor, 0n)
    const discount = args.discountMinor ? BigInt(args.discountMinor) : 0n
    if (discount < 0n || discount > subtotal) throw new DomainError(Codes.INVALID_INPUT, 'The discount is between zero and the subtotal.', { field: 'discountMinor' })
    if (discount > 0n && !can(actor, 'canApproveCredits') && !can(actor, 'canPostInvoices')) throw new DomainError(Codes.NOT_AUTHORIZED, 'Giving a discount here needs the post-invoices permission.')
    const shares = discount > 0n ? allocateMinor(discount, lines.map(l => l.amountMinor.toString())) : lines.map(() => 0n)

    const ref = await nextReference(tx, 'INV', uow.now)
    const loc = await tx.serviceLocation.findUnique({ where: { id: job.locationId ?? '' }, select: { id: true, state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } })
    const company = await tx.companySettings.findFirst({ select: { features: true } })
    const mode = (company?.features as { contractTaxMode?: string } | null)?.contractTaxMode === 'separated' ? 'separated' : 'lump_sum'
    const invoice = await tx.invoice.create({
      data: {
        ref, publicCode: publicCode('INV'), jobId: job.id, customerId: job.customerId, payerId: payer?.id ?? null, payerKind: payer?.kind ?? 'customer', locationId: loc?.id ?? null,
        propertyClass: loc?.propertyClass ?? 'residential', contractTaxMode: mode, status: 'draft', poNumber, authorizationId: args.authorizationId ?? null, progressReason,
        subtotalMinor: subtotal, discountMinor: discount, taxMinor: 0n, totalMinor: subtotal - discount, balanceMinor: 0n,
      },
      select: { id: true },
    })
    for (const [i, l] of lines.entries()) {
      await tx.invoiceLine.create({ data: { invoiceId: invoice.id, workLineId: l.workLineId, description: l.description, quantity: l.quantity, uom: l.uom, unitPriceMinor: l.unitPriceMinor, amountMinor: l.amountMinor, discountMinor: shares[i], taxCategory: l.taxCategory, costMinor: l.costMinor, revenueAccountCode: REVENUE_ACCOUNT[l.taxCategory] ?? '4000', sortOrder: i } })
    }
    auditCreate(uow, actor, 'Invoice', invoice.id, 'invoice.drafted', { ref, jobId: job.id, lines: lines.length, subtotalMinor: subtotal.toString(), progress: !finished })
    return { invoiceId: invoice.id, ref, subtotalMinor: subtotal.toString(), lines: lines.length }
  })
  return { replay: result.replay, ...result.value }
}

/** Remove a line from a draft, or add price-book items to it. Only a draft changes (I-M1). */
export async function discardInvoiceDraft(db: Db, actor: Actor, args: { invoiceId: string; expectedVersion: number; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'invoice.discard', BILL, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.discard', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockInvoice(uow.tx, args.invoiceId)
    if (row.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This invoice changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
    const version = await casUpdate(uow, { model: 'Invoice', id: row.id, version: row.version, from: ['draft'], to: 'discarded', actor, eventType: 'invoice.discarded', reason: args.reason ?? null })
    return { invoiceId: row.id, status: 'discarded', version }
  })
  return { replay: result.replay, ...result.value }
}

/** Post: tax from the matrix, frozen lines, due date by terms, open AR period, receivable entry. Nothing about the invoice changes after this. */
export async function postInvoice(db: Db, actor: Actor, args: { invoiceId: string; expectedVersion: number; invoiceDate?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'invoice.post', ['canPostInvoices'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.post', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const row = await lockInvoice(tx, args.invoiceId)
    if (row.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This invoice changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
    if (row.status !== 'draft') throw new DomainError(Codes.INVALID_TRANSITION, `Invoice ${row.ref} is ${row.status}; only a draft is posted.`)
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: row.id }, include: { lines: { orderBy: { sortOrder: 'asc' } }, payer: { select: { terms: true } } } })
    const today = await companyToday(tx, uow.now)
    const invoiceDate = args.invoiceDate ?? today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || invoiceDate > today) throw new DomainError(Codes.INVALID_INPUT, 'The invoice date is today or earlier.', { field: 'invoiceDate' })
    const period = await arPeriodFor(tx, invoiceDate)

    // The invoice total must reconcile before tax is added (I-M2).
    const sum = invoice.lines.reduce((a, l) => a + l.amountMinor, 0n)
    const disc = invoice.lines.reduce((a, l) => a + l.discountMinor, 0n)
    if (sum !== invoice.subtotalMinor || disc !== invoice.discountMinor) throw new DomainError(Codes.GUARD_FAILED, 'The invoice lines do not add up to its totals.', { reason: 'totals_do_not_reconcile' })

    const loc = invoice.locationId ? await tx.serviceLocation.findUnique({ where: { id: invoice.locationId }, select: { state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } }) : null
    let taxed: ReturnType<typeof estimateSalesTax>
    let ctx: Awaited<ReturnType<typeof taxContext>>
    try {
      ctx = await taxContext(tx, loc, uow.now)
      taxed = estimateSalesTax(invoice.lines.map(l => ({ taxCategory: l.taxCategory, netMinor: l.amountMinor - l.discountMinor, costMinor: l.costMinor })), ctx)
    } catch (error) {
      if (error instanceof PricingError) throw new DomainError(Codes.GUARD_FAILED, error.message, { reason: 'tax_unresolved' })
      throw error
    }
    // A nonresidential customer with an exemption certificate on file (SCHEMA Customer.taxExemptCertificate) pays no sales tax,
    // unless the certificate has expired by the invoice date (Document.expiresAt, read now; never cached on the customer).
    const cert = ctx.propertyClass !== 'residential' && invoice.customerId
      ? (await tx.customer.findUnique({ where: { id: invoice.customerId }, select: { taxExemptCertificate: { select: { id: true, expiresAt: true } } } }))?.taxExemptCertificate ?? null
      : null
    const certExpired = !!cert?.expiresAt && cert.expiresAt.toISOString().slice(0, 10) <= invoiceDate
    const exemptCertificateId = cert && !certExpired ? cert.id : null
    const exemptRefused = cert && certExpired ? { certificateId: cert.id, reason: 'certificate_expired', expiresAt: cert.expiresAt!.toISOString().slice(0, 10) } : null
    if (exemptCertificateId) taxed = { ...taxed, taxMinor: 0n, rows: taxed.rows.map(() => ({ taxable: false, baseMinor: 0n })) }
    // Tax per line: the total is rounded once; lines take pro-rata shares of it so they add up exactly.
    const baseWeights = taxed.rows.map(r => r.baseMinor.toString())
    const shares = taxed.taxMinor > 0n && taxed.rows.some(r => r.baseMinor > 0n) ? allocateMinor(taxed.taxMinor, baseWeights) : taxed.rows.map(() => 0n)
    for (const [i, l] of invoice.lines.entries()) {
      await tx.invoiceLine.update({ where: { id: l.id }, data: { taxable: taxed.rows[i].taxable, taxBaseMinor: taxed.rows[i].baseMinor, taxRate: taxed.rate, taxMinor: shares[i], taxJurisdictions: { state: ctx.rules.stateRate, localRateCode: taxed.localRateCode } as never } })
    }
    const total = invoice.subtotalMinor - invoice.discountMinor + taxed.taxMinor

    if (invoice.authorizationId) {
      const auth = await tx.thirdPartyAuthorization.findUniqueOrThrow({ where: { id: invoice.authorizationId }, select: { authorizedAmountMinor: true, status: true } })
      if (auth.status !== 'authorized') throw new DomainError(Codes.GUARD_FAILED, `The third-party authorization is ${auth.status.replace(/_/g, ' ')}.`, { reason: 'authorization_not_active' })
      const billed = await tx.invoice.aggregate({ where: { authorizationId: invoice.authorizationId, status: { in: ['posted', 'partially_paid', 'paid', 'written_off'] } }, _sum: { totalMinor: true } })
      if ((billed._sum.totalMinor ?? 0n) + total > auth.authorizedAmountMinor) throw new DomainError(Codes.GUARD_FAILED, `That would bill ${money((billed._sum.totalMinor ?? 0n) + total)}; the payer authorized ${money(auth.authorizedAmountMinor)}.`, { reason: 'over_authorized_amount' })
    }

    const terms = TERMS_DAYS[invoice.payer?.terms ?? 'due_on_receipt'] ?? 0
    const dueDate = addDays(invoiceDate, terms)
    const taxResult = { rate: taxed.rate, localRateCode: taxed.localRateCode, propertyClass: ctx.propertyClass, contractTaxMode: ctx.contractTaxMode, taxMinor: taxed.taxMinor.toString(), exemptCertificateId, ...(exemptRefused ? { exemptRefused } : {}) }
    const snapshot = { ref: invoice.ref, lines: invoice.lines.map((l, i) => ({ id: l.id, description: l.description, quantity: l.quantity.toFixed(), uom: l.uom, unitPriceMinor: l.unitPriceMinor.toString(), amountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString(), taxMinor: shares[i].toString() })) }
    const posted = await tx.invoice.updateMany({
      where: { id: row.id, version: row.version, status: 'draft' },
      data: { status: 'posted', version: { increment: 1 }, invoiceDate: asDate(invoiceDate), dueDate: asDate(dueDate), arPeriodId: period.id, propertyClass: ctx.propertyClass, contractTaxMode: ctx.contractTaxMode, taxResult: taxResult as never, snapshot: snapshot as never, taxMinor: taxed.taxMinor, totalMinor: total, balanceMinor: total, postedAt: uow.now, postedById: actorUserId(actor) },
    })
    if (posted.count !== 1) throw new DomainError(Codes.STALE_STATE, 'Invoice changed while posting. Reload and try again.')
    if (total > 0n) await postArEntry(uow, { invoice: row, kind: 'invoice_posted', amountMinor: total, sourceType: 'Invoice', sourceId: row.id })
    else await tx.invoice.update({ where: { id: row.id }, data: { status: 'paid' } })
    uow.audit({ eventType: 'invoice.posted', entityType: 'Invoice', entityId: row.id, actorUserId: actorUserId(actor), after: { ref: invoice.ref, totalMinor: total.toString(), taxMinor: taxed.taxMinor.toString(), invoiceDate, dueDate } })
    return { invoiceId: row.id, ref: invoice.ref, totalMinor: total.toString(), taxMinor: taxed.taxMinor.toString(), dueDate }
  })
  return { replay: result.replay, ...result.value }
}

/** Add a collections status (a label for the office; nothing is sent). */
export async function setCollectionsStatus(db: Db, actor: Actor, args: { invoiceId: string; status: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'invoice.collections', ['canManageInvoices', 'canManageAccounting'], args)
  const allowed = ['current', 'reminder_1', 'reminder_2', 'final_notice', 'collections_agency', 'lien_track', 'resolved']
  if (!allowed.includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, `Status is one of ${allowed.join(', ')}.`, { field: 'status' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.collections', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await lockInvoice(uow.tx, args.invoiceId)
    if (!['posted', 'partially_paid'].includes(row.status)) throw new DomainError(Codes.GUARD_FAILED, 'Only an open invoice has a collections status.')
    await uow.tx.invoice.update({ where: { id: row.id }, data: { collectionsStatus: args.status } })
    auditCreate(uow, actor, 'Invoice', row.id, 'invoice.collections_status', { status: args.status })
    return { invoiceId: row.id, collectionsStatus: args.status }
  })
  return { replay: result.replay, ...result.value }
}

// ── Credit memos ───────────────────────────────────────────────────────────────

const MEMO_REASONS = ['pricing_error', 'goodwill', 'cancellation_right', 'warranty', 'recall', 'duplicate', 'other']

async function postedMemoTotal(tx: Tx, invoiceId: string) {
  const sum = await tx.creditMemo.aggregate({ where: { invoiceId, status: { in: ['posted', 'applied'] } }, _sum: { totalMinor: true } })
  return sum._sum.totalMinor ?? 0n
}

/** Post a memo that is already approved (or small enough not to need it): reduces the balance or issues customer credit. */
async function postMemo(uow: UnitOfWork, actor: Actor, memoId: string, voidInvoice: boolean) {
  const { tx } = uow
  const memo = await tx.creditMemo.findUniqueOrThrow({ where: { id: memoId } })
  const invoice = await lockInvoice(tx, memo.invoiceId!)
  if (!['posted', 'partially_paid', 'paid'].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no credit memo.`)
  if ((await postedMemoTotal(tx, invoice.id)) + memo.totalMinor > invoice.totalMinor) throw new DomainError(Codes.GUARD_FAILED, 'Credit memos cannot add up to more than the invoice.', { reason: 'memo_exceeds_invoice' })
  let appliedInvoice = 0n
  let appliedCredit = 0n
  if (memo.appliesTo === 'customer_credit') {
    if (voidInvoice) throw new DomainError(Codes.INVALID_INPUT, 'A void reduces the balance; it does not issue credit.')
    if (!invoice.customerId) throw new DomainError(Codes.GUARD_FAILED, 'The invoice has no customer to credit.')
    await tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: 'issued', amountMinor: memo.totalMinor, sourceType: 'CreditMemo', sourceId: memo.id } })
    appliedCredit = memo.totalMinor
  } else {
    if (memo.totalMinor > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `The memo is ${money(memo.totalMinor)} but only ${money(invoice.balanceMinor)} is owed. Issue it as customer credit, or refund the payment.`, { reason: 'memo_exceeds_balance' })
    await postArEntry(uow, { invoice, kind: 'credit_memo', amountMinor: -memo.totalMinor, sourceType: 'CreditMemo', sourceId: memo.id, note: memo.reason })
    await settleInvoice(uow, actor, invoice, -memo.totalMinor, 'invoice.credit_memo_applied', { to: voidInvoice ? 'voided' : undefined, reason: memo.note })
    appliedInvoice = memo.totalMinor
  }
  const posted = await casUpdate(uow, { model: 'CreditMemo', id: memo.id, version: memo.version, from: ['draft', 'pending_approval'], to: 'posted', actor, eventType: 'credit_memo.posted', data: { postedAt: uow.now } })
  await casUpdate(uow, { model: 'CreditMemo', id: memo.id, version: posted, from: ['posted'], to: 'applied', actor, eventType: 'credit_memo.applied', data: { appliedToInvoiceMinor: appliedInvoice, appliedToCreditMinor: appliedCredit } })
  return { memoId: memo.id, appliedToInvoiceMinor: appliedInvoice.toString(), appliedToCreditMinor: appliedCredit.toString() }
}

async function memoThreshold(tx: Tx) {
  const c = await tx.companySettings.findFirst({ select: { refundApprovalThresholdMinor: true } })
  return c?.refundApprovalThresholdMinor ?? 50000n
}

async function createMemo(uow: UnitOfWork, actor: Actor, a: { invoiceId: string; amountMinor: bigint; reason: string; note: string; appliesTo: string; voidInvoice: boolean }) {
  const { tx } = uow
  const invoice = await lockInvoice(tx, a.invoiceId)
  if (!['posted', 'partially_paid', 'paid'].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no credit memo.`)
  if (a.amountMinor <= 0n) throw new DomainError(Codes.INVALID_INPUT, 'The memo is for more than zero.', { field: 'amountMinor' })
  const credited = await postedMemoTotal(tx, invoice.id)
  if (credited + a.amountMinor > invoice.totalMinor) throw new DomainError(Codes.GUARD_FAILED, 'Credit memos cannot add up to more than the invoice.', { reason: 'memo_exceeds_invoice' })
  const ref = await nextReference(tx, 'CRM', uow.now)
  // The threshold is on everything credited on this invoice, so several small memos cannot add up past it unapproved.
  const needsApproval = credited + a.amountMinor > (await memoThreshold(tx)) || a.voidInvoice === true && invoice.status !== 'posted'
  const memo = await tx.creditMemo.create({ data: { ref, invoiceId: invoice.id, reason: a.reason, note: a.note, status: needsApproval ? 'pending_approval' : 'draft', totalMinor: a.amountMinor, appliesTo: a.appliesTo, createdById: actorUserId(actor) }, select: { id: true } })
  auditCreate(uow, actor, 'CreditMemo', memo.id, 'credit_memo.created', { ref, invoiceId: invoice.id, amountMinor: a.amountMinor.toString(), void: a.voidInvoice })
  if (!needsApproval) return { ...(await postMemo(uow, actor, memo.id, a.voidInvoice)), ref, status: 'applied', approvalRequestId: null }
  const approval = await requestApproval(uow, actor, {
    action: 'credit.issue', targetList: 'CreditMemo', targetId: memo.id, requiredPermission: 'canApproveCredits',
    payload: { memoId: memo.id, invoiceId: invoice.id, amountMinor: a.amountMinor.toString(), appliesTo: a.appliesTo, void: a.voidInvoice },
    summary: `${ref}: ${a.voidInvoice ? 'void' : 'credit'} ${invoice.ref} for ${money(a.amountMinor)} — ${a.note}`,
  })
  await tx.creditMemo.update({ where: { id: memo.id }, data: { approvalId: approval.id } })
  return { memoId: memo.id, ref, status: 'pending_approval', approvalRequestId: approval.id }
}

registerApplier('credit.issue', async (uow, actor, request) => {
  const memo = await uow.tx.creditMemo.findUnique({ where: { id: request.targetId } })
  if (!memo || memo.status !== 'pending_approval' || memo.approvalId !== request.id || memo.totalMinor.toString() !== request.payload.amountMinor || memo.invoiceId !== request.payload.invoiceId) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The credit memo changed after approval was requested.')
  return postMemo(uow, actor, memo.id, request.payload.void === true)
})

export async function issueCreditMemo(db: Db, actor: Actor, args: { invoiceId: string; amountMinor: string; reason: string; note: string; appliesTo?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'credit_memo.issue', ['canManageInvoices', 'canPostInvoices'], args)
  if (!/^[1-9]\d{0,12}$/.test(args.amountMinor ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'Amount is whole cents, more than zero.', { field: 'amountMinor' })
  if (!MEMO_REASONS.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason is one of ${MEMO_REASONS.join(', ')}.`, { field: 'reason' })
  const appliesTo = args.appliesTo === 'customer_credit' ? 'customer_credit' : 'invoice_balance'
  const note = mustReason(args.note, 'note')
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'credit_memo.issue', actor, idempotencyKey, params, now: args.now }, uow => createMemo(uow, actor, { invoiceId: args.invoiceId, amountMinor: BigInt(args.amountMinor), reason: args.reason, note, appliesTo, voidInvoice: false }))
  return { replay: result.replay, ...result.value }
}

/** Void an unpaid invoice with a full credit memo (I-M1: it is never edited or deleted). */
export async function voidInvoice(db: Db, actor: Actor, args: { invoiceId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'invoice.void', ['canPostInvoices'], args)
  const note = mustReason(args.reason)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.void', actor, idempotencyKey, params, now: args.now }, async uow => {
    const inv = await lockInvoice(uow.tx, args.invoiceId)
    const allocations = await uow.tx.paymentAllocation.count({ where: { invoiceId: inv.id } })
    if (inv.status !== 'posted' || allocations > 0 || inv.balanceMinor !== inv.totalMinor) throw new DomainError(Codes.GUARD_FAILED, 'Only an invoice with no payments or credits can be voided. Credit it instead.', { reason: 'not_voidable' })
    return createMemo(uow, actor, { invoiceId: inv.id, amountMinor: inv.totalMinor, reason: 'duplicate', note, appliesTo: 'invoice_balance', voidInvoice: true })
  })
  return { replay: result.replay, ...result.value }
}

// ── Write-off ─────────────────────────────────────────────────────────────────

export async function requestWriteOff(db: Db, actor: Actor, args: { invoiceId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'invoice.write_off_request', ['canManageInvoices', 'canManageAccounting'], args)
  const reason = mustReason(args.reason)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'invoice.write_off_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const inv = await lockInvoice(uow.tx, args.invoiceId)
    if (!['posted', 'partially_paid'].includes(inv.status) || inv.balanceMinor <= 0n) throw new DomainError(Codes.GUARD_FAILED, 'Only an invoice with a balance is written off.')
    const pending = await uow.tx.approvalRequest.count({ where: { action: 'invoice.write_off', targetId: inv.id, status: 'pending' } })
    if (pending) throw new DomainError(Codes.GUARD_FAILED, 'A write-off is already waiting for approval on this invoice.')
    const approval = await requestApproval(uow, actor, {
      action: 'invoice.write_off', targetList: 'Invoice', targetId: inv.id, requiredPermission: 'canApproveWriteOff',
      payload: { invoiceId: inv.id, balanceMinor: inv.balanceMinor.toString(), version: inv.version },
      summary: `${inv.ref}: write off ${money(inv.balanceMinor)} — ${reason}`,
    })
    auditCreate(uow, actor, 'Invoice', inv.id, 'invoice.write_off_requested', { approvalId: approval.id, balanceMinor: inv.balanceMinor.toString() }, { reason })
    return { invoiceId: inv.id, approvalRequestId: approval.id }
  })
  return { replay: result.replay, ...result.value }
}

registerApplier('invoice.write_off', async (uow, actor, request) => {
  const inv: InvoiceRow = await lockInvoice(uow.tx, request.targetId)
  if (!['posted', 'partially_paid'].includes(inv.status) || inv.balanceMinor.toString() !== request.payload.balanceMinor || inv.version !== request.payload.version) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The invoice changed after the write-off was requested.')
  await postArEntry(uow, { invoice: inv, kind: 'write_off', amountMinor: -inv.balanceMinor, sourceType: 'ApprovalRequest', sourceId: request.id, note: 'Written off' })
  await settleInvoice(uow, actor, inv, -inv.balanceMinor, 'invoice.written_off', { to: 'written_off' })
  return { invoiceId: inv.id, status: 'written_off', writtenOffMinor: inv.balanceMinor.toString() }
})

void dayOf
