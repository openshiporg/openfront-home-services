import { payloadHash } from '../lib/canonical'
import { dec, Decimal, plain, type DecimalInput } from '../lib/decimal'
import { allocateMinor, bpsOf, extendLine, ratioBps, roundMinor } from '../lib/money'

/*
 * Price book and estimate arithmetic (DOMAIN §4.2, SM§5-6, I-E1..I-E5). Pure and exact: money is
 * bigint cents, quantities and multipliers are decimals, rounding is half-up per line. Formula prices
 * are frozen into unitPriceMinor when a version is submitted, so a published price never moves when
 * a labour rate or a cost changes later.
 */

export class PricingError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'GUARD_FAILED', message: string, readonly details: Record<string, unknown> = {}) {
    super(message)
  }
}

// ── Price book ────────────────────────────────────────────────────────────────

export type MarkupTier = { fromCostMinor: string; toCostMinor: string | null; multiplier: string }
export type MarkupTableRow = { name: string; appliesTo: 'material' | 'equipment'; tiers: MarkupTier[] }
export type LaborRateRow = { businessUnitId: string | null; hourlyMinor: bigint; afterHoursMultiplier: string | null }
export type MaterialRef = { itemKey: string; quantity: string }

export type PriceBookItemDraft = {
  itemKey: string
  kind: 'service_task' | 'material' | 'equipment' | 'fee' | 'discount' | 'bundle'
  categoryKey: string
  name: string
  customerDescription: string
  trade: 'hvac' | 'plumbing' | 'electrical' | 'general'
  businessUnitId: string | null
  pricingMethod: 'fixed' | 'formula'
  unitPriceMinor: bigint
  memberUnitPriceMinor: bigint | null
  costMinor: bigint
  laborHours: string | null
  uom: string
  taxCategory: string
  warrantyText: string
  materials: MaterialRef[]
  cancellationClassDefault: 'requested_repair' | 'necessary_replacement_parts' | 'additional_goods_services'
  ladderKey: string
  tier: '' | 'good' | 'better' | 'best'
  active: boolean
  equipmentModelId?: string | null
}

/** Markup multiplier for a unit cost: the tier whose [from, to) range holds it. */
export function markupFor(table: MarkupTableRow, costMinor: bigint): Decimal {
  const tier = table.tiers.find(t => costMinor >= BigInt(t.fromCostMinor) && (t.toCostMinor === null || costMinor < BigInt(t.toCostMinor)))
  if (!tier) throw new PricingError('INVALID_INPUT', `Markup table ${table.name} has no tier for a cost of ${costMinor} cents.`)
  return dec(tier.multiplier)
}

/** Tiers must start at 0, be contiguous and end open; multipliers at least 1. */
export function validateMarkupTiers(tiers: MarkupTier[]) {
  if (!tiers.length) throw new PricingError('INVALID_INPUT', 'A markup table needs at least one tier.')
  let expected = 0n
  tiers.forEach((tier, index) => {
    if (BigInt(tier.fromCostMinor) !== expected) throw new PricingError('INVALID_INPUT', `Markup tier ${index + 1} must start at ${expected} cents.`)
    if (dec(tier.multiplier).lessThan(1)) throw new PricingError('INVALID_INPUT', `Markup tier ${index + 1} multiplier must be at least 1.`)
    const last = index === tiers.length - 1
    if (last !== (tier.toCostMinor === null)) throw new PricingError('INVALID_INPUT', last ? 'The last markup tier must be open-ended.' : `Markup tier ${index + 1} needs an upper bound.`)
    if (!last) {
      if (BigInt(tier.toCostMinor!) <= expected) throw new PricingError('INVALID_INPUT', `Markup tier ${index + 1} must end above where it starts.`)
      expected = BigInt(tier.toCostMinor!)
    }
  })
}

/**
 * Formula price (D§4.2): laborHours × the business unit's hourly rate + Σ material unit cost ×
 * quantity × markup. Each term is rounded half-up to the cent once, then summed.
 */
