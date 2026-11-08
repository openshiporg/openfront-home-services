import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import * as pricebook from '../services/pricebook'
import * as estimates from '../services/estimates'
import * as cancellation from '../services/cancellation'

const graphql = String.raw

/** GraphQL → service: the session decides the actor; the client never supplies `now`. */
const bind = <A extends object, R>(fn: (db: Db, actor: Actor, args: A) => Promise<R>) =>
  op(async (_root: unknown, args: A, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args as A & { now?: unknown }
    return fn(context.prisma, await actorFor(context), clean as A)
  })

/*
 * Price book, estimates and cancellation rights (Phase 2). Structured inputs (items, options,
 * authorizations) are JSON validated by the services; every mutation takes an idempotency key.
 */
export const phase2TypeDefs = graphql`
  type Query {
    searchPriceBook(query: String, businessUnitId: ID, kind: String, limit: Int): JSON
    quotePriceBook(lines: JSON!, businessUnitId: ID, memberPricing: Boolean, discountBps: Int): JSON
    priceBookVersionReview(versionId: ID!): JSON
    estimateSummary(estimateId: ID!): JSON
  }
  type Mutation {
    openPriceBook(name: String!, code: String!, businessUnitIds: [ID!], idempotencyKey: String!): JSON
    startPriceBookDraft(priceBookId: ID!, label: String, idempotencyKey: String!): JSON
    saveDraftItems(versionId: ID!, items: JSON!, expectedVersion: Int, idempotencyKey: String!): JSON
    removeDraftItems(versionId: ID!, itemKeys: [String!]!, expectedVersion: Int, idempotencyKey: String!): JSON
    saveDraftSettings(versionId: ID!, categories: JSON, laborRates: JSON, markupTables: JSON, memberPricingRules: JSON, expectedVersion: Int, idempotencyKey: String!): JSON
    submitPriceBookVersion(versionId: ID!, effectiveAt: String, expectedVersion: Int!, note: String, idempotencyKey: String!): JSON
    reopenPriceBookDraft(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    discardPriceBookVersion(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    importSupplierCosts(priceBookId: ID!, supplier: String!, costs: JSON!, idempotencyKey: String!): JSON

    openEstimate(jobId: ID, opportunityId: ID, customerId: ID, locationId: ID, businessUnitId: ID, title: String!, options: JSON, idempotencyKey: String!): JSON
    draftEstimate(jobId: ID, opportunityId: ID, customerId: ID, locationId: ID, businessUnitId: ID, title: String!, options: JSON!, idempotencyKey: String!): JSON
    draftEstimateFromCapture(visitId: ID!, title: String!, options: JSON!, idempotencyKey: String!): JSON
    draftFollowupEstimate(versionId: ID!, idempotencyKey: String!): JSON
    saveEstimateOption(versionId: ID!, optionId: ID, tier: String!, name: String!, description: String, memberPricing: Boolean, lines: JSON!, expectedVersion: Int, idempotencyKey: String!): JSON
    removeEstimateOption(versionId: ID!, optionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    repriceEstimateVersion(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    setEstimateDiscount(versionId: ID!, discountBps: Int!, reason: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    reopenEstimateVersion(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    presentEstimate(versionId: ID!, via: String, notes: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    sellEstimate(versionId: ID!, optionId: ID!, expectedVersion: Int!, authorization: JSON!, saleLocation: String!, initiatedBy: String!, depositMinor: String, emergencyWaiver: JSON, acrContext: [String!], exclusions: [String!], idempotencyKey: String!): JSON
    declineEstimate(versionId: ID!, reason: String!, note: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    requoteEstimate(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    discardEstimateVersion(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    draftChangeOrder(jobId: ID!, reason: String!, add: JSON, removeWorkLineIds: [ID!], idempotencyKey: String!): JSON
    presentChangeOrder(changeOrderId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    acceptChangeOrder(changeOrderId: ID!, expectedVersion: Int!, authorization: JSON!, saleLocation: String!, initiatedBy: String!, emergencyWaiver: JSON, acrContext: [String!], idempotencyKey: String!): JSON
    declineChangeOrder(changeOrderId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON

    deliverCancellationNotice(noticeId: ID!, method: String!, acknowledgedBy: String!, signature: JSON, messageId: ID, expectedVersion: Int!, idempotencyKey: String!): JSON
    waiveCancellationNotice(noticeId: ID!, waiver: JSON!, expectedVersion: Int!, idempotencyKey: String!): JSON
    recordBuyerCancellation(noticeId: ID!, via: String!, sentAt: String!, amountPaidMinor: String, note: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    markCancellationRefunded(noticeId: ID!, evidence: JSON!, expectedVersion: Int!, idempotencyKey: String!): JSON
    requestCancellationHoldOverride(noticeId: ID!, reason: String!, expectedVersion: Int!, idempotencyKey: String!): JSON
  }
`

export const phase2Resolvers = {
  Query: {
    searchPriceBook: bind(pricebook.searchPriceBook),
    quotePriceBook: bind(pricebook.quotePriceBook),
    priceBookVersionReview: bind(pricebook.priceBookVersionReview),
    estimateSummary: bind(estimates.estimateSummary),
  },
  Mutation: {
    openPriceBook: bind(pricebook.createPriceBook),
    startPriceBookDraft: bind(pricebook.startPriceBookDraft),
    saveDraftItems: bind(pricebook.saveDraftItems),
    removeDraftItems: bind(pricebook.removeDraftItems),
    saveDraftSettings: bind(pricebook.saveDraftSettings),
    submitPriceBookVersion: bind(pricebook.submitPriceBookVersion),
    reopenPriceBookDraft: bind(pricebook.reopenPriceBookDraft),
    discardPriceBookVersion: bind(pricebook.discardPriceBookVersion),
    importSupplierCosts: bind(pricebook.importSupplierCosts),

    openEstimate: bind(estimates.createEstimate),
    draftEstimate: bind(estimates.draftEstimate),
    draftEstimateFromCapture: bind(estimates.draftEstimate),
    draftFollowupEstimate: bind(estimates.draftFollowupEstimate),
    saveEstimateOption: bind(estimates.saveEstimateOption),
    removeEstimateOption: bind(estimates.removeEstimateOption),
    repriceEstimateVersion: bind(estimates.repriceEstimateVersion),
    setEstimateDiscount: bind(estimates.setEstimateDiscount),
    reopenEstimateVersion: bind(estimates.reopenEstimateVersion),
    presentEstimate: bind(estimates.presentEstimate),
    sellEstimate: bind(estimates.sellEstimate),
    declineEstimate: bind(estimates.declineEstimate),
    requoteEstimate: bind(estimates.requoteEstimate),
    discardEstimateVersion: bind(estimates.discardEstimateVersion),
    draftChangeOrder: bind(estimates.draftChangeOrder),
    presentChangeOrder: bind(estimates.presentChangeOrder),
    acceptChangeOrder: bind(estimates.acceptChangeOrder),
    declineChangeOrder: bind(estimates.declineChangeOrder),

    deliverCancellationNotice: bind(cancellation.deliverCancellationNotice),
    waiveCancellationNotice: bind(cancellation.waiveCancellationNotice),
    recordBuyerCancellation: bind(cancellation.recordBuyerCancellation),
    markCancellationRefunded: bind(cancellation.markCancellationRefunded),
    requestCancellationHoldOverride: bind(cancellation.requestCancellationHoldOverride),
  },
}
