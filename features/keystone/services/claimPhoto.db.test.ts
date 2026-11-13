import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import { DomainError } from '../lib/errors'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { HOUSEHOLDS } from '../seed/operationsData'
import { ROLES } from '../seed/company'
import { attachClaimPhoto, ensureRegistrationFor, markClaimReady, openClaim, recordEquipment, saveClaimDraft } from './warranty'

/*
 * Photo evidence: a claim cannot be ready without a photo, attaching one makes it ready, the same photo twice is one,
 * and only office or the technician on their own claim may attach.
 * Run alone: timeout 300 npx vitest run features/keystone/services/claimPhoto.db.test.ts --no-file-parallelism
 */
const ALL = permissionNames.filter(p => p !== 'canBreakGlass') as Permission[]
const TECH = ROLES.find(r => r.id === 'seed_role_technician')!.permissions as Permission[]
const actorWith = (id: string, perms: readonly Permission[]): Actor => ({ kind: 'user', userId: id, name: id, permissions: new Set(perms) as never })
const k = (p = 'k') => uniqueKey(p)
const reason = async (p: Promise<unknown>) => { try { await p; return 'OK' } catch (e) { return e instanceof DomainError ? String(e.details.reason ?? e.code) : `RAW:${String(e)}` } }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

describe.skipIf(!hasTestDatabase)('Claim photo evidence (database)', () => {
  let prisma: PrismaClient
  let owner: Actor
  let claimId: string
  const sessionWith = (id: string) => ({ itemId: id, listKey: 'User', data: { name: id, email: `${id}@t.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, ALL.includes(p)])) } } })

  beforeAll(async () => {
    prisma = testPrisma(2)
    await resetDatabase(prisma)
    const o = await prisma.user.create({ data: { name: 'owner', email: `${k('o')}@test.local`, password: 'x'.repeat(60) } })
    const setupCtx = { session: sessionWith(o.id), prisma }
    await loadCompanySetup(null, { idempotencyKey: k('c') }, setupCtx)
    await loadOperationsSetup(null, { idempotencyKey: k('op') }, setupCtx)
    owner = actorWith(o.id, ALL)
    const eq = await recordEquipment(prisma, owner, { locationId: HOUSEHOLDS[0].location.id, manufacturer: 'Trane', modelNumber: 'XR16', serialNumber: `T-${Date.now()}`, kind: 'ac_condenser', installDate: '2026-05-01', idempotencyKey: k() })
    await ensureRegistrationFor(prisma, owner, { equipmentId: eq.equipmentId, idempotencyKey: k() })
    claimId = (await openClaim(prisma, owner, { equipmentId: eq.equipmentId, idempotencyKey: k() })).claimId
    await saveClaimDraft(prisma, owner, { claimId, draft: { failedPart: 'Capacitor', failureDate: '2026-11-01', replacementSerial: 'CAP-1', laborHours: '1.5', claimedMinor: '12000' } as never, expectedVersion: (await prisma.warrantyClaim.findUniqueOrThrow({ where: { id: claimId }, select: { version: true } })).version, idempotencyKey: k() })
  }, 900_000)
  afterAll(async () => { await prisma?.$disconnect() })

  it('without a photo the claim is not ready; with one it is, and the same photo twice is one', { timeout: 120_000 }, async () => {
    const claim = () => prisma.warrantyClaim.findUniqueOrThrow({ where: { id: claimId }, select: { version: true, status: true, evidence: { select: { id: true } } } })
    expect(await reason(markClaimReady(prisma, owner, { claimId, expectedVersion: (await claim()).version, idempotencyKey: k() }))).toBe('claim_incomplete')
    expect(await reason(attachClaimPhoto(prisma, owner, { claimId, filename: 'part.txt', mimeType: 'text/plain', bytes: Buffer.from('hi') }))).toBe('INVALID_INPUT')
    const a = await attachClaimPhoto(prisma, owner, { claimId, filename: 'part.png', mimeType: 'image/png', bytes: PNG })
    const b = await attachClaimPhoto(prisma, owner, { claimId, filename: 'part.png', mimeType: 'image/png', bytes: PNG })
    expect(b.mediaId).toBe(a.mediaId)
    expect((await claim()).evidence).toHaveLength(1)
    const m = await prisma.media.findUniqueOrThrow({ where: { id: a.mediaId } })
    expect(Buffer.from(m.content, 'base64').equals(PNG)).toBe(true)
    await markClaimReady(prisma, owner, { claimId, expectedVersion: (await claim()).version, idempotencyKey: k() })
    expect((await claim()).status).toBe('ready')
    expect(await reason(attachClaimPhoto(prisma, owner, { claimId, filename: 'late.png', mimeType: 'image/png', bytes: Buffer.concat([PNG, Buffer.from([0])]) }))).toBe('GUARD_FAILED')
  })

  it('a technician may attach only to their own claim; one who is not on it is refused', { timeout: 120_000 }, async () => {
    const eq = await prisma.warrantyClaim.findUniqueOrThrow({ where: { id: claimId }, select: { equipmentId: true } })
    const mine = await openClaim(prisma, owner, { equipmentId: eq.equipmentId!, idempotencyKey: k() })
    const tech = await prisma.user.create({ data: { name: 'Tech', email: `${k('t')}@test.local`, password: 'x'.repeat(60), roleId: 'seed_role_technician' } })
    const other = await prisma.user.create({ data: { name: 'Other', email: `${k('t')}@test.local`, password: 'x'.repeat(60), roleId: 'seed_role_technician' } })
    await prisma.warrantyClaim.update({ where: { id: mine.claimId }, data: { draftedById: tech.id } })
    const bytes = Buffer.concat([PNG, Buffer.from([1])])
    expect(await reason(attachClaimPhoto(prisma, actorWith(other.id, TECH), { claimId: mine.claimId, filename: 'x.png', mimeType: 'image/png', bytes }))).toBe('NOT_AUTHORIZED')
    const ok = await attachClaimPhoto(prisma, actorWith(tech.id, TECH), { claimId: mine.claimId, filename: 'x.png', mimeType: 'image/png', bytes })
    expect(ok.mediaId).toBeTruthy()
  })
})
