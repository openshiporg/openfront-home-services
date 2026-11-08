import type { Prisma } from '@prisma/client'
import { authorizeOperation, recordAgentRead } from '../lib/agentGate'
import { actorUserId, type Actor } from '../lib/actor'
import { requestApproval } from '../lib/approval'
import { auditCreate, casUpdate, transition } from '../lib/cas'
import { command } from '../lib/command'
import type { Db, Tx } from '../lib/db'
import { dec, plain, toScale } from '../lib/decimal'
import { DomainError, Codes } from '../lib/errors'
import { bpsOf } from '../lib/money'
import type { UnitOfWork } from '../lib/unitOfWork'
import {
  PricingError, costChangeReport, diffItems, formulaPrice, optionTotals, quoteHash, quoteLine, submitFindings, validateMarkupTiers, versionContentHash,
  type LaborRateRow, type MarkupTableRow, type MarkupTier, type MaterialRef, type PriceBookItemDraft,
} from '../domain/pricing'
import { CANCELLATION_CLASSES, ITEM_KINDS, TAX_CATEGORIES, TRADE_OR_GENERAL } from '../models/sales'

/*
 * Price book (SM§5, I-E1). A price book has numbered versions. Only a draft can be edited (a database
 * trigger enforces it too); submitting freezes formula prices into the rows, checks every row, diffs
 * against the active version and asks a second person to publish. Publication is maker-checker
 * (canApprovePriceBook, approver ≠ submitter). A published version becomes active at effectiveAt and
 * retires the one before it in the same transaction. Supplier cost imports only ever write a draft.
 */

const EDIT: ['canManagePriceBook'] = ['canManagePriceBook']
const READ = ['canManagePriceBook', 'canApprovePriceBook', 'canPresentEstimates', 'canSellEstimates', 'canBook', 'canManageCustomers'] as const

const fail = (error: unknown): never => {
  if (error instanceof PricingError) throw new DomainError(error.code === 'GUARD_FAILED' ? Codes.GUARD_FAILED : Codes.INVALID_INPUT, error.message, error.details)
  throw error
}

const minorIn = (value: unknown, field: string, allowNull = false): bigint | null => {
  if ((value === null || value === undefined || value === '') && allowNull) return null
  if (typeof value === 'bigint') { if (value < 0n) throw new DomainError(Codes.INVALID_INPUT, `${field} must not be negative.`, { field }); return value }
  if (typeof value !== 'string' || !/^\d{1,13}$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be whole cents as a string, e.g. "32500".`, { field })
  return BigInt(value)
}

const oneOf = <T extends string>(values: readonly T[], value: unknown, field: string, fallback?: T): T => {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback
  if (!values.includes(value as T)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be one of ${values.join(', ')}.`, { field })
  return value as T
}

