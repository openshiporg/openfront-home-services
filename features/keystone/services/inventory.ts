import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { authorizeOperation } from '../lib/agentGate'
import { actorUserId, can, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { requestApproval, consumeApproval } from '../lib/approval'
import { registerApplier } from '../lib/approvalAppliers'

/*
 * Stock (STATE-MACHINES §13, SCHEMA §12). Movement-only: the one write that changes a quantity is a StockMovement row; the database
 * trigger hs_apply_stock_movement folds it into StockLevel under the row lock of that (location, item), so two people consuming from
 * one truck take turns and never lose an update. verifyStock proves level = sum of movements and returns every row that is off.
 * A truck can go below zero (company control allowNegativeTruckStock) and is flagged with negativeSince; a warehouse cannot.
 */

export const MANAGE: Permission[] = ['canManageInventory']
const MOVERS: Permission[] = ['canManageInventory', 'canReceive', 'canPurchase']
const dec = (v: unknown, field: string, { positive = false, nonzero = false } = {}) => {
  let d: Prisma.Decimal
  try { d = new Prisma.Decimal(String(v ?? '').trim()) } catch { throw new DomainError(Codes.INVALID_INPUT, `${field} must be a number.`, { field }) }
  if (!d.isFinite() || d.decimalPlaces() > 4) throw new DomainError(Codes.INVALID_INPUT, `${field} has at most four decimals.`, { field })
  if (positive && d.lte(0)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be more than zero.`, { field })
  if (nonzero && d.isZero()) throw new DomainError(Codes.INVALID_INPUT, `${field} cannot be zero.`, { field })
  return d
}
export const decimal = dec
const clean = (v: unknown, field: string, max = 400) => {
  const s = String(v ?? '').trim()
  if (!s || s.length > max) throw new DomainError(Codes.INVALID_INPUT, `${field} is needed.`, { field })
  return s
}

/** A technician moves stock on their own truck only; the warehouse team moves anything. */
export async function requireLocationAccess(tx: Tx, actor: Actor, locationId: string) {
  const loc = await tx.stockLocation.findUnique({ where: { id: locationId }, select: { id: true, kind: true, active: true, employee: { select: { userId: true } } } })
  if (!loc) throw new DomainError(Codes.NOT_FOUND, 'That stock location does not exist.')
  if (actor.kind === 'system') return loc
  if (actor.kind === 'user' && MOVERS.some(p => can(actor, p))) return loc
  if (actor.kind === 'user' && can(actor, 'canWorkVisits') && loc.kind === 'truck' && loc.employee?.userId === actor.userId) return loc
  throw new DomainError(Codes.NOT_AUTHORIZED, 'That is not your truck.')
}

export type MovementInput = {
  key: string
  type: string
  itemId: string
  locationId: string
  quantity: Prisma.Decimal
  uomCode?: string | null
  unitCostMinor?: bigint
  jobId?: string | null
  workLineId?: string | null
  receiptId?: string | null
  transferGroup?: string | null
  serializedUnitId?: string | null
  reason?: string | null
  reversesId?: string | null
  occurredAt?: Date
  clientRecordedAt?: Date | null
}

/** Convert a quantity in the given unit into the item's base unit. */
export async function toBase(tx: Tx, itemId: string, qty: Prisma.Decimal, uomCode?: string | null) {
  const item = await tx.item.findUnique({ where: { id: itemId }, select: { id: true, active: true, trackSerial: true, baseUomId: true, baseUom: { select: { code: true, maxDecimals: true } } } })
  if (!item) throw new DomainError(Codes.NOT_FOUND, 'That item does not exist.')
  if (!uomCode || uomCode === item.baseUom?.code) {
    const max = item.baseUom?.maxDecimals ?? 4
    if (qty.decimalPlaces() > max) throw new DomainError(Codes.INVALID_INPUT, `This item is counted to ${max} decimals.`, { field: 'quantity' })
    return { item, base: qty, uomId: item.baseUomId }
  }
  const uom = await tx.unitOfMeasure.findUnique({ where: { code: uomCode }, select: { id: true } })
  if (!uom) throw new DomainError(Codes.INVALID_INPUT, `Unknown unit ${uomCode}.`, { field: 'uom' })
  const conv = await tx.itemUomConversion.findFirst({ where: { itemId, fromUomId: uom.id, toUomId: item.baseUomId ?? '' } })
  if (!conv?.factor) throw new DomainError(Codes.INVALID_INPUT, `No conversion from ${uomCode} to ${item.baseUom?.code ?? 'the base unit'} for this item.`, { field: 'uom' })
  return { item, base: qty.mul(conv.factor), uomId: uom.id }
}

/** The one place a stock quantity changes. Runs inside the caller's transaction. */
export async function applyMovement(uow: UnitOfWork, actor: Actor, m: MovementInput) {
  const { tx } = uow
  const { item, base, uomId } = await toBase(tx, m.itemId, m.quantity, m.uomCode)
  if (m.quantity.isZero()) throw new DomainError(Codes.INVALID_INPUT, 'A movement cannot be zero.', { field: 'quantity' })
  if (item.trackSerial && !m.serializedUnitId && !['adjust', 'count_variance'].includes(m.type)) {
    throw new DomainError(Codes.GUARD_FAILED, 'This item is tracked by serial number; name the unit.', { reason: 'serial_required' })
  }
  let row
  try {
    row = await tx.stockMovement.create({
      data: {
        idempotencyKey: m.key, type: m.type, itemId: m.itemId, locationId: m.locationId, quantity: m.quantity, uomId, baseQuantity: base,
        unitCostMinor: m.unitCostMinor ?? 0n, jobId: m.jobId ?? null, workLineId: m.workLineId ?? null, receiptId: m.receiptId ?? null,
        transferGroup: m.transferGroup ?? '', serializedUnitId: m.serializedUnitId ?? null, reason: m.reason ?? '', reversesId: m.reversesId ?? null,
        actorId: actorUserId(actor), occurredAt: m.occurredAt ?? uow.now, clientRecordedAt: m.clientRecordedAt ?? null,
      },
      select: { id: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/cannot go below zero/.test(message)) throw new DomainError(Codes.GUARD_FAILED, 'There is not enough of that at this location.', { reason: 'insufficient_stock' })
    if (/does not allow a truck/.test(message)) throw new DomainError(Codes.GUARD_FAILED, 'This company does not let a truck go below zero.', { reason: 'negative_truck' })
    throw error
  }
  const level = await tx.stockLevel.findFirst({ where: { locationId: m.locationId, itemId: m.itemId }, select: { onHand: true, negativeSince: true } })
  return { movementId: row.id, onHand: level?.onHand?.toString() ?? '0', negative: !!level?.negativeSince }
}

const keyOf = (...parts: string[]) => createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40)

// ── Items, locations, suppliers ──────────────────────────────────────────────────────────────────────────────────

export async function saveItem(db: Db, actor: Actor, args: { itemId?: string | null; sku: string; name: string; kind?: string; baseUom: string; trackSerial?: boolean; standardCostMinor?: string; defaultSupplierId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.item_save', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.item_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const sku = clean(args.sku, 'sku', 60).toUpperCase()
    const name = clean(args.name, 'name', 160)
    const uom = await tx.unitOfMeasure.findUnique({ where: { code: args.baseUom }, select: { id: true } })
    if (!uom) throw new DomainError(Codes.INVALID_INPUT, 'Pick a unit of measure.', { field: 'baseUom' })
    const kind = args.kind ?? 'part'
    if (!['part', 'material', 'equipment', 'refrigerant', 'consumable'].includes(kind)) throw new DomainError(Codes.INVALID_INPUT, 'Unknown kind.', { field: 'kind' })
    let cost = 0n
    if (args.standardCostMinor !== undefined) {
      if (!/^\d{1,10}$/.test(String(args.standardCostMinor))) throw new DomainError(Codes.INVALID_INPUT, 'Cost is whole cents.', { field: 'standardCostMinor' })
      cost = BigInt(args.standardCostMinor)
    }
    if (args.itemId) {
      const before = await tx.item.findUnique({ where: { id: args.itemId }, select: { id: true } })
      if (!before) throw new DomainError(Codes.NOT_FOUND, 'That item does not exist.')
      const dup = await tx.item.findFirst({ where: { sku, NOT: { id: args.itemId } }, select: { id: true } })
      if (dup) throw new DomainError(Codes.GUARD_FAILED, 'Another item uses that SKU.', { field: 'sku' })
      await tx.item.update({ where: { id: args.itemId }, data: { sku, name, kind, baseUomId: uom.id, trackSerial: !!args.trackSerial, standardCostMinor: cost, defaultSupplierId: args.defaultSupplierId ?? null } })
      uow.audit({ eventType: 'item.updated', entityType: 'Item', entityId: args.itemId, actorUserId: actorUserId(actor), after: { sku, name, kind } })
      return { itemId: args.itemId }
    }
    if (await tx.item.findUnique({ where: { sku }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'An item already uses that SKU.', { field: 'sku' })
    const row = await tx.item.create({ data: { sku, name, kind, baseUomId: uom.id, trackSerial: !!args.trackSerial, standardCostMinor: cost, defaultSupplierId: args.defaultSupplierId ?? null }, select: { id: true } })
    auditCreate(uow, actor, 'Item', row.id, 'item.created', { sku, name, kind })
    return { itemId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function saveStockLocation(db: Db, actor: Actor, args: { code: string; name: string; kind: string; employeeId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.location_save', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.location_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const code = clean(args.code, 'code', 40).toUpperCase()
    if (!['warehouse', 'truck', 'job_site', 'in_transit', 'rma_staging', 'scrap'].includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, 'Unknown location kind.', { field: 'kind' })
    if (args.kind === 'truck' && !args.employeeId) throw new DomainError(Codes.INVALID_INPUT, 'A truck belongs to a technician.', { field: 'employeeId' })
    if (await tx.stockLocation.findUnique({ where: { code }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'A location already uses that code.', { field: 'code' })
    const row = await tx.stockLocation.create({ data: { code, name: clean(args.name, 'name', 120), kind: args.kind, employeeId: args.employeeId ?? null }, select: { id: true } })
    auditCreate(uow, actor, 'StockLocation', row.id, 'stock_location.created', { code, kind: args.kind })
    return { locationId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Moving stock ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Used on a job: a technician on their truck, or the warehouse. Negative on a truck is allowed and flagged. */
export async function consumeStock(db: Db, actor: Actor, args: { itemId: string; locationId: string; quantity: string; uom?: string | null; jobId: string; workLineId?: string | null; serializedUnitId?: string | null; clientRecordedAt?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.consume', [...MOVERS, 'canWorkVisits'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.consume', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    await requireLocationAccess(tx, actor, args.locationId)
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'That job does not exist.')
    if (['cancelled', 'closed'].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: 'job_closed' })
    const qty = dec(args.quantity, 'quantity', { positive: true })
    const item = await tx.item.findUnique({ where: { id: args.itemId }, select: { standardCostMinor: true } })
    // A serial-numbered unit is never consumed by quantity: it is installed into equipment (installSerializedUnit), so it is always in one place.
    if (args.serializedUnitId) throw new DomainError(Codes.GUARD_FAILED, 'Install a serial-numbered unit into its equipment instead.', { reason: 'use_install' })
    const moved = await applyMovement(uow, actor, {
      key: `consume:${idempotencyKey}`, type: 'consume_job', itemId: args.itemId, locationId: args.locationId, quantity: qty.neg(), uomCode: args.uom, unitCostMinor: item?.standardCostMinor ?? 0n,
      jobId: args.jobId, workLineId: args.workLineId, clientRecordedAt: args.clientRecordedAt ? new Date(args.clientRecordedAt) : null,
    })
    if (moved.negative) {
      await tx.task.upsert({
        where: { dedupeKey: `stock.negative:${args.locationId}:${args.itemId}` }, update: {},
        create: { kind: 'stock.negative', title: 'A truck has less than zero of an item: recount it', subjectType: 'StockLocation', subjectId: args.locationId, status: 'open', priority: 'normal', dedupeKey: `stock.negative:${args.locationId}:${args.itemId}` },
      })
    }
    return moved
  })
  return { replay: result.replay, ...result.value }
}

/** Install a serialized unit into equipment: it leaves its stock location and belongs to the equipment, in one step. */
export async function installSerializedUnit(db: Db, actor: Actor, args: { serializedUnitId: string; equipmentId: string; jobId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.install_unit', [...MOVERS, 'canWorkVisits', 'canManageEquipment'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.install_unit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const unit = await lockRow<{ id: string; status: string; locationId: string | null; itemId: string; version: number }>(tx, 'SerializedUnit', args.serializedUnitId)
    if (!['in_stock', 'reserved'].includes(unit.status) || !unit.locationId) throw new DomainError(Codes.GUARD_FAILED, 'That serial number is not in stock.', { reason: 'unit_unavailable' })
    await requireLocationAccess(tx, actor, unit.locationId)
    const equip = await tx.installedEquipment.findUnique({ where: { id: args.equipmentId }, select: { id: true, serializedUnitId: true } })
    if (!equip) throw new DomainError(Codes.NOT_FOUND, 'That equipment does not exist.')
    if (equip.serializedUnitId) throw new DomainError(Codes.GUARD_FAILED, 'That equipment already has a unit.', { reason: 'equipment_has_unit' })
    const item = await tx.item.findUnique({ where: { id: unit.itemId }, select: { standardCostMinor: true } })
    const moved = await applyMovement(uow, actor, { key: `install:${idempotencyKey}`, type: 'consume_job', itemId: unit.itemId, locationId: unit.locationId, quantity: new Prisma.Decimal(-1), unitCostMinor: item?.standardCostMinor ?? 0n, jobId: args.jobId, serializedUnitId: unit.id })
    await casUpdate(uow, { model: 'SerializedUnit', id: unit.id, version: unit.version, from: [unit.status], to: 'installed', actor, eventType: 'serialized_unit.installed', data: { locationId: null, installedEquipmentId: args.equipmentId }, audit: { equipmentId: args.equipmentId, jobId: args.jobId } })
    await tx.installedEquipment.update({ where: { id: args.equipmentId }, data: { serializedUnitId: unit.id, version: { increment: 1 } } })
    return { unitId: unit.id, movementId: moved.movementId }
  })
  return { replay: result.replay, ...result.value }
}

export async function receiveSerializedUnit(uow: UnitOfWork, actor: Actor, args: { itemId: string; serialNumber: string; locationId: string; key: string; receiptId?: string | null; unitCostMinor?: bigint }) {
  const serial = clean(args.serialNumber, 'serialNumber', 80)
  const existing = await uow.tx.serializedUnit.findFirst({ where: { itemId: args.itemId, serialNumber: serial }, select: { id: true } })
  if (existing) throw new DomainError(Codes.GUARD_FAILED, `Serial number ${serial} already exists.`, { reason: 'duplicate_serial' })
  const unit = await uow.tx.serializedUnit.create({ data: { itemId: args.itemId, serialNumber: serial, status: 'in_stock', locationId: args.locationId }, select: { id: true } })
  await applyMovement(uow, actor, { key: args.key, type: 'receipt', itemId: args.itemId, locationId: args.locationId, quantity: new Prisma.Decimal(1), unitCostMinor: args.unitCostMinor, receiptId: args.receiptId, serializedUnitId: unit.id })
  auditCreate(uow, actor, 'SerializedUnit', unit.id, 'serialized_unit.received', { itemId: args.itemId, serialNumber: serial, locationId: args.locationId })
  return unit.id
}

/** Move stock between two locations as two movements under one group, in one transaction. */
export async function transferStock(db: Db, actor: Actor, args: { itemId: string; fromLocationId: string; toLocationId: string; quantity: string; uom?: string | null; serializedUnitId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.transfer', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.transfer', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    if (args.fromLocationId === args.toLocationId) throw new DomainError(Codes.INVALID_INPUT, 'Pick two different locations.')
    await requireLocationAccess(tx, actor, args.fromLocationId); await requireLocationAccess(tx, actor, args.toLocationId)
    const qty = dec(args.quantity, 'quantity', { positive: true })
    const group = `tr_${keyOf(idempotencyKey)}`
    const out = await applyMovement(uow, actor, { key: `${group}:out`, type: 'transfer_out', itemId: args.itemId, locationId: args.fromLocationId, quantity: qty.neg(), uomCode: args.uom, transferGroup: group, serializedUnitId: args.serializedUnitId })
    await applyMovement(uow, actor, { key: `${group}:in`, type: 'transfer_in', itemId: args.itemId, locationId: args.toLocationId, quantity: qty, uomCode: args.uom, transferGroup: group, serializedUnitId: args.serializedUnitId })
    if (args.serializedUnitId) {
      const unit = await lockRow<{ id: string; status: string; locationId: string | null }>(tx, 'SerializedUnit', args.serializedUnitId)
      if (unit.status !== 'in_stock' || unit.locationId !== args.fromLocationId) throw new DomainError(Codes.GUARD_FAILED, 'That serial number is not at the location you are moving it from.', { reason: 'unit_elsewhere' })
      await tx.serializedUnit.update({ where: { id: unit.id }, data: { locationId: args.toLocationId, version: { increment: 1 } } })
    }
    return { transferGroup: group, movementId: out.movementId }
  })
  return { replay: result.replay, ...result.value }
}

/** A correction is a new movement; the original stays. Needs the reason. */
export async function adjustStock(db: Db, actor: Actor, args: { itemId: string; locationId: string; quantity: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.adjust', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.adjust', actor, idempotencyKey, params, now: args.now }, async uow => {
    const qty = dec(args.quantity, 'quantity', { nonzero: true })
    const reason = clean(args.reason, 'reason', 300)
    const item = await uow.tx.item.findUnique({ where: { id: args.itemId }, select: { standardCostMinor: true, trackSerial: true } })
    if (item?.trackSerial) throw new DomainError(Codes.GUARD_FAILED, 'Serialized units are received and moved by serial number, not adjusted.', { reason: 'serialized' })
    const moved = await applyMovement(uow, actor, { key: `adjust:${idempotencyKey}`, type: 'adjust', itemId: args.itemId, locationId: args.locationId, quantity: qty, unitCostMinor: item?.standardCostMinor ?? 0n, reason })
    return moved
  })
  return { replay: result.replay, ...result.value }
}

// ── Proof: stock = sum of movements ──────────────────────────────────────────────────────────────────────────────

/** The verify job. Compares every StockLevel with the sum of its movements and lists the rows that differ (both directions). */
export async function verifyStock(db: Db | Tx) {
  const rows = await (db as Db).$queryRaw<{ location: string; item: string; level: Prisma.Decimal | null; ledger: Prisma.Decimal | null }[]>`
    SELECT COALESCE(l."location", m."location") AS location, COALESCE(l."item", m."item") AS item, l."onHand" AS level, m.total AS ledger
    FROM "StockLevel" l
    FULL OUTER JOIN (SELECT "location", "item", SUM("baseQuantity") AS total FROM "StockMovement" GROUP BY "location", "item") m
      ON m."location" = l."location" AND m."item" = l."item"
    WHERE COALESCE(l."onHand", 0) <> COALESCE(m.total, 0)`
  return { ok: rows.length === 0, mismatches: rows.map(r => ({ locationId: r.location, itemId: r.item, level: String(r.level ?? 0), ledger: String(r.ledger ?? 0) })) }
}

// ── Min/max and replenishment ────────────────────────────────────────────────────────────────────────────────────

export async function saveMinMaxRule(db: Db, actor: Actor, args: { locationId: string; itemId: string; min: string; max: string; reorderFromId?: string | null; supplierId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.minmax_save', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.minmax_save', actor, idempotencyKey, params, now: args.now }, async uow => {
    const min = dec(args.min, 'min'); const max = dec(args.max, 'max')
    if (min.lt(0) || max.lt(min)) throw new DomainError(Codes.INVALID_INPUT, 'Max must be at least min, and min at least zero.', { field: 'max' })
    const data = { min, max, reorderFromId: args.reorderFromId ?? null, supplierId: args.supplierId ?? null }
    const row = await uow.tx.minMaxRule.upsert({ where: { locationId_itemId: { locationId: args.locationId, itemId: args.itemId } }, update: data, create: { locationId: args.locationId, itemId: args.itemId, ...data }, select: { id: true } })
    uow.audit({ eventType: 'min_max_rule.saved', entityType: 'MinMaxRule', entityId: row.id, actorUserId: actorUserId(actor), after: { min: args.min, max: args.max } })
    return { ruleId: row.id }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * The nightly proposal, run by the staff button (or any request that advances timed states): for each rule where on-hand minus
 * reserved is under min, propose a refill up to max. One open proposal per location; running it twice changes nothing.
 */
export async function proposeReplenishment(db: Db, actor: Actor, args: { idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.replenish_propose', MANAGE, args)
  const result = await command(db, { name: 'inventory.replenish_propose', actor, idempotencyKey: args.idempotencyKey, params: {}, now: args.now }, async uow => {
    const { tx } = uow
    const rules = await tx.minMaxRule.findMany({ select: { locationId: true, itemId: true, min: true, max: true, supplierId: true, reorderFromId: true } })
    const levels = await tx.stockLevel.findMany({ select: { locationId: true, itemId: true, onHand: true, reserved: true } })
    const have = new Map(levels.map(l => [`${l.locationId}:${l.itemId}`, new Prisma.Decimal(l.onHand ?? 0).minus(l.reserved ?? 0)]))
    const byLocation = new Map<string, { itemId: string; onHand: string; min: string; max: string; need: string; reorderFromId: string | null; supplierId: string | null }[]>()
    for (const r of rules) {
      const onHand = have.get(`${r.locationId}:${r.itemId}`) ?? new Prisma.Decimal(0)
      if (!r.min || !r.max || !onHand.lt(r.min)) continue
      const list = byLocation.get(r.locationId ?? '') ?? []
      list.push({ itemId: r.itemId ?? '', onHand: onHand.toString(), min: r.min.toString(), max: r.max.toString(), need: new Prisma.Decimal(r.max).minus(onHand).toString(), reorderFromId: r.reorderFromId, supplierId: r.supplierId })
      byLocation.set(r.locationId ?? '', list)
    }
    let proposed = 0; let refreshed = 0
    for (const [locationId, lines] of byLocation) {
      const open = await tx.replenishmentRequest.findFirst({ where: { locationId, status: 'proposed' }, select: { id: true, version: true } })
      if (open) {
        await tx.replenishmentRequest.update({ where: { id: open.id }, data: { lines: lines as never } })
        refreshed += 1
        continue
      }
      const ref = await nextReference(tx, 'REP', uow.now)
      const row = await tx.replenishmentRequest.create({ data: { ref, locationId, lines: lines as never, status: 'proposed', proposedBy: actor.kind === 'user' ? 'staff button' : 'system' }, select: { id: true } })
      auditCreate(uow, actor, 'ReplenishmentRequest', row.id, 'replenishment.proposed', { ref, lines: lines.length })
      proposed += 1
    }
    return { proposed, refreshed, rulesChecked: rules.length }
  })
  return { replay: result.replay, ...result.value }
}

export async function decideReplenishment(db: Db, actor: Actor, args: { requestId: string; decision: 'approve' | 'reject'; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.replenish_decide', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.replenish_decide', actor, idempotencyKey, params, now: args.now }, async uow => {
    const to = args.decision === 'approve' ? 'approved' : 'rejected'
    const v = await casUpdate(uow, { model: 'ReplenishmentRequest', id: args.requestId, version: args.expectedVersion, from: ['proposed'], to, actor, eventType: `replenishment.${to}` })
    return { requestId: args.requestId, status: to, version: v }
  })
  return { replay: result.replay, ...result.value }
}

/** Fill an approved request: transfer from the source location for each line that has a source, and report the rest for ordering. */
export async function fillReplenishment(db: Db, actor: Actor, args: { requestId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.replenish_fill', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.replenish_fill', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const req = await lockRow<{ id: string; locationId: string; lines: { itemId: string; need: string; reorderFromId: string | null }[]; version: number; status: string }>(tx, 'ReplenishmentRequest', args.requestId)
    const group = `rep_${keyOf(req.id)}`
    let moved = 0; const toOrder: { itemId: string; need: string }[] = []
    for (const line of req.lines ?? []) {
      if (!line.reorderFromId) { toOrder.push({ itemId: line.itemId, need: line.need }); continue }
      const from = await tx.stockLevel.findFirst({ where: { locationId: line.reorderFromId, itemId: line.itemId }, select: { onHand: true } })
      const have = new Prisma.Decimal(from?.onHand ?? 0)
      const take = Prisma.Decimal.min(have, new Prisma.Decimal(line.need))
      if (take.gt(0)) {
        await applyMovement(uow, actor, { key: `${group}:${line.itemId}:out`, type: 'transfer_out', itemId: line.itemId, locationId: line.reorderFromId, quantity: take.neg(), transferGroup: group })
        await applyMovement(uow, actor, { key: `${group}:${line.itemId}:in`, type: 'transfer_in', itemId: line.itemId, locationId: req.locationId, quantity: take, transferGroup: group })
        moved += 1
      }
      const short = new Prisma.Decimal(line.need).minus(take)
      if (short.gt(0)) toOrder.push({ itemId: line.itemId, need: short.toString() })
    }
    await casUpdate(uow, { model: 'ReplenishmentRequest', id: req.id, version: args.expectedVersion, from: ['approved'], to: toOrder.length ? 'ordered' : 'transferred', actor, eventType: 'replenishment.filled', data: { transferGroup: group }, audit: { moved, toOrder: toOrder.length } })
    return { moved, toOrder }
  })
  return { replay: result.replay, ...result.value }
}

// ── Cycle counts ─────────────────────────────────────────────────────────────────────────────────────────────────

export async function startCycleCount(db: Db, actor: Actor, args: { locationId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.count_start', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.count_start', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const loc = await tx.stockLocation.findUnique({ where: { id: args.locationId }, select: { id: true } })
    if (!loc) throw new DomainError(Codes.NOT_FOUND, 'That location does not exist.')
    const levels = await tx.stockLevel.findMany({ where: { locationId: args.locationId }, select: { itemId: true, onHand: true } })
    const ref = await nextReference(tx, 'CNT', uow.now)
    const lines = levels.map(l => ({ itemId: l.itemId, expected: String(l.onHand ?? 0), counted: null as string | null }))
    const row = await tx.cycleCount.create({ data: { ref, locationId: args.locationId, status: 'counting', lines: lines as never }, select: { id: true } })
    auditCreate(uow, actor, 'CycleCount', row.id, 'cycle_count.started', { ref, lines: lines.length })
    return { countId: row.id, ref }
  })
  return { replay: result.replay, ...result.value }
}

/** Counting is the technician's or the warehouse's; the variance is approved by someone else before it posts. */
export async function submitCycleCount(db: Db, actor: Actor, args: { countId: string; counted: { itemId: string; counted: string }[]; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.count_submit', [...MOVERS, 'canWorkVisits'], args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.count_submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const count = await lockRow<{ id: string; locationId: string; lines: { itemId: string; expected: string; counted: string | null }[]; version: number }>(tx, 'CycleCount', args.countId)
    await requireLocationAccess(tx, actor, count.locationId)
    const given = new Map(args.counted.map(c => [c.itemId, dec(c.counted, 'counted')]))
    let cost = 0n
    const lines = []
    for (const l of count.lines ?? []) {
      const c = given.get(l.itemId)
      if (c && c.lt(0)) throw new DomainError(Codes.INVALID_INPUT, 'A count cannot be negative.', { field: 'counted' })
      const counted = c ? c.toString() : l.counted
      if (counted != null) {
        const item = await tx.item.findUnique({ where: { id: l.itemId }, select: { standardCostMinor: true } })
        const diff = new Prisma.Decimal(counted).minus(l.expected)
        cost += BigInt(diff.abs().mul(String(item?.standardCostMinor ?? 0n)).toDecimalPlaces(0).toString())
      }
      lines.push({ ...l, counted })
    }
    await casUpdate(uow, { model: 'CycleCount', id: count.id, version: args.expectedVersion, from: ['counting'], to: 'submitted', actor, eventType: 'cycle_count.submitted', data: { lines: lines as never, varianceMinor: cost } })
    return { countId: count.id, varianceMinor: cost.toString() }
  })
  return { replay: result.replay, ...result.value }
}

/** Posting a count writes the variance as movements. A different person (canApproveStockVariance) approves first. */
export async function requestCountApproval(db: Db, actor: Actor, args: { countId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.count_request', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.count_request', actor, idempotencyKey, params, now: args.now }, async uow => {
    const count = await uow.tx.cycleCount.findUnique({ where: { id: args.countId }, select: { id: true, status: true, lines: true, ref: true, approvalId: true } })
    if (!count || count.status !== 'submitted') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a submitted count goes for approval.')
    if (count.approvalId) return { requestId: count.approvalId }
    const req = await requestApproval(uow, actor, { action: 'stock.count_post', targetList: 'CycleCount', targetId: count.id, payload: { countId: count.id, lines: count.lines }, requiredPermission: 'canApproveStockVariance', summary: `Post count ${count.ref}` })
    await uow.tx.cycleCount.update({ where: { id: count.id }, data: { approvalId: req.id } })
    return { requestId: req.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function postCycleCount(db: Db, actor: Actor, args: { countId: string; expectedVersion: number; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'inventory.count_post', MANAGE, args)
  const { idempotencyKey, now: _n, ...params } = args
  const result = await command(db, { name: 'inventory.count_post', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const count = await lockRow<{ id: string; locationId: string; lines: { itemId: string; expected: string; counted: string | null }[]; approvalId: string | null; version: number; status: string }>(tx, 'CycleCount', args.countId)
    if (count.status !== 'submitted') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a submitted count posts.')
    if (!count.approvalId) throw new DomainError(Codes.APPROVAL_REQUIRED, 'A count needs a second person to approve it.')
    await consumeApproval(uow, { requestId: count.approvalId, action: 'stock.count_post', targetList: 'CycleCount', targetId: count.id, payload: { countId: count.id, lines: count.lines } })
    let posted = 0
    for (const l of count.lines ?? []) {
      if (l.counted == null) continue
      // The ledger, not the stale expectation, decides the variance: whatever moved since the count started is kept.
      const level = await tx.stockLevel.findFirst({ where: { locationId: count.locationId, itemId: l.itemId }, select: { onHand: true } })
      const diff = new Prisma.Decimal(l.counted).minus(level?.onHand ?? 0)
      if (diff.isZero()) continue
      await applyMovement(uow, actor, { key: `count:${count.id}:${l.itemId}`, type: 'count_variance', itemId: l.itemId, locationId: count.locationId, quantity: diff, reason: `Cycle count` })
      posted += 1
    }
    await casUpdate(uow, { model: 'CycleCount', id: count.id, version: args.expectedVersion, from: ['submitted'], to: 'posted', actor, eventType: 'cycle_count.posted', audit: { posted } })
    return { posted }
  })
  return { replay: result.replay, ...result.value }
}

registerApplier('stock.count_post', async () => ({ ok: true }), { applyOnApprove: false })

// ── Reads for the screens ────────────────────────────────────────────────────────────────────────────────────────

export async function stockSummary(db: Db, locationKind?: 'warehouse' | 'truck') {
  const levels = await db.stockLevel.findMany({
    where: { location: { is: { active: true, ...(locationKind ? { kind: locationKind } : {}) } } },
    orderBy: [{ locationId: 'asc' }],
    select: { id: true, onHand: true, reserved: true, negativeSince: true, location: { select: { id: true, code: true, name: true, kind: true } }, item: { select: { id: true, sku: true, name: true, trackSerial: true, baseUom: { select: { code: true } } } } },
  })
  return levels.map(l => ({ id: l.id, location: l.location, item: l.item, onHand: String(l.onHand ?? 0), reserved: String(l.reserved ?? 0), negativeSince: l.negativeSince }))
}
