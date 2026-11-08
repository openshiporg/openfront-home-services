import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { renderNoticePdf, type NoticeSnapshot } from '@/lib/salesPdf'
import { servePdf } from '@/lib/servePdf'

export const dynamic = 'force-dynamic'

/**
 * The notice of cancellation (receipt statement and both forms) as issued, for staff to print or resend.
 * Read through the session (assigned technicians and office staff), re-rendered from the frozen snapshot
 * and checked against the stored hash.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: `/api/cancellation-notices/${id}/pdf` } as IncomingMessage)
  if (!context.session?.itemId) return new Response('Sign in to view notices.', { status: 401 })
  const row = (await context.query.CancellationNotice.findOne({ where: { id }, query: 'ref snapshot noticeDocument { versions(orderBy: { versionNumber: desc }, take: 1) { sha256 } }' }).catch(() => null)) as { ref: string; snapshot: NoticeSnapshot | null; noticeDocument: { versions: { sha256: string }[] } | null } | null
  if (!row?.snapshot) return new Response('Notice not found.', { status: 404 })
  return servePdf(renderNoticePdf(row.snapshot), row.noticeDocument?.versions[0]?.sha256, `${row.ref}-notice-of-cancellation`)
}
