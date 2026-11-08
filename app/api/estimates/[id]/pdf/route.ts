import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { presentedLabel, renderEstimatePdf, type EstimateSnapshot } from '@/lib/salesPdf'
import { servePdf } from '@/lib/servePdf'

export const dynamic = 'force-dynamic'

/**
 * The estimate PDF for staff, read through the session (estimate scoping applies: a technician sees only
 * estimates on jobs they are assigned to). Re-rendered from the frozen snapshot and checked against the
 * stored hash before it is served.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: `/api/estimates/${id}/pdf` } as IncomingMessage)
  if (!context.session?.itemId) return new Response('Sign in to view estimates.', { status: 401 })
  const row = (await context.query.EstimateVersion.findOne({ where: { id }, query: 'status snapshot pdf { versions(orderBy: { versionNumber: desc }, take: 1) { sha256 } }' }).catch(() => null)) as { status: string; snapshot: EstimateSnapshot | null; pdf: { versions: { sha256: string }[] } | null } | null
  if (!row?.snapshot || ['draft', 'pending_approval', 'discarded'].includes(row.status)) return new Response('Estimate not found.', { status: 404 })
  const s = row.snapshot
  return servePdf(renderEstimatePdf(s, presentedLabel(s)), row.pdf?.versions[0]?.sha256, `${s.ref}-v${s.versionNumber}`)
}
