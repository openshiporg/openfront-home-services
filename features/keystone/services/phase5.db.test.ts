import { Prisma, type PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { HOUSEHOLDS } from '../seed/operationsData'
import { advanceWarrantyStates, markRegistrationSubmitted, recordEquipment, registrationList } from './warranty'
import { adjustStock, consumeStock, installSerializedUnit, receiveSerializedUnit, saveItem, saveStockLocation, transferStock, verifyStock, proposeReplenishment, saveMinMaxRule } from './inventory'
import { completeJob, logRefrigerant, nthMonthDay, openPermit, advancePermit, requestInspection, recordInspectionResult } from './compliance'
import { createPurchaseOrder, markPurchaseOrderSent, receivePurchaseOrder, recordVendorBill, submitPurchaseOrder } from './purchasing'
import { runInTransaction } from '../lib/unitOfWork'
import '../mutations'

/*
 * Phase 5 exit gate (each item has its own test):
 *  1. stock = sum of movements (the verify job), and it catches a level that has drifted;
 *  2. concurrent consumption on one truck item is correct;
 *  3. a serialized unit is in one place;
 *  4. a registration that is overdue never disappears;
 *  5. refrigerant entries need a valid EPA 608 credential.
 * Plus: permits gate `completed`, and the three-way match, the min/max proposal and the Texas lien clock.
 * Run alone: timeout 300 npx vitest run features/keystone/services/phase5.db.test.ts --no-file-parallelism
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const user = (id: string): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(ALL) as never })
const sessionFor = (id: string) => ({ itemId: id, data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, true])) } } })
const k = (p = 'k') => uniqueKey(p)
const reason = async (p: Promise<unknown>) => {
  try { await p; return 'OK' } catch (e) { if (e instanceof DomainError) return String(e.details.reason ?? e.code); return `RAW:${e instanceof Error ? e.message : String(e)}` }
}

describe.skipIf(!hasTestDatabase)('Phase 5: equipment, stock, purchasing and compliance (database)', () => {
  let prisma: PrismaClient
  let owner: Actor
  let customerId: string
  let locationId: string
  let seq = 0
  let warehouseId: string
  let truckId: string
  let techEmployeeId: string

  const job = async (status = 'in_progress', extra: Record<string, unknown> = {}) => {
    seq += 1
    return prisma.job.create({ data: { ref: `JOB-P5-${seq}-${Date.now()}`, publicCode: `J-P5${seq}${Date.now()}`, customerId, locationId, status, priority: 'normal', source: 'phone', ...extra } as never })
  }
  const item = async (extra: Record<string, unknown> = {}) => {
    seq += 1
    const made = await saveItem(prisma, owner, { sku: `P5-${seq}-${Date.now().toString(36)}`, name: `Part ${seq}`, baseUom: 'ea', standardCostMinor: '1000', idempotencyKey: k(), ...extra } as never)
    return made.itemId
  }
  const stock = async (itemId: string, locationId: string, qty: string) => adjustStock(prisma, owner, { itemId, locationId, quantity: qty, reason: 'Opening count', idempotencyKey: k() })
  const onHand = async (itemId: string, loc: string) => String((await prisma.stockLevel.findFirst({ where: { itemId, locationId: loc } }))?.onHand ?? '0')

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
    techEmployeeId = 'seed_emp_morrison'
    await prisma.unitOfMeasure.upsert({ where: { code: 'lb' }, update: {}, create: { code: 'lb', name: 'Pound', kind: 'weight', maxDecimals: 2 } })
    await prisma.unitOfMeasure.upsert({ where: { code: 'ea' }, update: {}, create: { code: 'ea', name: 'Each', kind: 'count', maxDecimals: 0 } })
    warehouseId = (await saveStockLocation(prisma, owner, { code: 'WH-1', name: 'Main warehouse', kind: 'warehouse', idempotencyKey: k() })).locationId
    truckId = (await saveStockLocation(prisma, owner, { code: 'TRK-1', name: 'Truck 1', kind: 'truck', employeeId: techEmployeeId, idempotencyKey: k() })).locationId
  }, 900_000)

  afterAll(async () => { await prisma?.$disconnect() })

  // ── Gate 1: stock = Σ movements ───────────────────────────────────────────────────────────────────────────────────

  it('stock equals the sum of its movements, and the verify job catches a level that drifted', { timeout: 120_000 }, async () => {
    const a = await item({ baseUom: 'lb' })
    await stock(a, warehouseId, '40')
    await transferStock(prisma, owner, { itemId: a, fromLocationId: warehouseId, toLocationId: truckId, quantity: '12.5', idempotencyKey: k() })
    await consumeStock(prisma, owner, { itemId: a, locationId: truckId, quantity: '2.25', jobId: (await job()).id, idempotencyKey: k() })
    expect(await onHand(a, warehouseId)).toBe('27.5')
    expect(await onHand(a, truckId)).toBe('10.25')
    const sum = await prisma.stockMovement.aggregate({ where: { itemId: a }, _sum: { baseQuantity: true } })
    expect(String(sum._sum.baseQuantity)).toBe('37.75')
    expect((await verifyStock(prisma)).ok).toBe(true)

    // Someone edits the cache by hand: the verify job names it. (The movement ledger itself cannot be edited.)
    await prisma.stockLevel.updateMany({ where: { itemId: a, locationId: truckId }, data: { onHand: new Prisma.Decimal('99') } })
    const bad = await verifyStock(prisma)
    expect(bad.ok).toBe(false)
    expect(bad.mismatches).toEqual([{ locationId: truckId, itemId: a, level: '99', ledger: '10.25' }])
    await prisma.stockLevel.updateMany({ where: { itemId: a, locationId: truckId }, data: { onHand: new Prisma.Decimal('10.25') } })
    expect((await verifyStock(prisma)).ok).toBe(true)

    await expect(prisma.stockMovement.updateMany({ data: { reason: 'edited' } })).rejects.toThrow()
    await expect(prisma.stockMovement.deleteMany({})).rejects.toThrow()
  })

  it('a warehouse cannot go below zero, and a truck can (flagged for a recount)', async () => {
    const a = await item()
    await stock(a, warehouseId, '3')
    expect(await reason(consumeStock(prisma, owner, { itemId: a, locationId: warehouseId, quantity: '5', jobId: (await job()).id, idempotencyKey: k() }))).toBe('insufficient_stock')
    expect(await onHand(a, warehouseId)).toBe('3')
    const r = await consumeStock(prisma, owner, { itemId: a, locationId: truckId, quantity: '2', jobId: (await job()).id, idempotencyKey: k() })
    expect(r.negative).toBe(true)
    expect(await onHand(a, truckId)).toBe('-2')
    const level = await prisma.stockLevel.findFirst({ where: { itemId: a, locationId: truckId } })
    expect(level?.negativeSince).toBeTruthy()
    expect(await prisma.task.count({ where: { kind: 'stock.negative', subjectId: truckId } })).toBe(1)
    expect((await verifyStock(prisma)).ok).toBe(true)
  })

  // ── Gate 2: concurrent consumption ────────────────────────────────────────────────────────────────────────────────

  it('parallel consumption of one truck item loses no update, and a retried key consumes once', { timeout: 120_000 }, async () => {
    const a = await item()
    await stock(a, truckId, '100')
    const j = await job()
    const keys = Array.from({ length: 12 }, () => k('c'))
    await Promise.all(keys.map(key => consumeStock(prisma, owner, { itemId: a, locationId: truckId, quantity: '3', jobId: j.id, idempotencyKey: key })))
    expect(await onHand(a, truckId)).toBe('64')
    // The same intent sent again (a double click, a retry after a lost response) is a replay.
    const dup = k('dup')
    const [x, y, z] = await Promise.all([1, 2, 3].map(() => consumeStock(prisma, owner, { itemId: a, locationId: truckId, quantity: '4', jobId: j.id, idempotencyKey: dup })))
    expect([x.replay, y.replay, z.replay].filter(Boolean).length).toBe(2)
    expect(await onHand(a, truckId)).toBe('60')
    expect(await prisma.stockMovement.count({ where: { itemId: a, type: 'consume_job' } })).toBe(13)
    expect((await verifyStock(prisma)).ok).toBe(true)
  })

  // ── Gate 3: a serialized unit is in one place ─────────────────────────────────────────────────────────────────────

  it('a serialized unit is at one location or installed, never both, and cannot be installed twice', { timeout: 120_000 }, async () => {
    const unitItem = await item({ trackSerial: true })
    const serial = `SN-${Date.now()}`
    const unitId = await runInTransaction(prisma, uow => receiveSerializedUnit(uow, owner, { itemId: unitItem, serialNumber: serial, locationId: truckId, key: k('rx') }))
    const equip = await recordEquipment(prisma, owner, { locationId, manufacturer: 'Carrier', modelNumber: '24ACC636', serialNumber: `E-${Date.now()}`, kind: 'ac_condenser', idempotencyKey: k() })
    const equip2 = await recordEquipment(prisma, owner, { locationId, manufacturer: 'Carrier', modelNumber: '24ACC636', serialNumber: `E2-${Date.now()}`, kind: 'ac_condenser', idempotencyKey: k() })
    const j = await job()

    // The database refuses a unit that is both installed and in stock, or neither.
    await expect(prisma.serializedUnit.update({ where: { id: unitId }, data: { installedEquipmentId: equip.equipmentId } })).rejects.toThrow(/exactly one stock location/)
    await expect(prisma.serializedUnit.update({ where: { id: unitId }, data: { status: 'installed' } })).rejects.toThrow(/belongs to equipment/)
    // A serial number is never consumed by quantity.
    expect(await reason(consumeStock(prisma, owner, { itemId: unitItem, locationId: truckId, quantity: '1', jobId: j.id, serializedUnitId: unitId, idempotencyKey: k() } as never))).toBe('use_install')
    // The same serial cannot be received twice.
    expect(await reason(runInTransaction(prisma, uow => receiveSerializedUnit(uow, owner, { itemId: unitItem, serialNumber: serial, locationId: truckId, key: k('rx2') })))).not.toBe('OK')

    // Two people install the same unit into two pieces of equipment at once: one wins.
    const tries = await Promise.all([equip.equipmentId, equip2.equipmentId].map(e => reason(installSerializedUnit(prisma, owner, { serializedUnitId: unitId, equipmentId: e, jobId: j.id, idempotencyKey: k() }))))
    expect(tries.filter(t => t === 'OK').length).toBe(1)
    const unit = await prisma.serializedUnit.findUniqueOrThrow({ where: { id: unitId } })
    expect(unit.status).toBe('installed')
    expect(unit.locationId).toBeNull()
    expect(unit.installedEquipmentId).toBeTruthy()
    expect(await prisma.installedEquipment.count({ where: { serializedUnitId: unitId } })).toBe(1)
    expect(await onHand(unitItem, truckId)).toBe('0')
    // Moving an installed unit between locations is refused.
    expect(await reason(transferStock(prisma, owner, { itemId: unitItem, fromLocationId: truckId, toLocationId: warehouseId, quantity: '1', serializedUnitId: unitId, idempotencyKey: k() }))).not.toBe('OK')
    expect((await verifyStock(prisma)).ok).toBe(true)
  })

  // ── Gate 4: an overdue registration never disappears ──────────────────────────────────────────────────────────────

  it('a registration past its deadline becomes overdue, stays on the list, and cannot be deleted or reset', { timeout: 120_000 }, async () => {
    await prisma.warrantyRule.upsert({ where: { manufacturer: 'Trane' }, update: {}, create: { manufacturer: 'Trane', brand: 'Trane', registrationDeadlineDays: 60, partsYearsRegistered: 10, partsYearsUnregistered: 5, laborYears: 1, claimDeadlineDays: 60, verified: false } })
    const longAgo = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10)
    const e = await recordEquipment(prisma, owner, { locationId, manufacturer: 'Trane', modelNumber: 'XR15', serialNumber: `T-${Date.now()}`, kind: 'ac_condenser', installDate: longAgo, idempotencyKey: k() })
    const reg = await prisma.warrantyRegistration.findUniqueOrThrow({ where: { id: e.registrationId! } })
    expect(reg.status).toBe('overdue') // already late when recorded: it is on the exception list at once

    // One that falls due later: it is `due` today, and a pass after the deadline makes it overdue.
    const soon = new Date(Date.now() - 50 * 86_400_000).toISOString().slice(0, 10) // 60-day deadline, 10 days left
    const e2 = await recordEquipment(prisma, owner, { locationId, manufacturer: 'Trane', modelNumber: 'XR16', serialNumber: `T2-${Date.now()}`, kind: 'ac_condenser', installDate: soon, idempotencyKey: k() })
    expect((await prisma.warrantyRegistration.findUniqueOrThrow({ where: { id: e2.registrationId! } })).status).toBe('due')
    const later = new Date(Date.now() + 15 * 86_400_000)
    expect((await advanceWarrantyStates(prisma, later)).overdue).toBe(1)
    expect((await advanceWarrantyStates(prisma, later)).overdue).toBe(0) // idempotent
    expect((await prisma.warrantyRegistration.findUniqueOrThrow({ where: { id: e2.registrationId! } })).status).toBe('overdue')
    expect(await prisma.task.count({ where: { kind: 'warranty.registration_overdue', subjectId: e2.registrationId! } })).toBe(1)

    // The list shows it as overdue even before any pass has run.
    const list = await registrationList(prisma, later)
    expect(list.filter(r => r.effectiveStatus === 'overdue').map(r => r.id)).toEqual(expect.arrayContaining([e.registrationId!, e2.registrationId!]))

    // The database refuses to delete it or to push it back to `due`.
    await expect(prisma.warrantyRegistration.delete({ where: { id: e.registrationId! } })).rejects.toThrow(/never deleted/)
    await expect(prisma.warrantyRegistration.update({ where: { id: e.registrationId! }, data: { status: 'due' } })).rejects.toThrow(/closed only by submitting/)
    await expect(prisma.installedEquipment.delete({ where: { id: e.equipmentId } })).rejects.toThrow()

    // A late submit is allowed and takes it off the overdue list (kept in history, with the Task closed).
    const done = await markRegistrationSubmitted(prisma, owner, { registrationId: e.registrationId!, confirmationNumber: 'TR-123', expectedVersion: reg.version, idempotencyKey: k() })
    expect(done.status).toBe('confirmed')
    const after = await prisma.warrantyRegistration.findUniqueOrThrow({ where: { id: e.registrationId! } })
    expect(after.overdueSince).toBeTruthy()
    // Parts cover the shorter, unregistered term because the registration was late.
    const parts = await prisma.warrantyCoverage.findFirstOrThrow({ where: { equipmentId: e.equipmentId, kind: 'manufacturer_parts' } })
    expect(parts.endsOn?.toISOString().slice(0, 4)).toBe(String(new Date(longAgo).getUTCFullYear() + 5))
  })

  // ── Gate 5: refrigerant needs a valid EPA 608 credential ──────────────────────────────────────────────────────────

  it('refrigerant entries need a verified, unexpired EPA 608 credential of the technician\'s own', { timeout: 120_000 }, async () => {
    const e = await recordEquipment(prisma, owner, { locationId, manufacturer: 'Lennox', modelNumber: 'XC21', serialNumber: `L-${Date.now()}`, kind: 'ac_condenser', refrigerantType: 'R-410A', idempotencyKey: k() })
    const entry = (technicianId: string, extra: Record<string, unknown> = {}) => logRefrigerant(prisma, owner, { kind: 'charge', equipmentId: e.equipmentId, refrigerantType: 'R-410A', quantityLb: '2.5', technicianId, idempotencyKey: k(), ...extra })

    // Morrison holds a verified Universal card.
    expect(await reason(entry(techEmployeeId))).toBe('OK')
    // The plumber has no EPA 608 card on file at all.
    expect(await reason(entry('seed_emp_castillo'))).toBe('no_epa_608')
    // An expired card does not count.
    await prisma.credential.updateMany({ where: { employeeId: techEmployeeId, kind: 'epa_608' }, data: { expiresOn: new Date('2020-01-01') } })
    expect(await reason(entry(techEmployeeId))).toBe('no_epa_608')
    // A card that is not verified does not count.
    await prisma.credential.updateMany({ where: { employeeId: techEmployeeId, kind: 'epa_608' }, data: { expiresOn: null, status: 'pending_verification' } })
    expect(await reason(entry(techEmployeeId))).toBe('no_epa_608')
    await prisma.credential.updateMany({ where: { employeeId: techEmployeeId, kind: 'epa_608' }, data: { status: 'verified' } })
    expect(await reason(entry(techEmployeeId))).toBe('OK')

    // Even a direct insert (bypassing the service) is refused by the database.
    const cred = await prisma.credential.findFirstOrThrow({ where: { employeeId: 'seed_emp_chu', kind: 'epa_608' } })
    await expect(prisma.refrigerantLogEntry.create({ data: { idempotencyKey: k(), kind: 'charge', refrigerantType: 'R-410A', quantityLb: new Prisma.Decimal(1), technicianId: techEmployeeId, credentialId: cred.id, occurredAt: new Date() } })).rejects.toThrow(/EPA 608/)
    await expect(prisma.refrigerantLogEntry.create({ data: { idempotencyKey: k(), kind: 'charge', refrigerantType: 'R-410A', quantityLb: new Prisma.Decimal(1), technicianId: techEmployeeId, occurredAt: new Date() } })).rejects.toThrow(/EPA 608/)
    // The log cannot be edited or deleted.
    await expect(prisma.refrigerantLogEntry.updateMany({ data: { notes: 'x' } })).rejects.toThrow()
    await expect(prisma.refrigerantLogEntry.deleteMany({})).rejects.toThrow()
    // A retried key is a replay, not a second entry.
    const key = k('same')
    const a = await entry(techEmployeeId, { idempotencyKey: key }); const b = await entry(techEmployeeId, { idempotencyKey: key })
    expect(a.entryId).toBe(b.entryId)
  })

  // ── Permits gate `completed` ──────────────────────────────────────────────────────────────────────────────────────

  it('a job with an open permit waits in awaiting_inspection and completes only when every inspection has passed', { timeout: 120_000 }, async () => {
    const j = await job('work_complete')
    const permit = await openPermit(prisma, owner, { jobId: j.id, ahj: 'City of Austin', permitType: 'Mechanical', feeMinor: '8500', idempotencyKey: k() })
    const r1 = await completeJob(prisma, owner, { jobId: j.id, expectedVersion: 0, idempotencyKey: k() })
    expect(r1.status).toBe('awaiting_inspection')
    // The database gate holds even if a caller skips the service.
    await expect(prisma.job.update({ where: { id: j.id }, data: { status: 'completed' } })).rejects.toThrow(/open permit/)

    let p = await prisma.permit.findUniqueOrThrow({ where: { id: permit.permitId } })
    await advancePermit(prisma, owner, { permitId: p.id, to: 'applied', expectedVersion: p.version, idempotencyKey: k() })
    p = await prisma.permit.findUniqueOrThrow({ where: { id: p.id } })
    await advancePermit(prisma, owner, { permitId: p.id, to: 'issued', externalNumber: 'MP-2026-4411', expectedVersion: p.version, idempotencyKey: k() })
    const insp = await requestInspection(prisma, owner, { permitId: p.id, kind: 'Final mechanical', idempotencyKey: k() })
    let i = await prisma.inspection.findUniqueOrThrow({ where: { id: insp.inspectionId } })
    const failed = await recordInspectionResult(prisma, owner, { inspectionId: i.id, result: 'failed', notes: 'Missing drain pan float switch', expectedVersion: i.version, idempotencyKey: k() })
    expect(failed.correctionsVisitId).toBeTruthy()
    expect((await prisma.visit.findUniqueOrThrow({ where: { id: failed.correctionsVisitId! } })).status).toBe('unassigned')
    expect(await reason(completeJob(prisma, owner, { jobId: j.id, expectedVersion: (await prisma.job.findUniqueOrThrow({ where: { id: j.id } })).version, idempotencyKey: k() }))).toBe('permit_open')

    const { reinspect } = await import('./compliance')
    i = await prisma.inspection.findUniqueOrThrow({ where: { id: i.id } })
    await reinspect(prisma, owner, { inspectionId: i.id, expectedVersion: i.version, idempotencyKey: k() })
    i = await prisma.inspection.findUniqueOrThrow({ where: { id: i.id } })
    await recordInspectionResult(prisma, owner, { inspectionId: i.id, result: 'passed', expectedVersion: i.version, idempotencyKey: k() })
    p = await prisma.permit.findUniqueOrThrow({ where: { id: p.id } })
    await advancePermit(prisma, owner, { permitId: p.id, to: 'closed', expectedVersion: p.version, idempotencyKey: k() })
    const done = await completeJob(prisma, owner, { jobId: j.id, expectedVersion: (await prisma.job.findUniqueOrThrow({ where: { id: j.id } })).version, idempotencyKey: k() })
    expect(done.status).toBe('completed')
    expect((await prisma.job.findUniqueOrThrow({ where: { id: j.id } })).completedAt).toBeTruthy()
  })

  // ── Purchasing: order, receive, three-way match ───────────────────────────────────────────────────────────────────

  it('orders, receives into stock (partial then full) and matches the bill three ways', { timeout: 120_000 }, async () => {
    const a = await item()
    const supplier = await prisma.supplier.create({ data: { name: `Supply ${Date.now()}`, kind: 'supply_house', orderMethod: 'email_pdf' } })
    const po = await createPurchaseOrder(prisma, owner, { supplierId: supplier.id, shipToId: warehouseId, lines: [{ itemId: a, quantity: '10', unitCostMinor: '2000' }], idempotencyKey: k() })
    expect(po.totalMinor).toBe('20000')
    let row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.purchaseOrderId }, include: { lines: true } })
    // Not received before it is sent.
    expect(await reason(receivePurchaseOrder(prisma, owner, { purchaseOrderId: row.id, lines: [{ lineId: row.lines[0].id, quantity: '1' }], idempotencyKey: k() }))).not.toBe('OK')
    expect((await submitPurchaseOrder(prisma, owner, { purchaseOrderId: row.id, expectedVersion: row.version, idempotencyKey: k() })).status).toBe('approved')
    row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: row.id }, include: { lines: true } })
    await markPurchaseOrderSent(prisma, owner, { purchaseOrderId: row.id, externalOrderNumber: 'S-9981', expectedVersion: row.version, idempotencyKey: k() })

    const r1 = await receivePurchaseOrder(prisma, owner, { purchaseOrderId: row.id, lines: [{ lineId: row.lines[0].id, quantity: '6' }], idempotencyKey: k() })
    expect(r1.status).toBe('partially_received')
    expect(await onHand(a, warehouseId)).toBe('6')
    // Receiving 50% more than ordered needs an approval.
    expect(await reason(receivePurchaseOrder(prisma, owner, { purchaseOrderId: row.id, lines: [{ lineId: row.lines[0].id, quantity: '9' }], idempotencyKey: k() }))).toBe('over_receipt')
    expect(await onHand(a, warehouseId)).toBe('6') // the failed receipt rolled back whole
    const r2 = await receivePurchaseOrder(prisma, owner, { purchaseOrderId: row.id, lines: [{ lineId: row.lines[0].id, quantity: '4' }], idempotencyKey: k() })
    expect(r2.status).toBe('received')
    expect(await onHand(a, warehouseId)).toBe('10')

    const bad = await recordVendorBill(prisma, owner, { purchaseOrderId: row.id, billNumber: 'B-1', totalMinor: '26000', idempotencyKey: k() })
    expect(bad.matchStatus).toBe('variance')
    expect(await reason(recordVendorBill(prisma, owner, { purchaseOrderId: row.id, billNumber: 'B-1', totalMinor: '20000', idempotencyKey: k() }))).toBe('duplicate_bill')
    const good = await recordVendorBill(prisma, owner, { purchaseOrderId: row.id, billNumber: 'B-2', totalMinor: '20100', idempotencyKey: k() })
    expect(good.matchStatus).toBe('matched') // within the 2% tolerance
    expect((await verifyStock(prisma)).ok).toBe(true)
  })

  // ── Replenishment and the Texas lien clock ────────────────────────────────────────────────────────────────────────

  it('proposes a refill up to max for a truck under min, once, and a rerun changes nothing', async () => {
    const a = await item()
    await stock(a, warehouseId, '50'); await stock(a, truckId, '2')
    await saveMinMaxRule(prisma, owner, { locationId: truckId, itemId: a, min: '5', max: '10', reorderFromId: warehouseId, idempotencyKey: k() })
    const first = await proposeReplenishment(prisma, owner, { idempotencyKey: k() })
    expect(first.proposed).toBeGreaterThanOrEqual(1)
    const second = await proposeReplenishment(prisma, owner, { idempotencyKey: k() })
    expect(second.proposed).toBe(0)
    const open = await prisma.replenishmentRequest.findMany({ where: { locationId: truckId, status: 'proposed' } })
    expect(open).toHaveLength(1)
    expect((open[0].lines as { itemId: string; need: string }[]).find(l => l.itemId === a)?.need).toBe('8')
  })

  it('works out the Texas lien dates by month: the 15th of the third month after the work month (residential)', () => {
    expect(nthMonthDay('2026-11-12', 3, 15)).toBe('2027-02-15')
    expect(nthMonthDay('2026-10-31', 3, 15)).toBe('2027-01-15')
    expect(nthMonthDay('2026-12-01', 4, 15)).toBe('2027-04-15')
    expect(nthMonthDay('2026-01-31', 2, 15)).toBe('2026-03-15')
  })
})
