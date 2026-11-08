import type { Actor } from '../lib/actor'
import { auditCreate } from '../lib/cas'
import { command } from '../lib/command'
import type { Db } from '../lib/db'
import { decideApprovalAs } from '../mutations/approvals'
import '../services/salesAppliers'
import { createPriceBook, importSupplierCosts, saveDraftItems, saveDraftSettings, startPriceBookDraft, submitPriceBookVersion } from '../services/pricebook'
import { CATALOG, CATEGORIES, LABOR_RATES, MARKUP_TABLES, PRICE_BOOK, SUPPLIER, UNITS, VERSION_LABELS, itemsFor, supplierCosts } from './pricebookData'

export { CATALOG, PRICE_BOOK, UNITS }

/*
 * Loads Summit's price book through the same commands the price-book screens call, so every row is
 * validated, hashed, diffed and approved exactly like a real edit.
 *
 * With a checker (the seed script: the general manager drafts, the owner approves) it replays the
 * shop's history: v1 launch, v2 replacement ladders, v3 EV charging and a price review (active),
 * then a v4 draft holding a supplier cost import. Without one (the onboarding card) the caller
 * drafts the whole catalogue as one version and submits it; a second person approves it under
 * Approvals, because nobody publishes their own prices.
 *
 * Every step has a fixed idempotency key, so loading twice replays and adds nothing.
 */

const chunks = <T>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))

export async function seedUnits(db: Db, actor: Actor, key: string) {
  const result = await command(db, { name: 'pricebook.units', actor, idempotencyKey: key, params: {} }, async uow => {
    const have = new Set((await uow.tx.unitOfMeasure.findMany({ select: { code: true } })).map(u => u.code))
    const missing = UNITS.filter(u => !have.has(u.code))
    if (missing.length) {
      await uow.tx.unitOfMeasure.createMany({ data: missing.map(u => ({ ...u })) })
      auditCreate(uow, actor, 'UnitOfMeasure', 'seed', 'unit_of_measure.created', { codes: missing.map(u => u.code) }, { metadata: { seed: true } })
    }
    return { units: missing.length }
  })
  return result.value
}

type Draft = { versionId: string; version: number }

async function fillDraft(db: Db, maker: Actor, prefix: string, draft: Draft, items: ReturnType<typeof itemsFor>, settings: boolean) {
  let version = draft.version
  if (settings) {
    const saved = await saveDraftSettings(db, maker, {
      versionId: draft.versionId, expectedVersion: version, idempotencyKey: `${prefix}:settings`,
      categories: CATEGORIES, laborRates: LABOR_RATES, markupTables: MARKUP_TABLES,
    })
    version = saved.version
  }
  for (const [i, chunk] of chunks(items, 150).entries()) {
    const saved = await saveDraftItems(db, maker, { versionId: draft.versionId, items: chunk, expectedVersion: version, idempotencyKey: `${prefix}:items:${i}` })
    version = saved.version
  }
  return version
}

async function publish(db: Db, maker: Actor, checker: Actor, prefix: string, versionId: string, expectedVersion: number, note: string) {
  const submitted = await submitPriceBookVersion(db, maker, { versionId, expectedVersion, note, idempotencyKey: `${prefix}:submit` })
  const request = await db.approvalRequest.findUniqueOrThrow({ where: { id: submitted.approvalRequestId }, select: { id: true, version: true, status: true } })
  if (request.status === 'pending') await decideApprovalAs(db, checker, { requestId: request.id, decision: 'approve', expectedVersion: request.version, idempotencyKey: `${prefix}:approve` })
  return submitted
}

export async function seedPriceBook(db: Db, opts: { maker: Actor; checker: Actor | null; prefix?: string }) {
  const prefix = opts.prefix ?? 'seed:pricebook'
  const { maker, checker } = opts
  const units = await seedUnits(db, maker, `${prefix}:units`)
  const existing = await db.priceBook.findFirst({ where: { code: PRICE_BOOK.code }, select: { id: true } })
  const created = existing ? null : await createPriceBook(db, maker, { ...PRICE_BOOK, idempotencyKey: `${prefix}:create` })
  const priceBookId = existing?.id ?? created!.priceBookId
  const versions = await db.priceBookVersion.findMany({ where: { priceBookId }, select: { id: true, versionNumber: true, status: true, version: true }, orderBy: { versionNumber: 'asc' } })
  const v1 = versions.find(v => v.versionNumber === 1)!

  if (!checker) {
    // Onboarding: the whole catalogue as one version, submitted for a second person to approve.
    if (v1.status === 'draft') {
      const all = [1, 2, 3].flatMap(n => itemsFor(n as 1 | 2 | 3)).filter((item, i, rows) => rows.findLastIndex(r => r.itemKey === item.itemKey) === i)
      const version = await fillDraft(db, maker, `${prefix}:v1`, { versionId: v1.id, version: v1.version }, all, true)
      await submitPriceBookVersion(db, maker, { versionId: v1.id, expectedVersion: version, note: 'Summit standard catalogue', idempotencyKey: `${prefix}:v1:submit` })
    }
    const now = await db.priceBookVersion.findFirst({ where: { priceBookId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true, status: true } })
    return { units: units.units, priceBookId, items: CATALOG.length, latestVersion: now?.versionNumber ?? null, status: now?.status ?? null }
  }

  // History: v1 → v2 → v3 (active), then the v4 supplier-cost draft.
  if (v1.status === 'draft') {
    const version = await fillDraft(db, maker, `${prefix}:v1`, { versionId: v1.id, version: v1.version }, itemsFor(1), true)
    await publish(db, maker, checker, `${prefix}:v1`, v1.id, version, VERSION_LABELS[1])
  }
  for (const n of [2, 3] as const) {
    const have = await db.priceBookVersion.findFirst({ where: { priceBookId, versionNumber: n }, select: { id: true, status: true, version: true } })
    if (have && have.status !== 'draft') continue
    const draft = have ? { versionId: have.id, version: have.version } : await (async () => {
      const started = await startPriceBookDraft(db, maker, { priceBookId, label: VERSION_LABELS[n], idempotencyKey: `${prefix}:v${n}:draft` })
      const row = await db.priceBookVersion.findUniqueOrThrow({ where: { id: started.versionId }, select: { version: true } })
      return { versionId: started.versionId, version: row.version }
    })()
    const version = await fillDraft(db, maker, `${prefix}:v${n}`, draft, itemsFor(n), false)
    await publish(db, maker, checker, `${prefix}:v${n}`, draft.versionId, version, VERSION_LABELS[n])
  }
  const v4 = await db.priceBookVersion.findFirst({ where: { priceBookId, versionNumber: 4 }, select: { id: true } })
  const imported = v4 ? null : await importSupplierCosts(db, maker, { priceBookId, supplier: SUPPLIER, costs: supplierCosts(), idempotencyKey: `${prefix}:v4:costs` })
  const book = await db.priceBook.findUniqueOrThrow({ where: { id: priceBookId }, select: { activeVersionId: true } })
  return { units: units.units, priceBookId, activeVersionId: book.activeVersionId, items: CATALOG.length, supplierDraft: imported?.versionId ?? v4?.id ?? null, costChanges: imported?.changes.length ?? null }
}
