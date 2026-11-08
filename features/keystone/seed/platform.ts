import { permissionNames } from '../access'
import { FEDERAL_HOLIDAYS, FEDERAL_SOURCE, US_FEDERAL } from '../lib/calendar'
import { auditCreate } from '../lib/cas'
import { payloadHash, toJsonValue } from '../lib/canonical'
import { parsePolicyRules } from '../domain/policySchemas'
import type { Actor } from '../lib/actor'
import type { UnitOfWork } from '../lib/unitOfWork'
import { APPROVAL_POLICIES, BRANCH, BRAND, BUSINESS_UNITS, COMPANY, COMPANY_CLOSED_HOLIDAYS, LICENSES, ROLES, SERVICE_AREAS, STAFF } from './company'
import { POLICY_PACKS } from './policyPacks'

/**
 * Loads the company spine idempotently: company settings, roles, office staff, licences, brand,
 * branch, business units, service areas, the federal and company calendars, approval policies and
 * the federal + Texas policy packs. Creates by deterministic id or natural key, so running it again
 * changes nothing and never overwrites edits made since.
 *
 * Seeded people cannot sign in until an administrator sets a password or sends a reset link. This
 * is a bcrypt hash of 32 random bytes that were discarded when it was made, so no password matches.
 */
const UNUSABLE_PASSWORD_HASH = '$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

