import { auditCreate } from '../lib/cas'
import type { Actor } from '../lib/actor'
import type { UnitOfWork } from '../lib/unitOfWork'
import { contactHash } from '../domain/contact'
import { ZIP_CENTROIDS } from '../../integrations/maps'
import { BRANCH } from './company'
import { CAMPAIGNS, COMMERCIAL, HOUSEHOLDS, JOB_TYPES, REQUIREMENTS, SKILLS, TECHS, WINDOW_TEMPLATES, jitter } from './operationsData'

export { CAMPAIGNS, COMMERCIAL, HOUSEHOLDS, JOB_TYPES, REQUIREMENTS, SKILLS, TECHS, WINDOW_TEMPLATES }

/**
 * Summit's field operation (BUILD-PLAN §5, Phase 1): technicians and their Texas licences, skills,
 * job types with licensing requirements and the AI receptionist's keywords and emergency scripts,
 * arrival-window templates, shifts, on-call, campaigns and tracking numbers, and fictional
 * households across Austin, Round Rock, Pflugerville and Cedar Park. Every name, number and address
 * is fictional (phones 512-555-01xx, emails @summitplumbingair.com). Ids are deterministic; loading twice adds nothing.
 */

const UNUSABLE_PASSWORD_HASH = '$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya'
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