export function formulaPrice(item: PriceBookItemDraft, ctx: { laborRates: LaborRateRow[]; markup: MarkupTableRow | null; materials: Map<string, PriceBookItemDraft> }) {
  const rate = ctx.laborRates.find(r => r.businessUnitId === item.businessUnitId) ?? ctx.laborRates.find(r => r.businessUnitId === null)
  if (!rate) throw new PricingError('GUARD_FAILED', `No labour rate covers ${item.itemKey}.`, { itemKey: item.itemKey })
  const hours = dec(item.laborHours ?? '0')
  const labor = extendLine(rate.hourlyMinor, hours)
  let materials = 0n
  let materialCost = 0n
  for (const ref of item.materials) {
    const material = ctx.materials.get(ref.itemKey)
    if (!material) throw new PricingError('GUARD_FAILED', `${item.itemKey} uses ${ref.itemKey}, which is not in this version.`, { itemKey: item.itemKey, material: ref.itemKey })
    if (!ctx.markup) throw new PricingError('GUARD_FAILED', 'Formula pricing with materials needs a markup table.', { itemKey: item.itemKey })
    const multiplier = markupFor(ctx.markup, material.costMinor)
    materials += roundMinor(dec(material.costMinor).times(dec(ref.quantity)).times(multiplier))
    materialCost += extendLine(material.costMinor, ref.quantity)
  }
  return { unitPriceMinor: labor + materials, laborMinor: labor, materialsMinor: materials, costMinor: materialCost, hourlyMinor: rate.hourlyMinor }
}

export type SubmitFinding = { itemKey: string; code: string; message: string }

/** Submit guards (SM§5.1): what must be true of every row before a version can go for approval. */
export function submitFindings(items: PriceBookItemDraft[], uoms: Map<string, { maxDecimals: number }>): SubmitFinding[] {
  const findings: SubmitFinding[] = []
  const keys = new Set<string>()
  for (const item of items) {
    const add = (code: string, message: string) => findings.push({ itemKey: item.itemKey, code, message })
    if (keys.has(item.itemKey)) add('duplicate_key', 'Item key is used twice.')
    keys.add(item.itemKey)
    if (!item.active) continue
    if (item.unitPriceMinor < 0n) add('negative_price', 'Price must not be negative.')
    if (item.memberUnitPriceMinor !== null && item.memberUnitPriceMinor > item.unitPriceMinor) add('member_above_list', 'Member price is above the list price.')
    if (!uoms.has(item.uom)) add('unknown_uom', `Unit ${item.uom} is not set up.`)
    if (item.kind === 'service_task' && !(item.laborHours && dec(item.laborHours).greaterThan(0))) add('task_hours_missing', 'A service task needs labour hours.')
    if (!item.taxCategory) add('tax_category_missing', 'Tax category is required.')
    if (item.kind === 'equipment' && !item.warrantyText.trim()) add('warranty_missing', 'Equipment needs warranty text.')
    if (item.kind !== 'material' && !item.customerDescription.trim()) add('description_missing', 'Customers see a description; add one.')
    if (item.tier && !item.ladderKey) add('tier_without_ladder', 'A good/better/best tier needs a ladder.')
  }
  return findings
}

/** The frozen, comparable content of an item: what customers are quoted from. */
export function itemContent(item: PriceBookItemDraft) {
  return {
    itemKey: item.itemKey, kind: item.kind, categoryKey: item.categoryKey, name: item.name, customerDescription: item.customerDescription,
    trade: item.trade, businessUnitId: item.businessUnitId, pricingMethod: item.pricingMethod, unitPriceMinor: item.unitPriceMinor,
    memberUnitPriceMinor: item.memberUnitPriceMinor, costMinor: item.costMinor, laborHours: item.laborHours, uom: item.uom,
    taxCategory: item.taxCategory, warrantyText: item.warrantyText, materials: item.materials, cancellationClassDefault: item.cancellationClassDefault,
    ladderKey: item.ladderKey, tier: item.tier, active: item.active, equipmentModelId: item.equipmentModelId ?? null,
  }
}

export function versionContentHash(content: { items: PriceBookItemDraft[]; categories: unknown[]; laborRates: unknown[]; markupTables: unknown[]; memberPricingRules: unknown[] }) {
  return payloadHash({
    items: [...content.items].sort((a, b) => a.itemKey.localeCompare(b.itemKey)).map(itemContent),
    categories: content.categories, laborRates: content.laborRates, markupTables: content.markupTables, memberPricingRules: content.memberPricingRules,
  })
}

export type PriceDiff = {
  added: { itemKey: string; name: string; unitPriceMinor: string }[]
  removed: { itemKey: string; name: string; unitPriceMinor: string }[]
  repriced: { itemKey: string; name: string; fromMinor: string; toMinor: string; changeBps: string | null }[]
  changed: { itemKey: string; name: string; fields: string[] }[]
  unchanged: number
}