const decimalText = (value: unknown, field: string, max = 4): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{1,10}(\.\d+)?$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be a decimal string, e.g. "1.5".`, { field })
  if (dec(value).decimalPlaces() > max) throw new DomainError(Codes.INVALID_INPUT, `${field} allows ${max} decimal places.`, { field })
  return plain(value)
}

// ── Loading ───────────────────────────────────────────────────────────────────

type ItemRow = Prisma.PriceBookItemGetPayload<object>

export function draftOf(row: ItemRow): PriceBookItemDraft & { id: string } {
  return {
    id: row.id, itemKey: row.itemKey, kind: row.kind as PriceBookItemDraft['kind'], categoryKey: row.categoryKey, name: row.name, customerDescription: row.customerDescription,
    trade: row.trade as PriceBookItemDraft['trade'], businessUnitId: row.businessUnitId, pricingMethod: row.pricingMethod as PriceBookItemDraft['pricingMethod'],
    unitPriceMinor: row.unitPriceMinor, memberUnitPriceMinor: row.memberUnitPriceMinor, costMinor: row.costMinor, laborHours: row.laborHours ? plain(row.laborHours.toString()) : null,
    uom: row.uom, taxCategory: row.taxCategory, warrantyText: row.warrantyText, materials: (row.materials as MaterialRef[] | null) ?? [],
    cancellationClassDefault: row.cancellationClassDefault as PriceBookItemDraft['cancellationClassDefault'], ladderKey: row.ladderKey, tier: row.tier as PriceBookItemDraft['tier'],
    active: row.active, equipmentModelId: row.equipmentModelId,
  }
}

export async function loadVersionContent(db: Tx | Db, versionId: string) {
  const [items, categories, laborRates, markupTables, memberPricingRules] = await Promise.all([
    db.priceBookItem.findMany({ where: { priceBookVersionId: versionId }, orderBy: [{ categoryKey: 'asc' }, { sortOrder: 'asc' }, { itemKey: 'asc' }] }),
    db.priceBookCategory.findMany({ where: { priceBookVersionId: versionId }, orderBy: [{ sortOrder: 'asc' }, { categoryKey: 'asc' }] }),
    db.laborRate.findMany({ where: { priceBookVersionId: versionId } }),
    db.markupTable.findMany({ where: { priceBookVersionId: versionId }, orderBy: { name: 'asc' } }),
    db.memberPricingRule.findMany({ where: { priceBookVersionId: versionId } }),
  ])
  return {
    items: items.map(draftOf),
    rows: items,
    categories: categories.map(c => ({ categoryKey: c.categoryKey, name: c.name, trade: c.trade, parentKey: c.parentKey, sortOrder: c.sortOrder })),
    laborRates: laborRates.map(r => ({ businessUnitId: r.businessUnitId, hourlyMinor: r.hourlyMinor, afterHoursMultiplier: r.afterHoursMultiplier ? plain(r.afterHoursMultiplier.toString()) : null }))
      .sort((a, b) => (a.businessUnitId ?? '').localeCompare(b.businessUnitId ?? '')) as LaborRateRow[],
    markupTables: markupTables.map(t => ({ name: t.name, appliesTo: t.appliesTo as MarkupTableRow['appliesTo'], tiers: (t.tiers as MarkupTier[] | null) ?? [] })),
    memberPricingRules: memberPricingRules.map(r => ({ planCode: r.planCode, scope: r.scope, scopeKey: r.scopeKey, discountBps: r.discountBps, waiveTripFee: r.waiveTripFee }))
      .sort((a, b) => `${a.planCode}:${a.scope}:${a.scopeKey}`.localeCompare(`${b.planCode}:${b.scope}:${b.scopeKey}`)),
  }
}

const hashOf = (content: Awaited<ReturnType<typeof loadVersionContent>>) =>
  versionContentHash({ items: content.items, categories: content.categories, laborRates: content.laborRates, markupTables: content.markupTables, memberPricingRules: content.memberPricingRules })

async function lockVersion(tx: Tx, versionId: string) {
  const [row] = await tx.$queryRaw<{ id: string; status: string; version: number; priceBook: string | null; versionNumber: number }[]>`SELECT id, status, version, "priceBook", "versionNumber" FROM "PriceBookVersion" WHERE id = ${versionId} FOR UPDATE`
  if (!row) throw new DomainError(Codes.NOT_FOUND, 'Price book version not found.')
  return row
}

async function lockDraft(tx: Tx, versionId: string, expectedVersion?: number | null) {
  const row = await lockVersion(tx, versionId)
  if (expectedVersion !== undefined && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, 'This price book version changed since you loaded it. Reload and try again.', { currentStatus: row.status, currentVersion: row.version })
  if (row.status !== 'draft') throw new DomainError(Codes.INVALID_TRANSITION, `This version is ${row.status.replaceAll('_', ' ')}; only a draft can be edited. Start a new draft.`, { currentStatus: row.status })
  return row
}

/** Bump the draft's version so a reviewer's open screen goes stale when rows change under it. */
const touchDraft = (tx: Tx, versionId: string) => tx.priceBookVersion.update({ where: { id: versionId }, data: { version: { increment: 1 } }, select: { version: true } })

/** The price book an estimate quotes from: the one that lists the business unit, else a company-wide one. */
export async function priceBookFor(db: Tx | Db, businessUnitId: string | null) {
  const books = await db.priceBook.findMany({ select: { id: true, code: true, activeVersionId: true, businessUnits: { select: { id: true } } }, orderBy: { code: 'asc' } })
  const specific = businessUnitId ? books.find(b => b.businessUnits.some(bu => bu.id === businessUnitId)) : undefined
  const book = specific ?? books.find(b => b.businessUnits.length === 0) ?? (books.length === 1 ? books[0] : undefined)
  if (!book) throw new DomainError(Codes.GUARD_FAILED, 'No price book covers this department yet.', { reason: 'no_price_book' })
  return book
}

export async function activeVersionFor(db: Tx | Db, businessUnitId: string | null) {
  const book = await priceBookFor(db, businessUnitId)
  if (!book.activeVersionId) throw new DomainError(Codes.GUARD_FAILED, `Price book ${book.code} has no active version yet.`, { reason: 'no_active_version' })
  return { priceBookId: book.id, versionId: book.activeVersionId }
}

// ── Books and drafts ──────────────────────────────────────────────────────────

export async function createPriceBook(db: Db, actor: Actor, args: { name: string; code: string; businessUnitIds?: string[] | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.create', EDIT, args)
  const name = args.name?.trim()
  if (!name) throw new DomainError(Codes.INVALID_INPUT, 'Name the price book.', { field: 'name' })
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(args.code ?? '')) throw new DomainError(Codes.INVALID_INPUT, 'Code is 2-24 capital letters, digits or dashes.', { field: 'code' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.create', actor, idempotencyKey, params, now: args.now }, async uow => {
    const company = await uow.tx.companySettings.findFirst({ select: { currencyCode: true } })
    const book = await uow.tx.priceBook.create({ data: { name, code: args.code, currencyCode: company?.currencyCode || 'USD', businessUnits: { connect: (args.businessUnitIds ?? []).map(id => ({ id })) } }, select: { id: true } })
    auditCreate(uow, actor, 'PriceBook', book.id, 'pricebook.created', { name, code: args.code, businessUnitIds: args.businessUnitIds ?? [] })
    const draft = await createDraftInTx(uow, actor, book.id, { label: 'Initial', source: 'manual' })
    return { priceBookId: book.id, draftVersionId: draft.id }
  })
  return { replay: result.replay, ...result.value }
}

/** A new draft: a full copy of the active version (or the latest published one), editable until submitted. */
async function createDraftInTx(uow: UnitOfWork, actor: Actor, priceBookId: string, opts: { label?: string | null; source: 'manual' | 'copy' | 'supplier_import'; notes?: string }) {
  const { tx } = uow
  await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${priceBookId} FOR UPDATE`
  const open = await tx.priceBookVersion.findFirst({ where: { priceBookId, status: { in: ['draft', 'pending_approval'] } }, select: { id: true, versionNumber: true, status: true } })
  if (open) throw new DomainError(Codes.GUARD_FAILED, `Version ${open.versionNumber} is already ${open.status === 'draft' ? 'a draft' : 'waiting for approval'}; finish or discard it first.`, { reason: 'open_draft', versionId: open.id })
  const book = await tx.priceBook.findUniqueOrThrow({ where: { id: priceBookId }, select: { activeVersionId: true } })
  const last = await tx.priceBookVersion.findFirst({ where: { priceBookId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } })
  const base = book.activeVersionId ?? (await tx.priceBookVersion.findFirst({ where: { priceBookId, status: { in: ['published', 'active', 'retired'] } }, orderBy: { versionNumber: 'desc' }, select: { id: true } }))?.id ?? null
  const versionNumber = (last?.versionNumber ?? 0) + 1
  const draft = await tx.priceBookVersion.create({
    data: { priceBookId, versionNumber, label: opts.label?.trim() || `Version ${versionNumber}`, status: 'draft', source: base ? opts.source === 'manual' ? 'copy' : opts.source : 'manual', basedOnId: base, notes: opts.notes ?? '' },
    select: { id: true, versionNumber: true },
  })
  if (base) {
    const content = await loadVersionContent(tx, base)
    const rates = await tx.laborRate.findMany({ where: { priceBookVersionId: base } })
    const tables = await tx.markupTable.findMany({ where: { priceBookVersionId: base } })
    if (content.categories.length) await tx.priceBookCategory.createMany({ data: content.categories.map(c => ({ ...c, priceBookVersionId: draft.id })) })
    if (content.rows.length) await tx.priceBookItem.createMany({ data: content.rows.map(({ id: _id, createdAt: _c, updatedAt: _u, priceBookVersionId: _v, ...row }) => ({ ...row, materials: (row.materials ?? undefined) as never, priceBookVersionId: draft.id })) })
    if (rates.length) await tx.laborRate.createMany({ data: rates.map(r => ({ priceBookVersionId: draft.id, businessUnitId: r.businessUnitId, hourlyMinor: r.hourlyMinor, afterHoursMultiplier: r.afterHoursMultiplier })) })
    if (tables.length) await tx.markupTable.createMany({ data: tables.map(t => ({ priceBookVersionId: draft.id, name: t.name, appliesTo: t.appliesTo, tiers: (t.tiers ?? undefined) as never })) })
    if (content.memberPricingRules.length) await tx.memberPricingRule.createMany({ data: content.memberPricingRules.map(r => ({ ...r, priceBookVersionId: draft.id })) })
  }
  auditCreate(uow, actor, 'PriceBookVersion', draft.id, 'pricebook_version.drafted', { priceBookId, versionNumber, basedOn: base, source: opts.source })
  return draft
}

