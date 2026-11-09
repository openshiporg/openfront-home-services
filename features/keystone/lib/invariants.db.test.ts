import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'

/*
 * Review r5b "app-only" invariants, now enforced by the database itself (migration r5b_db_invariants).
 * Each test writes straight to the table, as someone bypassing the application could.
 */
describe.skipIf(!hasTestDatabase)('database invariants the application also keeps (r5b)', () => {
  let prisma: PrismaClient
  const H = 'a'.repeat(64)
  beforeAll(async () => {
    prisma = testPrisma(4)
    await resetDatabase(prisma)
  })
  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('1. an approval request cannot change status or payload after a decision; it can be used once', async () => {
    const make = (data: object = {}) => prisma.approvalRequest.create({ data: { action: 'estimate.discount', targetList: 'Estimate', targetId: uniqueKey('e'), payload: { discountBps: 1500 }, payloadHash: H, requiredPermission: 'canApproveDiscounts', ...data } })
    // Pending requests stay editable (the decision itself is the pending -> approved move).
    const pending = await make()
    await prisma.approvalRequest.update({ where: { id: pending.id }, data: { summary: 'ok' } })
    const approved = await prisma.approvalRequest.update({ where: { id: pending.id }, data: { status: 'approved', version: { increment: 1 } } })
    await expect(prisma.approvalRequest.update({ where: { id: approved.id }, data: { status: 'rejected' } })).rejects.toThrow(/decision is final/)
    await expect(prisma.approvalRequest.update({ where: { id: approved.id }, data: { status: 'pending' } })).rejects.toThrow(/decision is final/)
    await expect(prisma.approvalRequest.update({ where: { id: approved.id }, data: { payload: { discountBps: 9000 } } })).rejects.toThrow(/frozen/)
    await expect(prisma.approvalRequest.update({ where: { id: approved.id }, data: { payloadHash: 'b'.repeat(64) } })).rejects.toThrow(/frozen/)
    await prisma.approvalRequest.update({ where: { id: approved.id }, data: { consumedAt: new Date(), version: { increment: 1 } } })
    await expect(prisma.approvalRequest.update({ where: { id: approved.id }, data: { consumedAt: null } })).rejects.toThrow(/already used/)
    // A rejected request cannot be flipped to approved.
    const rejected = await prisma.approvalRequest.update({ where: { id: (await make()).id }, data: { status: 'rejected' } })
    await expect(prisma.approvalRequest.update({ where: { id: rejected.id }, data: { status: 'approved' } })).rejects.toThrow(/decision is final/)
    // Only an approved request can be used.
    await expect(prisma.approvalRequest.update({ where: { id: rejected.id }, data: { consumedAt: new Date() } })).rejects.toThrow(/consumed_only_if_approved|decision is final|frozen|used/)
  })

  it('2. a revoked OAuth token cannot be un-revoked', async () => {
    const t = await prisma.oAuthToken.create({ data: { tokenType: 'access_token', token: uniqueKey('tok'), clientId: 'c', resource: 'r', isRevoked: 'false' } })
    await prisma.oAuthToken.update({ where: { id: t.id }, data: { isRevoked: 'true' } })
    await expect(prisma.oAuthToken.update({ where: { id: t.id }, data: { isRevoked: 'false' } })).rejects.toThrow(/stays revoked/)
    await expect(prisma.oAuthToken.update({ where: { id: t.id }, data: { isRevoked: null } })).rejects.toThrow(/stays revoked/)
    await prisma.oAuthToken.update({ where: { id: t.id }, data: { isRevoked: 'true', expiresAt: new Date() } }) // other writes to a revoked token are fine
  })

  it('3. a sold work line keeps its quantity, price and amount, and is not deleted; its status can still move', async () => {
    const sold = await prisma.workLine.create({ data: { source: 'estimate_line', description: 'Sold line', quantity: '1', unitPriceMinor: 10000n, amountMinor: 10000n, taxCategory: 'labor', trade: 'plumbing', cancellationClass: 'requested_repair' } })
    await expect(prisma.workLine.update({ where: { id: sold.id }, data: { amountMinor: 1n } })).rejects.toThrow(/amount is fixed/)
    await expect(prisma.workLine.update({ where: { id: sold.id }, data: { unitPriceMinor: 1n } })).rejects.toThrow(/amount is fixed/)
    await expect(prisma.workLine.update({ where: { id: sold.id }, data: { quantity: '5' } })).rejects.toThrow(/amount is fixed/)
    await expect(prisma.workLine.update({ where: { id: sold.id }, data: { source: 'manual' } })).rejects.toThrow(/amount is fixed/)
    await expect(prisma.workLine.delete({ where: { id: sold.id } })).rejects.toThrow(/kept/)
    await prisma.workLine.update({ where: { id: sold.id }, data: { status: 'completed', version: { increment: 1 }, description: 'Sold line (done)' } })
    // Not from a sale (a manual line): still editable.
    const manual = await prisma.workLine.create({ data: { source: 'manual', description: 'Manual', quantity: '1', unitPriceMinor: 1n, amountMinor: 1n, taxCategory: 'labor', trade: 'plumbing', cancellationClass: 'requested_repair' } })
    await prisma.workLine.update({ where: { id: manual.id }, data: { amountMinor: 2n } })
  })

  it('4. the label of a published, active or retired price book version is frozen; a draft label is editable', async () => {
    const book = await prisma.priceBook.create({ data: { name: 'Book', code: uniqueKey('pb') } })
    const draft = await prisma.priceBookVersion.create({ data: { priceBookId: book.id, versionNumber: 1, label: 'Draft label', status: 'draft' } })
    await prisma.priceBookVersion.update({ where: { id: draft.id }, data: { label: 'Draft label 2' } })
    await prisma.priceBookVersion.update({ where: { id: draft.id }, data: { status: 'active', contentHash: H, effectiveAt: new Date(), publishedAt: new Date() } })
    await expect(prisma.priceBookVersion.update({ where: { id: draft.id }, data: { label: 'Cheap!' } })).rejects.toThrow(/immutable/)
    await prisma.priceBookVersion.update({ where: { id: draft.id }, data: { status: 'retired' } })
    await expect(prisma.priceBookVersion.update({ where: { id: draft.id }, data: { label: 'Renamed later' } })).rejects.toThrow(/immutable/)
  })
})
