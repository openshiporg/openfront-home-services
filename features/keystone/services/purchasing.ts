import { Prisma } from '@prisma/client'
import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { Permission } from '../access'
import { consumeApproval, requestApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'
import { applyMovement, decimal, receiveSerializedUnit, requireLocationAccess } from './inventory'

/*
 * Purchasing (STATE-MACHINES §13.2, SCHEMA §12.4). Nothing is emailed: "send" renders the order as a printable page and a CSV that staff
 * send themselves (the email-PDF supplier adapter is a record of that), then mark the order sent. Receiving writes `receipt` movements.
 * Three-way match compares order, receipt and the supplier's bill; a difference over the tolerance needs a second person.
 */

const BUY: Permission[] = ['canPurchase']
const APPROVE: Permission[] = ['canApprovePurchases']
const RECEIVE: Permission[] = ['canReceive', 'canManageInventory']
const BILL: Permission[] = ['canPurchase', 'canManageAccounting']
/** A bill may differ from the order by this much (basis points of the order total) before a second person looks at it. */
export const MATCH_TOLERANCE_BPS = 200
/** An order at or above this many cents needs approval before it is sent. */
export const PO_APPROVAL_THRESHOLD_MINOR = 250_000n
/** Over-receiving more than this share of the ordered quantity needs approval. */
const OVER_RECEIPT_PCT = 10

type LineIn = { itemId: string; quantity: string; unitCostMinor?: string; uom?: string | null; jobId?: string | null }

export async function createPurchaseOrder(db: Db, actor: Actor, args: { supplierId: string; shipToId: string; jobId?: string | null; lines: LineIn[]; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.po_create', BUY, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.po_create', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (!args.lines?.length || args.lines.length > 100) throw new DomainError(Codes.INVALID_INPUT, 'An order has 1 to 100 lines.', { field: 'lines' })
    const supplier = await tx.supplier.findUnique({ where: { id: args.supplierId }, select: { id: true } })
    if (!supplier) throw new DomainError(Codes.NOT_FOUND, 'That supplier does not exist.')
    await requireLocationAccess(tx, actor, args.shipToId)
    let total = 0n
    const rows = []
    for (const l of args.lines) {
      const qty = decimal(l.quantity, 'quantity', { positive: true })
      const si = await tx.supplierItem.findFirst({ where: { supplierId: args.supplierId, itemId: l.itemId }, orderBy: { effectiveOn: 'desc' }, select: { supplierSku: true, costMinor: true } })
      const item = await tx.item.findUnique({ where: { id: l.itemId }, select: { id: true, baseUomId: true, standardCostMinor: true } })
      if (!item) throw new DomainError(Codes.NOT_FOUND, 'An item on the order does not exist.')
      const cost = l.unitCostMinor !== undefined ? BigInt(/^\d{1,10}$/.test(String(l.unitCostMinor)) ? l.unitCostMinor : '-1') : (si?.costMinor ?? item.standardCostMinor ?? 0n)
      if (cost < 0n) throw new DomainError(Codes.INVALID_INPUT, 'Cost is whole cents.', { field: 'unitCostMinor' })
      total += BigInt(qty.mul(String(cost)).toDecimalPlaces(0).toString())
      rows.push({ itemId: l.itemId, supplierSku: si?.supplierSku ?? '', quantity: qty, uomId: item.baseUomId, unitCostMinor: cost, receivedQuantity: 0, jobId: l.jobId ?? args.jobId ?? null })
    }
    const ref = await nextReference(tx, 'PO', uow.now)
    const po = await tx.purchaseOrder.create({ data: { ref, supplierId: args.supplierId, shipToId: args.shipToId, jobId: args.jobId ?? null, status: 'draft', totalMinor: total, lines: { create: rows } }, select: { id: true } })
    auditCreate(uow, actor, 'PurchaseOrder', po.id, 'purchase_order.created', { ref, lines: rows.length, totalMinor: total.toString() })
    return { purchaseOrderId: po.id, ref, totalMinor: total.toString() }
  })
  return { replay: result.replay, ...result.value }
}

