import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { toCsv } from '@/features/keystone/services/accounting'

export const dynamic = 'force-dynamic'

const BUCKETS = ['Current', '1-30', '31-60', '61-90', '90+']
const bucket = (days: number) => (days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4)
const dollars = (c: bigint) => `${c < 0n ? '-' : ''}${(c < 0n ? -c : c) / 100n}.${String((c < 0n ? -c : c) % 100n).padStart(2, '0')}`

/** Accounts receivable aging as a download (reports are export buttons, not scheduled sends). */
export async function GET(request: Request) {
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: '/api/reports/ar-aging' } as IncomingMessage)
  if (!context.session?.itemId) return new Response('Sign in to export.', { status: 401 })
  const rows = (await context.query.Invoice.findMany({
    where: { status: { in: ['posted', 'partially_paid'] } }, orderBy: [{ dueDate: 'asc' }], take: 5000,
    query: 'ref dueDate balanceMinor status collectionsStatus customer { displayName } payer { name }',
  }).catch(() => null)) as { ref: string; dueDate: string | null; balanceMinor: string; status: string; collectionsStatus: string; customer: { displayName: string } | null; payer: { name: string } | null }[] | null
  if (!rows) return new Response('Not allowed.', { status: 403 })
  const today = Date.now()
  const out = rows.map(r => {
    const days = r.dueDate ? Math.floor((today - Date.parse(r.dueDate)) / 86_400_000) : 0
    return [r.ref, r.payer?.name ?? r.customer?.displayName ?? '', r.dueDate?.slice(0, 10) ?? '', r.status, r.collectionsStatus, BUCKETS[bucket(days)], dollars(BigInt(r.balanceMinor))]
  })
  const csv = toCsv(['Invoice', 'Bill to', 'Due', 'Status', 'Collections', 'Aging', 'Balance'], out)
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ar-aging-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' } })
}
