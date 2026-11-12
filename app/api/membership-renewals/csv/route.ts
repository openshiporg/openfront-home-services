import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { renewalsComing, renewalsCsv } from '@/features/keystone/services/agreements'

export const dynamic = 'force-dynamic'

/** The renewal list as a download for staff who sell memberships. Nothing is sent to anyone. */
export async function GET(request: Request) {
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: '/api/membership-renewals/csv' } as IncomingMessage)
  const session = context.session as { data?: { role?: Record<string, unknown> } } | undefined
  if (!session?.data) return new Response('Sign in to export.', { status: 401 })
  const role = session.data.role ?? {}
  if (role.canSellMemberships !== true && role.canManageMemberships !== true) return new Response('Not found.', { status: 404 })
  const url = new URL(request.url)
  const rows = await renewalsComing(keystoneContext.prisma as never, { withinDays: 60, baseUrl: url.origin })
  return new Response(renewalsCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="membership-renewals.csv"', 'Cache-Control': 'private, no-store' } })
}