export async function startPriceBookDraft(db: Db, actor: Actor, args: { priceBookId: string; label?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.draft', EDIT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.draft', actor, idempotencyKey, params, now: args.now }, async uow => {
    const draft = await createDraftInTx(uow, actor, args.priceBookId, { label: args.label, source: 'copy' })
    return { versionId: draft.id, versionNumber: draft.versionNumber }
  })
  return { replay: result.replay, ...result.value }
}

export type ItemInput = {
  itemKey: string; kind: string; categoryKey?: string | null; name: string; customerDescription?: string | null; internalNotes?: string | null
  trade?: string | null; businessUnitId?: string | null; pricingMethod?: string | null; unitPriceMinor?: string | null; memberUnitPriceMinor?: string | null
  costMinor?: string | null; laborHours?: string | null; uom: string; taxCategory: string; warrantyText?: string | null; equipmentModelId?: string | null
  materials?: MaterialRef[] | null; commissionCode?: string | null; spiffCode?: string | null; cancellationClassDefault?: string | null
  ladderKey?: string | null; tier?: string | null; sortOrder?: number | null; active?: boolean | null
}

function itemData(input: ItemInput) {
  const itemKey = String(input.itemKey ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9-]{1,47}$/.test(itemKey)) throw new DomainError(Codes.INVALID_INPUT, 'Item key is 2-48 capital letters, digits or dashes.', { field: 'itemKey' })
  const name = input.name?.trim()
  if (!name) throw new DomainError(Codes.INVALID_INPUT, 'Name the item.', { field: 'name' })
  const pricingMethod = oneOf(['fixed', 'formula'] as const, input.pricingMethod, 'pricingMethod', 'fixed')
  const materials = (input.materials ?? []).map((m, i) => {
    const key = String(m?.itemKey ?? '').trim().toUpperCase()
    if (!key) throw new DomainError(Codes.INVALID_INPUT, `Material ${i + 1} needs an item key.`, { field: 'materials' })
    const quantity = decimalText(m.quantity, `materials[${i}].quantity`)
    if (!quantity || dec(quantity).lessThanOrEqualTo(0)) throw new DomainError(Codes.INVALID_INPUT, `Material ${key} needs a quantity above zero.`, { field: 'materials' })
    return { itemKey: key, quantity }
  })
  const unitPriceMinor = pricingMethod === 'formula' ? minorIn(input.unitPriceMinor ?? '0', 'unitPriceMinor')! : minorIn(input.unitPriceMinor, 'unitPriceMinor')!
  const tier = oneOf(['', 'good', 'better', 'best'] as const, input.tier ?? '', 'tier', '')
  return {
    itemKey, name, pricingMethod, unitPriceMinor, tier, materials,
    kind: oneOf(ITEM_KINDS, input.kind, 'kind'),
    categoryKey: input.categoryKey?.trim() ?? '',
    customerDescription: input.customerDescription?.trim() ?? '',
    internalNotes: input.internalNotes?.trim() ?? '',
    trade: oneOf(TRADE_OR_GENERAL, input.trade, 'trade', 'general'),
    businessUnitId: input.businessUnitId || null,
    memberUnitPriceMinor: minorIn(input.memberUnitPriceMinor, 'memberUnitPriceMinor', true),
    costMinor: minorIn(input.costMinor ?? '0', 'costMinor')!,
    laborHours: decimalText(input.laborHours, 'laborHours'),
    uom: String(input.uom ?? '').trim(),
    taxCategory: oneOf(TAX_CATEGORIES, input.taxCategory, 'taxCategory'),
    warrantyText: input.warrantyText?.trim() ?? '',
    equipmentModelId: input.equipmentModelId || null,
    commissionCode: input.commissionCode?.trim() ?? '',
    spiffCode: input.spiffCode?.trim() ?? '',
    cancellationClassDefault: oneOf(CANCELLATION_CLASSES, input.cancellationClassDefault, 'cancellationClassDefault', 'requested_repair'),
    ladderKey: input.ladderKey?.trim() ?? '',
    sortOrder: Number.isSafeInteger(input.sortOrder) ? input.sortOrder! : 0,
    active: input.active ?? true,
  }
}