export async function seedCompanyPlatform(uow: UnitOfWork, actor: Actor) {
  const { tx } = uow
  const created: Record<string, number> = { company: 0, roles: 0, staff: 0, licenses: 0, brands: 0, branches: 0, businessUnits: 0, serviceAreas: 0, calendars: 0, calendarExceptions: 0, approvalPolicies: 0, policyPacks: 0, policyVersions: 0, policyBindings: 0 }

  if (!(await tx.companySettings.findUnique({ where: { singletonKey: 'company' } }))) {
    const row = await tx.companySettings.create({ data: { id: 1, ...COMPANY, singletonKey: 'company', onboardingStatus: 'in_progress' } })
    auditCreate(uow, actor, 'CompanySettings', String(row.id), 'company.created', COMPANY, { metadata: { seed: true } })
    created.company = 1
  }

  const haveRoles = new Set((await tx.role.findMany({ where: { id: { in: ROLES.map(r => r.id) } }, select: { id: true } })).map(r => r.id))
  const newRoles = ROLES.filter(role => !haveRoles.has(role.id))
  if (newRoles.length) {
    await tx.role.createMany({ data: newRoles.map(role => ({ id: role.id, name: role.name, description: role.description, ...Object.fromEntries(permissionNames.map(name => [name, role.permissions.includes(name)])) })) })
    for (const role of newRoles) auditCreate(uow, actor, 'Role', role.id, 'role.created', { name: role.name, permissions: role.permissions }, { metadata: { seed: true } })
    created.roles = newRoles.length
  }

  const haveUsers = await tx.user.findMany({ where: { OR: [{ id: { in: STAFF.map(p => p.id) } }, { email: { in: STAFF.map(p => p.email) } }] }, select: { id: true, email: true } })
  const newStaff = STAFF.filter(person => !haveUsers.some(u => u.id === person.id || u.email === person.email))
  if (newStaff.length) {
    await tx.user.createMany({
      data: newStaff.map(person => ({ id: person.id, name: person.name, email: person.email, title: person.title, phone: person.phone, password: UNUSABLE_PASSWORD_HASH, kind: 'staff' as const, roleId: person.roleId, onboardingStatus: 'dismissed' })),
    })
    for (const person of newStaff) auditCreate(uow, actor, 'User', person.id, 'user.created', { name: person.name, title: person.title, role: person.roleId }, { metadata: { seed: true } })
    created.staff = newStaff.length
  }

  if (!(await tx.brand.findUnique({ where: { id: BRAND.id } }))) {
    await tx.brand.create({ data: BRAND })
    auditCreate(uow, actor, 'Brand', BRAND.id, 'brand.created', BRAND, { metadata: { seed: true } })
    created.brands = 1
  }
  const haveLicenses = new Set((await tx.contractorLicense.findMany({ where: { id: { in: LICENSES.map(l => l.id) } }, select: { id: true } })).map(r => r.id))
  for (const license of LICENSES.filter(l => !haveLicenses.has(l.id))) {
    await tx.contractorLicense.create({ data: { ...license, endorsements: [...license.endorsements], expiresOn: day('2027-08-31'), brands: { connect: [{ id: BRAND.id }] } } })
    auditCreate(uow, actor, 'ContractorLicense', license.id, 'license.created', license, { metadata: { seed: true } })
    created.licenses += 1
  }

  // Calendars: the legal federal business-day calendar, and the company's own opening hours.
  let federal = await tx.businessCalendar.findUnique({ where: { code: US_FEDERAL.code } })
  if (!federal) {
    federal = await tx.businessCalendar.create({
      data: { id: 'seed_calendar_us_federal', code: US_FEDERAL.code, name: 'US federal business days', kind: 'legal_business_days', timeZone: US_FEDERAL.timeZone, weekendDays: [...US_FEDERAL.weekendDays], regularOpen: '00:00', regularClose: '23:59', coverageThrough: day(US_FEDERAL.coverageThrough), source: FEDERAL_SOURCE },
    })
    auditCreate(uow, actor, 'BusinessCalendar', federal.id, 'calendar.created', { code: US_FEDERAL.code, coverageThrough: US_FEDERAL.coverageThrough }, { metadata: { seed: true } })
    created.calendars += 1
  }
  let shop = await tx.businessCalendar.findUnique({ where: { code: 'SUMMIT-HOURS' } })
  if (!shop) {
    shop = await tx.businessCalendar.create({
      data: { id: 'seed_calendar_summit_hours', code: 'SUMMIT-HOURS', name: 'Summit office hours', kind: 'company_hours', timeZone: 'America/Chicago', weekendDays: [0], regularOpen: '07:00', regularClose: '19:00', coverageThrough: day(US_FEDERAL.coverageThrough), source: 'Company decision: closed Sundays and six major holidays; on-call covers closed days.' },
    })
    auditCreate(uow, actor, 'BusinessCalendar', shop.id, 'calendar.created', { code: 'SUMMIT-HOURS' }, { metadata: { seed: true } })
    created.calendars += 1
  }
  const calendarDays: [string, typeof FEDERAL_HOLIDAYS, string][] = [
    [federal.id, FEDERAL_HOLIDAYS, 'Federal holiday'],
    [shop.id, FEDERAL_HOLIDAYS.filter(h => COMPANY_CLOSED_HOLIDAYS.includes(h.name)), 'Office closed'],
  ]
  for (const [calendarId, holidays, note] of calendarDays) {
    const have = new Set((await tx.calendarException.findMany({ where: { calendarId }, select: { date: true } })).map(d => d.date.toISOString().slice(0, 10)))
    const days = holidays.filter(h => !have.has(h.date))
    if (!days.length) continue
    await tx.calendarException.createMany({ data: days.map(h => ({ calendarId, date: day(h.date), kind: 'holiday', note: `${note}: ${h.name}${h.observed ? ' (observed)' : ''}` })) })
    uow.audit({ eventType: 'calendar.exceptions_loaded', entityType: 'BusinessCalendar', entityId: calendarId, actorUserId: actor.kind === 'user' ? actor.userId : null, after: { count: days.length } })
    created.calendarExceptions += days.length
  }

  if (!(await tx.branch.findUnique({ where: { id: BRANCH.id } }))) {
    await tx.branch.create({ data: { ...BRANCH, calendar: { connect: { id: shop.id } } } })
    auditCreate(uow, actor, 'Branch', BRANCH.id, 'branch.created', BRANCH, { metadata: { seed: true } })
    created.branches = 1
  }
  const haveAreas = new Set((await tx.serviceArea.findMany({ where: { id: { in: SERVICE_AREAS.map(r => r.id) } }, select: { id: true } })).map(r => r.id))
  const newAreas = SERVICE_AREAS.filter(area => !haveAreas.has(area.id))
  if (newAreas.length) {
    await tx.serviceArea.createMany({ data: newAreas.map(area => ({ id: area.id, name: area.name, kind: 'zip_list', zips: [...area.zips], travelZone: area.travelZone, branchId: BRANCH.id })) })
    for (const area of newAreas) auditCreate(uow, actor, 'ServiceArea', area.id, 'service_area.created', { name: area.name, zips: area.zips.length }, { metadata: { seed: true } })
    created.serviceAreas = newAreas.length
  }
  const haveUnits = new Set((await tx.businessUnit.findMany({ where: { id: { in: BUSINESS_UNITS.map(r => r.id) } }, select: { id: true } })).map(r => r.id))
  for (const bu of BUSINESS_UNITS.filter(u => !haveUnits.has(u.id))) {
    await tx.businessUnit.create({ data: { ...bu, brand: { connect: { id: BRAND.id } }, branch: { connect: { id: BRANCH.id } }, serviceAreas: { connect: SERVICE_AREAS.map(a => ({ id: a.id })) } } })
    auditCreate(uow, actor, 'BusinessUnit', bu.id, 'business_unit.created', bu, { metadata: { seed: true } })
    created.businessUnits += 1
  }

  const havePolicies = new Set((await tx.approvalPolicy.findMany({ select: { action: true } })).map(p => p.action))
  const newPolicies = APPROVAL_POLICIES.filter(p => !havePolicies.has(p.action))
  if (newPolicies.length) {
    const rows = await tx.approvalPolicy.createManyAndReturn({ data: newPolicies.map(policy => ({ action: policy.action, description: policy.description, requiredPermission: policy.requiredPermission, minApprovals: 1, expiresAfterMinutes: policy.expiresAfterMinutes, thresholdMinor: policy.thresholdMinor ?? null })), select: { id: true, action: true, requiredPermission: true } })
    for (const row of rows) auditCreate(uow, actor, 'ApprovalPolicy', row.id, 'approval_policy.created', { action: row.action, requiredPermission: row.requiredPermission }, { metadata: { seed: true } })
    created.approvalPolicies = rows.length
  }

  const policy = await seedPolicyPacks(uow, actor)
  created.policyPacks = policy.policyPacks
  created.policyVersions = policy.policyVersions
  created.policyBindings = policy.policyBindings

  return created
}

