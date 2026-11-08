import { APPROVAL_POLICIES, BRANCH, BUSINESS_UNITS, COMPANY, LICENSES, ROLES, SERVICE_AREAS, STAFF } from '@/features/keystone/seed/company'
import { POLICY_PACKS } from '@/features/keystone/seed/policyPacks'
import { CATALOG, UNITS } from '@/features/keystone/seed/pricebookData'
import { CAMPAIGNS, COMMERCIAL, HOUSEHOLDS, JOB_TYPES, TECHS, WINDOW_TEMPLATES } from '@/features/keystone/seed/operationsData'

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
  {
    id: 'operations',
    title: 'Technicians, job types and customers',
    mutation: 'mutation LoadOperations($idempotencyKey: String!) { loadOperationsSetup(idempotencyKey: $idempotencyKey) }',
    field: 'loadOperationsSetup',
    items: [
      ...TECHS.map(t => `${t.first} ${t.last} · ${t.title}`),
      'Rachel Kim · Comfort Advisor (sales visits)',
      `${JOB_TYPES.length} job types with Texas licensing requirements, AI keywords and emergency scripts`,
      `${WINDOW_TEMPLATES.length} arrival-window templates (2-hour service windows, half-day installs, half-capacity Saturdays)`,
      'Weekly shifts and four weeks of on-call for HVAC, plumbing and electrical',
      `${CAMPAIGNS.length} marketing campaigns with tracking numbers`,
      `${HOUSEHOLDS.length} households across Austin, Round Rock, Pflugerville and Cedar Park, plus ${COMMERCIAL.displayName}`,
      'The next 21 days of arrival windows and shifts',
    ],
  },
  {
    id: 'pricebook',
    title: 'Price book',
    mutation: 'mutation LoadPriceBook($idempotencyKey: String!) { loadPriceBookSetup(idempotencyKey: $idempotencyKey) }',
    field: 'loadPriceBookSetup',
    items: [
      `${CATALOG.length} flat-rate items: ${CATALOG.filter(i => i.kind === 'service_task').length} tasks, ${CATALOG.filter(i => i.kind === 'material').length} materials, ${CATALOG.filter(i => i.kind === 'equipment').length} systems and ${CATALOG.filter(i => i.kind === 'fee').length} fees`,
      'Good, better and best ladders: 3-ton AC and furnace, 3-ton heat pump, water heater (tank or tankless), 200 A panel, sewer line, whole-home repipe',
      'Labour rates per department with a 1.5× after-hours multiplier; tiered markup on materials and equipment',
      `${UNITS.length} units of measure`,
      'Submitted for approval: a second person publishes it under Approvals',
    ],
  },
] as const