/** Add or change items on a draft (upsert by item key). */
export async function saveDraftItems(db: Db, actor: Actor, args: { versionId: string; items: ItemInput[]; expectedVersion?: number | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.edit', EDIT, args)
  if (!Array.isArray(args.items) || !args.items.length || args.items.length > 500) throw new DomainError(Codes.INVALID_INPUT, 'Send between 1 and 500 items.', { field: 'items' })
  const rows = args.items.map(itemData)
  const keys = new Set<string>()
  for (const r of rows) { if (keys.has(r.itemKey)) throw new DomainError(Codes.INVALID_INPUT, `${r.itemKey} appears twice.`, { field: 'items' }); keys.add(r.itemKey) }
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.edit', actor, idempotencyKey, params, now: args.now }, async uow => {
    await lockDraft(uow.tx, args.versionId, args.expectedVersion)
    const uoms = new Set((await uow.tx.unitOfMeasure.findMany({ select: { code: true } })).map(u => u.code))
    for (const r of rows) if (!uoms.has(r.uom)) throw new DomainError(Codes.INVALID_INPUT, `Unit ${r.uom || '(blank)'} is not set up.`, { field: 'uom', itemKey: r.itemKey })
    const existing = new Map((await uow.tx.priceBookItem.findMany({ where: { priceBookVersionId: args.versionId, itemKey: { in: [...keys] } }, select: { id: true, itemKey: true } })).map(r => [r.itemKey, r.id]))
    const fresh = []
    for (const { materials, ...r } of rows) {
      const data = { ...r, materials: materials as never, laborHours: r.laborHours }
      const id = existing.get(r.itemKey)
      if (id) await uow.tx.priceBookItem.update({ where: { id }, data })
      else fresh.push({ ...data, priceBookVersionId: args.versionId })
    }
    if (fresh.length) await uow.tx.priceBookItem.createMany({ data: fresh })
    const { version } = await touchDraft(uow.tx, args.versionId)
    auditCreate(uow, actor, 'PriceBookVersion', args.versionId, 'pricebook_version.items_saved', { added: rows.filter(r => !existing.has(r.itemKey)).map(r => r.itemKey), changed: rows.filter(r => existing.has(r.itemKey)).map(r => r.itemKey) })
    return { versionId: args.versionId, version, saved: rows.length }
  })
  return { replay: result.replay, ...result.value }
}

