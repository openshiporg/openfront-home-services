import { describe, expect, it } from 'vitest'
import { contactHash, maskAddress, maskEmail, maskName, maskPhone, normalizeEmail, normalizePhone } from './contact'
import { dateRange, fits, holdExpiry, remainingHours, windowsForDate, type WindowTemplate } from './capacity'
import { credentialCodes, evaluateEligibility, type CrewMember, type LicensingRules, type Requirement } from './eligibility'
import { driveMinutes, loadTenths, rankCandidates, type Candidate } from './dispatch'
import { classifyKeyword } from './smsKeywords'
import { stricterContactHours } from './policy'
import { POLICY_PACKS } from '../seed/policyPacks'
import { LICENSES } from '../seed/company'
import { contactHoursRules, licensingRules } from './policySchemas'

const rulesOf = (code: string) => POLICY_PACKS.find(p => p.code === code)!.version.rules
const LICENSING = licensingRules.parse(rulesOf('us-tx-licensing')) as LicensingRules
const COMPANY = LICENSES.map(l => ({ issuer: l.issuer, licenseClass: l.licenseClass, endorsements: [...(l.endorsements ?? [])], trade: l.trade, expiresOn: null as string | null }))

describe('contact normalisation and masking', () => {
  it('normalises North American numbers to E.164 and rejects junk', () => {
    expect(normalizePhone('(512) 555-0123')).toBe('+15125550123')
    expect(normalizePhone('1-512-555-0123')).toBe('+15125550123')
    expect(normalizePhone('+1 512 555 0123')).toBe('+15125550123')
    expect(() => normalizePhone('555-0123')).toThrow()
    expect(() => normalizePhone('(012) 555-0123')).toThrow()
  })
  it('lower-cases email and hashes so the same person dedupes however they type it', () => {
    expect(normalizeEmail('  Dana@Example.COM ')).toBe('dana@example.com')
    expect(() => normalizeEmail('not-an-email')).toThrow()
    expect(contactHash(normalizePhone('512.555.0123'))).toBe(contactHash(normalizePhone('+15125550123')))
    expect(contactHash('+15125550123')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('masks enough for a caller to confirm and not enough to find or contact them', () => {
    expect(maskPhone('+15125550123')).toBe('(•••) •••-0123')
    expect(maskEmail('dana@example.com')).toBe('d•••@example.com')
    expect(maskAddress('4100 Industrial Blvd')).toBe('4100 I•••')
    expect(maskName('Dana', 'Whitfield')).toBe('Dana W.')
  })
})

describe('arrival windows and capacity', () => {
  const tpl = (over: Partial<WindowTemplate> = {}): WindowTemplate => ({ id: 't', businessUnitId: 'bu', weekday: 0, startLocal: '08:00', endLocal: '10:00', label: '8–10', capacityHours: '6', active: true, ...over })
  const open = () => true

  it('keeps 8–10 AM local on both sides of the November DST change (Chicago)', () => {
    // 2026-11-01 is the Sunday DST ends; Saturday before is CDT (UTC-5), Monday after is CST (UTC-6).
    const [sat] = windowsForDate([tpl({ weekday: 6 })], '2026-10-31', 'America/Chicago', open)
    const [mon] = windowsForDate([tpl({ weekday: 1 })], '2026-11-02', 'America/Chicago', open)
    expect(sat.startsAt.toISOString()).toBe('2026-10-31T13:00:00.000Z')
    expect(mon.startsAt.toISOString()).toBe('2026-11-02T14:00:00.000Z')
    expect(mon.endsAt.getTime() - mon.startsAt.getTime()).toBe(2 * 3600_000)
  })
  it('a window spanning the fall-back hour is three real hours long', () => {
    const [w] = windowsForDate([tpl({ weekday: 0, startLocal: '00:00', endLocal: '02:00' })], '2026-11-01', 'America/Chicago', open)
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(3 * 3600_000)
  })
  it('the spring-forward day still produces a window at 08:00 local', () => {
    const [w] = windowsForDate([tpl({ weekday: 0 })], '2026-03-08', 'America/Chicago', open)
    expect(w.startsAt.toISOString()).toBe('2026-03-08T13:00:00.000Z')
  })
  it('closed days produce no windows and the capacity factor scales hours exactly', () => {
    expect(windowsForDate([tpl({ weekday: 4 })], '2026-11-26', 'America/Chicago', d => d !== '2026-11-26')).toEqual([])
    const [half] = windowsForDate([tpl({ weekday: 6, capacityFactor: '0.5' })], '2026-11-07', 'America/Chicago', open)
    expect(half.capacityHours).toBe('3.0000')
  })
  it('dateRange is inclusive and calendar-correct across month ends', () => {
    expect(dateRange('2026-11-29', 3)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01'])
  })
  it('remaining hours are exact decimals and never negative; a booking must fit', () => {
    expect(remainingHours({ capacityHours: '6', usedHours: ['1.5', '2', '0.25'] }).toString()).toBe('2.25')
    expect(remainingHours({ capacityHours: '2', usedHours: ['3'] }).toString()).toBe('0')
    expect(remainingHours({ capacityHours: '2', usedHours: ['2'], overrideHours: ['1.5'] }).toString()).toBe('1.5')
    expect(fits({ capacityHours: '6', usedHours: ['4.5'] }, '1.5')).toBe(true)
    expect(fits({ capacityHours: '6', usedHours: ['4.5'] }, '1.5001')).toBe(false)
    expect(() => fits({ capacityHours: '6', usedHours: [] }, '0')).toThrow()
  })
  it('holds last 10 minutes online/AI and 30 for a CSR; a caller can ask for less, never more', () => {
    const now = new Date('2026-11-07T15:00:00Z')
    expect(holdExpiry(now, 'ai_agent').toISOString()).toBe('2026-11-07T15:10:00.000Z')
    expect(holdExpiry(now, 'csr').toISOString()).toBe('2026-11-07T15:30:00.000Z')
    expect(holdExpiry(now, 'csr', 90).toISOString()).toBe('2026-11-07T15:30:00.000Z')
    expect(holdExpiry(now, 'online', 3).toISOString()).toBe('2026-11-07T15:03:00.000Z')
  })
})

describe('eligibility (Texas licensing pack, fails closed)', () => {
  const cred = (kind: string, trade: string, licenseClass: string, epaType = 'none', over: Partial<CrewMember['credentials'][number]> = {}) => ({ kind, trade, licenseClass, epaType, status: 'verified', expiresOn: '2027-12-31', ...over })
  const member = (employeeId: string, credentials: CrewMember['credentials'], role: CrewMember['role'] = 'lead'): CrewMember => ({ employeeId, role, status: 'active', credentials })
  const req = (licensingTags: string[], over: Partial<Requirement> = {}): Requirement => ({ licensingTags, requiredCredentialKinds: [], requiresSupervisorOnJob: false, maxCoolingTons: null, ...over })
  const run = (requirement: Requirement, crew: CrewMember[], rules: LicensingRules | null = LICENSING, companyLicenses = COMPANY) => evaluateEligibility({ date: '2026-11-09', requirement, rules, companyLicenses, crew })
  const codes = (r: ReturnType<typeof run>) => [...r.crewFindings, ...Object.values(r.perEmployee).flatMap(e => e.findings)].map(f => f.code).sort()

  const certifiedTech = member('jake', [cred('state_trade_license', 'hvac', 'acr_certified_technician'), cred('epa_608', 'hvac', '', 'universal')])

  it('maps credentials to the pack codes', () => {
    expect(credentialCodes(cred('state_trade_license', 'hvac', 'acr_certified_technician'))).toEqual(['tx_acr_certified_technician'])
    expect(credentialCodes(cred('epa_608', 'hvac', '', 'type_ii'))).toEqual(['epa608_type_ii'])
  })
  it('clears a certified tech with EPA Universal for refrigerant work', () => {
    expect(run(req(['acr_service', 'refrigerant_handling']), [certifiedTech]).eligible).toBe(true)
  })
  it('blocks refrigerant work for an EPA Type I card (high-pressure systems need Type II or Universal)', () => {
    const r = run(req(['acr_service', 'refrigerant_handling']), [member('brandon', [cred('state_trade_license', 'hvac', 'acr_registered_technician'), cred('epa_608', 'hvac', '', 'type_i')])])
    expect(r.eligible).toBe(false)
    expect(codes(r)).toContain('LICENSE_MISSING')
  })
  it('an expired licence blocks new assignments with a renewal finding', () => {
    const r = run(req(['electrical_service']), [member('maya', [cred('state_trade_license', 'electrical', 'residential_wireman', 'none', { expiresOn: '2026-11-08' })])])
    expect(r.eligible).toBe(false)
    expect(codes(r)).toEqual(['CREDENTIAL_EXPIRED'])
  })
  it('an unverified licence does not count', () => {
    const r = run(req(['plumbing_service']), [member('omar', [cred('state_trade_license', 'plumbing', 'journeyman_plumber', 'none', { status: 'pending_verification' })])])
    expect(r.eligible).toBe(false)
  })
  it('a plumbing apprentice alone is blocked; with a journeyman on the visit the crew is cleared', () => {
    const apprentice = member('cody', [cred('state_trade_license', 'plumbing', 'plumber_apprentice')], 'apprentice')
    const alone = run(req(['plumbing_service']), [apprentice])
    expect(alone.eligible).toBe(false)
    expect(codes(alone)).toContain('SUPERVISOR_REQUIRED')
    const journeyman = member('nina', [cred('state_trade_license', 'plumbing', 'journeyman_plumber')])
    expect(run(req(['plumbing_service']), [journeyman, apprentice]).eligible).toBe(true)
  })
  it('the company needs its own current licence (TDLR ACR with environmental air)', () => {
    const withoutAcr = COMPANY.filter(l => !(l.issuer === 'TDLR' && ['A', 'B'].includes(l.licenseClass)))
    const r = run(req(['acr_service']), [certifiedTech], LICENSING, withoutAcr)
    expect(codes(r)).toContain('COMPANY_LICENSE_MISSING')
  })
  it('fails closed with no policy, and on a job tag the policy does not know', () => {
    expect(codes(run(req(['acr_service']), [certifiedTech], null))).toContain('POLICY_UNRESOLVED')
    expect(codes(run(req(['solar_install']), [certifiedTech]))).toContain('UNKNOWN_JOB_TAG')
  })
  it('a job type with no licensing tags (sales visit) needs only an active person', () => {
    expect(run(req([]), [member('rachel', [], 'sales')]).eligible).toBe(true)
    expect(run(req([]), [{ ...member('gone', []), status: 'terminated' }]).eligible).toBe(false)
    expect(codes(run(req([]), []))).toEqual(['NO_CREW'])
  })
})

describe('dispatch ranking (deterministic, explained)', () => {
  const c = (employeeId: string, over: Partial<Candidate> = {}): Candidate => ({ employeeId, name: employeeId, eligible: true, eligibilityCodes: [], driveMinutes: 20, skillsMatched: 1, skillsRequired: 1, priorVisitsHere: 0, assignedHoursToday: '0', onShift: true, overlaps: 0, ...over })

  it('never ranks an ineligible tech above an eligible one, however close', () => {
    const ranked = rankCandidates([c('near', { eligible: false, eligibilityCodes: ['LICENSE_MISSING'], driveMinutes: 1 }), c('far', { driveMinutes: 60 })])
    expect(ranked.map(r => r.employeeId)).toEqual(['far', 'near'])
    expect(ranked[1].explanation[0]).toContain('LICENSE_MISSING')
  })
  it('weighs drive time, continuity and today\'s load; every candidate explains its score', () => {
    // a: -60+100 = 40; b: -20+100 = 80; c: -60+100+50 = 90 (been here twice); d: -20+100-60 = 20 (6 h already).
    const ranked = rankCandidates([c('a', { driveMinutes: 30 }), c('b', { driveMinutes: 10 }), c('c', { driveMinutes: 30, priorVisitsHere: 2 }), c('d', { driveMinutes: 10, assignedHoursToday: '6' })])
    expect(ranked.map(r => [r.employeeId, r.score])).toEqual([['c', 90], ['b', 80], ['a', 40], ['d', 20]])
    expect(ranked.every(r => r.explanation.length > 0)).toBe(true)
  })
  it('is stable: same input, same order; ties break by drive time then id', () => {
    const input = [c('x'), c('w'), c('y', { driveMinutes: 19, skillsMatched: 0 })]
    expect(rankCandidates(input).map(r => r.employeeId)).toEqual(rankCandidates([...input].reverse()).map(r => r.employeeId))
    expect(rankCandidates([c('x'), c('w')]).map(r => r.employeeId)).toEqual(['w', 'x'])
  })
  it('works in integer tenths of an hour (half-up) and estimates drive minutes without a routing adapter', () => {
    expect(loadTenths('2.25')).toBe(23)
    expect(loadTenths('0')).toBe(0)
    expect(driveMinutes({ lat: '30.209500', lng: '-97.738100' }, { lat: '30.209500', lng: '-97.738100' })).toBe(1)
    const m = driveMinutes({ lat: '30.209500', lng: '-97.738100' }, { lat: '30.518500', lng: '-97.714400' })!
    expect(m).toBeGreaterThan(50)
    expect(m).toBeLessThan(80)
    expect(driveMinutes(null, { lat: '1', lng: '1' })).toBeNull()
  })
})

describe('inbound text keywords', () => {
  it('recognises carrier keywords however they are typed', () => {
    expect(classifyKeyword(' stop ')).toBe('stop')
    expect(classifyKeyword('Stop.')).toBe('stop')
    expect(classifyKeyword('UNSTOP')).toBe('start')
    expect(classifyKeyword('help')).toBe('help')
    expect(classifyKeyword('stop by at 3?')).toBeNull()
  })
})