/**
 * Loads the federal + Texas policy packs, their versions and bindings. Idempotent by deterministic
 * id: it adds what is missing (including later versions) and never rewrites an existing row. Run on
 * every deploy (npm run policies:ensure) so a sale can never meet a missing binding.
 */
export async function seedPolicyPacks(uow: UnitOfWork, actor: Actor) {
  const { tx } = uow
  const created = { policyPacks: 0, policyVersions: 0, policyBindings: 0 }

  for (const pack of POLICY_PACKS) {
    for (const v of [pack.version, ...(pack.next ? [pack.next] : [])]) {
      const parsed = parsePolicyRules(pack.kind, v.rules)
      if (!parsed.success) throw new Error(`Seed policy ${pack.code} (${v.id}) does not match its schema: ${parsed.error.issues[0]?.message}`)
    }
  }
  const havePacks = new Set((await tx.policyPack.findMany({ where: { id: { in: POLICY_PACKS.map(p => p.id) } }, select: { id: true } })).map(r => r.id))
  const haveVersions = new Set((await tx.policyVersion.findMany({ where: { id: { in: POLICY_PACKS.flatMap(p => [p.version.id, ...(p.next ? [p.next.id] : [])]) } }, select: { id: true } })).map(r => r.id))
  const haveBindings = new Set((await tx.policyBinding.findMany({ where: { id: { in: POLICY_PACKS.map(p => p.binding.id) } }, select: { id: true } })).map(r => r.id))
  const packs = POLICY_PACKS.filter(p => !havePacks.has(p.id))
  if (packs.length) {
    await tx.policyPack.createMany({ data: packs.map(pack => ({ id: pack.id, code: pack.code, name: pack.name, kind: pack.kind, jurisdictionCode: pack.jurisdictionCode, description: pack.description })) })
    for (const pack of packs) auditCreate(uow, actor, 'PolicyPack', pack.id, 'policy_pack.created', { code: pack.code, kind: pack.kind }, { metadata: { seed: true } })
    created.policyPacks = packs.length
  }
  const versions = POLICY_PACKS.filter(p => !haveVersions.has(p.version.id)).map(pack => ({ pack, contentHash: payloadHash({ rules: pack.version.rules, sourceRefs: pack.version.sourceRefs }) }))
  if (versions.length) {
    await tx.policyVersion.createMany({
      data: versions.map(({ pack, contentHash }) => ({
        id: pack.version.id, packId: pack.id, versionNumber: 1, effectiveFrom: day(pack.version.effectiveFrom),
        rules: toJsonValue(pack.version.rules) as never, sourceRefs: toJsonValue(pack.version.sourceRefs) as never,
        verifiedBy: 'Openfront research (RESEARCH.md §12)', verifiedAt: new Date('2026-11-07T18:00:00Z'), status: 'active', contentHash,
      })),
    })
    for (const { pack, contentHash } of versions) auditCreate(uow, actor, 'PolicyVersion', pack.version.id, 'policy_version.activated', { pack: pack.code, versionNumber: 1, contentHash }, { metadata: { seed: true }, reason: 'Initial verified policy load' })
    created.policyVersions = versions.length
  }
  // Later versions: close the earlier one the day the new one starts (effectiveTo is exclusive), so
  // a sale on an earlier date is still evaluated against the rules in effect then.
  const successors = POLICY_PACKS.filter(p => p.next && !haveVersions.has(p.next.id))
  for (const pack of successors) {
    const next = pack.next!
    const contentHash = payloadHash({ rules: next.rules, sourceRefs: next.sourceRefs })
    await tx.policyVersion.update({ where: { id: pack.version.id }, data: { effectiveTo: day(next.effectiveFrom) } })
    await tx.policyVersion.create({
      data: {
        id: next.id, packId: pack.id, versionNumber: next.versionNumber, effectiveFrom: day(next.effectiveFrom),
        rules: toJsonValue(next.rules) as never, sourceRefs: toJsonValue(next.sourceRefs) as never,
        verifiedBy: 'Openfront research (RESEARCH.md §12.1a)', verifiedAt: new Date('2026-11-08T12:00:00Z'), status: 'active', contentHash,
      },
    })
    auditCreate(uow, actor, 'PolicyVersion', pack.version.id, 'policy_version.superseded', { pack: pack.code, effectiveTo: next.effectiveFrom, by: next.id }, { metadata: { seed: true }, reason: next.reason })
    auditCreate(uow, actor, 'PolicyVersion', next.id, 'policy_version.activated', { pack: pack.code, versionNumber: next.versionNumber, contentHash }, { metadata: { seed: true }, reason: next.reason })
    created.policyVersions += 1
  }
  const bindings = POLICY_PACKS.filter(p => !haveBindings.has(p.binding.id))
  if (bindings.length) {
    await tx.policyBinding.createMany({ data: bindings.map(pack => ({ id: pack.binding.id, packId: pack.id, scope: pack.binding.scope, scopeValue: pack.binding.scopeValue, priority: pack.binding.priority, status: 'active' })) })
    for (const pack of bindings) auditCreate(uow, actor, 'PolicyBinding', pack.binding.id, 'policy_binding.created', pack.binding, { metadata: { seed: true } })
    created.policyBindings = bindings.length
  }

  return created
}