/** Take items out of a draft. Published versions keep theirs; the next version simply won't have them. */
export async function removeDraftItems(db: Db, actor: Actor, args: { versionId: string; itemKeys: string[]; expectedVersion?: number | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.edit', EDIT, args)
  if (!args.itemKeys?.length) throw new DomainError(Codes.INVALID_INPUT, 'Choose items to remove.', { field: 'itemKeys' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.remove_items', actor, idempotencyKey, params, now: args.now }, async uow => {
    await lockDraft(uow.tx, args.versionId, args.expectedVersion)
    const { count } = await uow.tx.priceBookItem.deleteMany({ where: { priceBookVersionId: args.versionId, itemKey: { in: args.itemKeys } } })
    const { version } = await touchDraft(uow.tx, args.versionId)
    auditCreate(uow, actor, 'PriceBookVersion', args.versionId, 'pricebook_version.items_removed', { itemKeys: args.itemKeys, removed: count })
    return { versionId: args.versionId, version, removed: count }
  })
  return { replay: result.replay, ...result.value }
}

export type DraftSettings = {
  categories?: { categoryKey: string; name: string; trade?: string | null; parentKey?: string | null; sortOrder?: number | null }[] | null
  laborRates?: { businessUnitId?: string | null; hourlyMinor: string; afterHoursMultiplier?: string | null }[] | null
  markupTables?: { name: string; appliesTo?: string | null; tiers: MarkupTier[] }[] | null
  memberPricingRules?: { planCode: string; scope?: string | null; scopeKey?: string | null; discountBps: number; waiveTripFee?: boolean | null }[] | null
}

/** Replace a draft's categories, labour rates, markup tables or member pricing (each list given replaces that list). */
export async function saveDraftSettings(db: Db, actor: Actor, args: DraftSettings & { versionId: string; expectedVersion?: number | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.edit', EDIT, args)
  const categories = args.categories?.map((c, i) => {
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(c.categoryKey ?? '')) throw new DomainError(Codes.INVALID_INPUT, `Category ${i + 1}: key is lower-case letters, digits and dashes.`, { field: 'categories' })
    if (!c.name?.trim()) throw new DomainError(Codes.INVALID_INPUT, `Category ${c.categoryKey} needs a name.`, { field: 'categories' })
    return { categoryKey: c.categoryKey, name: c.name.trim(), trade: oneOf(TRADE_OR_GENERAL, c.trade, 'trade', 'general'), parentKey: c.parentKey ?? '', sortOrder: c.sortOrder ?? i }
  })
  const laborRates = args.laborRates?.map(r => {
    const hourly = minorIn(r.hourlyMinor, 'hourlyMinor')!
    if (hourly <= 0n) throw new DomainError(Codes.INVALID_INPUT, 'An hourly rate must be above zero.', { field: 'laborRates' })
    const multiplier = decimalText(r.afterHoursMultiplier, 'afterHoursMultiplier', 6)
    if (multiplier && dec(multiplier).lessThan(1)) throw new DomainError(Codes.INVALID_INPUT, 'The after-hours multiplier is at least 1.', { field: 'laborRates' })
    return { businessUnitId: r.businessUnitId || null, hourlyMinor: hourly, afterHoursMultiplier: multiplier ? toScale(multiplier, 'rate') : null }
  })
  if (laborRates && new Set(laborRates.map(r => r.businessUnitId ?? '')).size !== laborRates.length) throw new DomainError(Codes.INVALID_INPUT, 'One labour rate per department (and one default).', { field: 'laborRates' })
  const markupTables = args.markupTables?.map(t => {
    if (!t.name?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Name the markup table.', { field: 'markupTables' })
    try { validateMarkupTiers(t.tiers ?? []) } catch (error) { fail(error) }
    return { name: t.name.trim(), appliesTo: oneOf(['material', 'equipment'] as const, t.appliesTo, 'appliesTo', 'material'), tiers: t.tiers.map(x => ({ fromCostMinor: String(x.fromCostMinor), toCostMinor: x.toCostMinor === null ? null : String(x.toCostMinor), multiplier: plain(x.multiplier) })) }
  })
  if (markupTables && new Set(markupTables.map(t => t.appliesTo)).size !== markupTables.length) throw new DomainError(Codes.INVALID_INPUT, 'One markup table for materials and one for equipment.', { field: 'markupTables' })
  const memberPricingRules = args.memberPricingRules?.map(r => {
    if (!r.planCode?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Member pricing needs a plan code.', { field: 'memberPricingRules' })
    if (!Number.isInteger(r.discountBps) || r.discountBps < 0 || r.discountBps > 10_000) throw new DomainError(Codes.INVALID_INPUT, 'Member discount is 0 to 10000 basis points.', { field: 'memberPricingRules' })
    return { planCode: r.planCode.trim(), scope: oneOf(['all', 'category', 'item'] as const, r.scope, 'scope', 'all'), scopeKey: r.scopeKey ?? '', discountBps: r.discountBps, waiveTripFee: !!r.waiveTripFee }
  })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.settings', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const versionId = args.versionId
    await lockDraft(tx, versionId, args.expectedVersion)
    if (categories) { await tx.priceBookCategory.deleteMany({ where: { priceBookVersionId: versionId } }); if (categories.length) await tx.priceBookCategory.createMany({ data: categories.map(c => ({ ...c, priceBookVersionId: versionId })) }) }
    if (laborRates) { await tx.laborRate.deleteMany({ where: { priceBookVersionId: versionId } }); if (laborRates.length) await tx.laborRate.createMany({ data: laborRates.map(r => ({ ...r, priceBookVersionId: versionId })) }) }
    if (markupTables) { await tx.markupTable.deleteMany({ where: { priceBookVersionId: versionId } }); if (markupTables.length) await tx.markupTable.createMany({ data: markupTables.map(t => ({ ...t, tiers: t.tiers as never, priceBookVersionId: versionId })) }) }
    if (memberPricingRules) { await tx.memberPricingRule.deleteMany({ where: { priceBookVersionId: versionId } }); if (memberPricingRules.length) await tx.memberPricingRule.createMany({ data: memberPricingRules.map(r => ({ ...r, priceBookVersionId: versionId })) }) }
    const { version } = await touchDraft(tx, versionId)
    auditCreate(uow, actor, 'PriceBookVersion', versionId, 'pricebook_version.settings_saved', { categories: categories?.length ?? null, laborRates: laborRates ?? null, markupTables: markupTables ?? null, memberPricingRules: memberPricingRules ?? null })
    return { versionId, version }
  })
  return { replay: result.replay, ...result.value }
}

/** Member price for a formula item: the most specific rule (item > category > all); across plans, the smallest discount. */
function memberPriceFor(item: PriceBookItemDraft, unit: bigint, rules: { scope: string; scopeKey: string; discountBps: number }[]) {
  for (const scope of ['item', 'category', 'all']) {
    const matching = rules.filter(r => r.scope === scope && (scope === 'all' || r.scopeKey === (scope === 'item' ? item.itemKey : item.categoryKey)))
    if (matching.length) return unit - bpsOf(unit, Math.min(...matching.map(r => r.discountBps)))
  }
  return item.memberUnitPriceMinor
}

/** Recompute formula prices from labour rates and markup (D§4.2). Returns the rows that changed. */
export function recomputeFormulaPrices(content: Awaited<ReturnType<typeof loadVersionContent>>) {
  const materials = new Map(content.items.map(i => [i.itemKey, i]))
  const markup = content.markupTables.find(t => t.appliesTo === 'material') ?? null
  const changed: { id: string; itemKey: string; unitPriceMinor: bigint; memberUnitPriceMinor: bigint | null; costMinor: bigint }[] = []
  for (const item of content.items) {
    if (item.pricingMethod !== 'formula' || !item.active) continue
    let price: ReturnType<typeof formulaPrice>
    try { price = formulaPrice(item, { laborRates: content.laborRates, markup, materials }) } catch (error) { return fail(error) }
    const member = memberPriceFor(item, price.unitPriceMinor, content.memberPricingRules)
    if (price.unitPriceMinor !== item.unitPriceMinor || price.costMinor !== item.costMinor || member !== item.memberUnitPriceMinor) {
      changed.push({ id: (item as PriceBookItemDraft & { id: string }).id, itemKey: item.itemKey, unitPriceMinor: price.unitPriceMinor, memberUnitPriceMinor: member, costMinor: price.costMinor })
    }
  }
  return changed
}

// ── Submit, publish, activate ─────────────────────────────────────────────────

export async function submitPriceBookVersion(db: Db, actor: Actor, args: { versionId: string; effectiveAt?: string | null; expectedVersion: number; note?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.submit', EDIT, args)
  if (actor.kind === 'agent') throw new DomainError(Codes.NOT_AUTHORIZED, 'Agents do not submit price books.')
  const effectiveAt = args.effectiveAt ? new Date(args.effectiveAt) : null
  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, 'effectiveAt must be an ISO date-time.', { field: 'effectiveAt' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.submit', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const version = await lockDraft(tx, args.versionId, args.expectedVersion)
    let content = await loadVersionContent(tx, args.versionId)
    if (!content.items.some(i => i.active)) throw new DomainError(Codes.GUARD_FAILED, 'A price book version needs at least one item.', { reason: 'empty' })
    // Freeze formula prices into the rows while the version is still a draft (the trigger allows it now, never after).
    const frozen = recomputeFormulaPrices(content)
    for (const row of frozen) await tx.priceBookItem.update({ where: { id: row.id }, data: { unitPriceMinor: row.unitPriceMinor, memberUnitPriceMinor: row.memberUnitPriceMinor, costMinor: row.costMinor } })
    if (frozen.length) content = await loadVersionContent(tx, args.versionId)
    const uoms = new Map((await tx.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } })).map(u => [u.code, { maxDecimals: u.maxDecimals }]))
    const findings = submitFindings(content.items, uoms)
    if (findings.length) throw new DomainError(Codes.GUARD_FAILED, `${findings.length} item${findings.length === 1 ? '' : 's'} need attention before this version can be submitted.`, { reason: 'findings', findings })
    const book = await tx.priceBook.findUniqueOrThrow({ where: { id: version.priceBook! }, select: { activeVersionId: true, code: true } })
    const before = book.activeVersionId ? (await loadVersionContent(tx, book.activeVersionId)).items : []
    const diff = diffItems(before, content.items)
    const contentHash = hashOf(content)
    const approval = await requestApproval(uow, actor, {
      action: 'pricebook.publish', targetList: 'PriceBookVersion', targetId: args.versionId,
      payload: { versionId: args.versionId, contentHash, effectiveAt: effectiveAt?.toISOString() ?? null },
      requiredPermission: 'canApprovePriceBook',
      summary: `Publish ${book.code} v${version.versionNumber}: ${diff.added.length} added, ${diff.repriced.length} repriced, ${diff.removed.length} removed${args.note ? ` (${args.note})` : ''}`,
    })
    const next = await casUpdate(uow, {
      model: 'PriceBookVersion', id: args.versionId, version: version.version, from: ['draft'], to: 'pending_approval', actor, eventType: 'pricebook_version.submitted', reason: args.note ?? null,
      data: { contentHash, diffReport: diff as never, approvalId: approval.id, submittedById: actorUserId(actor), submittedAt: uow.now, effectiveAt },
      audit: { contentHash, approvalId: approval.id, frozenFormulaPrices: frozen.map(f => f.itemKey), diff: { added: diff.added.length, removed: diff.removed.length, repriced: diff.repriced.length, changed: diff.changed.length } },
    })
    return { versionId: args.versionId, status: 'pending_approval', version: next, approvalRequestId: approval.id, contentHash, diff }
  })
  return { replay: result.replay, ...result.value }
}

