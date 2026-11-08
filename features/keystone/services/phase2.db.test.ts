import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import { Codes, DomainError } from '../lib/errors'
import { verifyAuditChain } from '../lib/audit'
import { addBusinessDays, addDays, inZone, localDate, US_FEDERAL } from '../lib/calendar'
import { loadCompanySetup, loadOperationsSetup, loadPriceBookSetup } from '../mutations/setup'
import { decideApprovalAs } from '../mutations/approvals'
import { seedPriceBook } from '../seed/pricebook'
import { CATALOG } from '../seed/pricebookData'
import { HOUSEHOLDS, JOB_TYPES } from '../seed/operationsData'
import { bookJob } from './booking'
import { assignVisit, setVisitStatus } from './dispatch'
import { activeVersionFor, importSupplierCosts, quotePriceBook, reopenPriceBookDraft, saveDraftItems, searchPriceBook, startPriceBookDraft, submitPriceBookVersion } from './pricebook'
import {
  acceptChangeOrder, createEstimate, declineEstimate, discardEstimateVersion, draftChangeOrder, draftEstimate, draftFollowupEstimate, estimateSummary, expireDueEstimates,
  presentChangeOrder, presentEstimate, repriceEstimateVersion, requoteEstimate, saveEstimateOption, sellEstimate, setEstimateDiscount,
} from './estimates'
import { cancellationHoldsFor, deliverCancellationNotice, expireCancellationNotices, markCancellationRefunded, recordBuyerCancellation, requestCancellationHoldOverride, waiveCancellationNotice } from './cancellation'
import { sha256Bytes } from './salesShared'
import { renderEstimatePdf, renderNoticePdf } from '../../../lib/salesPdf'
import { presentedLabel } from './estimates'

