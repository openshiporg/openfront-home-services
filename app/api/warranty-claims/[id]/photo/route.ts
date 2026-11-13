import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { actorFromSession } from '@/features/keystone/lib/actor'
import { DomainError } from '@/features/keystone/lib/errors'
import { attachClaimPhoto, mayUseClaimPhotos, CLAIM_PHOTO_MAX_BYTES } from '@/features/keystone/services/warranty'

export const dynamic = 'force-dynamic'

async function who(request: Request) {
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: '/api/warranty-claims/photo' } as IncomingMessage)
  try { return actorFromSession(context.session as never) } catch { return null }
}

/** Upload one photo to a claim (multipart field "file"). Office, or a technician on a claim of their own job. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await who(request)
  if (!actor) return Response.json({ error: 'Sign in to attach a photo.' }, { status: 401 })
  const { id } = await params
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > CLAIM_PHOTO_MAX_BYTES + 200_000) return Response.json({ error: 'That photo is over 5 MB. Send a smaller one.' }, { status: 413 })
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return Response.json({ error: 'Choose a photo first.' }, { status: 400 })
  try {
    const r = await attachClaimPhoto(keystoneContext.prisma as never, actor, { claimId: id, filename: file.name || 'photo', mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) })
    return Response.json({ ok: true, mediaId: r.mediaId, replay: r.replay })
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ error: e.message }, { status: e.code === 'NOT_AUTHORIZED' ? 404 : 400 })
    throw e
  }
}

/** One stored photo: ?media=<id>. Only people who may attach to this claim may see it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await who(request)
  if (!actor) return new Response('Sign in.', { status: 401 })
  const { id } = await params
  const db = keystoneContext.prisma as never as any
  if (!(await mayUseClaimPhotos(db, actor, id))) return new Response('Not found.', { status: 404 })
  const m = await db.media.findFirst({ where: { id: new URL(request.url).searchParams.get('media') ?? '', subjectType: 'WarrantyClaim', subjectId: id }, select: { content: true, mimeType: true } })
  if (!m?.content) return new Response('Not found.', { status: 404 })
  return new Response(Buffer.from(m.content, 'base64'), { headers: { 'Content-Type': m.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