/** Submit for approval when large; otherwise approve at once. The person who buys never approves their own order. */
export async function submitPurchaseOrder(db: Db, actor: Actor, args: { purchaseOrderId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.po_submit', BUY, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.po_submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const po = await lockRow<{ id: string; status: string; version: number; totalMinor: bigint; ref: string }>(uow.tx, 'PurchaseOrder', args.purchaseOrderId)
    if (po.totalMinor >= PO_APPROVAL_THRESHOLD_MINOR) {
      const req = await requestApproval(uow, actor, { action: 'purchase_order.approve', targetList: 'PurchaseOrder', targetId: po.id, payload: { purchaseOrderId: po.id, totalMinor: po.totalMinor.toString() }, requiredPermission: 'canApprovePurchases', summary: `Approve ${po.ref}` })
      const v = await casUpdate(uow, { model: 'PurchaseOrder', id: po.id, version: args.expectedVersion, from: ['draft'], to: 'pending_approval', actor, eventType: 'purchase_order.submitted', data: { approvalId: req.id } })
      return { status: 'pending_approval', version: v, requestId: req.id }
    }
    const v = await casUpdate(uow, { model: 'PurchaseOrder', id: po.id, version: args.expectedVersion, from: ['draft'], to: 'approved', actor, eventType: 'purchase_order.approved' })
    return { status: 'approved', version: v, requestId: null }
  })
  return { replay: result.replay, ...result.value }
}

/** Mark an approved order approved/sent after the approval is used. */
export async function approvePurchaseOrder(db: Db, actor: Actor, args: { purchaseOrderId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.po_approve', [...BUY, ...APPROVE], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.po_approve', actor, idempotencyKey, params, now: args.now }, async uow => {
    const po = await lockRow<{ id: string; status: string; totalMinor: bigint; approvalId: string | null }>(uow.tx, 'PurchaseOrder', args.purchaseOrderId)
    if (!po.approvalId) throw new DomainError(Codes.APPROVAL_REQUIRED, 'This order needs an approval request.')
    const { approverId } = await consumeApproval(uow, { requestId: po.approvalId, action: 'purchase_order.approve', targetList: 'PurchaseOrder', targetId: po.id, payload: { purchaseOrderId: po.id, totalMinor: po.totalMinor.toString() } })
    const v = await casUpdate(uow, { model: 'PurchaseOrder', id: po.id, version: args.expectedVersion, from: ['pending_approval'], to: 'approved', actor, eventType: 'purchase_order.approved', approverId })
    return { status: 'approved', version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Staff sent the order themselves (print or CSV); record when and the supplier's own order number. */
export async function markPurchaseOrderSent(db: Db, actor: Actor, args: { purchaseOrderId: string; externalOrderNumber?: string | null; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.po_sent', BUY, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.po_sent', actor, idempotencyKey, params, now: args.now }, async uow => {
    const v = await casUpdate(uow, { model: 'PurchaseOrder', id: args.purchaseOrderId, version: args.expectedVersion, from: ['approved'], to: 'sent', actor, eventType: 'purchase_order.sent', data: { externalOrderNumber: String(args.externalOrderNumber ?? '').trim().slice(0, 80) } })
    return { status: 'sent', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function cancelPurchaseOrder(db: Db, actor: Actor, args: { purchaseOrderId: string; reason: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.po_cancel', BUY, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.po_cancel', actor, idempotencyKey, params, now: args.now }, async uow => {
    if (!String(args.reason ?? '').trim()) throw new DomainError(Codes.INVALID_INPUT, 'Say why.', { field: 'reason' })
    const v = await casUpdate(uow, { model: 'PurchaseOrder', id: args.purchaseOrderId, version: args.expectedVersion, from: ['draft', 'pending_approval', 'approved', 'sent', 'acknowledged'], to: 'cancelled', actor, eventType: 'purchase_order.cancelled', reason: args.reason })
    return { status: 'cancelled', version: v }
  })
  return { replay: result.replay, ...result.value }
}

type ReceiptLine = { lineId: string; quantity: string; serials?: string[] }

/** Receive against an order. Idempotent per key; over-receiving past the tolerance needs an approval named in `overReceiptRequestId`. */
export async function receivePurchaseOrder(db: Db, actor: Actor, args: { purchaseOrderId: string; lines: ReceiptLine[]; overReceiptRequestId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.receive', RECEIVE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.receive', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const po = await lockRow<{ id: string; status: string; version: number; shipToId: string | null }>(tx, 'PurchaseOrder', args.purchaseOrderId)
    if (!['sent', 'acknowledged', 'partially_received'].includes(po.status)) throw new DomainError(Codes.INVALID_TRANSITION, `An order that is ${po.status.replaceAll('_', ' ')} is not received against.`)
    if (!po.shipToId) throw new DomainError(Codes.GUARD_FAILED, 'The order has nowhere to ship to.')
    const lines = await tx.purchaseOrderLine.findMany({ where: { poId: po.id }, select: { id: true, itemId: true, quantity: true, receivedQuantity: true, unitCostMinor: true, item: { select: { trackSerial: true } } } })
    const byId = new Map(lines.map(l => [l.id, l]))
    if (!args.lines?.length) throw new DomainError(Codes.INVALID_INPUT, 'Receive at least one line.', { field: 'lines' })
    const receipt = await tx.receipt.create({ data: { poId: po.id, lines: args.lines as never, receivedAt: uow.now, receivedById: actorUserId(actor) }, select: { id: true } })
    let over = false
    for (const r of args.lines) {
      const line = byId.get(r.lineId)
      if (!line) throw new DomainError(Codes.INVALID_INPUT, 'A line does not belong to this order.', { field: 'lines' })
      const qty = decimal(r.quantity, 'quantity', { positive: true })
      const after = new Prisma.Decimal(line.receivedQuantity ?? 0).plus(qty)
      const allowed = new Prisma.Decimal(line.quantity ?? 0).mul(100 + OVER_RECEIPT_PCT).div(100)
      if (after.gt(allowed)) over = true
      if (line.item?.trackSerial) {
        if ((r.serials ?? []).length !== qty.toNumber() || !qty.isInteger()) throw new DomainError(Codes.INVALID_INPUT, 'Give one serial number per unit received.', { field: 'serials' })
        for (const [i, serial] of (r.serials ?? []).entries()) await receiveSerializedUnit(uow, actor, { itemId: line.itemId ?? '', serialNumber: serial, locationId: po.shipToId, key: `receipt:${receipt.id}:${line.id}:${i}`, receiptId: receipt.id, unitCostMinor: line.unitCostMinor ?? 0n })
      } else {
        await applyMovement(uow, actor, { key: `receipt:${receipt.id}:${line.id}`, type: 'receipt', itemId: line.itemId ?? '', locationId: po.shipToId, quantity: qty, unitCostMinor: line.unitCostMinor ?? 0n, receiptId: receipt.id })
      }
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: after } })
      line.receivedQuantity = after
    }
    if (over) {
      if (!args.overReceiptRequestId) throw new DomainError(Codes.APPROVAL_REQUIRED, `More than ${OVER_RECEIPT_PCT}% over the order needs approval.`, { reason: 'over_receipt' })
      await consumeApproval(uow, { requestId: args.overReceiptRequestId, action: 'purchase_order.over_receipt', targetList: 'PurchaseOrder', targetId: po.id, payload: { purchaseOrderId: po.id, lines: args.lines } })
    }
    const full = [...byId.values()].every(l => new Prisma.Decimal(l.receivedQuantity ?? 0).gte(l.quantity ?? 0))
    const v = await casUpdate(uow, { model: 'PurchaseOrder', id: po.id, version: po.version, from: [po.status], to: full ? 'received' : 'partially_received', actor, eventType: full ? 'purchase_order.received' : 'purchase_order.partially_received' })
    return { receiptId: receipt.id, status: full ? 'received' : 'partially_received', version: v }
  })
  return { replay: result.replay, ...result.value }
}

export async function requestOverReceipt(db: Db, actor: Actor, args: { purchaseOrderId: string; lines: ReceiptLine[]; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.over_receipt_request', RECEIVE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.over_receipt_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const req = await requestApproval(uow, actor, { action: 'purchase_order.over_receipt', targetList: 'PurchaseOrder', targetId: args.purchaseOrderId, payload: { purchaseOrderId: args.purchaseOrderId, lines: args.lines }, requiredPermission: 'canApprovePurchases', summary: 'Receive more than ordered' })
    return { requestId: req.id }
  })
  return { replay: result.replay, ...result.value }
}
registerApplier('purchase_order.approve', async () => ({ ok: true }), { applyOnApprove: false })
registerApplier('purchase_order.over_receipt', async () => ({ ok: true }), { applyOnApprove: false })
registerApplier('vendor_bill.variance', async () => ({ ok: true }), { applyOnApprove: false })