/** Approved (maker-checker): the version is published and, once effectiveAt arrives, active. */
export async function applyPriceBookPublish(uow: UnitOfWork, actor: Actor, request: { id: string; targetId: string; payload: { versionId: string; contentHash: string; effectiveAt: string | null } }) {
  const { tx } = uow
  const version = await lockVersion(tx, request.targetId)
  if (version.status !== 'pending_approval') throw new DomainError(Codes.INVALID_TRANSITION, `This version is ${version.status}; only a version waiting for approval can be published.`, { currentStatus: version.status })
  const content = await loadVersionContent(tx, request.targetId)
  if (hashOf(content) !== request.payload.contentHash) throw new DomainError(Codes.APPROVAL_MISMATCH, 'The version changed after it was submitted; submit it again.')
  const requested = request.payload.effectiveAt ? new Date(request.payload.effectiveAt) : uow.now
  const effectiveAt = requested.getTime() < uow.now.getTime() ? uow.now : requested
  const approverId = actorUserId(actor)
  const v = await casUpdate(uow, {
    model: 'PriceBookVersion', id: request.targetId, version: version.version, from: ['pending_approval'], to: 'published', actor, eventType: 'pricebook_version.published', approverId,
    data: { publishedById: approverId, publishedAt: uow.now, effectiveAt }, metadata: { approvalRequestId: request.id },
  })
  const activated = effectiveAt.getTime() <= uow.now.getTime() ? await activateInTx(uow, actor, request.targetId, version.priceBook!, v) : null
  return { versionId: request.targetId, status: activated ? 'active' : 'published', effectiveAt: effectiveAt.toISOString() }
}

