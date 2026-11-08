import { createHash } from 'node:crypto'
import { actorUserId, type Actor } from '../lib/actor'
import { auditCreate } from '../lib/cas'
import type { Db, Tx } from '../lib/db'
import type { UnitOfWork } from '../lib/unitOfWork'

/* Helpers shared by estimates and cancellation rights: places, addresses, the seller block, rendered documents. */

export type LocationLike = { address1: string; address2?: string | null; city: string; state: string; postalCode: string }

/** The policy place of a service address (same shape as dispatch's placeOf). */
export const placeOfLocation = (loc: { state: string; postalCode: string; city: string } | null) => {
  const state = loc?.state ? `US-${loc.state}` : 'US-TX'
  return { state, zip: loc?.postalCode || null, city: loc?.city ? `${state}-${loc.city.toUpperCase().replace(/\s+/g, '-')}` : null }
}

export const addressLine = (loc: LocationLike | null) =>
  loc ? [loc.address1, loc.address2, `${loc.city}, ${loc.state} ${loc.postalCode}`].filter(Boolean).join(', ') : ''

/** The seller as printed on estimates and notices: brand, legal name, branch address, licences for the trades sold. */
export async function sellerBlock(tx: Tx | Db, businessUnitId: string | null, jurisdiction: string, trades: Iterable<string>) {
  const [company, brand, bu] = await Promise.all([
    tx.companySettings.findFirst({ select: { legalName: true, displayName: true, homeTimeZone: true, estimateValidityDays: true } }),
    tx.brand.findFirst({ orderBy: { createdAt: 'asc' }, select: { name: true, phone: true, email: true } }),
    businessUnitId ? tx.businessUnit.findUnique({ where: { id: businessUnitId }, select: { branch: { select: { line1: true, line2: true, city: true, region: true, postalCode: true } } } }) : null,
  ])
  if (!company) throw new Error('Company settings are not set up.')
  const branch = bu?.branch ?? (await tx.branch.findFirst({ orderBy: { createdAt: 'asc' }, select: { line1: true, line2: true, city: true, region: true, postalCode: true } }))
  const licenses = await tx.contractorLicense.findMany({ where: { displayOnDocuments: true, jurisdictionCode: jurisdiction, trade: { in: [...new Set(trades)] } }, orderBy: { trade: 'asc' }, select: { issuer: true, licenseNumber: true } })
  return {
    company,
    block: {
      name: brand?.name || company.displayName, legalName: company.legalName, phone: brand?.phone || '', email: brand?.email || '',
      address: branch ? [branch.line1, branch.line2, `${branch.city}, ${branch.region} ${branch.postalCode}`].filter(Boolean).join(', ') : '',
      licenses: licenses.map(l => ({ label: l.issuer, number: l.licenseNumber })),
    },
  }
}

export const sha256Bytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/**
 * A rendered document is reproducible from its frozen snapshot, so the stored version is the render
 * recipe (storageKey `render:<list>/<id>`) plus the byte hash; the download route re-renders from the
 * snapshot and refuses to serve bytes whose hash differs.
 */
export async function storeRenderedPdf(uow: UnitOfWork, actor: Actor, spec: { title: string; kind: string; subjectType: string; subjectId: string; storageKey: string; bytes: Uint8Array }) {
  const digest = sha256Bytes(spec.bytes)
  const doc = await uow.tx.document.create({ data: { title: spec.title, kind: spec.kind, visibility: 'customer', subjectType: spec.subjectType, subjectId: spec.subjectId }, select: { id: true } })
  await uow.tx.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, storageKey: spec.storageKey, sha256: digest, mimeType: 'application/pdf', sizeBytes: spec.bytes.length, createdById: actorUserId(actor) } })
  auditCreate(uow, actor, 'Document', doc.id, 'document.rendered', { kind: spec.kind, subjectType: spec.subjectType, subjectId: spec.subjectId, sha256: digest, sizeBytes: spec.bytes.length })
  return { documentId: doc.id, sha256: digest }
}

/** A document captured on paper or as text (e.g. the buyer's handwritten emergency waiver): the hash is of the transcription and the media reference. */
export async function storeRecordedDocument(uow: UnitOfWork, actor: Actor, spec: { title: string; kind: string; subjectType: string; subjectId: string; storageKey: string; content: string; mimeType: string }) {
  const digest = createHash('sha256').update(spec.content).digest('hex')
  const doc = await uow.tx.document.create({ data: { title: spec.title, kind: spec.kind, visibility: 'internal', subjectType: spec.subjectType, subjectId: spec.subjectId }, select: { id: true } })
  await uow.tx.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, storageKey: spec.storageKey, sha256: digest, mimeType: spec.mimeType, sizeBytes: Buffer.byteLength(spec.content), createdById: actorUserId(actor) } })
  auditCreate(uow, actor, 'Document', doc.id, 'document.recorded', { kind: spec.kind, subjectType: spec.subjectType, subjectId: spec.subjectId, sha256: digest })
  return { documentId: doc.id, sha256: digest }
}
