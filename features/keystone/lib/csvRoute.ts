import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '../context'

/** CSV cell: a leading = + - @ is made harmless so a spreadsheet never runs it as a formula. */
export const cell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
export const toCsv = (rows: unknown[][]) => rows.map(r => r.map(cell).join(',')).join('\n') + '\n'

/** Runs an export for a signed-in person holding at least one of the permissions. Nothing is sent to anyone. */
export async function exportCsv(request: Request, path: string, perms: string[], filename: string, build: (db: any) => Promise<string | null>) {
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: path } as IncomingMessage)
  const session = context.session as { data?: { role?: Record<string, unknown> } } | undefined
  if (!session?.data) return new Response('Sign in to export.', { status: 401 })
  const role = session.data.role ?? {}
  if (!perms.some(p => role[p] === true)) return new Response('Not found.', { status: 404 })
  const body = await build(keystoneContext.prisma)
  if (body === null) return new Response('Not found.', { status: 404 })
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } })
}
