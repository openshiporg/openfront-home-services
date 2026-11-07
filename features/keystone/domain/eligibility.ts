import type { z } from 'zod'
import { dec } from '../lib/decimal'
import type { licensingRules } from './policySchemas'

/*
 * Who may work a job (I-P1, SM§4; rideshare eligibility.ts pattern). Pure: the caller loads the job
 * type requirement, the crew's credentials and the bound licensing PolicyVersion, and stores the result
 * with that version's id. Fails closed: a job tag the policy doesn't know, or no policy, blocks.
 *
 * Texas (licensing pack, R§12.3a):
 * - ACR work needs an ACR-licensed company and a technician holding one of the listed ACR credentials;
 *   Class B contractors are capped (25 tons cooling, 1.5M BTU/h heating), carried as maxCoolingTons.
 * - Refrigerant handling needs EPA 608 at the right type (Type II or Universal for high-pressure).
 * - Plumbing and electrical apprentices may work only with a licensed supervisor on the same visit.
 */

export type LicensingRules = z.infer<typeof licensingRules>

export type CredentialFact = { kind: string; trade: string; licenseClass: string | null; epaType: string | null; status: string; expiresOn: string | null }
export type CrewMember = { employeeId: string; role: 'lead' | 'helper' | 'sales' | 'apprentice'; status: string; credentials: CredentialFact[] }
export type Requirement = { licensingTags: string[]; requiredCredentialKinds: string[]; requiresSupervisorOnJob: boolean; maxCoolingTons: string | null; jobCoolingTons?: string | null }
export type CompanyLicense = { issuer: string; licenseClass: string; endorsements: string[]; trade: string; expiresOn: string | null }

export type Finding = { code: string; severity: 'block' | 'warn'; employeeId?: string; tag?: string; message: string }
export type EligibilityResult = { eligible: boolean; perEmployee: Record<string, { eligible: boolean; findings: Finding[] }>; crewFindings: Finding[] }

/** A credential counts on `date` if verified and not expired that day. Expiry blocks new assignments only (I-P2). */
export function credentialCurrent(c: CredentialFact, date: string) {
  return c.status === 'verified' && (!c.expiresOn || c.expiresOn >= date)
}

/** The codes a credential satisfies in the licensing pack: its Texas class, or `epa608_<type>`. */
export function credentialCodes(c: CredentialFact): string[] {
  const codes: string[] = []
  if (c.licenseClass) codes.push(c.licenseClass.startsWith('tx_') ? c.licenseClass : `tx_${c.licenseClass}`)
  if (c.kind === 'epa_608' && c.epaType && c.epaType !== 'none') codes.push(`epa608_${c.epaType}`)
  if (c.kind !== 'state_trade_license' && c.kind !== 'epa_608') codes.push(c.kind)
  return codes
}

const isApprenticeCode = (code: string) => /apprentice/.test(code)

