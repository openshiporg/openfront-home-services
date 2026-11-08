import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { ROLES } from './company'
import { HOUSEHOLDS } from './operationsData'
import { createEstimate, declineEstimate, presentEstimate, sellEstimate } from '../services/estimates'
import { deliverCancellationNotice } from '../services/cancellation'

/*
 * Sample sales on the seeded working day, through the same commands the estimate screens call:
 *   1. A 3-ton AC + furnace replacement for a household, presented with good/better/best (open).
 *   2. On a booked drain visit, the tech sells the requested drain clearing plus a hydro-jet and a camera
 *      inspection at the customer's home: the add-on is covered by the Texas home-solicitation right,
 *      so a notice of cancellation is issued, and delivered on the device.
 *   3. A panel upgrade quote the customer declined on price.
 * Every step has a fixed idempotency key, and the whole step is skipped once estimates exist.
 */

const role = (id: string) => ROLES.find(r => r.id === id)!
const staff = (userId: string, name: string, roleId: string): Actor => ({ kind: 'user', userId, name, permissions: new Set<Permission>(role(roleId).permissions.filter(p => permissionNames.includes(p))) })

const SIGNATURE = { kind: 'drawn', strokes: 3, capturedOn: 'field-tablet' }

export async function seedSales(db: Db, opts: { owner: Actor; prefix?: string }) {
  const prefix = opts.prefix ?? 'seed:sales'
  if (await db.estimate.count()) return { skipped: 'estimates exist' }
  const book = await db.priceBook.findFirst({ where: { activeVersionId: { not: null } }, select: { id: true } })
  if (!book) return { skipped: 'no active price book' }
  const advisor = staff('seed_user_kim', 'Rachel Kim', 'seed_role_comfort_advisor')
  const out: Record<string, unknown> = {}

  // 1. Replacement estimate, presented with three options.
  const h1 = HOUSEHOLDS[41]
  const replacement = await createEstimate(db, advisor, {
    customerId: h1.id, locationId: h1.location.id, businessUnitId: 'seed_bu_hvac_install', title: 'Replace 15-year-old AC and furnace',
    options: [
      { tier: 'good', name: 'Good: single stage', lines: [{ itemKey: 'SYS-ACF-3T-GOOD', quantity: '1' }] },
      { tier: 'better', name: 'Better: two stage', lines: [{ itemKey: 'SYS-ACF-3T-BETTER', quantity: '1' }, { itemKey: 'IAQ-UV', quantity: '1' }] },
      { tier: 'best', name: 'Best: variable speed', lines: [{ itemKey: 'SYS-ACF-3T-BEST', quantity: '1' }, { itemKey: 'DUCT-SEAL', quantity: '1' }] },
    ],
    idempotencyKey: `${prefix}:replacement`,
  })
  const v1 = await db.estimateVersion.findUniqueOrThrow({ where: { id: replacement.versionId }, select: { version: true } })
  await presentEstimate(db, advisor, { versionId: replacement.versionId, via: 'in_person', notes: 'Walked the attic; existing ductwork is serviceable.', expectedVersion: v1.version, idempotencyKey: `${prefix}:replacement:present` })
  out.replacement = replacement.ref

  // 2. Add-on sold at the home on an assigned drain visit, with the notice delivered.
  const drain = await db.visit.findFirst({
    where: { job: { jobTypeId: 'seed_jt_drain' }, assignments: { some: { active: true } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, jobId: true, assignments: { where: { active: true }, select: { employee: { select: { userId: true, displayName: true } } } } },
  })
  const techUser = drain?.assignments[0]?.employee
  if (drain?.jobId && techUser?.userId) {
    const tech = staff(techUser.userId, techUser.displayName, 'seed_role_technician')
    const est = await createEstimate(db, tech, {
      jobId: drain.jobId, title: 'Main line clearing and camera inspection',
      options: [{ tier: 'single', name: 'Clear, jet and inspect', lines: [{ itemKey: 'DRAIN-MAIN-CLEANOUT', quantity: '1' }, { itemKey: 'DRAIN-HYDROJET', quantity: '1' }, { itemKey: 'DRAIN-CAMERA', quantity: '1' }] }],
      idempotencyKey: `${prefix}:drain`,
    })
    const v = await db.estimateVersion.findUniqueOrThrow({ where: { id: est.versionId }, select: { version: true } })
    const presented = await presentEstimate(db, tech, { versionId: est.versionId, via: 'in_person', expectedVersion: v.version, idempotencyKey: `${prefix}:drain:present` })
    const option = await db.estimateOption.findFirstOrThrow({ where: { estimateVersionId: est.versionId }, select: { id: true } })
    const job = await db.job.findUniqueOrThrow({ where: { id: drain.jobId }, select: { customer: { select: { displayName: true } } } })
    const sold = await sellEstimate(db, tech, {
      versionId: est.versionId, optionId: option.id, expectedVersion: presented.version,
      authorization: { method: 'signature_on_device', signerName: job.customer?.displayName ?? 'Customer', signerRole: 'owner', signature: SIGNATURE },
      saleLocation: 'buyer_residence', initiatedBy: 'customer_request', idempotencyKey: `${prefix}:drain:sell`,
    })
    out.drain = { ref: est.ref, notice: sold.cancellation?.ref ?? null }
    if (sold.cancellation?.noticeId) {
      const n = await db.cancellationNotice.findUniqueOrThrow({ where: { id: sold.cancellation.noticeId }, select: { version: true } })
      await deliverCancellationNotice(db, tech, { noticeId: sold.cancellation.noticeId, method: 'signed_on_device', acknowledgedBy: job.customer?.displayName ?? 'Customer', signature: SIGNATURE, expectedVersion: n.version, idempotencyKey: `${prefix}:drain:deliver` })
    }
  }

  // 3. A panel upgrade the customer declined on price.
  const h3 = HOUSEHOLDS[27]
  const panel = await createEstimate(db, advisor, {
    customerId: h3.id, locationId: h3.location.id, businessUnitId: 'seed_bu_electrical', title: '200 A panel upgrade',
    options: [
      { tier: 'good', name: 'Good: 200 A panel', lines: [{ itemKey: 'PANEL-200A-GOOD', quantity: '1' }, { itemKey: 'FEE-PERMIT-ELEC', quantity: '1' }] },
      { tier: 'better', name: 'Better: with surge and AFCI', lines: [{ itemKey: 'PANEL-200A-BETTER', quantity: '1' }, { itemKey: 'FEE-PERMIT-ELEC', quantity: '1' }] },
    ],
    idempotencyKey: `${prefix}:panel`,
  })
  const pv = await db.estimateVersion.findUniqueOrThrow({ where: { id: panel.versionId }, select: { version: true } })
  const shown = await presentEstimate(db, advisor, { versionId: panel.versionId, via: 'email', expectedVersion: pv.version, idempotencyKey: `${prefix}:panel:present` })
  await declineEstimate(db, advisor, { versionId: panel.versionId, reason: 'price', note: 'Getting a second quote; asked us to follow up in the spring.', expectedVersion: shown.version, idempotencyKey: `${prefix}:panel:decline` })
  out.panel = panel.ref
  void opts.owner
  return out
}
