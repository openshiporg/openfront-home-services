import { Prisma, type PrismaClient } from '@prisma/client'
import { getContext } from '@keystone-6/core/context'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { HOUSEHOLDS } from '../seed/operationsData'
import { ROLES } from '../seed/company'
import { recordEquipment } from './warranty'
import { adjustStock, proposeReplenishment, receiveSerializedUnit, saveItem, saveMinMaxRule, saveStockLocation, transferStock } from './inventory'
import { logRefrigerant } from './compliance'
import { createPurchaseOrder, markPurchaseOrderSent, receivePurchaseOrder, recordVendorBill, submitPurchaseOrder, threeWayMatch } from './purchasing'
import { runInTransaction } from '../lib/unitOfWork'
import { loadEquipment, loadInventory, loadTruck, replenishmentDecision, type Query } from '../../platform/operations/screens/loaders'
import config from '../index'
import * as PrismaModule from '@prisma/client'
import '../mutations'

/*
 * P5 r1 review fixes, each a test that fails on e7798c5:
 *  M1  the inventory, truck and equipment screens read as the signed-in person (the same list rules as the API);
 *  M2  the Replenishment screen's Approve approves, through the real GraphQL mutation;
 *  M4  a second bill for the same goods is not matched against what an earlier bill already used;
 *  M5  the seeded Technician role logs refrigerant only under its own name;
 *  and a serial-number transfer moves exactly one.
 * Run alone: timeout 300 npx vitest run features/keystone/services/phase5r1.db.test.ts --no-file-parallelism
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const role = (id: string) => ROLES.find(r => r.id === id)!.permissions as Permission[]
const actorWith = (id: string, perms: readonly Permission[]): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(perms) as never })
const sessionWith = (id: string, perms: readonly Permission[]) => ({ itemId: id, listKey: 'User', data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, perms.includes(p)])) } } })
const k = (p = 'k') => uniqueKey(p)
const reason = async (p: Promise<unknown>) => {
  try { await p; return 'OK' } catch (e) { if (e instanceof DomainError) return String(e.details.reason ?? e.code); return `RAW:${e instanceof Error ? e.message : String(e)}` }
}

describe.skipIf(!hasTestDatabase)('P5 r1 fixes (database)', () => {
  let prisma: PrismaClient
  let owner: Actor
  let ctx: ReturnType<typeof getContext>
  let warehouseId: string
  let truck1: string // Morrison's
  let truck2: string // Alvarez's
  let seq = 0
  const TECH = role('seed_role_technician')

  /** GraphQL as this person, the same path the dashboard's `q` and MCP queryData take. */
  const as = (userId: string, perms: readonly Permission[]): Query => async (query, variables) => {
    const r = await ctx.withSession(sessionWith(userId, perms)).graphql.raw({ query, variables })
    if (r.errors?.length) throw new Error(r.errors.map(e => e.message).join('; '))
    return r.data as never
  }
  const item = async (extra: Record<string, unknown> = {}) => {
    seq += 1
    return (await saveItem(prisma, owner, { sku: `R1-${seq}-${Date.now().toString(36)}`, name: `Part ${seq}`, baseUom: 'ea', standardCostMinor: '1000', idempotencyKey: k(), ...extra } as never)).itemId
  }
  const stock = (itemId: string, locationId: string, qty: string) => adjustStock(prisma, owner, { itemId, locationId, quantity: qty, reason: 'Opening count', idempotencyKey: k() })

  beforeAll(async () => {
    prisma = testPrisma(2)
    await resetDatabase(prisma)
    const o = await prisma.user.create({ data: { name: 'owner', email: `${k('o')}@test.local`, password: 'x'.repeat(60) } })
    const setupCtx = { session: sessionWith(o.id, ALL), prisma }
    await loadCompanySetup(null, { idempotencyKey: k('c') }, setupCtx)
    await loadOperationsSetup(null, { idempotencyKey: k('op') }, setupCtx)
    owner = actorWith(o.id, ALL)
    await prisma.unitOfMeasure.upsert({ where: { code: 'ea' }, update: {}, create: { code: 'ea', name: 'Each', kind: 'count', maxDecimals: 0 } })
    warehouseId = (await saveStockLocation(prisma, owner, { code: 'WH-1', name: 'Main warehouse', kind: 'warehouse', idempotencyKey: k() })).locationId
    truck1 = (await saveStockLocation(prisma, owner, { code: 'TRK-1', name: 'Truck 1', kind: 'truck', employeeId: 'seed_emp_morrison', idempotencyKey: k() })).locationId
    truck2 = (await saveStockLocation(prisma, owner, { code: 'TRK-2', name: 'Truck 2', kind: 'truck', employeeId: 'seed_emp_alvarez', idempotencyKey: k() })).locationId
    const a = await item()
    await stock(a, warehouseId, '20'); await stock(a, truck1, '3'); await stock(a, truck2, '4')
    await recordEquipment(prisma, owner, { locationId: HOUSEHOLDS[0].location.id, manufacturer: 'Trane', modelNumber: 'XR16', serialNumber: `T-${Date.now()}`, kind: 'ac_condenser', idempotencyKey: k() })
    // The screens' GraphQL runs against this test database through a Keystone context on the same Prisma client.
    ctx = getContext({ ...config, db: { ...config.db, url: process.env.HS_TEST_DATABASE_URL! } } as never, PrismaModule) as never
  }, 900_000)

  afterAll(async () => { await (ctx as unknown as { prisma?: PrismaClient })?.prisma?.$disconnect(); await prisma?.$disconnect() })

  // ── M1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  it('M1: a technician with no truck sees no stock, no truck, no equipment and no addresses on the screens', { timeout: 120_000 }, async () => {
    const terrence = await prisma.user.create({ data: { name: 'Terrence Hartwell', email: `${k('t')}@test.local`, password: 'x'.repeat(60), roleId: 'seed_role_technician' } })
    const q = as(terrence.id, TECH)
    const inv = await loadInventory(q)
    expect(inv.locations).toEqual([])
    expect(inv.levels).toEqual([])
    expect(await loadTruck(q, truck2)).toBeNull()
    const eq = await loadEquipment(q)
    expect(eq.equipment).toEqual([])
    expect(eq.locations).toEqual([])
  })

  it('M1: a technician with a truck sees that truck only, and another truck is a 404', { timeout: 120_000 }, async () => {
    const q = as('seed_user_morrison', TECH)
    const inv = await loadInventory(q)
    // Only trucks assigned to Morrison (the seed gives him one too), never Alvarez's or the warehouse.
    const his = (await prisma.stockLocation.findMany({ where: { employeeId: 'seed_emp_morrison' }, select: { id: true } })).map(l => l.id).sort()
    expect(his).toContain(truck1)
    expect(inv.locations.map(l => l.id).sort()).toEqual(his)
    expect(inv.levels.every(l => his.includes(l.location!.id))).toBe(true)
    expect((await loadTruck(q, truck1))?.truck.id).toBe(truck1)
    expect(await loadTruck(q, truck2)).toBeNull()
    expect(await loadTruck(q, warehouseId)).toBeNull()
  })

  it('M1: stock staff still see every location and any truck', { timeout: 120_000 }, async () => {
    const q = as(owner.kind === 'user' ? owner.userId : '', role('seed_role_warehouse'))
    const inv = await loadInventory(q, { forms: true })
    const every = (await prisma.stockLocation.findMany({ where: { active: true }, select: { id: true } })).map(l => l.id).sort()
    expect(every).toEqual(expect.arrayContaining([warehouseId, truck1, truck2]))
    expect(inv.locations.map(l => l.id).sort()).toEqual(every)
    expect((await loadTruck(q, truck2))?.truck.id).toBe(truck2)
    const eq = await loadEquipment(as(owner.kind === 'user' ? owner.userId : '', role('seed_role_service_manager')))
    expect(eq.equipment.length).toBeGreaterThan(0)
  })

  // ── M2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  it('M2: the screen\'s Approve button, sent through the real GraphQL mutation, approves; the old value is refused', { timeout: 120_000 }, async () => {
    const a = await item()
    await stock(a, warehouseId, '50'); await stock(a, truck1, '1')
    await saveMinMaxRule(prisma, owner, { locationId: truck1, itemId: a, min: '5', max: '10', reorderFromId: warehouseId, idempotencyKey: k() })
    await proposeReplenishment(prisma, owner, { idempotencyKey: k() })
    const req = await prisma.replenishmentRequest.findFirstOrThrow({ where: { locationId: truck1, status: 'proposed' } })
    const mutate = (vars: Record<string, unknown>) => ctx.withSession(sessionWith(owner.kind === 'user' ? owner.userId : '', role('seed_role_warehouse'))).graphql.raw({
      query: 'mutation($requestId: ID!, $decision: String!, $expectedVersion: Int!, $idempotencyKey: String!) { decideReplenishment(requestId: $requestId, decision: $decision, expectedVersion: $expectedVersion, idempotencyKey: $idempotencyKey) }',
      variables: { ...vars, idempotencyKey: k('rep') },
    })
    // What e7798c5 sent: refused, and the request is untouched (it used to be rejected).
    const old = await mutate({ requestId: req.id, decision: 'approved', expectedVersion: req.version })
    expect(old.errors?.[0]?.message).toMatch(/approve or reject/)
    expect((await prisma.replenishmentRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('proposed')
    // What the screen sends now.
    const now = await mutate(replenishmentDecision(req, 'approve'))
    expect(now.errors).toBeUndefined()
    expect((await prisma.replenishmentRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('approved')
  })

  // ── M4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  it('M4: a second bill for goods already billed is a variance, never matched (received $200, two bills $204 + $196)', { timeout: 120_000 }, async () => {
    const a = await item()
    const supplier = await prisma.supplier.create({ data: { name: `Supply ${Date.now()}`, kind: 'supply_house', orderMethod: 'email_pdf' } })
    const po = await createPurchaseOrder(prisma, owner, { supplierId: supplier.id, shipToId: warehouseId, lines: [{ itemId: a, quantity: '10', unitCostMinor: '2000' }], idempotencyKey: k() })
    let row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.purchaseOrderId }, include: { lines: true } })
    await submitPurchaseOrder(prisma, owner, { purchaseOrderId: row.id, expectedVersion: row.version, idempotencyKey: k() })
    row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: row.id }, include: { lines: true } })
    await markPurchaseOrderSent(prisma, owner, { purchaseOrderId: row.id, expectedVersion: row.version, idempotencyKey: k() })
    await receivePurchaseOrder(prisma, owner, { purchaseOrderId: row.id, lines: [{ lineId: row.lines[0].id, quantity: '10' }], idempotencyKey: k() })

    const first = await recordVendorBill(prisma, owner, { purchaseOrderId: row.id, billNumber: 'INV-7001', totalMinor: '20400', idempotencyKey: k() })
    expect(first.matchStatus).toBe('matched')
    const second = await recordVendorBill(prisma, owner, { purchaseOrderId: row.id, billNumber: 'INV-7003', totalMinor: '19600', idempotencyKey: k() })
    expect(second.matchStatus).toBe('variance')
    const matched = await prisma.vendorBill.findMany({ where: { poId: row.id, matchStatus: 'matched' } })
    expect(matched.reduce((s, b) => s + b.totalMinor, 0n) <= 20400n).toBe(true)

    // Split billing still works: half received, half billed, then the rest.
    expect(threeWayMatch({ billed: 10000n, received: 20000n, alreadyBilled: 10000n, status: 'received' }).matched).toBe(true)
    expect(threeWayMatch({ billed: 10000n, received: 20000n, alreadyBilled: 20000n, status: 'received' }).matched).toBe(false)
    expect(threeWayMatch({ billed: 20400n, received: 20000n, alreadyBilled: 0n, status: 'received' }).matched).toBe(true)
    expect(threeWayMatch({ billed: 20401n, received: 20000n, alreadyBilled: 0n, status: 'received' }).matched).toBe(false)
  })

  // ── M5 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  it('M5: the seeded Technician role logs refrigerant only under its own name; a manager may log for others', { timeout: 120_000 }, async () => {
    const e = await recordEquipment(prisma, owner, { locationId: HOUSEHOLDS[0].location.id, manufacturer: 'Lennox', modelNumber: 'XC21', serialNumber: `L-${Date.now()}`, kind: 'ac_condenser', refrigerantType: 'R-410A', idempotencyKey: k() })
    const entry = (actor: Actor, technicianId: string) => logRefrigerant(prisma, actor, { kind: 'charge', equipmentId: e.equipmentId, refrigerantType: 'R-410A', quantityLb: '1.5', technicianId, idempotencyKey: k() })
    const morrison = actorWith('seed_user_morrison', TECH)
    expect(TECH).toContain('canManageRefrigerant') // the role that slipped through
    expect(await reason(entry(morrison, 'seed_emp_chu'))).toBe('not_own_name')
    expect(await reason(entry(morrison, 'seed_emp_morrison'))).toBe('OK')
    expect(await reason(entry(actorWith(owner.kind === 'user' ? owner.userId : '', role('seed_role_install_manager')), 'seed_emp_chu'))).toBe('OK')
  })

  // ── Backlog: a serial is one unit ───────────────────────────────────────────────────────────────────────────────

  it('a transfer naming a serial number moves exactly one', { timeout: 120_000 }, async () => {
    const unitItem = await item({ trackSerial: true })
    const unitId = await runInTransaction(prisma, uow => receiveSerializedUnit(uow, owner, { itemId: unitItem, serialNumber: `SN-${Date.now()}`, locationId: warehouseId, key: k('rx') }))
    expect(await reason(transferStock(prisma, owner, { itemId: unitItem, fromLocationId: warehouseId, toLocationId: truck1, quantity: '3', serializedUnitId: unitId, idempotencyKey: k() }))).toBe('INVALID_INPUT')
    expect(await reason(transferStock(prisma, owner, { itemId: unitItem, fromLocationId: warehouseId, toLocationId: truck1, quantity: '1', serializedUnitId: unitId, idempotencyKey: k() }))).toBe('OK')
    expect(String((await prisma.stockLevel.findFirst({ where: { itemId: unitItem, locationId: truck1 } }))?.onHand)).toBe(String(new Prisma.Decimal(1)))
  })
})