export function evaluateEligibility(input: { date: string; requirement: Requirement; rules: LicensingRules | null; companyLicenses: CompanyLicense[]; crew: CrewMember[] }): EligibilityResult {
  const { date, requirement, rules, crew } = input
  const perEmployee: EligibilityResult['perEmployee'] = {}
  const crewFindings: Finding[] = []
  const blockCrew = (code: string, message: string, tag?: string) => crewFindings.push({ code, severity: 'block', message, tag })

  if (!crew.length) blockCrew('NO_CREW', 'No technician is assigned.')
  if (requirement.licensingTags.length && !rules) blockCrew('POLICY_UNRESOLVED', 'No licensing policy applies here, so nobody can be cleared for this work.')

  const rulesFor = (tag: string) => rules?.requirements.filter(r => r.jobTag === tag) ?? []
  for (const tag of requirement.licensingTags) {
    if (rules && !rulesFor(tag).length) blockCrew('UNKNOWN_JOB_TAG', `The licensing policy has no rule for ${tag}.`, tag)
  }

  // Company licence: some licence of the right issuer and class, current on the date.
  for (const tag of requirement.licensingTags) {
    for (const rule of rulesFor(tag)) {
      if (!rule.companyLicense) continue
      const need = rule.companyLicense
      const ok = input.companyLicenses.some(l => l.issuer === need.issuer && need.classes.includes(l.licenseClass) && (!need.endorsement || l.endorsements.includes(need.endorsement)) && (!l.expiresOn || l.expiresOn >= date))
      if (!ok) blockCrew('COMPANY_LICENSE_MISSING', `The company needs a current ${need.issuer} ${need.classes.join(' or ')} licence${need.endorsement ? ` with ${need.endorsement.replaceAll('_', ' ')}` : ''} for ${tag.replaceAll('_', ' ')}.`, tag)
      if (rule.maxCoolingTons && requirement.jobCoolingTons && dec(requirement.jobCoolingTons).gt(dec(rule.maxCoolingTons))) {
        blockCrew('TONNAGE_OVER_CLASS', `The system is ${requirement.jobCoolingTons} tons; this licence class covers up to ${rule.maxCoolingTons}.`, tag)
      }
    }
  }
  if (requirement.maxCoolingTons && requirement.jobCoolingTons && dec(requirement.jobCoolingTons).gt(dec(requirement.maxCoolingTons))) {
    blockCrew('TONNAGE_OVER_JOB_TYPE', `The system is ${requirement.jobCoolingTons} tons; this job type is limited to ${requirement.maxCoolingTons}.`)
  }

  const supervisors = new Set<string>()
  const heldFor = new Map<string, string[]>()
  for (const member of crew) {
    const findings: Finding[] = []
    const block = (code: string, message: string, tag?: string) => findings.push({ code, severity: 'block', employeeId: member.employeeId, message, tag })
    if (member.status !== 'active') block('EMPLOYEE_NOT_ACTIVE', 'This person is not active.')
    const current = member.credentials.filter(c => credentialCurrent(c, date))
    const expired = member.credentials.filter(c => c.status === 'verified' && c.expiresOn && c.expiresOn < date)
    const codes = new Set(current.flatMap(credentialCodes))
    for (const kind of requirement.requiredCredentialKinds) if (!current.some(c => c.kind === kind)) block('CREDENTIAL_MISSING', `Needs a current ${kind.replaceAll('_', ' ')} credential.`)
    for (const tag of requirement.licensingTags) {
      for (const rule of rulesFor(tag)) {
        if (!rule.individual) continue
        const held = rule.individual.anyOf.filter(code => codes.has(code))
        heldFor.set(`${tag}:${member.employeeId}`, held)
        const supervises = rule.individual.supervisionBy.filter(code => codes.has(code))
        if (supervises.length) supervisors.add(`${tag}:${member.employeeId}`)
        if (!held.length) {
          const lapsed = expired.flatMap(credentialCodes).filter(code => rule.individual!.anyOf.includes(code))
          block(lapsed.length ? 'CREDENTIAL_EXPIRED' : 'LICENSE_MISSING', lapsed.length
            ? `${lapsed.join(', ')} expired; renew before assigning ${tag.replaceAll('_', ' ')} work.`
            : `Needs one of ${rule.individual.anyOf.join(', ')} for ${tag.replaceAll('_', ' ')}.`, tag)
        }
      }
    }
    perEmployee[member.employeeId] = { eligible: !findings.some(f => f.severity === 'block'), findings }
  }

  // Supervision: a member whose only qualifying credential for the tag is an apprentice class needs a
  // supervisor (a code in supervisionBy) on the same visit. Other licence holders work under the
  // company licence holder's general supervision, which the company-licence check covers.
  for (const tag of requirement.licensingTags) {
    for (const rule of rulesFor(tag)) {
      if (!rule.individual?.supervisionBy.length) continue
      const needsOnSite = crew.filter(m => {
        const held = heldFor.get(`${tag}:${m.employeeId}`) ?? []
        return held.length > 0 && held.every(isApprenticeCode)
      })
      if (!needsOnSite.length) continue
      const present = crew.some(m => supervisors.has(`${tag}:${m.employeeId}`) && perEmployee[m.employeeId]?.eligible)
      if (!present) blockCrew('SUPERVISOR_REQUIRED', `${needsOnSite.length === 1 ? 'An apprentice' : 'Apprentices'} on ${tag.replaceAll('_', ' ')} work need a ${rule.individual.supervisionBy.join(' or ')} on the visit.`, tag)
    }
  }
  if (requirement.requiresSupervisorOnJob && crew.length && !crew.some(m => [...supervisors].some(s => s.endsWith(`:${m.employeeId}`)))) {
    blockCrew('SUPERVISOR_REQUIRED', 'This job type needs a licensed supervisor on the visit.')
  }

  const eligible = !crewFindings.some(f => f.severity === 'block') && Object.values(perEmployee).every(e => e.eligible)
  return { eligible, perEmployee, crewFindings }
}
