import type { Actor } from '../lib/actor'
import type { UnitOfWork } from '../lib/unitOfWork'
import { Prisma } from '@prisma/client'
import { actorUserId } from '../lib/actor'

/*
 * Summit's stock room: units, a few suppliers, common HVAC and plumbing parts, one warehouse and a truck per lead technician, opening
 * counts and the manufacturers' warranty terms. Idempotent: re-running adds only what is missing. Warranty terms are the rule of thumb
 * most makers publish; they are marked unverified until the owner checks them against the maker's current paper.
 */
const UOMS = [['ea', 'Each', 'count', 0], ['ft', 'Foot', 'length', 1], ['lb', 'Pound', 'weight', 2], ['case', 'Case', 'count', 0]] as const
const SUPPLIERS = [
  { name: 'Austin Air Supply', kind: 'supply_house', accountNumber: 'SUM-4410', orderMethod: 'email_pdf' },
  { name: 'Capital Plumbing Wholesale', kind: 'supply_house', accountNumber: 'SUM-7782', orderMethod: 'email_pdf' },
]
const ITEMS = [
  { sku: 'CAP-45-440', name: 'Run capacitor 45/5 µF 440 V', cost: 1450n, min: 4, max: 10 },
  { sku: 'CONT-2P-30', name: 'Contactor 2-pole 30 A', cost: 1890n, min: 3, max: 8 },
  { sku: 'FLT-16x25', name: 'Air filter 16x25x1', cost: 420n, min: 10, max: 30 },
  { sku: 'DRN-SW', name: 'Condensate float switch', cost: 1250n, min: 2, max: 6 },
  { sku: 'R410A-25', name: 'R-410A refrigerant (lb)', cost: 1900n, min: 10, max: 50, uom: 'lb' },
  { sku: 'PEX-12-100', name: 'PEX 1/2 in tubing (ft)', cost: 85n, min: 50, max: 200, uom: 'ft' },
  { sku: 'SHARK-12', name: 'SharkBite 1/2 in coupling', cost: 640n, min: 6, max: 20 },
  { sku: 'WH-ANODE', name: 'Water heater anode rod', cost: 3200n, min: 1, max: 4 },
]
const WARRANTY: [string, number, number, number, number][] = [
  // maker, register within days, parts yrs registered, parts yrs not registered, labour yrs
  ['Carrier', 90, 10, 5, 1], ['Trane', 60, 10, 5, 1], ['Lennox', 60, 10, 5, 1], ['Rheem', 60, 10, 5, 1], ['Goodman', 60, 10, 5, 1], ['American Standard', 60, 10, 5, 1], ['A. O. Smith', 90, 6, 6, 1], ['Bradford White', 90, 6, 6, 1],
]