async function activateInTx(uow: UnitOfWork, actor: Actor, versionId: string, priceBookId: string, versionRow: number) {
  const { tx } = uow
  await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${priceBookId} FOR UPDATE`
  const prior = await tx.priceBookVersion.findFirst({ where: { priceBookId, status: 'active' }, select: { id: true, version: true } })
  if (prior) await casUpdate(uow, { model: 'PriceBookVersion', id: prior.id, version: prior.version, from: ['active'], to: 'retired', actor, eventType: 'pricebook_version.retired', data: { retiredAt: uow.now }, metadata: { supersededBy: versionId } })
  await casUpdate(uow, { model: 'PriceBookVersion', id: versionId, version: versionRow, from: ['published'], to: 'active', actor, eventType: 'pricebook_version.activated', data: { activatedAt: uow.now }, metadata: { retired: prior?.id ?? null } })
  await tx.priceBook.update({ where: { id: priceBookId }, data: { activeVersionId: versionId, version: { increment: 1 } } })
  return true
}

/** Timer: activate every published version whose effectiveAt has arrived (SM§5.1). */
export async function activateDuePriceBookVersions(db: Db, now = new Date()) {
  const due = await db.priceBookVersion.findMany({ where: { status: 'published', effectiveAt: { lte: now } }, select: { id: true }, orderBy: { effectiveAt: 'asc' }, take: 50 })
  let activated = 0
  for (const { id } of due) {
    const actor: Actor = { kind: 'system', name: 'pricebook-activation' }
    const r = await command(db, { name: 'pricebook.activate', actor, idempotencyKey: `pricebook-activate:${id}`, params: { versionId: id }, now }, async uow => {
      const row = await lockVersion(uow.tx, id)
      if (row.status !== 'published') return false
      // Two published versions due at once: only the newest becomes active; the older one retires unused.
      const newer = await uow.tx.priceBookVersion.findFirst({ where: { priceBookId: row.priceBook, status: 'published', effectiveAt: { lte: now }, versionNumber: { gt: row.versionNumber } }, select: { id: true } })
      if (newer) { await casUpdate(uow, { model: 'PriceBookVersion', id, version: row.version, from: ['published'], to: 'retired', actor, eventType: 'pricebook_version.retired', data: { retiredAt: uow.now }, metadata: { supersededBy: newer.id, neverActive: true } }); return false }
      return activateInTx(uow, actor, id, row.priceBook!, row.version)
    })
    if (r.value) activated += 1
  }
  return { activated }
}

/** Back to draft after a rejection, an expiry or the maker withdrawing it. */
export async function reopenPriceBookDraft(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.reopen', EDIT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.reopen', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await transition<{ id: string; approvalId: string | null; version: number }>(uow, {
      model: 'PriceBookVersion', id: args.versionId, from: ['pending_approval'], to: 'draft', expectedVersion: args.expectedVersion, actor, eventType: 'pricebook_version.reopened', reason: args.reason ?? null,
      data: { approvalId: null, contentHash: '', submittedAt: null, submittedById: null },
      guard: async v => {
        const approval = v.approvalId ? await uow.tx.approvalRequest.findUnique({ where: { id: v.approvalId }, select: { status: true } }) : null
        if (approval?.status === 'approved') throw new DomainError(Codes.GUARD_FAILED, 'This version was approved; it is being published.')
      },
    })
    const pending = await uow.tx.approvalRequest.findFirst({ where: { action: 'pricebook.publish', targetId: args.versionId, status: 'pending' }, select: { id: true, version: true } })
    if (pending) await casUpdate(uow, { model: 'ApprovalRequest', id: pending.id, version: pending.version, from: ['pending'], to: 'cancelled', actor, eventType: 'approval.cancelled', reason: 'Price book version reopened for editing' })
    return { versionId: row.id, status: 'draft', version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

export async function discardPriceBookVersion(db: Db, actor: Actor, args: { versionId: string; expectedVersion: number; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.discard', EDIT, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.discard', actor, idempotencyKey, params, now: args.now }, async uow => {
    const row = await transition<{ id: string; version: number }>(uow, { model: 'PriceBookVersion', id: args.versionId, from: ['draft'], to: 'discarded', expectedVersion: args.expectedVersion, actor, eventType: 'pricebook_version.discarded', reason: args.reason ?? null })
    return { versionId: row.id, status: 'discarded', version: row.version }
  })
  return { replay: result.replay, ...result.value }
}

/**
 * Supplier cost import (SM§5.1): never touches a published version. Costs land on the open draft (or a
 * new draft copied from the active version), formula prices are recomputed in that draft, and the
 * draft carries a cost-change report for the reviewer.
 */
export async function importSupplierCosts(db: Db, actor: Actor, args: { priceBookId: string; supplier: string; costs: { itemKey: string; costMinor: string }[]; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'pricebook.import_costs', EDIT, args)
  if (!args.supplier?.trim()) throw new DomainError(Codes.INVALID_INPUT, 'Name the supplier.', { field: 'supplier' })
  if (!Array.isArray(args.costs) || !args.costs.length || args.costs.length > 5000) throw new DomainError(Codes.INVALID_INPUT, 'Send between 1 and 5000 cost rows.', { field: 'costs' })
  const costs = args.costs.map(c => ({ itemKey: String(c.itemKey ?? '').trim().toUpperCase(), costMinor: minorIn(c.costMinor, `costs.${c.itemKey}`)! }))
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'pricebook.import_costs', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${args.priceBookId} FOR UPDATE`
    const open = await tx.priceBookVersion.findFirst({ where: { priceBookId: args.priceBookId, status: { in: ['draft', 'pending_approval'] } }, select: { id: true, status: true, versionNumber: true } })
    if (open?.status === 'pending_approval') throw new DomainError(Codes.GUARD_FAILED, `Version ${open.versionNumber} is waiting for approval; reopen it or wait before importing costs.`, { reason: 'pending_approval' })
    const draft = open ?? await createDraftInTx(uow, actor, args.priceBookId, { label: `${args.supplier.trim()} costs`, source: 'supplier_import', notes: `Supplier cost import from ${args.supplier.trim()}` })
    let content = await loadVersionContent(tx, draft.id)
    let report: ReturnType<typeof costChangeReport>
    try { report = costChangeReport(content.items, costs) } catch (error) { return fail(error) }
    const byKey = new Map(content.rows.map(r => [r.itemKey, r.id]))
    for (const change of report.changes) await tx.priceBookItem.update({ where: { id: byKey.get(change.itemKey)! }, data: { costMinor: BigInt(change.toMinor) } })
    content = await loadVersionContent(tx, draft.id)
    const repriced = recomputeFormulaPrices(content)
    for (const row of repriced) await tx.priceBookItem.update({ where: { id: row.id }, data: { unitPriceMinor: row.unitPriceMinor, memberUnitPriceMinor: row.memberUnitPriceMinor, costMinor: row.costMinor } })
    const stored = { supplier: args.supplier.trim(), importedAt: uow.now.toISOString(), changes: report.changes, unknown: report.unknown, formulaRepriced: repriced.map(r => ({ itemKey: r.itemKey, unitPriceMinor: r.unitPriceMinor.toString() })) }
    const updated = await tx.priceBookVersion.update({ where: { id: draft.id }, data: { costChangeReport: stored as never, version: { increment: 1 } }, select: { version: true } })
    auditCreate(uow, actor, 'PriceBookVersion', draft.id, 'pricebook_version.costs_imported', { supplier: stored.supplier, changed: report.changes.length, unknown: report.unknown.length, formulaRepriced: repriced.length })
    return { versionId: draft.id, version: updated.version, ...stored }
  })
  return { replay: result.replay, ...result.value }
}

// ── Reads (staff screens and MCP tools) ───────────────────────────────────────

