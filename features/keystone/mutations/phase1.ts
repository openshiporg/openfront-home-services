import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import * as booking from '../services/booking'
import * as dispatch from '../services/dispatch'
import * as comms from '../services/comms'
import * as crm from '../services/crm'

const graphql = String.raw

/** GraphQL → service: the session decides the actor; the client never supplies `now`. */
const bind = <A extends object, R>(fn: (db: Db, actor: Actor, args: A) => Promise<R>) =>
  op(async (_root: unknown, args: A, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args as A & { now?: unknown }
    return fn(context.prisma, await actorFor(context), clean as A)
  })

export const phase1TypeDefs = graphql`
  type Query {
    availableWindows(jobTypeId: ID!, postalCode: String!, from: String!, days: Int): JSON
    lookupCustomer(phone: String, email: String, name: String, postalCode: String): JSON
    customerHistory(customerId: ID!, limit: Int): JSON
    matchJobType(description: String!, postalCode: String): JSON
    checkEligibility(visitId: ID!, employeeIds: [ID!]!): JSON
  }
  type Mutation {
    materializeWindows(from: String!, days: Int!, businessUnitIds: [ID!], idempotencyKey: String!): JSON
    holdWindow(windowId: ID!, jobTypeId: ID!, source: String!, minutes: Int, customerDraft: JSON, idempotencyKey: String!): JSON
    releaseHold(holdId: ID!, idempotencyKey: String!): JSON
    bookJob(holdId: ID, windowId: ID, jobTypeId: ID!, customerId: ID, locationId: ID, customer: JSON, location: JSON, summary: String, source: String, leadId: ID, smsConsent: Boolean, idempotencyKey: String!): JSON
    addCustomer(customer: JSON!, location: JSON, smsConsent: Boolean, idempotencyKey: String!): JSON
    addServiceLocation(customerId: ID!, location: JSON!, idempotencyKey: String!): JSON
    addContactPoint(contactId: ID!, kind: String!, value: String!, isPrimary: Boolean, idempotencyKey: String!): JSON
    storeAccessSecret(locationId: ID!, kind: String!, label: String, secret: String!, idempotencyKey: String!): JSON
    revealAccessSecret(accessSecretId: ID!, visitId: ID!, reason: String): JSON
    ingestLead(source: String!, externalId: String, campaignId: ID, contactName: String, phone: String, email: String, summary: String, requestedJobTypeId: ID, postalCode: String, idempotencyKey: String!): JSON
    markLeadContacted(leadId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    qualifyLead(leadId: ID!, expectedVersion: Int!, requestedJobTypeId: ID!, locationId: ID, postalCode: String, idempotencyKey: String!): JSON
    loseLead(leadId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    markLeadSpam(leadId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    mergeLead(leadId: ID!, expectedVersion: Int!, intoLeadId: ID!, idempotencyKey: String!): JSON
    recommendDispatch(visitId: ID!, idempotencyKey: String!): JSON
    assignVisit(visitId: ID!, expectedVersion: Int!, employeeIds: [ID!]!, leadEmployeeId: ID, recommendationId: ID, overrideReason: String, idempotencyKey: String!): JSON
    unassignVisit(visitId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    setVisitStatus(visitId: ID!, to: String!, expectedVersion: Int, reason: String, clientRecordedAt: String, deviceEventKey: String, lat: String, lng: String, idempotencyKey: String!): JSON
    holdJob(jobId: ID!, expectedVersion: Int!, reason: String!, followUpOn: String!, idempotencyKey: String!): JSON
    releaseJobHold(jobId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    cancelJob(jobId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    recordConsent(contactPointId: ID, customerId: ID, phone: String, purpose: String!, action: String!, channel: String!, evidence: JSON, wordingVersion: String, idempotencyKey: String!): JSON
    requeueMessage(messageId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    markMessageSent(messageId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    handoffToHuman(callId: ID!, reason: String!, summary: String, idempotencyKey: String!): JSON
    pageOnCall(callId: ID, businessUnitId: ID, summary: String!, idempotencyKey: String!): JSON
    verifyCredential(credentialId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    revokeCredential(credentialId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
  }
`

export const phase1Resolvers = {
  Query: {
    availableWindows: bind(booking.availableWindows),
    lookupCustomer: bind(crm.lookupCustomer),
    customerHistory: bind(crm.customerHistory),
    matchJobType: bind(crm.matchJobType),
    checkEligibility: bind(dispatch.checkEligibility),
  },
  Mutation: {
    materializeWindows: bind(booking.materializeWindows),
    holdWindow: bind(booking.holdWindow),
    releaseHold: bind(booking.releaseHold),
    bookJob: bind(booking.bookJob),
    addCustomer: bind(crm.createCustomer),
    addServiceLocation: bind(crm.addLocation),
    addContactPoint: bind(crm.addContactPoint),
    storeAccessSecret: bind(crm.storeAccessSecret),
    revealAccessSecret: bind(crm.revealAccessSecret),
    ingestLead: bind(crm.ingestLead),
    markLeadContacted: bind(crm.markLeadContacted),
    qualifyLead: bind(crm.qualifyLead),
    loseLead: bind(crm.loseLead),
    markLeadSpam: bind(crm.markLeadSpam),
    mergeLead: bind(crm.mergeLead),
    recommendDispatch: bind(dispatch.recommendDispatch),
    assignVisit: bind(dispatch.assignVisit),
    unassignVisit: bind(dispatch.unassignVisit),
    setVisitStatus: bind(dispatch.setVisitStatus),
    holdJob: bind(dispatch.holdJob),
    releaseJobHold: bind(dispatch.releaseJobHold),
    cancelJob: bind(dispatch.cancelJob),
    recordConsent: bind(comms.recordConsent),
    requeueMessage: bind(comms.requeueMessage),
    markMessageSent: bind(comms.markMessageSent),
    handoffToHuman: bind(crm.handoffToHuman),
    pageOnCall: bind(crm.pageOnCall),
    verifyCredential: bind(crm.verifyCredential),
    revokeCredential: bind(crm.revokeCredential),
  },
}