/*
 * Phase 2 exit gate (BUILD-PLAN §1 Phase 2): a published price book is immutable; an estimate's
 * snapshot is unchanged after a re-price; selling evaluates the buyer's cancellation rights, issues
 * the notice and holds covered work; the buyer's cancellation, refund and expiry; change orders;
 * the discount maker-checker; access per role; and the onboarding path. The 15 golden right
 * scenarios run in domain/cancellation-rights.test.ts against the same seeded packs.
 *
 * The price book is seeded once through the real services (GM drafts and submits, owner approves).
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const userActor = (userId: string, perms: Permission[]): Actor => ({ kind: 'user', userId, name: userId, permissions: new Set(perms) })
const sessionFor = (id: string, granted: readonly string[]) => ({ itemId: id, data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, granted.includes(p)])) } } })
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'OK'
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
}
const reason = async (p: Promise<unknown>) => {
  try {
    await p
    return 'OK'
  } catch (e) {
    if (e instanceof DomainError) return String(e.details.reason ?? e.code)
    throw e
  }
}

const CHICAGO = { timeZone: 'America/Chicago' }
const REAL_NOW = new Date()
/** The next Monday at least two days out, with open windows. */
const DAY = (() => {
  let d = addDays(localDate(CHICAGO, REAL_NOW), 2)
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1)
  return d
})()
/** 10:00 Chicago on DAY (CST, UTC-6 in November..March; the suite only needs a Monday morning). */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`)
const SALE = at(DAY, '10:00')

const SIGNATURE = { kind: 'drawn', strokes: 4 }
const sign = (name = 'Homeowner') => ({ method: 'signature_on_device' as const, signerName: name, signerRole: 'owner' as const, signature: SIGNATURE })

describe.skipIf(!hasTestDatabase)('Phase 2: price book, estimates and cancellation rights (database)', () => {
  let prisma: PrismaClient
  let ownerId: string
  let owner: Actor
  let gm: Actor
  let serviceManager: Actor
  let advisor: Actor
  let csr: Actor
  let dispatcher: Actor
  let accountant: Actor
  let techNina: Actor
  let techJake: Actor
  let agent: Actor & { kind: 'agent' }
  let priceBookId: string

  const ROLE_PERMS = {
    gm: ALL.filter(p => !['canManageRoles', 'canRunPayroll'].includes(p)),
    serviceManager: ['canAccessDashboard', 'canManageCustomers', 'canBook', 'canDispatch', 'canViewBoard', 'canApproveDiscounts', 'canManagePriceBook', 'canReadAudit'] as Permission[],
    advisor: ['canAccessDashboard', 'canManageCustomers', 'canReadCustomerPII', 'canViewBoard', 'canPresentEstimates', 'canSellEstimates'] as Permission[],
    tech: ['canAccessDashboard', 'canWorkVisits', 'canPresentEstimates', 'canSellEstimates'] as Permission[],
  }

  const windowFor = async (jobTypeCode: string, label: string) => {
    const jt = JOB_TYPES.find(j => j.code === jobTypeCode)!
    const w = await prisma.arrivalWindow.findFirstOrThrow({ where: { businessUnitId: jt.bu, date: new Date(`${DAY}T00:00:00Z`), label } })
    return { jobTypeId: jt.id, windowId: w.id }
  }
  /** A booked job assigned to a tech, ready for an estimate. */
  const bookedJob = async (jobTypeCode: string, label: string, customerIndex: number, employeeId: string) => {
    const { jobTypeId, windowId } = await windowFor(jobTypeCode, label)
    const h = HOUSEHOLDS[customerIndex]
    const booked = await bookJob(prisma, csr, { jobTypeId, windowId, customerId: h.id, locationId: h.location.id, summary: 'phase 2 test', idempotencyKey: uniqueKey('book'), now: REAL_NOW })
    const v = await prisma.visit.findUniqueOrThrow({ where: { id: booked.visitId } })
    await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: [employeeId], idempotencyKey: uniqueKey('as'), now: REAL_NOW })
    return { jobId: booked.jobId, visitId: booked.visitId, customer: h }
  }
  const versionOf = async (id: string) => (await prisma.estimateVersion.findUniqueOrThrow({ where: { id }, select: { version: true } })).version
  /** Draft → present → sell one option of a fresh estimate on the job. */
  const sell = async (by: Actor, jobId: string, lines: { itemKey: string; quantity: string; cancellationClass?: string }[], sale: { location?: 'buyer_residence' | 'other_non_merchant' | 'merchant_place' | 'remote'; initiatedBy?: 'customer_request' | 'solicited'; now?: Date; depositMinor?: string; emergencyWaiver?: Parameters<typeof sellEstimate>[2]['emergencyWaiver'] } = {}) => {
    const est = await createEstimate(prisma, by, { jobId, title: 'Work on site', options: [{ tier: 'single', name: 'Recommended', lines }], idempotencyKey: uniqueKey('est'), now: sale.now })
    const shown = await presentEstimate(prisma, by, { versionId: est.versionId, expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('pr'), now: sale.now })
    const option = await prisma.estimateOption.findFirstOrThrow({ where: { estimateVersionId: est.versionId }, select: { id: true } })
    const sold = await sellEstimate(prisma, by, {
      versionId: est.versionId, optionId: option.id, expectedVersion: shown.version, authorization: sign(), saleLocation: sale.location ?? 'buyer_residence', initiatedBy: sale.initiatedBy ?? 'customer_request',
      depositMinor: sale.depositMinor, emergencyWaiver: sale.emergencyWaiver, idempotencyKey: uniqueKey('sell'), now: sale.now,
    })
    return { est, sold, optionId: option.id }
  }
  /** Drive a visit to on_site so the next move is "working". */
  const toOnSite = async (visitId: string, tech: Actor) => {
    await setVisitStatus(prisma, dispatcher, { visitId, to: 'dispatched', idempotencyKey: uniqueKey('s'), now: REAL_NOW })
    for (const to of ['en_route', 'on_site']) await setVisitStatus(prisma, tech, { visitId, to, deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW })
  }

  beforeAll(async () => {
    prisma = testPrisma(12)
    await resetDatabase(prisma)
    const ownerUser = await prisma.user.create({ data: { name: 'owner', email: `${uniqueKey('owner')}@test.local`, password: 'x'.repeat(60) } })
    ownerId = ownerUser.id
    const ctx = { session: sessionFor(ownerId, ALL), prisma }
    await loadCompanySetup(null, { idempotencyKey: uniqueKey('company') }, ctx)
    await loadOperationsSetup(null, { idempotencyKey: uniqueKey('ops') }, ctx)
    owner = userActor(ownerId, ALL)
    gm = userActor('seed_user_ortega', ROLE_PERMS.gm)
    serviceManager = userActor('seed_user_mendoza', ROLE_PERMS.serviceManager)
    advisor = userActor('seed_user_kim', ROLE_PERMS.advisor)
    csr = userActor('seed_user_raman', ['canAccessDashboard', 'canBook', 'canManageLeads', 'canManageCustomers', 'canSendMessages'])
    dispatcher = userActor('seed_user_brooks', ['canAccessDashboard', 'canDispatch', 'canViewBoard', 'canBook', 'canReadCustomerPII', 'canSendMessages'])
    accountant = userActor('seed_user_cole', ['canAccessDashboard', 'canReadAudit', 'canManageInvoices', 'canManagePayments', 'canIssueRefunds'])
    techNina = userActor('seed_user_patel', ROLE_PERMS.tech)
    techJake = userActor('seed_user_morrison', ROLE_PERMS.tech)
    const tools = ['pricebook.search', 'pricebook.quote', 'estimate.draft', 'estimate.draft_from_capture', 'estimate.draft_followup', 'estimate.summary']
    const salesAgent = await prisma.agentIdentity.create({ data: { name: 'Summit estimator', kind: 'llm_agent', ownerId, status: 'active' } })
    await prisma.agentScopeGrant.createMany({ data: tools.map(tool => ({ agentId: salesAgent.id, tool, autonomy: 'auto_within_policy', status: 'active', grantedById: ownerId })) })
    agent = { kind: 'agent', agentId: salesAgent.id, ownerUserId: ownerId, name: 'Summit estimator', scopes: new Set(tools) }
    const seeded = await seedPriceBook(prisma, { maker: gm, checker: owner, prefix: uniqueKey('pb') })
    priceBookId = seeded.priceBookId
  }, 900_000)

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  // ── Price book ──────────────────────────────────────────────────────────────

  describe('price book versions (maker-checker, immutable once published)', () => {
    it('history is v1 retired, v2 retired, v3 active, v4 a supplier-cost draft; the v3 reprices are live', { timeout: 60_000 }, async () => {
      const versions = await prisma.priceBookVersion.findMany({ where: { priceBookId }, orderBy: { versionNumber: 'asc' }, select: { versionNumber: true, status: true, source: true, submittedById: true, publishedById: true } })
      expect(versions.map(v => `${v.versionNumber}:${v.status}`)).toEqual(['1:retired', '2:retired', '3:active', '4:draft'])
      expect(versions.slice(0, 3).every(v => v.submittedById === 'seed_user_ortega' && v.publishedById === ownerId)).toBe(true)
      expect(versions[3].source).toBe('supplier_import')
      const active = await activeVersionFor(prisma, 'seed_bu_hvac_service')
      const diag = await prisma.priceBookItem.findFirstOrThrow({ where: { priceBookVersionId: active.versionId, itemKey: 'HVAC-DIAG' } })
      expect(diag.unitPriceMinor).toBe(9900n)
      expect(await prisma.priceBookItem.count({ where: { priceBookVersionId: active.versionId } })).toBe(CATALOG.length)
    })

    it('a published version is immutable: rows, prices and status are refused by the database', { timeout: 60_000 }, async () => {
      const active = await activeVersionFor(prisma, null)
      const item = await prisma.priceBookItem.findFirstOrThrow({ where: { priceBookVersionId: active.versionId } })
      await expect(prisma.priceBookItem.update({ where: { id: item.id }, data: { unitPriceMinor: 1n } })).rejects.toThrow(/frozen/)
      await expect(prisma.priceBookItem.delete({ where: { id: item.id } })).rejects.toThrow(/frozen/)
      await expect(prisma.priceBookItem.create({ data: { priceBookVersionId: active.versionId, itemKey: 'SNEAK-IN', name: 'Sneaked in', kind: 'service_task', uom: 'job' } })).rejects.toThrow(/frozen/)
      await expect(prisma.priceBookVersion.update({ where: { id: active.versionId }, data: { contentHash: 'f'.repeat(64) } })).rejects.toThrow(/immutable/)
      await expect(prisma.priceBookVersion.update({ where: { id: active.versionId }, data: { status: 'draft' } })).rejects.toThrow(/cannot move|immutable/)
      await expect(prisma.priceBookVersion.delete({ where: { id: active.versionId } })).rejects.toThrow(/kept/)
      const retired = await prisma.priceBookVersion.findFirstOrThrow({ where: { priceBookId, status: 'retired' } })
      await expect(prisma.priceBookVersion.update({ where: { id: retired.id }, data: { status: 'active' } })).rejects.toThrow(/cannot move|immutable/)
      // And through the service: only a draft is edited.
      const { since: _s, v3UnitPriceMinor: _v, ...one } = CATALOG.find(i => i.itemKey === 'FEE-TRIP')!
      expect(await code(saveDraftItems(prisma, gm, { versionId: active.versionId, items: [{ ...one, unitPriceMinor: '1' }], idempotencyKey: uniqueKey('x') }))).toBe(Codes.INVALID_TRANSITION)
    })

    it('one open draft per book; the maker cannot approve their own version; the approval is bound to the content hash', { timeout: 120_000 }, async () => {
      const v4 = await prisma.priceBookVersion.findFirstOrThrow({ where: { priceBookId, versionNumber: 4 } })
      expect(await reason(startPriceBookDraft(prisma, gm, { priceBookId, idempotencyKey: uniqueKey('d') }))).toBe('open_draft')
      // Only the price-book permission edits; an advisor and an agent are refused.
      expect(await code(saveDraftItems(prisma, advisor, { versionId: v4.id, items: [], idempotencyKey: uniqueKey('x') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(submitPriceBookVersion(prisma, agent, { versionId: v4.id, expectedVersion: v4.version, idempotencyKey: uniqueKey('x') }))).toBe(Codes.SCOPE_DENIED)
      // Stale expected version.
      expect(await code(submitPriceBookVersion(prisma, gm, { versionId: v4.id, expectedVersion: v4.version - 1, idempotencyKey: uniqueKey('x') }))).toBe(Codes.STALE_STATE)
      const submitted = await submitPriceBookVersion(prisma, gm, { versionId: v4.id, expectedVersion: v4.version, note: 'supplier costs', idempotencyKey: uniqueKey('sub') })
      const request = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: submitted.approvalRequestId } })
      expect(await code(decideApprovalAs(prisma, gm, { requestId: request.id, decision: 'approve', expectedVersion: request.version, idempotencyKey: uniqueKey('ap') }))).toBe(Codes.SELF_APPROVAL)
      expect(await code(decideApprovalAs(prisma, advisor, { requestId: request.id, decision: 'approve', expectedVersion: request.version, idempotencyKey: uniqueKey('ap') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(decideApprovalAs(prisma, agent, { requestId: request.id, decision: 'approve', expectedVersion: request.version, idempotencyKey: uniqueKey('ap') }))).toBe(Codes.NOT_AUTHORIZED)
      // Pending approval freezes the rows too.
      const row = await prisma.priceBookItem.findFirstOrThrow({ where: { priceBookVersionId: v4.id } })
      await expect(prisma.priceBookItem.update({ where: { id: row.id }, data: { unitPriceMinor: 1n } })).rejects.toThrow(/frozen/)
      // Withdraw it; the request is cancelled and the draft is editable again.
      const pending = await prisma.priceBookVersion.findUniqueOrThrow({ where: { id: v4.id } })
      const reopened = await reopenPriceBookDraft(prisma, gm, { versionId: v4.id, expectedVersion: pending.version, reason: 'add one more item', idempotencyKey: uniqueKey('re') })
      expect(reopened.status).toBe('draft')
      expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('cancelled')
      // The supplier import lands in the same open draft, never in the active version.
      const again = await importSupplierCosts(prisma, gm, { priceBookId, supplier: 'Hill Country Supply', costs: [{ itemKey: 'MAT-CAP-4555', costMinor: '2000' }], idempotencyKey: uniqueKey('imp') })
      expect(again.versionId).toBe(v4.id)
      const live = await activeVersionFor(prisma, null)
      expect((await prisma.priceBookItem.findFirstOrThrow({ where: { priceBookVersionId: live.versionId, itemKey: 'MAT-CAP-4555' } })).costMinor).not.toBe(2000n)
    })

    it('agents search and quote without seeing cost or margin; the quote hash binds the price', { timeout: 60_000 }, async () => {
      const found = await searchPriceBook(prisma, agent, { query: 'capacitor', businessUnitId: 'seed_bu_hvac_service' })
      expect(found.items.length).toBeGreaterThan(0)
      expect(JSON.stringify(found)).not.toMatch(/costMinor|margin/i)
      const quote = await quotePriceBook(prisma, agent, { lines: [{ itemKey: 'HVAC-CAP-DUAL', quantity: '1' }], businessUnitId: 'seed_bu_hvac_service' })
      expect(quote.totalBeforeTaxMinor).toBe('25900')
      expect(JSON.stringify(quote)).not.toMatch(/costMinor|margin/i)
      expect(quote.quoteHash).toMatch(/^[0-9a-f]{64}$/)
      expect(await prisma.agentAction.count({ where: { agentId: agent.agentId, tool: { in: ['pricebook.search', 'pricebook.quote'] } } })).toBe(2)
      expect(await code(quotePriceBook(prisma, agent, { lines: [{ itemKey: 'NOPE', quantity: '1' }] }))).toBe(Codes.NOT_FOUND)
    })
  })

  // ── Estimates ───────────────────────────────────────────────────────────────

  describe('estimate state machine and snapshots', () => {
    it('draft → presented freezes the snapshot, hash and PDF; a re-price never touches it; a re-quote is v2', { timeout: 180_000 }, async () => {
      const h = HOUSEHOLDS[41]
      const est = await createEstimate(prisma, advisor, {
        customerId: h.id, locationId: h.location.id, businessUnitId: 'seed_bu_hvac_install', title: 'Replace AC and furnace',
        options: [
          { tier: 'good', name: 'Good', lines: [{ itemKey: 'SYS-ACF-3T-GOOD', quantity: '1' }] },
          { tier: 'better', name: 'Better', lines: [{ itemKey: 'SYS-ACF-3T-BETTER', quantity: '1' }] },
          { tier: 'best', name: 'Best', lines: [{ itemKey: 'SYS-ACF-3T-BEST', quantity: '1' }] },
        ],
        idempotencyKey: uniqueKey('est'),
      })
      expect(est.options.map(o => o.totalMinor)).toEqual(['989500', '1349500', '1899500'])
      // Draft edits are allowed and re-price in place.
      const v = await versionOf(est.versionId)
      expect(await code(presentEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: v - 1, idempotencyKey: uniqueKey('p') }))).toBe(Codes.STALE_STATE)
      const shown = await presentEstimate(prisma, advisor, { versionId: est.versionId, via: 'in_person', expectedVersion: v, idempotencyKey: uniqueKey('p') })
      const frozen = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.versionId }, include: { options: { include: { lines: true } } } })
      expect(frozen.status).toBe('presented')
      expect(frozen.contentHash).toBe(shown.contentHash)
      // The stored PDF re-renders byte-for-byte from the snapshot.
      const doc = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: frozen.pdfId! } })
      const snap = frozen.snapshot as Parameters<typeof renderEstimatePdf>[0]
      expect(sha256Bytes(renderEstimatePdf(snap, presentedLabel(snap)))).toBe(doc.sha256)
      expect(doc.storageKey).toBe(`render:estimate-version/${est.versionId}`)
      // Presented is frozen: the service refuses edits, and the database refuses them too.
      expect(await code(repriceEstimateVersion(prisma, advisor, { versionId: est.versionId, expectedVersion: shown.version, idempotencyKey: uniqueKey('r') }))).toBe(Codes.INVALID_TRANSITION)
      expect(await code(saveEstimateOption(prisma, advisor, { versionId: est.versionId, tier: 'custom', name: 'x', lines: [{ itemKey: 'FEE-TRIP', quantity: '1' }], idempotencyKey: uniqueKey('o') }))).toBe(Codes.INVALID_TRANSITION)
      const line = frozen.options[0].lines[0]
      await expect(prisma.estimateLine.update({ where: { id: line.id }, data: { unitPriceMinor: 1n } })).rejects.toThrow(/frozen/)
      await expect(prisma.estimateOption.update({ where: { id: frozen.options[0].id }, data: { totalMinor: 1n } })).rejects.toThrow(/frozen/)
      await expect(prisma.estimateVersion.update({ where: { id: est.versionId }, data: { snapshot: {} } })).rejects.toThrow(/immutable/)
      await expect(prisma.estimateVersion.delete({ where: { id: est.versionId } })).rejects.toThrow(/kept/)
      // Publish a new price for the Good system; the presented version is unchanged.
      const draft = await startPriceBookDraft(prisma, gm, { priceBookId, label: 'Reprice', idempotencyKey: uniqueKey('d') }).catch(async () => {
        const open = await prisma.priceBookVersion.findFirstOrThrow({ where: { priceBookId, status: 'draft' } })
        return { versionId: open.id }
      })
      const item = CATALOG.find(i => i.itemKey === 'SYS-ACF-3T-GOOD')!
      const { since: _s, v3UnitPriceMinor: _v, ...input } = item
      const dv = (await prisma.priceBookVersion.findUniqueOrThrow({ where: { id: draft.versionId } })).version
      const saved = await saveDraftItems(prisma, gm, { versionId: draft.versionId, items: [{ ...input, unitPriceMinor: '1049500' }], expectedVersion: dv, idempotencyKey: uniqueKey('i') })
      const sub = await submitPriceBookVersion(prisma, gm, { versionId: draft.versionId, expectedVersion: saved.version, idempotencyKey: uniqueKey('s') })
      const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: sub.approvalRequestId } })
      await decideApprovalAs(prisma, owner, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') })
      const after = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.versionId }, include: { options: { include: { lines: true } } } })
      expect(after.contentHash).toBe(frozen.contentHash)
      expect(after.snapshot).toEqual(frozen.snapshot)
      expect(after.options.map(o => o.totalMinor)).toEqual(frozen.options.map(o => o.totalMinor))
      // The customer wants it updated: a re-quote supersedes v1 and prices v2 from the new book.
      const re = await requoteEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: after.version, idempotencyKey: uniqueKey('rq') })
      expect(re.versionNumber).toBe(2)
      expect(re.options[0].totalMinor).toBe('1049500')
      expect((await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.versionId } })).status).toBe('superseded')
      // Only one open version per estimate.
      await expect(prisma.estimateVersion.create({ data: { estimateId: est.estimateId, versionNumber: 3, label: 'x', status: 'draft' } })).rejects.toThrow()
    })

    it('a draft priced from an older book must be re-priced before it is presented', { timeout: 120_000 }, async () => {
      const h = HOUSEHOLDS[30]
      const est = await createEstimate(prisma, advisor, { customerId: h.id, locationId: h.location.id, businessUnitId: 'seed_bu_hvac_service', title: 'Capacitor', options: [{ tier: 'single', name: 'Fix', lines: [{ itemKey: 'HVAC-CAP-DUAL', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      // Publish an unrelated change so the active version moves.
      const draft = await startPriceBookDraft(prisma, gm, { priceBookId, label: 'Tweak', idempotencyKey: uniqueKey('d') })
      const item = CATALOG.find(i => i.itemKey === 'FEE-TRIP')!
      const { since: _s, v3UnitPriceMinor: _v, ...input } = item
      const dv = (await prisma.priceBookVersion.findUniqueOrThrow({ where: { id: draft.versionId } })).version
      const saved = await saveDraftItems(prisma, gm, { versionId: draft.versionId, items: [{ ...input, unitPriceMinor: '8900' }], expectedVersion: dv, idempotencyKey: uniqueKey('i') })
      const sub = await submitPriceBookVersion(prisma, gm, { versionId: draft.versionId, expectedVersion: saved.version, idempotencyKey: uniqueKey('s') })
      const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: sub.approvalRequestId } })
      await decideApprovalAs(prisma, owner, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') })
      expect(await reason(presentEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('p') }))).toBe('pricebook_changed')
      const rp = await repriceEstimateVersion(prisma, advisor, { versionId: est.versionId, expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('r') })
      expect(rp.options).toHaveLength(1)
      expect((await presentEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: rp.version, idempotencyKey: uniqueKey('p') })).status).toBe('presented')
    })

    it('a discount over the seller\'s limit needs a second person; the approval is bound to the option hashes', { timeout: 120_000 }, async () => {
      const h = HOUSEHOLDS[31]
      const est = await createEstimate(prisma, advisor, { customerId: h.id, locationId: h.location.id, businessUnitId: 'seed_bu_hvac_service', title: 'Blower', options: [{ tier: 'single', name: 'Fix', lines: [{ itemKey: 'HVAC-BLOWER-ECM', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      // Within the 10% company limit: no approval.
      const small = await setEstimateDiscount(prisma, advisor, { versionId: est.versionId, discountBps: 500, reason: 'Repeat customer', expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('d') })
      expect(small.status).toBe('draft')
      expect(await code(setEstimateDiscount(prisma, advisor, { versionId: est.versionId, discountBps: 1500, expectedVersion: small.version, idempotencyKey: uniqueKey('d') }))).toBe(Codes.INVALID_INPUT)
      const big = await setEstimateDiscount(prisma, advisor, { versionId: est.versionId, discountBps: 1500, reason: 'Matching a competitor quote', expectedVersion: small.version, idempotencyKey: uniqueKey('d') })
      expect(big.status).toBe('pending_approval')
      expect(await code(presentEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: big.version, idempotencyKey: uniqueKey('p') }))).toBe(Codes.INVALID_TRANSITION)
      const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: big.approvalRequestId! } })
      expect(await code(decideApprovalAs(prisma, advisor, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') }))).toBe(Codes.SELF_APPROVAL)
      await decideApprovalAs(prisma, serviceManager, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') })
      const back = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.versionId } })
      expect(back.status).toBe('draft')
      const shown = await presentEstimate(prisma, advisor, { versionId: est.versionId, expectedVersion: back.version, idempotencyKey: uniqueKey('p') })
      const opt = await prisma.estimateOption.findFirstOrThrow({ where: { estimateVersionId: est.versionId } })
      expect(opt.discountMinor).toBe(20925n) // 15% of 139500
      expect(opt.totalMinor).toBe(118575n)
      expect(shown.status).toBe('presented')
    })

    it('decline, follow-up draft by an agent, discard, and expiry', { timeout: 120_000 }, async () => {
      const h = HOUSEHOLDS[32]
      const est = await createEstimate(prisma, advisor, { customerId: h.id, locationId: h.location.id, businessUnitId: 'seed_bu_electrical', title: 'Panel', options: [{ tier: 'good', name: 'Good', lines: [{ itemKey: 'PANEL-200A-GOOD', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      const shown = await presentEstimate(prisma, advisor, { versionId: est.versionId, via: 'email', expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('p') })
      expect(await prisma.outboxMessage.count({ where: { topic: 'notify.estimate', aggregateId: est.versionId } })).toBe(1)
      expect(await code(declineEstimate(prisma, advisor, { versionId: est.versionId, reason: 'other', expectedVersion: shown.version, idempotencyKey: uniqueKey('x') }))).toBe(Codes.INVALID_INPUT)
      const declined = await declineEstimate(prisma, advisor, { versionId: est.versionId, reason: 'price', expectedVersion: shown.version, idempotencyKey: uniqueKey('x') })
      expect(declined.status).toBe('declined')
      expect(await code(sellEstimate(prisma, advisor, { versionId: est.versionId, optionId: 'x', expectedVersion: declined.version, authorization: sign(), saleLocation: 'buyer_residence', initiatedBy: 'customer_request', idempotencyKey: uniqueKey('s') }))).toBe(Codes.INVALID_TRANSITION)
      // The agent drafts the follow-up; a person reviews it. The agent cannot present.
      const follow = await draftFollowupEstimate(prisma, agent, { versionId: est.versionId, idempotencyKey: uniqueKey('f') })
      expect(follow.versionNumber).toBe(2)
      expect(await code(presentEstimate(prisma, agent, { versionId: follow.versionId, expectedVersion: await versionOf(follow.versionId), idempotencyKey: uniqueKey('p') }))).toBe(Codes.SCOPE_DENIED)
      const summary = await estimateSummary(prisma, agent, { estimateId: est.estimateId })
      expect(summary.version?.status).toBe('draft')
      expect(JSON.stringify(summary)).not.toMatch(/costMinor/)
      await discardEstimateVersion(prisma, advisor, { versionId: follow.versionId, expectedVersion: await versionOf(follow.versionId), reason: 'Customer went elsewhere', idempotencyKey: uniqueKey('x') })
      expect((await prisma.estimate.findUniqueOrThrow({ where: { id: est.estimateId } })).status).toBe('declined')
      // Expiry: a presented estimate past its validity expires on the timer.
      const h2 = HOUSEHOLDS[33]
      const old = await createEstimate(prisma, advisor, { customerId: h2.id, locationId: h2.location.id, businessUnitId: 'seed_bu_electrical', title: 'Fan', options: [{ tier: 'single', name: 'Fan', lines: [{ itemKey: 'LIGHT-FAN', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      await presentEstimate(prisma, advisor, { versionId: old.versionId, expectedVersion: await versionOf(old.versionId), idempotencyKey: uniqueKey('p') })
      const later = new Date(REAL_NOW.getTime() + 32 * 86_400_000)
      expect((await expireDueEstimates(prisma, later)).expired).toBeGreaterThanOrEqual(1)
      expect((await prisma.estimateVersion.findUniqueOrThrow({ where: { id: old.versionId } })).status).toBe('expired')
      expect((await prisma.estimate.findUniqueOrThrow({ where: { id: old.estimateId } })).status).toBe('expired')
    })

    it('access: a tech sees estimates only on jobs they are assigned to; office staff without the estimate permission cannot write', { timeout: 120_000 }, async () => {
      const job = await bookedJob('AC-DIAG', '8–10 AM', 34, 'seed_emp_morrison')
      expect(await code(createEstimate(prisma, techNina, { jobId: job.jobId, title: 'x', idempotencyKey: uniqueKey('e') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(createEstimate(prisma, csr, { jobId: job.jobId, title: 'x', idempotencyKey: uniqueKey('e') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(createEstimate(prisma, agent, { jobId: job.jobId, title: 'x', idempotencyKey: uniqueKey('e') }))).toBe(Codes.SCOPE_DENIED)
      const est = await createEstimate(prisma, techJake, { jobId: job.jobId, title: 'Capacitor', options: [{ tier: 'single', name: 'Fix', lines: [{ itemKey: 'HVAC-CAP-DUAL', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      expect((await prisma.estimate.findUniqueOrThrow({ where: { id: est.estimateId } })).source).toBe('technician')
      expect(await code(presentEstimate(prisma, techNina, { versionId: est.versionId, expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('p') }))).toBe(Codes.NOT_AUTHORIZED)
      // An agent drafts from the visit's capture into a draft for a person.
      const drafted = await draftEstimate(prisma, agent, { visitId: job.visitId, title: 'From capture', options: [{ tier: 'single', name: 'Fix', lines: [{ itemKey: 'HVAC-CONTACTOR', quantity: '1' }] }], idempotencyKey: uniqueKey('d') })
      expect((await prisma.estimate.findUniqueOrThrow({ where: { id: drafted.estimateId } })).source).toBe('agent_draft')
      expect(await code(sellEstimate(prisma, agent, { versionId: drafted.versionId, optionId: 'x', expectedVersion: 0, authorization: sign(), saleLocation: 'buyer_residence', initiatedBy: 'customer_request', idempotencyKey: uniqueKey('s') }))).toBe(Codes.SCOPE_DENIED)
    })
  })

  // ── Sale, rights, notice, hold ──────────────────────────────────────────────

  describe('selling evaluates the cancellation right, issues the notice and holds covered work', () => {
    it('requested repair only at the home: no right, work starts', { timeout: 120_000 }, async () => {
      const job = await bookedJob('DRAIN-CLR', '8–10 AM', 35, 'seed_emp_patel')
      const { sold } = await sell(techNina, job.jobId, [{ itemKey: 'DRAIN-SINK', quantity: '1' }], { now: SALE })
      expect(sold.cancellation).toMatchObject({ applies: false, noticeId: null })
      expect(await prisma.cancellationEvaluation.count({ where: { jobId: job.jobId, rightApplies: false } })).toBe(1)
      await toOnSite(job.visitId, techNina)
      await setVisitStatus(prisma, techNina, { visitId: job.visitId, to: 'working', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW })
      expect((await prisma.visit.findUniqueOrThrow({ where: { id: job.visitId } })).status).toBe('working')
    })

    it('an add-on sold at the home: notice issued with both forms; the PDF re-renders; the hold, delivery, expiry', { timeout: 180_000 }, async () => {
      const job = await bookedJob('DRAIN-CLR', '10 AM–12 PM', 36, 'seed_emp_patel')
      const { sold, est } = await sell(techNina, job.jobId, [{ itemKey: 'DRAIN-HYDROJET', quantity: '1' }], { now: SALE })
      expect(sold.cancellation).toMatchObject({ applies: true, coveredAmountMinor: '69500' })
      const notice = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: sold.cancellation!.noticeId! } })
      expect(notice.status).toBe('issued')
      expect(notice.rule).toBe('ftc_16cfr429')
      expect((notice.rules as { rule: string }[]).map(r => r.rule).sort()).toEqual(['ftc_cooling_off', 'tx_601'])
      const snap = notice.snapshot as Parameters<typeof renderNoticePdf>[0]
      expect(snap.notices.map(n => n.citation)).toEqual(['16 CFR 429.1(a)-(b)', 'Tex. Bus. & Com. Code §601.052-.053'])
      const doc = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: notice.noticeDocumentId! } })
      expect(sha256Bytes(renderNoticePdf(snap))).toBe(doc.sha256)
      // Right fields are frozen by the database; the notice can't be deleted.
      await expect(prisma.cancellationNotice.update({ where: { id: notice.id }, data: { cancelBy: new Date() } })).rejects.toThrow(/fixed when issued/)
      await expect(prisma.cancellationNotice.update({ where: { id: notice.id }, data: { status: 'expired_uncancelled' } })).rejects.toThrow(/cannot move/)
      await expect(prisma.cancellationNotice.delete({ where: { id: notice.id } })).rejects.toThrow(/kept/)
      const evaluation = await prisma.cancellationEvaluation.findUniqueOrThrow({ where: { id: notice.evaluationId! } })
      await expect(prisma.cancellationEvaluation.update({ where: { id: evaluation.id }, data: { rightApplies: false } })).rejects.toThrow()
      const auth = await prisma.authorization.findFirstOrThrow({ where: { subjectId: est.versionId } })
      await expect(prisma.authorization.update({ where: { id: auth.id }, data: { signerName: 'x' } })).rejects.toThrow()
      // Work is held: every planned line is covered.
      await toOnSite(job.visitId, techNina)
      const start = () => setVisitStatus(prisma, techNina, { visitId: job.visitId, to: 'working', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW })
      expect(await reason(start())).toBe('cancellation_hold')
      // Delivered on the device; still held until the window closes.
      expect(await code(deliverCancellationNotice(prisma, techNina, { noticeId: notice.id, method: 'signed_on_device', acknowledgedBy: 'Buyer', expectedVersion: notice.version, idempotencyKey: uniqueKey('dl') }))).toBe(Codes.INVALID_INPUT)
      expect(await code(deliverCancellationNotice(prisma, techJake, { noticeId: notice.id, method: 'printed_acknowledged', acknowledgedBy: 'Buyer', expectedVersion: notice.version, idempotencyKey: uniqueKey('dl') }))).toBe(Codes.NOT_AUTHORIZED)
      await deliverCancellationNotice(prisma, techNina, { noticeId: notice.id, method: 'signed_on_device', acknowledgedBy: 'Buyer', signature: SIGNATURE, expectedVersion: notice.version, idempotencyKey: uniqueKey('dl') })
      expect(await reason(start())).toBe('cancellation_hold')
      // The window closes: the timer expires the notice and the hold lifts.
      const after = new Date(notice.cancelBy.getTime() + 60_000)
      expect(await expireCancellationNotices(prisma, after)).toMatchObject({ expired: 1 })
      expect((await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: notice.id } })).status).toBe('expired_uncancelled')
      expect(await cancellationHoldsFor(prisma, job.jobId, after)).toEqual([])
      expect(await code(start())).toBe('OK')
    })

    it('a requested repair plus an add-on: only the add-on is covered, so the repair can start', { timeout: 120_000 }, async () => {
      const job = await bookedJob('DRAIN-CLR', '12–2 PM', 37, 'seed_emp_patel')
      const { sold } = await sell(techNina, job.jobId, [{ itemKey: 'DRAIN-MAIN-CLEANOUT', quantity: '1' }, { itemKey: 'DRAIN-HYDROJET', quantity: '1' }], { now: SALE })
      expect(sold.cancellation).toMatchObject({ applies: true, coveredAmountMinor: '69500' })
      await toOnSite(job.visitId, techNina)
      expect(await code(setVisitStatus(prisma, techNina, { visitId: job.visitId, to: 'working', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW }))).toBe('OK')
    })

    it('an undelivered notice never expires: the office gets a task, and the hold stays', { timeout: 120_000 }, async () => {
      const job = await bookedJob('LEAK-REP', '12–2 PM', 38, 'seed_emp_castillo')
      const techRay = userActor('seed_user_castillo', ROLE_PERMS.tech)
      const { sold } = await sell(techRay, job.jobId, [{ itemKey: 'DRAIN-ENZYME', quantity: '1' }], { now: SALE })
      const id = sold.cancellation!.noticeId!
      const notice = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id } })
      const later = new Date(notice.cancelBy.getTime() + 86_400_000)
      const swept = await expireCancellationNotices(prisma, later)
      expect(swept.expired).toBe(0)
      expect(swept.undelivered).toBeGreaterThanOrEqual(1)
      expect((await prisma.cancellationNotice.findUniqueOrThrow({ where: { id } })).status).toBe('issued')
      expect(await prisma.task.count({ where: { dedupeKey: `cancellation.undelivered:${id}` } })).toBe(1)
      expect((await cancellationHoldsFor(prisma, job.jobId, later)).map(h => h.id)).toEqual([id])
    })

    it('the buyer cancels in time: covered lines and the estimate are cancelled, the refund is due in 10 business days and recorded in full', { timeout: 180_000 }, async () => {
      const job = await bookedJob('LEAK-REP', '8–10 AM', 39, 'seed_emp_castillo')
      const techRay = userActor('seed_user_castillo', ROLE_PERMS.tech)
      const { sold, est } = await sell(techRay, job.jobId, [{ itemKey: 'PLB-PRV', quantity: '1', cancellationClass: 'additional_goods_services' }], { now: SALE, initiatedBy: 'solicited', depositMinor: '20000' })
      const id = sold.cancellation!.noticeId!
      let n = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id } })
      // A cancellation sent after the deadline is refused; one the seller hasn't received yet can't be recorded from the future.
      const late = new Date(n.cancelBy.getTime() + 1000).toISOString()
      expect(await reason(recordBuyerCancellation(prisma, csr, { noticeId: id, via: 'mail', sentAt: late, amountPaidMinor: '20000', expectedVersion: n.version, idempotencyKey: uniqueKey('c'), now: new Date(n.cancelBy.getTime() + 86_400_000) }))).toBe('after_deadline')
      expect(await code(recordBuyerCancellation(prisma, techJake, { noticeId: id, via: 'mail', sentAt: SALE.toISOString(), expectedVersion: n.version, idempotencyKey: uniqueKey('c') }))).toBe(Codes.NOT_AUTHORIZED)
      const sentAt = new Date(SALE.getTime() + 26 * 3_600_000) // next day, by mail
      const cancelled = await recordBuyerCancellation(prisma, csr, { noticeId: id, via: 'mail', sentAt: sentAt.toISOString(), amountPaidMinor: '20000', expectedVersion: n.version, idempotencyKey: uniqueKey('c'), now: new Date(sentAt.getTime() + 3_600_000) })
      expect(cancelled.status).toBe('cancelled_by_buyer')
      expect(cancelled.workLineIds).toHaveLength(1)
      expect((await prisma.workLine.findUniqueOrThrow({ where: { id: cancelled.workLineIds[0] } })).status).toBe('cancelled_by_buyer')
      expect((await prisma.estimate.findUniqueOrThrow({ where: { id: est.estimateId } })).status).toBe('cancelled')
      // Ten business days (Sundays and federal holidays excluded) from the day the buyer sent it.
      const cal = inZone(US_FEDERAL, 'America/Chicago')
      expect(cancelled.refundDueBy).toBe(addBusinessDays(cal, localDate(cal, sentAt), 10))
      const task = await prisma.task.findUniqueOrThrow({ where: { dedupeKey: `cancellation.refund:${id}` } })
      expect(task.status).toBe('open')
      n = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id } })
      expect(await reason(markCancellationRefunded(prisma, accountant, { noticeId: id, evidence: { method: 'check', reference: '1042', amountMinor: '10000' }, expectedVersion: n.version, idempotencyKey: uniqueKey('r') }))).toBe('refund_amount_mismatch')
      expect(await code(markCancellationRefunded(prisma, csr, { noticeId: id, evidence: { method: 'check', reference: '1042', amountMinor: '20000' }, expectedVersion: n.version, idempotencyKey: uniqueKey('r') }))).toBe(Codes.NOT_AUTHORIZED)
      const refunded = await markCancellationRefunded(prisma, accountant, { noticeId: id, evidence: { method: 'check', reference: '1042', amountMinor: '20000' }, expectedVersion: n.version, idempotencyKey: uniqueKey('r') })
      expect(refunded.status).toBe('refunded')
      expect((await prisma.task.findUniqueOrThrow({ where: { dedupeKey: `cancellation.refund:${id}` } })).status).toBe('done')
      // Terminal: nothing moves it again.
      expect(await code(recordBuyerCancellation(prisma, csr, { noticeId: id, via: 'mail', sentAt: sentAt.toISOString(), expectedVersion: refunded.version, idempotencyKey: uniqueKey('c') }))).toBe(Codes.INVALID_TRANSITION)
    })

    it('Texas keeps the right through an emergency waiver; an override is approved by a second person', { timeout: 180_000 }, async () => {
      const job = await bookedJob('LEAK-REP', '10 AM–12 PM', 40, 'seed_emp_castillo')
      const techRay = userActor('seed_user_castillo', ROLE_PERMS.tech)
      const waiver = { present: true, handwritten: true, signedAndDated: true, statement: 'Water is pouring through the ceiling; please start now. I waive my right to cancel.', mediaRef: 'photo-123' }
      const { sold } = await sell(techRay, job.jobId, [{ itemKey: 'PLB-PRV', quantity: '1', cancellationClass: 'additional_goods_services' }], { now: SALE, emergencyWaiver: waiver })
      // Federal is waived by the complete statement; ch. 601 has no emergency waiver, so its right stands.
      expect(sold.cancellation).toMatchObject({ applies: true })
      const notice = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: sold.cancellation!.noticeId! } })
      expect((notice.rules as { rule: string }[]).map(r => r.rule)).toEqual(['tx_601'])
      expect(await reason(waiveCancellationNotice(prisma, techRay, { noticeId: notice.id, waiver, expectedVersion: notice.version, idempotencyKey: uniqueKey('w') }))).toBe('waiver_not_available')
      await toOnSite(job.visitId, techRay)
      expect(await reason(setVisitStatus(prisma, techRay, { visitId: job.visitId, to: 'working', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW }))).toBe('cancellation_hold')
      const asked = await requestCancellationHoldOverride(prisma, dispatcher, { noticeId: notice.id, reason: 'Active leak; the buyer asked us to start.', expectedVersion: notice.version, idempotencyKey: uniqueKey('o') })
      const req = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: asked.approvalRequestId } })
      expect(await code(decideApprovalAs(prisma, dispatcher, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') }))).toBe(Codes.SELF_APPROVAL)
      await decideApprovalAs(prisma, gm, { requestId: req.id, decision: 'approve', expectedVersion: req.version, idempotencyKey: uniqueKey('a') })
      expect(await code(setVisitStatus(prisma, techRay, { visitId: job.visitId, to: 'working', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: REAL_NOW }))).toBe('OK')
      // The buyer still has the right to cancel.
      expect((await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: notice.id } })).status).toBe('issued')
    })

    it('ACR exemption: a consumer-initiated HVAC add-on keeps only the federal right', { timeout: 120_000 }, async () => {
      const job = await bookedJob('AC-DIAG', '10 AM–12 PM', 43, 'seed_emp_morrison')
      const { sold } = await sell(techJake, job.jobId, [{ itemKey: 'HVAC-T-STAT-SMART', quantity: '1' }], { now: SALE })
      const notice = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: sold.cancellation!.noticeId! } })
      expect((notice.rules as { rule: string }[]).map(r => r.rule)).toEqual(['ftc_cooling_off'])
      const ev = await prisma.cancellationEvaluation.findUniqueOrThrow({ where: { id: notice.evaluationId! } })
      const tx = (ev.results as { results: { rule: string; reasons: string[] }[] }).results.find(r => r.rule === 'tx_601')!
      expect(tx.reasons).toContain('tx_acr_consumer_initiated')
    })

    it('a sale at our place of business carries no right', { timeout: 120_000 }, async () => {
      const job = await bookedJob('ELEC-DIAG', '8–10 AM', 44, 'seed_emp_dawson')
      const techLuke = userActor('seed_user_dawson', ROLE_PERMS.tech)
      const { sold } = await sell(techLuke, job.jobId, [{ itemKey: 'SAFE-SURGE', quantity: '1' }], { now: SALE, location: 'merchant_place' })
      expect(sold.cancellation).toMatchObject({ applies: false, noticeId: null })
    })
  })

  describe('change orders', () => {
    it('draft → presented → accepted adds lines and evaluates rights for the added lines only; stale and repeat are refused', { timeout: 180_000 }, async () => {
      const job = await bookedJob('DRAIN-CLR', '2–4 PM', 45, 'seed_emp_patel')
      const { sold } = await sell(techNina, job.jobId, [{ itemKey: 'DRAIN-SINK', quantity: '1' }], { now: SALE })
      expect(sold.cancellation).toMatchObject({ applies: false })
      const remove = sold.workLineIds[0]
      const co = await draftChangeOrder(prisma, techNina, { jobId: job.jobId, reason: 'Found a failing P-trap and a slow tub', add: [{ itemKey: 'DRAIN-PTRAP', quantity: '1' }, { itemKey: 'DRAIN-ENZYME', quantity: '1' }], removeWorkLineIds: [remove], idempotencyKey: uniqueKey('co') })
      expect(co.deltaMinor).toBe(String(21500 + 12900 - 19900))
      expect(await code(presentChangeOrder(prisma, techNina, { changeOrderId: co.changeOrderId, expectedVersion: co.version + 1, idempotencyKey: uniqueKey('p') }))).toBe(Codes.STALE_STATE)
      const shown = await presentChangeOrder(prisma, techNina, { changeOrderId: co.changeOrderId, expectedVersion: co.version, idempotencyKey: uniqueKey('p') })
      const accepted = await acceptChangeOrder(prisma, techNina, { changeOrderId: co.changeOrderId, expectedVersion: shown.version, authorization: sign(), saleLocation: 'buyer_residence', initiatedBy: 'customer_request', idempotencyKey: uniqueKey('a'), now: SALE })
      expect(accepted.workLineIds).toHaveLength(2)
      expect((await prisma.workLine.findUniqueOrThrow({ where: { id: remove } })).status).toBe('removed')
      // Only the enzyme treatment is an add-on: the P-trap is a part the requested repair needs (16 CFR 429.0(a)(5)(vi)), and Texas covers only add-ons on a visit the buyer asked for.
      expect(accepted.cancellation).toMatchObject({ applies: true, coveredAmountMinor: '12900' })
      const notice = await prisma.cancellationNotice.findUniqueOrThrow({ where: { id: accepted.cancellation!.noticeId! }, include: { coveredWorkLines: { select: { id: true } } } })
      expect(notice.changeOrderId).toBe(co.changeOrderId)
      expect(notice.coveredWorkLines.length).toBe(1)
      expect(await code(acceptChangeOrder(prisma, techNina, { changeOrderId: co.changeOrderId, expectedVersion: accepted.version, authorization: sign(), saleLocation: 'buyer_residence', initiatedBy: 'customer_request', idempotencyKey: uniqueKey('a') }))).toBe(Codes.INVALID_TRANSITION)
    })
  })

  describe('replay and onboarding', () => {
    it('a sale replays with the same key and never double-creates', { timeout: 120_000 }, async () => {
      const job = await bookedJob('ELEC-DIAG', '10 AM–12 PM', 46, 'seed_emp_dawson')
      const techLuke = userActor('seed_user_dawson', ROLE_PERMS.tech)
      const est = await createEstimate(prisma, techLuke, { jobId: job.jobId, title: 'Surge', options: [{ tier: 'single', name: 'Surge', lines: [{ itemKey: 'SAFE-SURGE', quantity: '1' }] }], idempotencyKey: uniqueKey('e') })
      const shown = await presentEstimate(prisma, techLuke, { versionId: est.versionId, expectedVersion: await versionOf(est.versionId), idempotencyKey: uniqueKey('p') })
      const option = await prisma.estimateOption.findFirstOrThrow({ where: { estimateVersionId: est.versionId } })
      const args = { versionId: est.versionId, optionId: option.id, expectedVersion: shown.version, authorization: sign(), saleLocation: 'buyer_residence' as const, initiatedBy: 'customer_request' as const, idempotencyKey: uniqueKey('sell'), now: SALE }
      const first = await sellEstimate(prisma, techLuke, args)
      const again = await sellEstimate(prisma, techLuke, args)
      expect(again.replay).toBe(true)
      expect(again.authorizationId).toBe(first.authorizationId)
      expect(await prisma.authorization.count({ where: { subjectId: est.versionId } })).toBe(1)
      expect(await prisma.cancellationNotice.count({ where: { estimateVersionId: est.versionId } })).toBe(1)
      expect(await code(sellEstimate(prisma, techLuke, { ...args, optionId: 'other' }))).toBe(Codes.IDEMPOTENCY_KEY_REUSED)
    })

    it('onboarding with a book already loaded reports it and changes nothing; it needs the onboarding permission', { timeout: 600_000 }, async () => {
      const ctx = { session: sessionFor(ownerId, ALL), prisma }
      const out = await loadPriceBookSetup(null, { idempotencyKey: uniqueKey('pbs') }, ctx)
      expect(out.created).toMatchObject({ priceBookId, items: CATALOG.length })
      expect(await prisma.priceBook.count()).toBe(1)
      const agentCtx = { session: sessionFor(ownerId, []), prisma }
      expect(await code(loadPriceBookSetup(null, { idempotencyKey: uniqueKey('pbs') }, agentCtx))).toBe(Codes.NOT_AUTHORIZED)
    })

    it('the audit chain verifies after everything above', { timeout: 120_000 }, async () => {
      expect((await verifyAuditChain(prisma)).ok).toBe(true)
    })
  })
})