/** pricebook.search: active items matching a phrase (name, key, description), for a department. */
export async function searchPriceBook(db: Db, actor: Actor, args: { query?: string | null; businessUnitId?: string | null; kind?: string | null; limit?: number | null }) {
  await authorizeOperation(db, actor, 'pricebook.search', [...READ], args)
  const { versionId } = await activeVersionFor(db, args.businessUnitId ?? null)
  const q = args.query?.trim() ?? ''
  const rows = await db.priceBookItem.findMany({
    where: {
      priceBookVersionId: versionId, active: true,
      ...(args.kind ? { kind: args.kind } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { itemKey: { contains: q.toUpperCase() } }, { customerDescription: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ ladderKey: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    take: Math.min(Math.max(args.limit ?? 20, 1), 100),
  })
  const items = rows.map(r => ({
    itemKey: r.itemKey, name: r.name, description: r.customerDescription, kind: r.kind, trade: r.trade, uom: r.uom, unitPriceMinor: r.unitPriceMinor.toString(),
    memberUnitPriceMinor: r.memberUnitPriceMinor?.toString() ?? null, ladderKey: r.ladderKey, tier: r.tier, warrantyText: r.warrantyText,
  }))
  const output = { priceBookVersionId: versionId, items }
  await recordAgentRead(db, actor, { tool: 'pricebook.search', inputs: args, output: { priceBookVersionId: versionId, count: items.length } })
  return output
}

export type QuoteRequestLine = { itemKey: string; quantity: string; cancellationClass?: string | null; description?: string | null }

/** Price lines from the active version and freeze them; the hash is what a voice agent must match before speaking a price. */
export async function quoteFromVersion(db: Tx | Db, versionId: string, lines: QuoteRequestLine[], memberPricing: boolean) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) throw new DomainError(Codes.INVALID_INPUT, 'Quote between 1 and 200 lines.', { field: 'lines' })
  const keys = [...new Set(lines.map(l => String(l.itemKey ?? '').trim().toUpperCase()))]
  const [rows, uoms] = await Promise.all([
    db.priceBookItem.findMany({ where: { priceBookVersionId: versionId, itemKey: { in: keys } } }),
    db.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } }),
  ])
  const byKey = new Map(rows.map(r => [r.itemKey, draftOf(r)]))
  const uomOf = new Map(uoms.map(u => [u.code, { maxDecimals: u.maxDecimals }]))
  return lines.map(line => {
    const item = byKey.get(String(line.itemKey ?? '').trim().toUpperCase())
    if (!item) throw new DomainError(Codes.NOT_FOUND, `${line.itemKey} is not in the active price book.`, { field: 'itemKey', itemKey: line.itemKey })
    const cancellationClass = line.cancellationClass ? oneOf(CANCELLATION_CLASSES, line.cancellationClass, 'cancellationClass') : undefined
    try {
      return quoteLine(versionId, { item, quantity: String(line.quantity ?? ''), memberPricing, cancellationClass, description: line.description ?? undefined }, uomOf.get(item.uom) ?? { maxDecimals: 0 })
    } catch (error) { return fail(error) }
  })
}

export async function quotePriceBook(db: Db, actor: Actor, args: { lines: QuoteRequestLine[]; businessUnitId?: string | null; memberPricing?: boolean | null; discountBps?: number | null }) {
  await authorizeOperation(db, actor, 'pricebook.quote', [...READ], args)
  const { versionId } = await activeVersionFor(db, args.businessUnitId ?? null)
  const lines = await quoteFromVersion(db, versionId, args.lines, !!args.memberPricing)
  let totals: ReturnType<typeof optionTotals>
  try { totals = optionTotals(lines.map(l => ({ amountMinor: l.amountMinor, costMinor: BigInt(l.costMinor) })), args.discountBps ?? 0) } catch (error) { return fail(error) }
  const snapshots = lines.map(({ amountMinor: _a, ...s }) => s)
  const output = {
    priceBookVersionId: versionId,
    // Internal cost and margin never leave the shop: a quote is what the customer may hear.
    lines: lines.map(({ costMinor: _c, ...l }) => ({ ...l, amountMinor: l.amountMinor.toString() })),
    subtotalMinor: totals.subtotalMinor.toString(), discountMinor: totals.discountMinor.toString(), totalBeforeTaxMinor: totals.totalBeforeTaxMinor.toString(),
    taxNote: 'Plus applicable sales tax, calculated on the invoice.',
    quoteHash: quoteHash(versionId, snapshots, args.discountBps ?? 0),
  }
  await recordAgentRead(db, actor, { tool: 'pricebook.quote', inputs: args, output: { priceBookVersionId: versionId, quoteHash: output.quoteHash, totalBeforeTaxMinor: output.totalBeforeTaxMinor } })
  return output
}

/** A reviewer's view: the stored diff, the cost report and the formula prices the draft would freeze. */
export async function priceBookVersionReview(db: Db, actor: Actor, args: { versionId: string }) {
  await authorizeOperation(db, actor, 'pricebook.review', ['canManagePriceBook', 'canApprovePriceBook'], args)
  const version = await db.priceBookVersion.findUnique({ where: { id: args.versionId }, select: { id: true, status: true, priceBookId: true, versionNumber: true, diffReport: true, costChangeReport: true, contentHash: true } })
  if (!version) throw new DomainError(Codes.NOT_FOUND, 'Price book version not found.')
  if (version.status !== 'draft') return { ...version, live: null }
  const content = await loadVersionContent(db, version.id)
  const book = await db.priceBook.findUniqueOrThrow({ where: { id: version.priceBookId! }, select: { activeVersionId: true } })
  const before = book.activeVersionId ? (await loadVersionContent(db, book.activeVersionId)).items : []
  const formula = (() => { try { return recomputeFormulaPrices(content) } catch (error) { return { error: (error as Error).message } } })()
  const uoms = new Map((await db.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } })).map(u => [u.code, { maxDecimals: u.maxDecimals }]))
  return { ...version, live: { diff: diffItems(before, content.items), findings: submitFindings(content.items, uoms), formula: Array.isArray(formula) ? formula.map(f => ({ itemKey: f.itemKey, unitPriceMinor: f.unitPriceMinor.toString() })) : formula } }
}