// ── Three-way match ──────────────────────────────────────────────────────────────────────────────────────────────

/** Record the supplier's bill and compare it with what was ordered and what arrived. */
export async function recordVendorBill(db: Db, actor: Actor, args: { purchaseOrderId: string; billNumber: string; totalMinor: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.bill_record', BILL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.bill_record', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (!/^\d{1,10}$/.test(String(args.totalMinor))) throw new DomainError(Codes.INVALID_INPUT, 'The bill total is whole cents.', { field: 'totalMinor' })
    const billNumber = String(args.billNumber ?? '').trim().slice(0, 80)
    if (!billNumber) throw new DomainError(Codes.INVALID_INPUT, 'Enter the bill number.', { field: 'billNumber' })
    const po = await tx.purchaseOrder.findUnique({ where: { id: args.purchaseOrderId }, select: { id: true, supplierId: true, status: true, lines: { select: { quantity: true, receivedQuantity: true, unitCostMinor: true } } } })
    if (!po) throw new DomainError(Codes.NOT_FOUND, 'That order does not exist.')
    if (await tx.vendorBill.findFirst({ where: { supplierId: po.supplierId, billNumber }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'That bill number is already recorded for this supplier.', { reason: 'duplicate_bill' })
    const billed = BigInt(args.totalMinor)
    const received = po.lines.reduce((s, l) => s + BigInt(new Prisma.Decimal(l.receivedQuantity ?? 0).mul(String(l.unitCostMinor ?? 0n)).toDecimalPlaces(0).toString()), 0n)
    const ordered = po.lines.reduce((s, l) => s + BigInt(new Prisma.Decimal(l.quantity ?? 0).mul(String(l.unitCostMinor ?? 0n)).toDecimalPlaces(0).toString()), 0n)
    const gap = billed > received ? billed - received : received - billed
    const matched = po.status !== 'sent' && received > 0n && gap * 10_000n <= received * BigInt(MATCH_TOLERANCE_BPS)
    const row = await tx.vendorBill.create({ data: { supplierId: po.supplierId, poId: po.id, billNumber, totalMinor: billed, matchStatus: matched ? 'matched' : 'variance', matchDetail: { orderedMinor: ordered.toString(), receivedMinor: received.toString(), billedMinor: billed.toString(), gapMinor: gap.toString(), toleranceBps: MATCH_TOLERANCE_BPS } as never }, select: { id: true } })
    auditCreate(uow, actor, 'VendorBill', row.id, 'vendor_bill.recorded', { billNumber, matched, gapMinor: gap.toString() })
    if (matched && ['received', 'partially_received'].includes(po.status)) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: po.status === 'received' ? 'billed' : po.status, version: { increment: 1 } } })
    }
    return { billId: row.id, matchStatus: matched ? 'matched' : 'variance', gapMinor: gap.toString() }
  })
  return { replay: result.replay, ...result.value }
}

