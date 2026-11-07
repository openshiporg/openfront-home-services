import { APPROVAL_POLICIES, BRANCH, BUSINESS_UNITS, COMPANY, LICENSES, ROLES, SERVICE_AREAS, STAFF } from '@/features/keystone/seed/company'
import { POLICY_PACKS } from '@/features/keystone/seed/policyPacks'

/**
 * What "Load Summit Plumbing & Air" creates, section by section. Each section is one idempotent
 * server command; later phases add the price book, memberships, equipment and pay plans here.
 */
export const SETUP_SECTIONS = [
  {
    id: 'company',
    title: 'Company, people and controls',
    mutation: 'mutation LoadCompany($idempotencyKey: String!) { loadCompanySetup(idempotencyKey: $idempotencyKey) }',
    field: 'loadCompanySetup',
    items: [
      `${COMPANY.legalName} · ${BRANCH.name}`,
      `${LICENSES.length} Texas trade licences`,
      `${BUSINESS_UNITS.length} business units across HVAC, plumbing and electrical`,
      `${SERVICE_AREAS.length} service areas by ZIP`,
      `${ROLES.length} roles with separated duties`,
      ...STAFF.map((person: { name: string; title: string }) => `${person.name} · ${person.title}`),
      'Federal business-day calendar and office hours 2026-2028',
      `${APPROVAL_POLICIES.length} maker-checker approval policies`,
      `${POLICY_PACKS.length} federal and Texas policy packs (cancellation rights, contact hours, tax, licensing, liens)`,
    ],
  },
] as const
