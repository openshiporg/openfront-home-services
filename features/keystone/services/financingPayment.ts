import { actorUserId, type Actor } from '../lib/actor'
import { nextReference } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import { arPeriodFor, asDate, companyToday, type InvoiceRow } from './billingShared'
import { Codes, DomainError } from '../lib/errors'

/** The payment row for a partner payout, filed in that day's financing batch. The partner's fee is kept on the payment, not netted out of the invoice. */
export async function createPaymentForFunding(uow: UnitOfWork, actor: Actor, a: { invoice: InvoiceRow; gross: bigint; fee: bigint; reference: string; receivedAt: Date }) {
  const { tx } = uow
  const ref = await nextReference(tx, 'PMT', uow.now)
  const payment = await tx.payment.create({
    data: { ref, jobId: a.invoice.jobId, customerId: a.invoice.customerId, payerId: a.invoice.payerId, kind: 'payment', method: 'financing', amountMinor: a.gross, feeMinor: a.fee, reference: a.reference, receivedAt: a.receivedAt, recordedById: actorUserId(actor) },
    select: { id: true },
  })
  const day = await companyToday(tx, a.receivedAt)
  await arPeriodFor(tx, day) // no payout is filed in a closed AR month (I-M9)
  const date = asDate(day)
  let batch = await tx.paymentBatch.findFirst({ where: { businessDate: date, tenderGroup: 'financing' }, select: { id: true, status: true } })
  if (!batch) batch = await tx.paymentBatch.create({ data: { ref: await nextReference(tx, 'PBT', uow.now), businessDate: date, tenderGroup: 'financing', status: 'open' }, select: { id: true, status: true } })
  if (batch.status !== 'open') throw new DomainError(Codes.GUARD_FAILED, `The financing batch for ${day} is ${batch.status}; record the payout on a day with an open batch.`, { reason: 'batch_closed' })
  await tx.paymentBatch.update({ where: { id: batch.id }, data: { expectedMinor: { increment: a.gross - a.fee }, feesMinor: { increment: a.fee } } })
  return payment
}
