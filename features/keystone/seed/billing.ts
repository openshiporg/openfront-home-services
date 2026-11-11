import type { Db } from '../lib/db'
import type { Actor } from '../lib/actor'
import { createInvoiceDraft, postInvoice } from '../services/invoices'
import { recordInvoicePayment } from '../services/payments'
import { saveFinancingProgram, savePayerProfile } from '../services/financing'

/**
 * Billing sample data, through the real services: a financing program (the partner's terms as the
 * partner states them), a home-warranty payer, and the first sold job invoiced as progress billing,
 * posted and part-paid in cash. Idempotent: fixed keys, and nothing is added once invoices exist.
 */
export async function seedBilling(db: Db, opts: { biller: Actor; prefix?: string }) {
  const prefix = opts.prefix ?? 'seed:billing'
  const out: Record<string, unknown> = {}
  const program = await saveFinancingProgram(db, opts.biller, { name: 'Summit homeowner financing', partner: 'Third-party lender', minMinor: '100000', maxMinor: '5000000', termsNote: 'Rates and terms are set by the lender and shown to the customer by the lender.', applyUrl: 'https://lender.example/apply/summit', active: true, idempotencyKey: `${prefix}:program` })
  out.program = program.programId
  await savePayerProfile(db, opts.biller, { name: 'Shield Home Warranty', kind: 'home_warranty_company', terms: 'net_30', poRequired: false, billingContact: 'claims@shield.example', idempotencyKey: `${prefix}:payer` })
  if (await db.invoice.count()) return { ...out, skipped: 'invoices exist' }
  const line = await db.workLine.findFirst({ where: { status: { in: ['planned', 'completed'] } }, orderBy: { createdAt: 'asc' }, select: { jobId: true } })
  if (!line?.jobId) return { ...out, skipped: 'no work lines' }
  const draft = await createInvoiceDraft(db, opts.biller, { jobId: line.jobId, progressReason: 'Main line cleared; camera inspection scheduled', idempotencyKey: `${prefix}:draft` })
  const row = await db.invoice.findUniqueOrThrow({ where: { id: draft.invoiceId }, select: { version: true } })
  const posted = await postInvoice(db, opts.biller, { invoiceId: draft.invoiceId, expectedVersion: row.version, idempotencyKey: `${prefix}:post` })
  await recordInvoicePayment(db, opts.biller, { invoiceId: draft.invoiceId, amountMinor: '5000', method: 'cash', idempotencyKey: `${prefix}:pay` })
  return { ...out, invoice: posted.invoiceId }
}