export async function seedStock(uow: UnitOfWork, actor: Actor) {
  const { tx } = uow
  const out = { uoms: 0, suppliers: 0, items: 0, locations: 0, opening: 0, warrantyRules: 0 }

  for (const [code, name, kind, maxDecimals] of UOMS) {
    if (!(await tx.unitOfMeasure.findUnique({ where: { code } }))) { await tx.unitOfMeasure.create({ data: { code, name, kind, maxDecimals } }); out.uoms += 1 }
  }
  const uom = new Map((await tx.unitOfMeasure.findMany({ select: { id: true, code: true } })).map(u => [u.code, u.id]))

  for (const s of SUPPLIERS) {
    if (!(await tx.supplier.findFirst({ where: { name: s.name } }))) { await tx.supplier.create({ data: s }); out.suppliers += 1 }
  }
  const supplier = await tx.supplier.findFirst({ where: { name: SUPPLIERS[0].name }, select: { id: true } })

  const items = new Map<string, { id: string; min: number; max: number }>()
  for (const i of ITEMS) {
    let row = await tx.item.findUnique({ where: { sku: i.sku }, select: { id: true } })
    if (!row) {
      row = await tx.item.create({ data: { sku: i.sku, name: i.name, kind: i.sku.startsWith('R410') ? 'refrigerant' : 'part', baseUomId: uom.get(i.uom ?? 'ea'), standardCostMinor: i.cost, defaultSupplierId: supplier?.id ?? null, active: true } as never, select: { id: true } })
      out.items += 1
    }
    items.set(i.sku, { id: row.id, min: i.min, max: i.max })
  }

  const wanted = [{ code: 'WH-MAIN', name: 'Main warehouse', kind: 'warehouse', employeeId: null as string | null }, ...[['morrison', 'Truck 1 · Morrison'], ['alvarez', 'Truck 2 · Alvarez'], ['chu', 'Truck 3 · Chu']].map(([k, name], i) => ({ code: `TRUCK-${i + 1}`, name, kind: 'truck', employeeId: `seed_emp_${k}` as string | null }))]
  const loc = new Map<string, string>()
  for (const w of wanted) {
    let row = await tx.stockLocation.findFirst({ where: { code: w.code }, select: { id: true } })
    if (!row) {
      const emp = w.employeeId ? await tx.employee.findUnique({ where: { id: w.employeeId }, select: { id: true } }) : null
      row = await tx.stockLocation.create({ data: { code: w.code, name: w.name, kind: w.kind, employeeId: emp?.id ?? null, active: true }, select: { id: true } })
      out.locations += 1
    }
    loc.set(w.code, row.id)
  }

  // Opening counts as movements, once each (the key is fixed per place and item). One statement; the database trigger keeps the levels.
  const haveKeys = new Set((await tx.stockMovement.findMany({ where: { idempotencyKey: { startsWith: 'seed:opening:' } }, select: { idempotencyKey: true } })).map(m => m.idempotencyKey))
  const itemRows = await tx.item.findMany({ where: { id: { in: [...items.values()].map(i => i.id) } }, select: { id: true, baseUomId: true } })
  const baseUom = new Map(itemRows.map(r => [r.id, r.baseUomId]))
  const movements = []
  for (const [code, locationId] of loc) {
    for (const [sku, it] of items) {
      const key = `seed:opening:${code}:${sku}`
      if (haveKeys.has(key)) continue
      const qty = new Prisma.Decimal(code === 'WH-MAIN' ? it.max * 3 : Math.max(1, Math.round(it.max / 2)))
      movements.push({ idempotencyKey: key, type: 'adjust', itemId: it.id, locationId, quantity: qty, baseQuantity: qty, uomId: baseUom.get(it.id) ?? null, reason: 'Opening count', actorId: actorUserId(actor), occurredAt: uow.now })
    }
  }
  if (movements.length) { await tx.stockMovement.createMany({ data: movements as never }); out.opening = movements.length }
  // Truck minimums refill from the warehouse.
  const haveRules = new Set((await tx.minMaxRule.findMany({ select: { locationId: true, itemId: true } })).map(r => `${r.locationId}:${r.itemId}`))
  const rules = []
  for (const [code, locationId] of loc) {
    if (code === 'WH-MAIN') continue
    for (const [, it] of items) if (!haveRules.has(`${locationId}:${it.id}`)) rules.push({ locationId, itemId: it.id, min: new Prisma.Decimal(Math.max(1, Math.round(it.min / 2))), max: new Prisma.Decimal(Math.max(2, Math.round(it.max / 2))), reorderFromId: loc.get('WH-MAIN') })
  }
  if (rules.length) await tx.minMaxRule.createMany({ data: rules as never })

  const haveRules2 = new Set((await tx.warrantyRule.findMany({ select: { manufacturer: true } })).map(r => r.manufacturer))
  const fresh = WARRANTY.filter(w => !haveRules2.has(w[0])).map(([manufacturer, days, reg, unreg, labor]) => ({ manufacturer, brand: manufacturer, registrationDeadlineDays: days, partsYearsRegistered: reg, partsYearsUnregistered: unreg, laborYears: labor, claimDeadlineDays: 60, submitMethod: 'portal', verified: false, notes: "Typical terms. Check against the maker's current warranty paper." }))
  if (fresh.length) { await tx.warrantyRule.createMany({ data: fresh }); out.warrantyRules = fresh.length }
  return out
}