/** What a reviewer approves: added, removed and repriced items against the version it replaces. */
export function diffItems(before: PriceBookItemDraft[], after: PriceBookItemDraft[]): PriceDiff {
  const prev = new Map(before.filter(i => i.active).map(i => [i.itemKey, i]))
  const next = new Map(after.filter(i => i.active).map(i => [i.itemKey, i]))
  const diff: PriceDiff = { added: [], removed: [], repriced: [], changed: [], unchanged: 0 }
  for (const [key, item] of next) {
    const old = prev.get(key)
    if (!old) { diff.added.push({ itemKey: key, name: item.name, unitPriceMinor: item.unitPriceMinor.toString() }); continue }
    if (old.unitPriceMinor !== item.unitPriceMinor) {
      const changeBps = ratioBps(item.unitPriceMinor - old.unitPriceMinor, old.unitPriceMinor)
      diff.repriced.push({ itemKey: key, name: item.name, fromMinor: old.unitPriceMinor.toString(), toMinor: item.unitPriceMinor.toString(), changeBps })
      continue
    }
    const a = itemContent(old) as Record<string, unknown>
    const b = itemContent(item) as Record<string, unknown>
    const fields = Object.keys(b).filter(k => payloadHash(a[k] ?? null) !== payloadHash(b[k] ?? null))
    if (fields.length) diff.changed.push({ itemKey: key, name: item.name, fields })
    else diff.unchanged += 1
  }
  for (const [key, item] of prev) if (!next.has(key)) diff.removed.push({ itemKey: key, name: item.name, unitPriceMinor: item.unitPriceMinor.toString() })
  return diff
}

export type CostRow = { itemKey: string; costMinor: bigint }

/** Supplier cost import: the cost changes it would make to a draft, never to a published version. */
export function costChangeReport(items: PriceBookItemDraft[], costs: CostRow[]) {
  const byKey = new Map(items.map(i => [i.itemKey, i]))
  const changes: { itemKey: string; name: string; fromMinor: string; toMinor: string; marginBpsAfter: string | null }[] = []
  const unknown: string[] = []
  for (const row of costs) {
    if (row.costMinor < 0n) throw new PricingError('INVALID_INPUT', `Cost for ${row.itemKey} must not be negative.`)
    const item = byKey.get(row.itemKey)
    if (!item) { unknown.push(row.itemKey); continue }
    if (item.costMinor === row.costMinor) continue
    const marginBpsAfter = ratioBps(item.unitPriceMinor - row.costMinor, item.unitPriceMinor)
    changes.push({ itemKey: row.itemKey, name: item.name, fromMinor: item.costMinor.toString(), toMinor: row.costMinor.toString(), marginBpsAfter })
  }
  return { changes, unknown }
}

// ── Estimates ─────────────────────────────────────────────────────────────────

/** The frozen copy of a price-book row on an estimate line (I-E2). */
export type LineSnapshot = {
  priceBookVersionId: string
  priceBookItemId: string | null
  itemKey: string
  name: string
  description: string
  quantity: string
  uom: string
  unitPriceMinor: string
  listUnitPriceMinor: string
  memberPriced: boolean
  costMinor: string
  taxCategory: string
  trade: string
  warrantyText: string
  cancellationClass: string
}

export type QuoteLineInput = { item: PriceBookItemDraft & { id: string | null }; quantity: DecimalInput; memberPricing: boolean; cancellationClass?: LineSnapshot['cancellationClass']; description?: string }

/** Price one line from the active version and freeze it. Quantity precision is the unit's. */
export function quoteLine(versionId: string, input: QuoteLineInput, uom: { maxDecimals: number }): LineSnapshot & { amountMinor: bigint } {
  const quantity = dec(input.quantity)
  if (quantity.lessThanOrEqualTo(0)) throw new PricingError('INVALID_INPUT', `Quantity for ${input.item.itemKey} must be more than zero.`)
  if (quantity.decimalPlaces() > uom.maxDecimals) throw new PricingError('INVALID_INPUT', `${input.item.uom} quantities allow ${uom.maxDecimals} decimal places.`)
  if (!input.item.active) throw new PricingError('GUARD_FAILED', `${input.item.itemKey} is not sold any more.`)
  const memberPriced = input.memberPricing && input.item.memberUnitPriceMinor !== null
  const unit = memberPriced ? input.item.memberUnitPriceMinor! : input.item.unitPriceMinor
  return {
    priceBookVersionId: versionId,
    priceBookItemId: input.item.id,
    itemKey: input.item.itemKey,
    name: input.item.name,
    description: input.description?.trim() || input.item.customerDescription || input.item.name,
    quantity: plain(quantity),
    uom: input.item.uom,
    unitPriceMinor: unit.toString(),
    listUnitPriceMinor: input.item.unitPriceMinor.toString(),
    memberPriced,
    costMinor: extendLine(input.item.costMinor, quantity).toString(),
    taxCategory: input.item.taxCategory,
    trade: input.item.trade,
    warrantyText: input.item.warrantyText,
    cancellationClass: input.cancellationClass ?? input.item.cancellationClassDefault,
    amountMinor: extendLine(unit, quantity),
  }
}

