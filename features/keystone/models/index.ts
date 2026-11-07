import { User } from './User'
import { Role } from './Role'
import { OAuthApp } from './OAuthApp'
import { OAuthToken } from './OAuthToken'
import * as company from './company'
import * as platform from './platform'
import * as policy from './policy'
import * as agents from './agents'

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
} as Record<string, any>

export default models