/** A variance is accepted by someone other than the person who recorded the bill. */
export async function requestBillVariance(db: Db, actor: Actor, args: { billId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.bill_variance_request', BILL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.bill_variance_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const bill = await uow.tx.vendorBill.findUnique({ where: { id: args.billId }, select: { id: true, matchStatus: true, totalMinor: true, billNumber: true, approvalId: true } })
    if (!bill || bill.matchStatus !== 'variance') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a bill with a variance goes for approval.')
    if (bill.approvalId) return { requestId: bill.approvalId }
    const req = await requestApproval(uow, actor, { action: 'vendor_bill.variance', targetList: 'VendorBill', targetId: bill.id, payload: { billId: bill.id, totalMinor: String(bill.totalMinor) }, requiredPermission: 'canApprovePurchases', summary: `Accept the variance on bill ${bill.billNumber}` })
    await uow.tx.vendorBill.update({ where: { id: bill.id }, data: { approvalId: req.id } })
    return { requestId: req.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function acceptBillVariance(db: Db, actor: Actor, args: { billId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'purchasing.bill_variance_accept', BILL, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'purchasing.bill_variance_accept', actor, idempotencyKey, params, now: args.now }, async uow => {
    const bill = await lockRow<{ id: string; totalMinor: bigint; approvalId: string | null }>(uow.tx, 'VendorBill', args.billId)
    if (!bill.approvalId) throw new DomainError(Codes.APPROVAL_REQUIRED, 'Ask for approval first.')
    const { approverId } = await consumeApproval(uow, { requestId: bill.approvalId, action: 'vendor_bill.variance', targetList: 'VendorBill', targetId: bill.id, payload: { billId: bill.id, totalMinor: String(bill.totalMinor) } })
    const v = await casUpdate(uow, { model: 'VendorBill', id: bill.id, version: args.expectedVersion, from: ['variance'], to: 'approved_variance', actor, statusField: 'matchStatus', eventType: 'vendor_bill.variance_accepted', approverId })
    return { matchStatus: 'approved_variance', version: v }
  })
  return { replay: result.replay, ...result.value }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function purchaseOrderCsv(db: Db, purchaseOrderId: string) {
  const po = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { ref: true, supplier: { select: { name: true, accountNumber: true } }, shipTo: { select: { name: true } }, lines: { select: { supplierSku: true, quantity: true, unitCostMinor: true, item: { select: { sku: true, name: true } } } } } })
  if (!po) return null
  const q = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s }
  const rows = [['PO', 'Supplier', 'Account', 'Ship to', 'Supplier SKU', 'Our SKU', 'Item', 'Quantity', 'Unit cost']]
  for (const l of po.lines) rows.push([po.ref, po.supplier?.name ?? '', po.supplier?.accountNumber ?? '', po.shipTo?.name ?? '', l.supplierSku, l.item?.sku ?? '', l.item?.name ?? '', String(l.quantity ?? ''), (Number(l.unitCostMinor ?? 0n) / 100).toFixed(2)])
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n'
}