export type OptionTotals = { subtotalMinor: bigint; discountMinor: bigint; lineDiscounts: bigint[]; totalBeforeTaxMinor: bigint; costMinor: bigint; marginBps: string | null }

/** Order discount spread over the lines by amount (allocateMinor), so per-line amounts stay exact. */
export function optionTotals(lines: { amountMinor: bigint; costMinor: bigint }[], discountBps: number): OptionTotals {
  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 10_000) throw new PricingError('INVALID_INPUT', 'Discount must be between 0 and 100%.')
  const subtotal = lines.reduce((s, l) => s + l.amountMinor, 0n)
  const discount = bpsOf(subtotal, discountBps)
  const lineDiscounts = discount === 0n || subtotal === 0n ? lines.map(() => 0n) : allocateMinor(discount, lines.map(l => l.amountMinor))
  const cost = lines.reduce((s, l) => s + l.costMinor, 0n)
  const net = subtotal - discount
  const marginBps = ratioBps(net - cost, net)
  return { subtotalMinor: subtotal, discountMinor: discount, lineDiscounts, totalBeforeTaxMinor: net, costMinor: cost, marginBps }
}

/** The quote hash a voice or chat agent must match before it speaks a price (I§ runtime guardrails). */
export const quoteHash = (versionId: string, lines: LineSnapshot[], discountBps = 0) => payloadHash({ versionId, discountBps, lines })

/** Hash of an option as presented: what an Authorization binds to (I-E4). */
export const optionHash = (option: { tier: string; name: string; subtotalMinor: bigint; discountMinor: bigint; totalMinor: bigint; lines: (LineSnapshot & { id: string; amountMinor: bigint; discountMinor: bigint })[] }) =>
  payloadHash({ tier: option.tier, name: option.name, subtotalMinor: option.subtotalMinor, discountMinor: option.discountMinor, totalMinor: option.totalMinor, lines: option.lines.map(l => ({ ...l })) })

/** Deposit cap from the home-improvement contract pack: the lower of a percentage and an amount, when set. */
export function depositCap(totalMinor: bigint, rules: { depositCapPct: string | null; depositCapMinor: string | null }): bigint | null {
  const caps: bigint[] = []
  if (rules.depositCapPct !== null) caps.push(roundMinor(dec(totalMinor).times(dec(rules.depositCapPct)).div(100), Decimal.ROUND_DOWN))
  if (rules.depositCapMinor !== null) caps.push(BigInt(rules.depositCapMinor))
  return caps.length ? caps.reduce((a, b) => (a < b ? a : b)) : null
}

export type SalesTaxMatrixRow = { propertyClass: string; contractTaxMode: string; taxCategory: string; taxable: boolean; basis: 'price' | 'at_least_cost' | 'none'; note?: string }
export type SalesTaxRulesLike = { stateRate: string; maxLocalRate: string; localRates: { code: string; name: string; rate: string }[]; matrix: SalesTaxMatrixRow[] }

/**
 * Estimated sales tax for an option (shown on the estimate; the invoice computes the binding figure in
 * Phase 3). First matching matrix row wins, so the pack orders rows most specific first. The local rate
 * is the place's own (by city code); an unknown city uses the maximum local rate, so an estimate never
 * understates tax. Lines arrive net of discount.
 */
export function estimateSalesTax(
  lines: { taxCategory: string; netMinor: bigint; costMinor: bigint }[],
  ctx: { propertyClass: string; contractTaxMode: 'lump_sum' | 'separated'; cityCode: string | null; rules: SalesTaxRulesLike },
) {
  const local = ctx.rules.localRates.find(r => r.code === ctx.cityCode)
  const rate = dec(ctx.rules.stateRate).plus(local ? local.rate : ctx.rules.maxLocalRate)
  let base = 0n
  const rows = lines.map(line => {
    const row = ctx.rules.matrix.find(m => m.propertyClass === ctx.propertyClass && (m.contractTaxMode === 'any' || m.contractTaxMode === ctx.contractTaxMode) && (m.taxCategory === 'any' || m.taxCategory === line.taxCategory))
    if (!row) throw new PricingError('GUARD_FAILED', `No sales-tax rule covers ${line.taxCategory} on ${ctx.propertyClass} work.`)
    const lineBase = !row.taxable || row.basis === 'none' ? 0n : row.basis === 'at_least_cost' && line.costMinor > line.netMinor ? line.costMinor : line.netMinor
    base += lineBase
    return { taxable: lineBase > 0n, baseMinor: lineBase }
  })
  return { taxMinor: roundMinor(dec(base).times(rate)), rate: plain(rate), localRateCode: local?.code ?? null, rows }
}
