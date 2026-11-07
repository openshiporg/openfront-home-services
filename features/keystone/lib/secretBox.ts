import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { Tx } from './db'

/*
 * SecretBox (SCHEMA G7): gate codes, lockbox codes and integration credentials are stored as
 * AES-256-GCM ciphertext. The key comes from SECRET_BOX_KEY (or, when unset in development, is
 * derived from SESSION_SECRET), never from the database. The list has no GraphQL API at all; the only
 * read path for an access secret is revealAccessSecret, which checks assignment and logs the reveal.
 */

export type SecretPurpose = 'integration_credential' | 'access_secret' | 'webhook_secret'

function key(version = 1) {
  const material = process.env.SECRET_BOX_KEY || process.env.SESSION_SECRET
  if (!material) {
    if (process.env.NODE_ENV === 'production') throw new Error('SECRET_BOX_KEY is not set')
    return createHash('sha256').update('openfront-home-services:development-secret-box').digest()
  }
  return createHash('sha256').update(`openfront-home-services:secret-box:v${version}:${material}`).digest()
}

export async function sealSecret(tx: Tx, purpose: SecretPurpose, plaintext: string, createdById?: string | null) {
  if (!plaintext || plaintext.length > 4096) throw new Error('Secret must be 1-4096 characters')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(1), iv)
  cipher.setAAD(Buffer.from(purpose))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const row = await tx.secretBox.create({
    data: { purpose, ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), keyVersion: 1, ...(createdById ? { createdById } : {}) },
    select: { id: true },
  })
  return row.id
}

export async function openSecret(tx: Tx, id: string, purpose: SecretPurpose) {
  const row = await tx.secretBox.findUnique({ where: { id } })
  if (!row || row.purpose !== purpose) throw new Error('Secret not found')
  const decipher = createDecipheriv('aes-256-gcm', key(row.keyVersion ?? 1), Buffer.from(row.iv, 'base64'))
  decipher.setAAD(Buffer.from(purpose))
  decipher.setAuthTag(Buffer.from(row.authTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
