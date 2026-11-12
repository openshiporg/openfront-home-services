import { User } from './User'
import { Role } from './Role'
import { OAuthApp } from './OAuthApp'
import { OAuthToken } from './OAuthToken'
import * as company from './company'
import * as platform from './platform'
import * as policy from './policy'
import * as agents from './agents'
import * as people from './people'
import * as crm from './crm'
import * as demand from './demand'
import * as booking from './booking'
import * as jobs from './jobs'
import * as sales from './sales'
import * as billing from './billing'
import * as memberships from './memberships'

const listsOf = (module: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(module).filter(([name, value]) => /^[A-Z]/.test(name) && typeof value === 'object' && value !== null && 'fields' in (value as object)))

export const models = {
  User,
  Role,
  OAuthApp,
  OAuthToken,
  ...listsOf(company),
  ...listsOf(platform),
  ...listsOf(policy),
  ...listsOf(agents),
  ...listsOf(people),
  ...listsOf(crm),
  ...listsOf(demand),
  ...listsOf(booking),
  ...listsOf(jobs),
  ...listsOf(sales),
  ...listsOf(billing),
  ...listsOf(memberships),
} as Record<string, any>

export default models
