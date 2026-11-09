import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import redirectToInit from './redirectToInit'
import updateActiveUser from './updateActiveUser'
import { op } from './op'
import * as setup from './setup'
import * as audit from './audit'
import * as approvals from './approvals'
import * as policy from './policy'
import { phase1Resolvers, phase1TypeDefs } from './phase1'
import { phase2Resolvers, phase2TypeDefs } from './phase2'
import { agentBindingResolvers, agentBindingTypeDefs } from './agentBinding'
import '../lib/companyControls'
import '../services/salesAppliers'

const graphql = String.raw

// Every domain resolver checks permission itself and runs as one idempotent command: the state
// change, audit events and outbox messages commit in one transaction (features/keystone/lib).
export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  const core = mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      scalar JSON
      type Query {
        redirectToInit: Boolean
        verifyAuditChain: JSON
        resolvePolicy(kind: String!, state: String, county: String, city: String, zip: String, branchId: ID, on: String!): JSON
      }
      input UserUpdateProfileInput { name: String, email: String, password: String, onboardingStatus: String }
      type Mutation {
        updateActiveUser(data: UserUpdateProfileInput!): User
        loadCompanySetup(idempotencyKey: String!): JSON
        loadOperationsSetup(idempotencyKey: String!): JSON
        loadPriceBookSetup(idempotencyKey: String!): JSON
        decideApprovalRequest(requestId: ID!, decision: String!, reason: String, expectedVersion: Int!, idempotencyKey: String!): JSON
        cancelApprovalRequest(requestId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
        requestCompanyControls(changes: JSON!, reason: String!, idempotencyKey: String!): JSON
        setCompanyOnboardingStatus(status: String!, expectedVersion: Int!, idempotencyKey: String!): JSON
      }
    `,
    resolvers: {
      Query: {
        redirectToInit,
        verifyAuditChain: op(audit.verifyAuditChain),
        resolvePolicy: op(policy.resolvePolicyQuery),
      },
      Mutation: {
        updateActiveUser,
        loadCompanySetup: op(setup.loadCompanySetup),
        loadOperationsSetup: op(setup.loadOperationsSetup),
        loadPriceBookSetup: op(setup.loadPriceBookSetup),
        decideApprovalRequest: op(approvals.decideApprovalRequest),
        cancelApprovalRequest: op(approvals.cancelApprovalRequest),
        requestCompanyControls: op(approvals.requestCompanyControls),
        setCompanyOnboardingStatus: op(setup.setCompanyOnboardingStatus),
      },
    },
  })
  return mergeSchemas({ schemas: [core], typeDefs: [phase1TypeDefs, phase2TypeDefs, agentBindingTypeDefs], resolvers: [phase1Resolvers, phase2Resolvers, agentBindingResolvers] })
}
