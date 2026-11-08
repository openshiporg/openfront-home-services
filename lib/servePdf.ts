import { createHash } from 'node:crypto'

/**
 * Serve a re-rendered document only if its bytes hash to the stored DocumentVersion (C11: the stored
 * file is the render recipe plus its sha256). A mismatch means the renderer or the snapshot changed
 * since the customer received the document, so nothing is served and the caller sees a 409.
 */
export function servePdf(bytes: Uint8Array, expectedSha256: string | null | undefined, fileName: string) {
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (!expectedSha256 || actual !== expectedSha256) {
    return new Response('This document no longer matches the copy the customer received. Contact support; nothing was served.', { status: 409 })
  }
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName.replace(/[^\w.-]+/g, '_')}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-SHA256': actual,
    },
  })
}
