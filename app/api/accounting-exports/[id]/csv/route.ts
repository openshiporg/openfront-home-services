import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { exportBatchCsv } from '@/features/keystone/services/accounting'

export const dynamic = 'force-dynamic'

/** The accounting export is a download: balanced journal lines as CSV, read through the signed-in session. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: `/api/accounting-exports/${id}/csv` } as IncomingMessage)
  if (!context.session?.itemId) return new Response('Sign in to export.', { status: 401 })
  const visible = await context.query.AccountingExportBatch.findOne({ where: { id }, query: 'id' }).catch(() => null)
  if (!visible) return new Response('Export not found.', { status: 404 })
  const out = await exportBatchCsv(keystoneContext.prisma as never, id)
  if (!out) return new Response('Export not found.', { status: 404 })
  return new Response(out.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${out.ref}.csv"`, 'Cache-Control': 'private, no-store' } })
}
