import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import { advanceTimedStates } from '../services/maintenance'
import * as memberships from '../services/memberships'
import * as billing from '../services/membershipBilling'
import * as agreements from '../services/agreements'

const graphql = String.raw

const bind = <A extends object, R>(fn: (db: Db, actor: Actor, args: A) => Promise<R>) =>
  op(async (_root: unknown, args: A, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args as A & { now?: unknown }
    const actor = await actorFor(context)
    await advanceTimedStates(context.prisma)
    return fn(context.prisma, actor, clean as A)
  })

/* Memberships, entitlements, billing runs, renewal notices and service agreements (Phase 4). Every mutation takes an idempotency key. */
export const phase4TypeDefs = graphql`
  type Mutation {
    openMembershipPlan(name: String!, code: String!, description: String, draft: JSON, idempotencyKey: String!): JSON
    saveMembershipPlanDraft(planId: ID!, draft: JSON!, idempotencyKey: String!): JSON
    activateMembershipPlanVersion(versionId: ID!, idempotencyKey: String!): JSON
    retireMembershipPlan(planId: ID!, reason: String, idempotencyKey: String!): JSON

    sellMembership(customerId: ID!, locationId: ID!, planId: ID!, startsOn: String, channel: String, paymentMethodRef: String, paymentMethodLabel: String, autoRenew: Boolean, consent: JSON, idempotencyKey: String!): JSON
    updateMembershipPaymentMethod(membershipId: ID!, paymentMethodRef: String!, paymentMethodLabel: String!, idempotencyKey: String!): JSON
    renewMembership(membershipId: ID!, idempotencyKey: String!): JSON
    cancelMembership(membershipId: ID!, reason: String!, idempotencyKey: String!): JSON
    transferMembership(membershipId: ID!, newCustomerId: ID!, newLocationId: ID, idempotencyKey: String!): JSON
    bookMembershipVisit(eventId: ID!, jobRef: String!, idempotencyKey: String!): JSON
    releaseMembershipVisit(eventId: ID!, reason: String!, idempotencyKey: String!): JSON

    runMembershipBilling(period: String!, idempotencyKey: String!): JSON
    retryMembershipCharge(attemptId: ID!, idempotencyKey: String!): JSON
    recordRenewalNotice(membershipId: ID!, status: String!, idempotencyKey: String!): JSON

    saveServiceAgreement(agreementId: ID, name: String!, customerId: ID!, locationId: ID!, payerId: ID, startsOn: String!, endsOn: String!, scope: String!, visitMonths: JSON!, poNumber: String, nteMinor: String, idempotencyKey: String!): JSON
    activateServiceAgreement(agreementId: ID!, idempotencyKey: String!): JSON
    endServiceAgreement(agreementId: ID!, reason: String!, idempotencyKey: String!): JSON
    setDocumentExpiry(documentId: ID!, expiresOn: String, reason: String!, idempotencyKey: String!): JSON
  }
`

export const phase4Resolvers = {
  Mutation: {
    openMembershipPlan: bind(memberships.createPlan),
    saveMembershipPlanDraft: bind(memberships.saveDraftVersion),
    activateMembershipPlanVersion: bind(memberships.activatePlanVersion),
    retireMembershipPlan: bind(memberships.retirePlan),
    sellMembership: bind(memberships.sellMembership),
    updateMembershipPaymentMethod: bind(memberships.updatePaymentMethod),
    renewMembership: bind(memberships.renewMembership),
    cancelMembership: bind(memberships.cancelMembership),
    transferMembership: bind(memberships.transferMembership),
    bookMembershipVisit: bind(memberships.bookVisit),
    releaseMembershipVisit: bind(memberships.releaseVisit),
    runMembershipBilling: bind((db: Db, actor: Actor, a: { period: string; idempotencyKey: string }) => billing.runMembershipBilling(db, actor, a)),
    retryMembershipCharge: bind((db: Db, actor: Actor, a: { attemptId: string; idempotencyKey: string }) => billing.retryAttempt(db, actor, a)),
    recordRenewalNotice: bind(agreements.recordRenewalNotice),
    saveServiceAgreement: bind(agreements.saveAgreement),
    activateServiceAgreement: bind(agreements.activateAgreement),
    endServiceAgreement: bind(agreements.endAgreement),
    setDocumentExpiry: bind(agreements.setDocumentExpiry),
  },
}