export async function seedOperations(uow: UnitOfWork, actor: Actor) {
  const { tx, now } = uow
  const created: Record<string, number> = { skills: 0, technicians: 0, credentials: 0, requirements: 0, jobTypes: 0, windowTemplates: 0, shiftTemplates: 0, onCall: 0, campaigns: 0, customers: 0, locations: 0, consents: 0 }
  const meta = { metadata: { seed: true } }

  // Skills.
  const haveSkills = new Set((await tx.skill.findMany({ select: { code: true } })).map(s => s.code))
  const newSkills = SKILLS.filter(([code]) => !haveSkills.has(code))
  if (newSkills.length) {
    await tx.skill.createMany({ data: newSkills.map(([code, name, trade]) => ({ id: `seed_skill_${code}`, code, name, trade })) })
    created.skills = newSkills.length
  }
  const skillId = (code: string) => `seed_skill_${code}`

  // Technicians: a user (technician role, unusable password) + an employee record each.
  const techIds = TECHS.map(t => `seed_emp_${t.key}`)
  const haveEmployees = new Set((await tx.employee.findMany({ where: { id: { in: [...techIds, 'seed_emp_kim'] } }, select: { id: true } })).map(e => e.id))
  const newTechs = TECHS.filter(t => !haveEmployees.has(`seed_emp_${t.key}`))
  if (newTechs.length) {
    const emails = newTechs.map(t => `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase())
    const existingUsers = new Set((await tx.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map(u => u.email))
    await tx.user.createMany({ data: newTechs.filter(t => !existingUsers.has(`${t.first}.${t.last}@summitplumbingair.com`.toLowerCase())).map(t => ({ id: `seed_user_${t.key}`, name: `${t.first} ${t.last}`, email: `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase(), title: t.title, phone: t.phone, password: UNUSABLE_PASSWORD_HASH, kind: 'staff' as const, roleId: 'seed_role_technician', onboardingStatus: 'dismissed' })) })
    for (const [i, t] of newTechs.entries()) {
      const [lat, lng] = ZIP_CENTROIDS[t.zip]
      await tx.employee.create({
        data: {
          id: `seed_emp_${t.key}`, userId: `seed_user_${t.key}`, firstName: t.first, lastName: t.last, displayName: `${t.first} ${t.last}`, employeeNumber: `E-${String(1101 + TECHS.indexOf(t))}`,
          homeBranchId: BRANCH.id, kind: t.kind, employmentType: 'w2_hourly', hireDate: day(`20${String(14 + (i % 10)).padStart(2, '0')}-0${1 + (i % 9)}-15`), phoneE164: t.phone, email: `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase(),
          lat: jitter(lat, i, 3), lng: jitter(lng, i, 4), dispatchable: true, status: 'active',
          businessUnits: { connect: t.units.map(id => ({ id })) }, skills: { connect: t.skills.map(code => ({ id: skillId(code) })) },
        },
      })
      auditCreate(uow, actor, 'Employee', `seed_emp_${t.key}`, 'employee.created', { name: `${t.first} ${t.last}`, kind: t.kind, units: t.units }, meta)
    }
    const credentials = newTechs.flatMap(t => t.credentials.map((c, j) => ({
      id: `seed_cred_${t.key}_${j}`, employeeId: `seed_emp_${t.key}`, kind: c.kind, trade: c.trade, jurisdictionCode: c.kind === 'epa_608' ? 'US' : 'US-TX', issuer: c.issuer, number: c.number,
      licenseClass: c.licenseClass ?? '', epaType: c.epaType ?? 'none', issuedOn: day('2022-01-15'), expiresOn: c.expiresOn ? day(c.expiresOn) : null,
      status: c.status ?? 'verified', verifiedById: (c.status ?? 'verified') === 'verified' ? 'seed_user_ortega' : null, verifiedAt: (c.status ?? 'verified') === 'verified' ? new Date('2026-10-01T15:00:00Z') : null,
    })))
    await tx.credential.createMany({ data: credentials })
    for (const c of credentials) auditCreate(uow, actor, 'Credential', c.id, c.status === 'verified' ? 'credential.verified' : 'credential.created', { employeeId: c.employeeId, kind: c.kind, licenseClass: c.licenseClass, epaType: c.epaType, expiresOn: c.expiresOn }, meta)
    created.technicians = newTechs.length
    created.credentials = credentials.length

    // Weekly shifts: Mon–Fri 7:30–5; half of them also work Saturday mornings.
    const shiftTemplates = newTechs.flatMap(t => [1, 2, 3, 4, 5].map(weekday => ({ employeeId: `seed_emp_${t.key}`, weekday, startLocal: '07:30', endLocal: '17:00' })).concat(t.saturday ? [{ employeeId: `seed_emp_${t.key}`, weekday: 6, startLocal: '08:00', endLocal: '14:00' }] : []))
    await tx.shiftTemplate.createMany({ data: shiftTemplates, skipDuplicates: true })
    created.shiftTemplates = shiftTemplates.length
  }
  if (!haveEmployees.has('seed_emp_kim')) {
    await tx.employee.create({ data: { id: 'seed_emp_kim', userId: 'seed_user_kim', firstName: 'Rachel', lastName: 'Kim', displayName: 'Rachel Kim', employeeNumber: 'E-1201', homeBranchId: BRANCH.id, kind: 'sales', employmentType: 'w2_salaried_nonexempt', phoneE164: '+15125550109', email: 'rachel.kim@summitplumbingair.com', lat: '30.351600', lng: '-97.731700', dispatchable: true, status: 'active', businessUnits: { connect: [{ id: 'seed_bu_hvac_install' }] } } })
    await tx.shiftTemplate.createMany({ data: [1, 2, 3, 4, 5].map(weekday => ({ employeeId: 'seed_emp_kim', weekday, startLocal: '08:00', endLocal: '17:00' })), skipDuplicates: true })
    auditCreate(uow, actor, 'Employee', 'seed_emp_kim', 'employee.created', { name: 'Rachel Kim', kind: 'sales' }, meta)
    created.technicians += 1
  }

  // Requirements and job types.
  const haveReqs = new Set((await tx.jobTypeRequirement.findMany({ where: { id: { in: REQUIREMENTS.map(r => r.id) } }, select: { id: true } })).map(r => r.id))
  for (const r of REQUIREMENTS.filter(r => !haveReqs.has(r.id))) {
    await tx.jobTypeRequirement.create({ data: { id: r.id, name: r.name, licensingTags: [...r.licensingTags], requiredCredentialKinds: [], requiresSupervisorOnJob: false, skills: { connect: r.skills.map(code => ({ id: skillId(code) })) } } })
    created.requirements += 1
  }
  if (!(await tx.checklistTemplate.findUnique({ where: { id: 'seed_checklist_ac' } }))) {
    await tx.checklistTemplate.create({ data: { id: 'seed_checklist_ac', name: 'Cooling system check', required: true, items: [{ key: 'thermostat', label: 'Thermostat set and responding' }, { key: 'filter', label: 'Filter condition' }, { key: 'pressures', label: 'Suction and liquid pressures recorded' }, { key: 'delta_t', label: 'Supply/return temperature split' }, { key: 'condensate', label: 'Condensate drain clear' }] } })
  }
  const haveTypes = new Set((await tx.jobType.findMany({ where: { id: { in: JOB_TYPES.map(j => j.id) } }, select: { id: true } })).map(j => j.id))
  const newTypes = JOB_TYPES.filter(j => !haveTypes.has(j.id))
  if (newTypes.length) {
    await tx.jobType.createMany({
      data: newTypes.map(j => ({
        id: j.id, code: j.code, name: j.name, businessUnitId: j.bu, trade: j.trade, priority: j.priority, defaultDurationMinutes: j.minutes, capacityHours: j.hours, crewSize: 1, requirementsId: j.req,
        keywords: [...j.keywords], bookableOnline: j.ai, bookableByAi: j.ai, emergencyPolicy: (j.emergency ?? undefined) as never, checklistTemplateId: j.code === 'AC-DIAG' || j.code === 'AC-TUNE' ? 'seed_checklist_ac' : null,
        refrigerantWork: j.req === 'seed_req_acr_refrigerant', permitLikely: false, bookingQuestions: [], active: true,
      })),
    })
    for (const j of newTypes) auditCreate(uow, actor, 'JobType', j.id, 'job_type.created', { code: j.code, businessUnitId: j.bu, requirement: j.req, bookableByAi: j.ai, emergency: !!j.emergency }, meta)
    created.jobTypes = newTypes.length
  }

  // Arrival-window templates.
  const haveTemplates = new Set((await tx.arrivalWindowTemplate.findMany({ select: { id: true } })).map(t => t.id))
  const newTemplates = WINDOW_TEMPLATES.filter(t => !haveTemplates.has(t.id))
  if (newTemplates.length) {
    await tx.arrivalWindowTemplate.createMany({ data: newTemplates.map(t => ({ ...t, active: true })), skipDuplicates: true })
    uow.audit({ eventType: 'capacity.templates_loaded', entityType: 'ArrivalWindowTemplate', entityId: 'seed', actorUserId: actor.kind === 'user' ? actor.userId : null, after: { count: newTemplates.length } })
    created.windowTemplates = newTemplates.length
  }

  // On-call: one week at a time per trade, primary + master as backup, from today for four weeks.
  if (!(await tx.onCallRotation.count())) {
    const sixAm = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6)
    // The rota starts at the most recent 06:00 UTC (midnight in Austin), so someone is on call now.
    const start = new Date(sixAm > now.getTime() ? sixAm - 86_400_000 : sixAm)
    const rota: Record<string, [string, string][]> = {
      seed_bu_hvac_service: [['morrison', 'chu'], ['alvarez', 'chu'], ['chu', 'morrison'], ['morrison', 'chu']],
      seed_bu_plumbing_service: [['patel', 'castillo'], ['haddad', 'castillo'], ['castillo', 'patel'], ['patel', 'castillo']],
      seed_bu_electrical: [['dawson', 'bennett'], ['bennett', 'dawson'], ['dawson', 'bennett'], ['bennett', 'dawson']],
    }
    const rows = Object.entries(rota).flatMap(([bu, weeks]) => weeks.flatMap(([primary, backup], w) => [primary, backup].map((key, order) => ({
      businessUnitId: bu, employeeId: `seed_emp_${key}`, startsAt: new Date(start.getTime() + w * 7 * 86_400_000), endsAt: new Date(start.getTime() + (w + 1) * 7 * 86_400_000), phoneE164: TECHS.find(t => t.key === key)!.phone, escalationOrder: order + 1,
    }))))
    await tx.onCallRotation.createMany({ data: rows })
    created.onCall = rows.length
  }

  // Campaigns and tracking numbers.
  const haveCampaigns = new Set((await tx.campaign.findMany({ select: { id: true } })).map(c => c.id))
  for (const c of CAMPAIGNS.filter(c => !haveCampaigns.has(c.id))) {
    await tx.campaign.create({ data: { id: c.id, name: c.name, channel: c.channel, monthlyCostMinor: c.monthlyCostMinor, active: true, trackingNumbers: { create: [{ phoneE164: c.number, provider: 'manual', forwardTo: '+15125550100' }] } } })
    created.campaigns += 1
  }

  // Customers, contacts, phones/emails, locations, and the consent each one gave.
  const all = [...HOUSEHOLDS.map(h => ({ ...h, kind: 'residential' as const, organizationName: '' })), { ...COMMERCIAL, kind: 'commercial' as const, organizationName: COMMERCIAL.displayName, smsConsent: true, optedOut: false }]
  const haveCustomers = new Set((await tx.customer.findMany({ where: { id: { in: all.map(c => c.id) } }, select: { id: true } })).map(c => c.id))
  const fresh = all.filter(c => !haveCustomers.has(c.id))
  if (fresh.length) {
    await tx.customer.createMany({ data: fresh.map(c => ({ id: c.id, ref: c.ref, kind: c.kind, displayName: c.displayName, organizationName: c.organizationName })) })
    await tx.contact.createMany({ data: fresh.map(c => ({ id: `${c.id}_contact`, customerId: c.id, firstName: c.first, lastName: c.last, role: c.kind === 'commercial' ? 'property_manager' : 'owner' })) })
    await tx.$executeRaw`UPDATE "Customer" SET "primaryContact" = id || '_contact' WHERE id = ANY(${fresh.map(c => c.id)}::text[])`
    await tx.contactPoint.createMany({
      data: fresh.flatMap(c => [
        { id: `${c.id}_mobile`, contactId: `${c.id}_contact`, kind: 'mobile', value: c.phone, valueHash: contactHash(c.phone), isPrimary: true, carrierLineType: 'mobile' },
        { id: `${c.id}_email`, contactId: `${c.id}_contact`, kind: 'email', value: c.email, valueHash: contactHash(c.email), isPrimary: false, carrierLineType: 'unknown' },
      ]),
    })
    const serviceArea = (zip: string) => (['78613', '78660', '78664', '78665', '78681', '78717', '78727', '78728', '78729', '78750'].includes(zip) ? 'seed_area_north' : 'seed_area_austin')
    await tx.serviceLocation.createMany({
      data: fresh.map(c => ({ id: c.location.id, ref: c.location.ref, customerId: c.id, address1: c.location.address1, city: c.location.city, state: 'TX', county: ['78613', '78660', '78664', '78665', '78681', '78717', '78729'].includes(c.location.postalCode) ? 'Williamson' : 'Travis', postalCode: c.location.postalCode, country: 'US', lat: c.location.lat, lng: c.location.lng, geocodeQuality: 'interpolated', timeZone: 'America/Chicago', serviceAreaId: serviceArea(c.location.postalCode), propertyClass: c.kind === 'commercial' ? 'nonresidential' : 'residential', propertyType: c.location.propertyType, yearBuilt: c.location.yearBuilt })),
    })
    await tx.locationOwnership.createMany({ data: fresh.map(c => ({ locationId: c.location.id, customerId: c.id, from: day('2020-01-01'), reason: 'import' })) })
    const consents = fresh.flatMap(c => [
      ...(c.smsConsent ? [{ contactPointId: `${c.id}_mobile`, purpose: 'transactional_sms', action: 'grant', channel: 'import', evidence: { source: 'prior system export', capturedAt: '2026-06-01' }, wordingVersion: 'booking-texts-v1', recordedAt: new Date('2026-06-01T15:00:00Z'), actorKind: 'system', actorId: 'seed' }] : []),
      ...(c.optedOut ? [{ contactPointId: `${c.id}_mobile`, purpose: 'transactional_sms', action: 'revoke', channel: 'sms_keyword', evidence: { keyword: 'STOP' }, wordingVersion: 'ctia-keywords', recordedAt: new Date('2026-09-12T19:20:00Z'), actorKind: 'customer', actorId: '' }] : []),
    ])
    await tx.consentRecord.createMany({ data: consents })
    const optedOut = fresh.filter(c => c.optedOut)
    if (optedOut.length) await tx.dncEntry.createMany({ data: optedOut.map(c => ({ valueHash: contactHash(c.phone), kind: 'internal', source: 'sms_stop', addedAt: new Date('2026-09-12T19:20:00Z') })) })
    for (const c of fresh) auditCreate(uow, actor, 'Customer', c.id, 'customer.created', { ref: c.ref, kind: c.kind, locationId: c.location.id, smsConsent: c.smsConsent }, meta)
    created.customers = fresh.length
    created.locations = fresh.length
    created.consents = consents.length
  }
  return created
}
