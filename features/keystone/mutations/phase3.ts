import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import { advanceTimedStates } from '../services/maintenance'
import * as invoices from '../services/invoices'
import * as payments from '../services/payments'
import * as financing from '../services/financing'
import * as accounting from '../services/accounting'

const graphql = String.raw

const bind = <A extends object, R>(fn: (db: Db, actor: Actor, args: A) => Promise<R>) =>
  op(async (_root: unknown, args: A, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args as A & { now?: unknown }
    const actor = await actorFor(context)
    await advanceTimedStates(context.prisma)
    return fn(context.prisma, actor, clean as A)
  })

/* Invoices, payments, financing records, AR close and the accounting export (Phase 3). Every mutation takes an idempotency key. */
export const phase3TypeDefs = graphql`
  type Mutation {
    createInvoiceDraft(jobId: ID!, workLineIds: [ID!], items: JSON, payerId: ID, authorizationId: ID, poNumber: String, progressReason: String, discountMinor: String, idempotencyKey: String!): JSON
    discardInvoiceDraft(invoiceId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    postInvoice(invoiceId: ID!, expectedVersion: Int!, invoiceDate: String, idempotencyKey: String!): JSON
    voidInvoice(invoiceId: ID!, reason: String!, idempotencyKey: String!): JSON
    issueCreditMemo(invoiceId: ID!, amountMinor: String!, reason: String!, note: String!, appliesTo: String, idempotencyKey: String!): JSON
    requestWriteOff(invoiceId: ID!, reason: String!, idempotencyKey: String!): JSON
    setCollectionsStatus(invoiceId: ID!, status: String!, idempotencyKey: String!): JSON

    recordInvoicePayment(invoiceId: ID!, amountMinor: String!, method: String!, reference: String, checkNumber: String, feeMinor: String, receivedAt: String, attemptId: ID, idempotencyKey: String!): JSON
    applyCustomerCredit(invoiceId: ID!, amountMinor: String!, idempotencyKey: String!): JSON
    startPaymentAttempt(invoiceId: ID!, amountMinor: String!, method: String!, idempotencyKey: String!): JSON
    markAttemptUnknown(attemptId: ID!, expectedVersion: Int!, note: String, idempotencyKey: String!): JSON
    resolveAttemptFailed(attemptId: ID!, expectedVersion: Int!, evidence: String!, idempotencyKey: String!): JSON
    requestRefund(paymentId: ID!, amountMinor: String!, method: String!, reason: String!, reference: String!, idempotencyKey: String!): JSON
    recordApprovedRefund(approvalRequestId: ID!, idempotencyKey: String!): JSON
    settleRefundedMembershipInvoice(invoiceId: ID!, idempotencyKey: String!): JSON
    closePaymentBatch(batchId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    reconcilePaymentBatch(batchId: ID!, expectedVersion: Int!, depositedMinor: String!, depositReference: String!, idempotencyKey: String!): JSON

    saveFinancingProgram(programId: ID, name: String!, partner: String, minMinor: String!, maxMinor: String!, termsNote: String, applyUrl: String, active: Boolean, idempotencyKey: String!): JSON
    startFinancing(customerId: ID!, programId: ID!, amountMinor: String!, jobId: ID, invoiceId: ID, estimateVersionId: ID, consent: Boolean!, idempotencyKey: String!): JSON
    recordFinancingStatus(applicationId: ID!, to: String!, expectedVersion: Int!, partnerReference: String, offers: JSON, selectedOffer: JSON, offerExpiresAt: String, note: String, idempotencyKey: String!): JSON
    recordFinancingFunding(applicationId: ID!, expectedVersion: Int!, grossMinor: String!, feeMinor: String, reference: String!, fundedAt: String, idempotencyKey: String!): JSON
    savePayerProfile(payerId: ID, name: String!, kind: String!, terms: String!, poRequired: Boolean, billingContact: String, accountingCustomerRef: String, idempotencyKey: String!): JSON
    recordThirdPartyAuthorization(jobId: ID!, payerId: ID!, kind: String!, externalRef: String!, authorizedAmountMinor: String!, serviceFeeMinor: String, idempotencyKey: String!): JSON

    requestArPeriodClose(periodId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    reopenArPeriod(periodId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    createExportBatch(from: String!, to: String!, idempotencyKey: String!): JSON
  }
`

export const phase3Resolvers = {
  Mutation: {
    createInvoiceDraft: bind(invoices.createInvoiceDraft),
    discardInvoiceDraft: bind(invoices.discardInvoiceDraft),
    postInvoice: bind(invoices.postInvoice),
    voidInvoice: bind(invoices.voidInvoice),
    issueCreditMemo: bind(invoices.issueCreditMemo),
    requestWriteOff: bind(invoices.requestWriteOff),
    setCollectionsStatus: bind(invoices.setCollectionsStatus),
    recordInvoicePayment: bind(payments.recordInvoicePayment),
    applyCustomerCredit: bind(payments.applyCustomerCredit),
    startPaymentAttempt: bind(payments.startPaymentAttempt),
    markAttemptUnknown: bind(payments.markAttemptUnknown),
    resolveAttemptFailed: bind(payments.resolveAttemptFailed),
    requestRefund: bind(payments.requestRefund),
    recordApprovedRefund: bind(payments.recordApprovedRefund),
    settleRefundedMembershipInvoice: bind(payments.settleRefundedMembershipInvoice),
    closePaymentBatch: bind(payments.closePaymentBatch),
    reconcilePaymentBatch: bind(payments.reconcilePaymentBatch),
    saveFinancingProgram: bind(financing.saveFinancingProgram),
    startFinancing: bind(financing.startFinancing),
    recordFinancingStatus: bind(financing.recordFinancingStatus),
    recordFinancingFunding: bind(financing.recordFinancingFunding),
    savePayerProfile: bind(financing.savePayerProfile),
    recordThirdPartyAuthorization: bind(financing.recordThirdPartyAuthorization),
    requestArPeriodClose: bind(financing.requestArPeriodClose),
    reopenArPeriod: bind(financing.reopenArPeriod),
    createExportBatch: bind(accounting.createExportBatch),
  },
}
