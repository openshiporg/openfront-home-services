import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasTestDatabase, resetDatabase, testPrisma, uniqueKey } from '../../../tests/helpers/db'
import { permissionNames, type Permission } from '../access'
import type { Actor } from '../lib/actor'
import { Codes, DomainError } from '../lib/errors'
import { verifyAuditChain } from '../lib/audit'
import { addDays, localDate } from '../lib/calendar'
import { loadCompanySetup, loadOperationsSetup } from '../mutations/setup'
import { advanceTimedStates } from './maintenance'
import { availableWindows, bookJob, expireHolds, holdWindow, materializeWindows, releaseHold } from './booking'
import { assignVisit, cancelJob, checkEligibility, recommendDispatch, setVisitStatus, submitChecklist, unassignVisit } from './dispatch'
import { effectiveConsent, receiveInboundSms, recordConsent } from './comms'
import { handoffToHuman, ingestLead, loseLead, lookupCustomer, lookupLocations, markLeadContacted, matchJobType, pageOnCall, qualifyLead, revealAccessSecret, startInboundCall, storeAccessSecret, verifyCredential } from './crm'
import { HOUSEHOLDS, JOB_TYPES, TECHS } from '../seed/operationsData'

/*
 * Phase 1 exit gate (BUILD-PLAN): the AI receptionist books a window on a recorded call (fake
 * telephony) without overbooking under 50 parallel holds; an emergency phrase pages on-call; a
 * reassign race gives one STALE_STATE; an ineligible tech is blocked with findings; an on-the-way
 * text is blocked at 9:05 p.m. when only marketing consent exists. Plus access per role, the lead,
 * hold, job and visit state machines, STOP handling and out-of-order device events.
 *
 * The suite books into the coming week's windows (materialised from the seeded templates) and
 * passes explicit clocks wherever a rule depends on the time of day.
 */

const ALL = permissionNames.filter(p => p !== 'canBreakGlass')
const userActor = (userId: string, perms: Permission[]): Actor => ({ kind: 'user', userId, name: userId, permissions: new Set(perms) })
const sessionFor = (id: string, granted: readonly string[]) => ({ itemId: id, data: { name: id, email: `${id}@test.local`, kind: 'staff', accessExpiresAt: null, role: { id: 'r', name: 'r', ...Object.fromEntries(permissionNames.map(p => [p, granted.includes(p)])) } } })
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'OK'
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
}
const hours = (v: { toString(): string }) => {
  const s = v.toString()
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

const CHICAGO = { timeZone: 'America/Chicago' }
const REAL_NOW = new Date()
/** The next Monday at least two days out: every window that day is in the future and open. */
const DAY = (() => {
  let d = addDays(localDate(CHICAGO, REAL_NOW), 2)
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1)
  return d
})()
const NOW = REAL_NOW

describe.skipIf(!hasTestDatabase)('Phase 1: CRM, booking, dispatch and the AI receptionist (database)', () => {
  let prisma: PrismaClient
  let ownerId: string
  let owner: Actor
  let csr: Actor
  let dispatcher: Actor
  let techJake: Actor
  let techSofia: Actor
  let accountant: Actor
  let agent: Actor & { kind: 'agent' }
  let agentNoGrants: Actor & { kind: 'agent' }

  const windowFor = async (jobTypeCode: string, label: string, date = DAY) => {
    const jt = JOB_TYPES.find(j => j.code === jobTypeCode)!
    const w = await prisma.arrivalWindow.findFirstOrThrow({ where: { businessUnitId: jt.bu, date: new Date(`${date}T00:00:00Z`), label } })
    return { jobTypeId: jt.id, windowId: w.id, window: w }
  }

  const book = async (jobTypeCode: string, label: string, customerIndex: number, by: Actor = csr) => {
    const { jobTypeId, windowId } = await windowFor(jobTypeCode, label)
    const h = HOUSEHOLDS[customerIndex]
    return bookJob(prisma, by, { jobTypeId, windowId, customerId: h.id, locationId: h.location.id, summary: 'test booking', idempotencyKey: uniqueKey('book'), now: NOW })
  }

  const visitOf = (id: string) => prisma.visit.findUniqueOrThrow({ where: { id } })

  beforeAll(async () => {
    prisma = testPrisma(12)
    await resetDatabase(prisma)
    const ownerUser = await prisma.user.create({ data: { name: 'owner', email: `${uniqueKey('owner')}@test.local`, password: 'x'.repeat(60) } })
    ownerId = ownerUser.id
    const ctx = { session: sessionFor(ownerId, ALL), prisma }
    await loadCompanySetup(null, { idempotencyKey: uniqueKey('company') }, ctx)
    await loadOperationsSetup(null, { idempotencyKey: uniqueKey('ops') }, ctx)
    owner = userActor(ownerId, ALL)

    csr = userActor('seed_user_raman', ['canAccessDashboard', 'canBook', 'canManageLeads', 'canManageCustomers', 'canSendMessages'])
    dispatcher = userActor('seed_user_brooks', ['canAccessDashboard', 'canDispatch', 'canViewBoard', 'canBook', 'canReadCustomerPII', 'canSendMessages', 'canRevealAccessSecret'])
    techJake = userActor('seed_user_morrison', ['canAccessDashboard', 'canWorkVisits'])
    techSofia = userActor('seed_user_alvarez', ['canAccessDashboard', 'canWorkVisits'])
    accountant = userActor('seed_user_cole', ['canAccessDashboard', 'canReadAudit'])

    const tools = ['customer.lookup', 'location.lookup', 'customer.history', 'jobtype.match', 'capacity.windows', 'booking.hold', 'booking.release', 'booking.confirm', 'consent.record', 'handoff.to_human', 'page.on_call', 'dispatch.recommend', 'dispatch.apply', 'dispatch.eligibility']
    const receptionist = await prisma.agentIdentity.create({ data: { name: 'Summit receptionist', kind: 'llm_agent', ownerId, status: 'active' } })
    await prisma.agentScopeGrant.createMany({ data: tools.map(tool => ({ agentId: receptionist.id, tool, autonomy: 'auto_within_policy', status: 'active', grantedById: ownerId })) })
    agent = { kind: 'agent', agentId: receptionist.id, ownerUserId: ownerId, name: 'Summit receptionist', scopes: new Set(tools) }
    const bare = await prisma.agentIdentity.create({ data: { name: 'Ungranted agent', kind: 'llm_agent', ownerId, status: 'active' } })
    agentNoGrants = { kind: 'agent', agentId: bare.id, ownerUserId: ownerId, scopes: new Set() }
  }, 300_000)

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('the operations seed is complete, opens three weeks of windows, and loads twice without change', { timeout: 120_000 }, async () => {
    expect(await prisma.employee.count({ where: { kind: { in: ['technician', 'apprentice'] } } })).toBe(TECHS.length)
    expect(await prisma.jobType.count()).toBe(JOB_TYPES.length)
    expect(await prisma.customer.count()).toBe(HOUSEHOLDS.length + 1)
    // 3 service units × 4 windows + install × 2 on a weekday.
    expect(await prisma.arrivalWindow.count({ where: { date: new Date(`${DAY}T00:00:00Z`) } })).toBe(14)
    expect(await prisma.shift.count({ where: { date: new Date(`${DAY}T00:00:00Z`) } })).toBe(TECHS.length + 1) // the techs and the comfort advisor
    const again = await loadOperationsSetup(null, { idempotencyKey: uniqueKey('ops') }, { session: sessionFor(ownerId, ALL), prisma })
    expect(Object.entries(again.created).filter(([, n]) => n !== 0)).toEqual([])
    // Materialising the same days again is a no-op too.
    const re = await materializeWindows(prisma, owner, { from: DAY, days: 1, idempotencyKey: uniqueKey('w') })
    expect(re).toMatchObject({ created: 0, shifts: 0 })
  })

  describe('access per role', () => {
    it('an accountant, a tech and an ungranted agent cannot hold a window; the agent refusal is recorded', async () => {
      const { jobTypeId, windowId } = await windowFor('DRAIN-CLR', '8–10 AM')
      const args = { jobTypeId, windowId, source: 'csr' as const, idempotencyKey: uniqueKey('hold'), now: NOW }
      expect(await code(holdWindow(prisma, accountant, args))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(holdWindow(prisma, techJake, args))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(holdWindow(prisma, agentNoGrants, args))).toBe(Codes.SCOPE_DENIED)
      expect(await prisma.agentAction.count({ where: { agentId: agentNoGrants.agentId, status: 'rejected', tool: 'booking.hold' } })).toBe(1)
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })).bookedHours)).toBe('0')
    })

    it('agents never cancel jobs, change visit status, move a person\'s assignment, handle access codes or verify licences', { timeout: 60_000 }, async () => {
      const booked = await book('DRAIN-CLR', '2–4 PM', 30)
      const job = await prisma.job.findUniqueOrThrow({ where: { id: booked.jobId } })
      expect(await code(cancelJob(prisma, agent, { jobId: job.id, expectedVersion: job.version, reason: 'customer_request', idempotencyKey: uniqueKey('c') }))).toBe(Codes.SCOPE_DENIED)
      expect(await code(setVisitStatus(prisma, agent, { visitId: booked.visitId, to: 'dispatched', idempotencyKey: uniqueKey('s') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(storeAccessSecret(prisma, agent, { locationId: HOUSEHOLDS[30].location.id, kind: 'gate_code', secret: '1234', idempotencyKey: uniqueKey('a') }))).toBe(Codes.SCOPE_DENIED)
      const cred = await prisma.credential.findFirstOrThrow({ where: { status: 'pending_verification' } })
      expect(await code(verifyCredential(prisma, agent, { credentialId: cred.id, expectedVersion: cred.version, idempotencyKey: uniqueKey('v') }))).toBe(Codes.SCOPE_DENIED)
      // A person scheduled it; the agent may not move it.
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_patel'], idempotencyKey: uniqueKey('as'), now: NOW })
      const scheduled = await visitOf(v.id)
      expect(await code(assignVisit(prisma, agent, { visitId: v.id, expectedVersion: scheduled.version, employeeIds: ['seed_emp_castillo'], idempotencyKey: uniqueKey('as'), now: NOW }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await prisma.visitAssignment.findFirst({ where: { visitId: v.id, active: true }, select: { employeeId: true } })).toEqual({ employeeId: 'seed_emp_patel' })
    })

    it('the AI sees masked customer details; a person with PII access sees them in full', async () => {
      const h = HOUSEHOLDS[5]
      const masked = await lookupCustomer(prisma, agent, { phone: h.phone })
      expect(masked.matches).toHaveLength(1)
      expect(masked.matches[0].phone).toBe(`(•••) •••-${h.phone.slice(-4)}`)
      expect(masked.matches[0].name).toBe(`${h.first} ${h.last[0]}.`)
      expect(masked.matches[0].locations[0].address).not.toBe(h.location.address1)
      const full = await lookupCustomer(prisma, dispatcher, { phone: h.phone })
      expect(full.matches[0]).toMatchObject({ phone: h.phone, name: h.displayName })
      expect(full.matches[0].locations[0].address).toBe(h.location.address1)
      // Service addresses: the AI gets the area and open jobs but not the street; nobody without a booking role sees any.
      const aiLocs = await lookupLocations(prisma, agent, { customerId: h.id })
      expect(aiLocs.locations).toHaveLength(1)
      expect(aiLocs.locations[0]).toMatchObject({ locationId: h.location.id, postalCode: h.location.postalCode, inServiceArea: true })
      expect(aiLocs.locations[0].address).not.toBe(h.location.address1)
      expect((await lookupLocations(prisma, owner, { customerId: h.id })).locations[0].address).toBe(h.location.address1)
      expect(await code(lookupLocations(prisma, accountant, { customerId: h.id }))).toBe(Codes.NOT_AUTHORIZED)
    })
  })

  describe('AI receptionist on a recorded call', () => {
    it('matches the problem, offers windows, holds one, books it, and the confirmation text goes out', { timeout: 300_000 }, async () => {
      const caller = HOUSEHOLDS[2]
      const call = await startInboundCall(prisma, { providerCallId: `CA${uniqueKey('call')}`, provider: 'recording', from: caller.phone, to: '+15125550190', answeredBy: 'ai_agent', recordingDisclosurePlayed: true, startedAt: NOW })
      expect(call).toMatchObject({ customerId: caller.id, campaignId: 'seed_campaign_lsa' })

      const match = await matchJobType(prisma, agent, { description: "My AC is blowing warm air and the thermostat says it's cooling", postalCode: caller.location.postalCode })
      expect(match.matches[0].code).toBe('AC-DIAG')
      expect(match.emergency).toBeNull()
      expect(match.inArea).toBe(true)

      const offer = await availableWindows(prisma, agent, { jobTypeId: 'seed_jt_ac_diag', postalCode: caller.location.postalCode, from: DAY, days: 1, now: NOW })
      expect(offer.inArea).toBe(true)
      expect(offer.windows.map(w => w.label)).toEqual(['8–10 AM', '10 AM–12 PM', '12–2 PM', '2–4 PM'])
      const morning = offer.windows[0]

      const heldAt = new Date(NOW.getTime() - 3 * 60_000)
      const hold = await holdWindow(prisma, agent, { windowId: morning.windowId, jobTypeId: 'seed_jt_ac_diag', source: 'csr', idempotencyKey: uniqueKey('hold'), now: heldAt })
      expect(new Date(hold.expiresAt).getTime() - heldAt.getTime()).toBe(10 * 60_000) // an agent's hold is 10 minutes, whatever it asks for
      const booked = await bookJob(prisma, agent, { holdId: hold.holdId, jobTypeId: 'seed_jt_ac_diag', customerId: caller.id, locationId: caller.location.id, summary: 'AC blowing warm', idempotencyKey: uniqueKey('confirm'), now: NOW })
      expect(booked).toMatchObject({ window: '8–10 AM', date: DAY })
      const job = await prisma.job.findUniqueOrThrow({ where: { id: booked.jobId } })
      expect(job).toMatchObject({ status: 'booked', source: 'ai_agent', bookedByAgentId: agent.agentId, bookedById: null })
      expect(await prisma.bookingHold.findUniqueOrThrow({ where: { id: hold.holdId } })).toMatchObject({ status: 'converted', visitId: booked.visitId })
      // The window counted the hours once: the hold's reservation became the visit's.
      const w = await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: morning.windowId } })
      const usage = await prisma.capacityUsage.findMany({ where: { windowId: morning.windowId } })
      expect(usage.map(u => u.kind)).toEqual(['visit'])
      expect(hours(w.bookedHours)).toBe('2')

      // Every agent call is on the record.
      const actions = await prisma.agentAction.findMany({ where: { agentId: agent.agentId, status: 'applied' }, select: { tool: true } })
      expect(actions.map(a => a.tool)).toEqual(expect.arrayContaining(['jobtype.match', 'capacity.windows', 'booking.hold', 'booking.confirm']))
    })

    it('50 parallel holds on one window never oversell it', { timeout: 180_000 }, async () => {
      const { jobTypeId, windowId, window } = await windowFor('ELEC-DIAG', '12–2 PM')
      // 6 h of capacity, 1.5 h per diagnostic: exactly 4 fit.
      const results = await Promise.all(Array.from({ length: 50 }, (_, i) => code(holdWindow(prisma, i % 2 ? agent : csr, { windowId, jobTypeId, source: 'csr', idempotencyKey: uniqueKey(`race${i}`), now: NOW }))))
      expect(results.filter(r => r === 'OK')).toHaveLength(4)
      expect(results.filter(r => r === Codes.CAPACITY_FULL)).toHaveLength(46)
      const after = await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })
      expect(hours(after.bookedHours)).toBe(hours(window.capacityHours))
      expect(await prisma.bookingHold.count({ where: { windowId, status: 'held' } })).toBe(4)
      expect(await prisma.capacityUsage.count({ where: { windowId } })).toBe(4)
    })

    it('with no timer running, a request-driven pass (the Refresh button) expires a lapsed hold and gives its hours back', { timeout: 60_000 }, async () => {
      const { jobTypeId, windowId } = await windowFor('DRAIN-CLR', '12–2 PM')
      const hold = await holdWindow(prisma, csr, { windowId, jobTypeId, source: 'csr', idempotencyKey: uniqueKey('h'), now: NOW })
      expect((await prisma.bookingHold.findUniqueOrThrow({ where: { id: hold.holdId } })).status).toBe('held')
      await prisma.bookingHold.update({ where: { id: hold.holdId }, data: { expiresAt: new Date(Date.now() - 60_000) } })
      const first = await advanceTimedStates(prisma, { force: true })
      expect(first?.holds.expired).toBeGreaterThanOrEqual(1)
      expect((await prisma.bookingHold.findUniqueOrThrow({ where: { id: hold.holdId } })).status).toBe('expired')
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })).bookedHours)).toBe('0')
      // Running it again changes nothing; an unforced call right after shares the last pass.
      expect((await advanceTimedStates(prisma, { force: true }))?.holds.expired).toBe(0)
      expect(await advanceTimedStates(prisma)).toBeNull()
    })

    it('an expired hold gives its hours back and cannot be confirmed; a release frees them at once', { timeout: 60_000 }, async () => {
      const { jobTypeId, windowId } = await windowFor('PANEL-EST', '8–10 AM')
      const hold = await holdWindow(prisma, agent, { windowId, jobTypeId, source: 'ai_agent', idempotencyKey: uniqueKey('h'), now: NOW })
      const late = new Date(NOW.getTime() + 11 * 60_000)
      expect(await code(bookJob(prisma, agent, { holdId: hold.holdId, jobTypeId, customerId: HOUSEHOLDS[3].id, locationId: HOUSEHOLDS[3].location.id, idempotencyKey: uniqueKey('b'), now: late }))).toBe(Codes.HOLD_EXPIRED)
      expect((await expireHolds(prisma, late)).expired).toBeGreaterThanOrEqual(1)
      expect((await prisma.bookingHold.findUniqueOrThrow({ where: { id: hold.holdId } })).status).toBe('expired')
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })).bookedHours)).toBe('0')

      const second = await holdWindow(prisma, csr, { windowId, jobTypeId, source: 'csr', idempotencyKey: uniqueKey('h'), now: late })
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })).bookedHours)).toBe('1')
      expect(await code(releaseHold(prisma, agent, { holdId: second.holdId, idempotencyKey: uniqueKey('r') }))).toBe(Codes.NOT_AUTHORIZED) // not the agent's hold
      await releaseHold(prisma, csr, { holdId: second.holdId, idempotencyKey: uniqueKey('r'), now: late })
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: windowId } })).bookedHours)).toBe('0')
    })

    it('the AI books only job types marked bookable by AI; nobody books outside the service area', { timeout: 60_000 }, async () => {
      const sewer = await windowFor('SEWER-CAM', '8–10 AM')
      expect(await code(holdWindow(prisma, agent, { windowId: sewer.windowId, jobTypeId: sewer.jobTypeId, source: 'ai_agent', idempotencyKey: uniqueKey('h'), now: NOW }))).toBe(Codes.GUARD_FAILED)
      const ac = await windowFor('AC-DIAG', '2–4 PM')
      const out = bookJob(prisma, csr, { windowId: ac.windowId, jobTypeId: ac.jobTypeId, customer: { firstName: 'Far', lastName: 'Away', phone: '+15125550098' }, location: { address1: '1 Main St', city: 'San Marcos', postalCode: '78666' }, idempotencyKey: uniqueKey('b'), now: NOW })
      expect(await code(out)).toBe(Codes.OUT_OF_AREA)
      // The refused booking rolled back whole: no hours taken, no customer created.
      expect(hours((await prisma.arrivalWindow.findUniqueOrThrow({ where: { id: ac.windowId } })).bookedHours)).toBe(hours(ac.window.bookedHours))
      expect(await prisma.customer.count({ where: { displayName: 'Far Away' } })).toBe(0)
    })

    it('an emergency phrase gives the safety script and raises an urgent on-call task', { timeout: 60_000 }, async () => {
      const caller = HOUSEHOLDS[9]
      const call = await startInboundCall(prisma, { providerCallId: `CA${uniqueKey('em')}`, provider: 'recording', from: caller.phone, to: '+15125550100', answeredBy: 'ai_agent', recordingDisclosurePlayed: true, startedAt: NOW })
      const match = await matchJobType(prisma, agent, { description: 'There is a pipe burst in the laundry room and water everywhere' })
      expect(match.emergency?.page).toBe(true)
      expect(match.emergency?.script).toContain('main water shut-off')
      expect(match.matches[0].code).toBe('LEAK-REP')
      const paged = await pageOnCall(prisma, agent, { callId: call.callId, businessUnitId: 'seed_bu_plumbing_service', summary: 'Burst pipe, water everywhere', idempotencyKey: uniqueKey('page'), now: NOW })
      expect(paged.paged).toBe(true)
      const task = await prisma.task.findFirstOrThrow({ where: { kind: 'page.on_call', subjectId: call.callId } })
      expect(task).toMatchObject({ priority: 'urgent', status: 'open' })
      expect((await prisma.call.findUniqueOrThrow({ where: { id: call.callId } })).disposition).toBe('emergency_paged')
    })

    it('a hand-off raises one high-priority task however many times the AI asks', async () => {
      const call = await startInboundCall(prisma, { providerCallId: `CA${uniqueKey('ho')}`, provider: 'recording', from: HOUSEHOLDS[11].phone, to: '+15125550100', answeredBy: 'ai_agent', startedAt: NOW })
      const a = await handoffToHuman(prisma, agent, { callId: call.callId, reason: 'billing question', idempotencyKey: uniqueKey('ho') })
      const b = await handoffToHuman(prisma, agent, { callId: call.callId, reason: 'billing question again', idempotencyKey: uniqueKey('ho') })
      expect(a.taskId).toBe(b.taskId)
      expect(await prisma.task.findUniqueOrThrow({ where: { id: a.taskId } })).toMatchObject({ priority: 'high', status: 'open', kind: 'call.handoff' })
      expect((await prisma.call.findUniqueOrThrow({ where: { id: call.callId } })).status).toBe('handoff_requested')
    })
  })

  describe('dispatch', () => {
    it('a reassign race: two dispatchers on the same version, exactly one STALE_STATE', { timeout: 60_000 }, async () => {
      const booked = await book('AC-TUNE', '12–2 PM', 12)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_morrison'], idempotencyKey: uniqueKey('a'), now: NOW })
      const scheduled = await visitOf(v.id)
      const outcomes = await Promise.all([
        code(assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: scheduled.version, employeeIds: ['seed_emp_chu'], idempotencyKey: uniqueKey('r1'), now: NOW })),
        code(assignVisit(prisma, owner, { visitId: v.id, expectedVersion: scheduled.version, employeeIds: ['seed_emp_alvarez'], idempotencyKey: uniqueKey('r2'), now: NOW })),
      ])
      expect([...outcomes].sort()).toEqual(['OK', Codes.STALE_STATE].sort())
      expect(await prisma.visitAssignment.count({ where: { visitId: v.id, active: true } })).toBe(1)
    })

    it('an ineligible tech is refused with findings, and nothing is assigned', { timeout: 60_000 }, async () => {
      const booked = await book('AC-DIAG', '12–2 PM', 13)
      const v = await visitOf(booked.visitId)
      // Brandon holds EPA Type I only: no refrigerant work on a split system.
      const check = await checkEligibility(prisma, dispatcher, { visitId: v.id, employeeIds: ['seed_emp_lee'] })
      expect(check.eligible).toBe(false)
      expect(check.perEmployee.seed_emp_lee.findings.map(f => f.code)).toContain('LICENSE_MISSING')
      let refusal: DomainError | null = null
      try {
        await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_lee'], idempotencyKey: uniqueKey('a'), now: NOW })
      } catch (e) {
        refusal = e as DomainError
      }
      expect(refusal?.code).toBe(Codes.NOT_ELIGIBLE)
      expect(refusal?.message).toContain('LICENSE_MISSING')
      expect((refusal?.details.problems as string[]).join(' ')).toMatch(/epa608_type_ii/)
      expect(await prisma.visitAssignment.count({ where: { visitId: v.id } })).toBe(0)
      expect((await visitOf(v.id)).status).toBe('unassigned')
      // A plumber can't do HVAC; an apprentice plumber needs a licensed plumber on the visit.
      expect((await checkEligibility(prisma, dispatcher, { visitId: v.id, employeeIds: ['seed_emp_castillo'] })).eligible).toBe(false)
      const leak = await book('LEAK-REP', '12–2 PM', 14)
      const solo = await checkEligibility(prisma, dispatcher, { visitId: leak.visitId, employeeIds: ['seed_emp_harris'] })
      expect(solo.eligible).toBe(false)
      expect(solo.crewFindings.map(f => f.code)).toContain('SUPERVISOR_REQUIRED')
      expect((await checkEligibility(prisma, dispatcher, { visitId: leak.visitId, employeeIds: ['seed_emp_castillo', 'seed_emp_harris'] })).eligible).toBe(true)
    })

    it('recommends eligible techs first with reasons, records the decision, and freezes the recommendation', { timeout: 60_000 }, async () => {
      const booked = await book('AC-DIAG', '12–2 PM', 15)
      const rec = await recommendDispatch(prisma, agent, { visitId: booked.visitId, idempotencyKey: uniqueKey('rec'), now: NOW })
      const ranked = rec.candidates
      expect(ranked.length).toBeGreaterThan(0)
      const firstIneligible = ranked.findIndex(c => !c.eligible)
      if (firstIneligible >= 0) expect(ranked.slice(firstIneligible).every(c => !c.eligible)).toBe(true)
      expect(ranked[0].eligible).toBe(true)
      expect(ranked.every(c => c.explanation.length > 0)).toBe(true)
      expect(ranked.find(c => c.employeeId === 'seed_emp_lee')?.eligible).toBe(false)
      // The agent may fill an unassigned visit (dispatch.apply grant) with the top pick.
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, agent, { visitId: v.id, expectedVersion: v.version, employeeIds: [ranked[0].employeeId], recommendationId: rec.recommendationId, idempotencyKey: uniqueKey('apply'), now: NOW })
      const stored = await prisma.dispatchRecommendation.findUniqueOrThrow({ where: { id: rec.recommendationId } })
      expect(stored.decision).toBe('applied')
      // Frozen: the database refuses an edit to the ranking, a second decision, or a delete.
      await expect(prisma.dispatchRecommendation.update({ where: { id: stored.id }, data: { inputsHash: 'x' } })).rejects.toThrow()
      await expect(prisma.dispatchRecommendation.update({ where: { id: stored.id }, data: { decision: 'overridden' } })).rejects.toThrow()
      await expect(prisma.dispatchRecommendation.delete({ where: { id: stored.id } })).rejects.toThrow()
    })

    it('a double-booking needs an override reason', { timeout: 60_000 }, async () => {
      const a = await book('AC-TUNE', '2–4 PM', 16)
      const b = await book('HEAT-TUNE', '2–4 PM', 17)
      const va = await visitOf(a.visitId)
      const vb = await visitOf(b.visitId)
      await assignVisit(prisma, dispatcher, { visitId: va.id, expectedVersion: va.version, employeeIds: ['seed_emp_chu'], idempotencyKey: uniqueKey('a'), now: NOW })
      expect(await code(assignVisit(prisma, dispatcher, { visitId: vb.id, expectedVersion: vb.version, employeeIds: ['seed_emp_chu'], idempotencyKey: uniqueKey('a'), now: NOW }))).toBe(Codes.SCHEDULE_CONFLICT)
      expect(await code(assignVisit(prisma, dispatcher, { visitId: vb.id, expectedVersion: vb.version, employeeIds: ['seed_emp_chu'], overrideReason: 'Same street, quick tune-up', idempotencyKey: uniqueKey('a'), now: NOW }))).toBe('OK')
    })
  })

  describe('visit and job state machines', () => {
    it('scheduled → dispatched → en route → on site → working → done, and the job follows', { timeout: 120_000 }, async () => {
      const booked = await book('DRAIN-CLR', '10 AM–12 PM', 18)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_patel'], idempotencyKey: uniqueKey('a'), now: NOW })
      expect((await prisma.job.findUniqueOrThrow({ where: { id: booked.jobId } })).status).toBe('scheduled')
      const techNina = userActor('seed_user_patel', ['canAccessDashboard', 'canWorkVisits'])
      // Only a dispatcher dispatches; another tech can't touch Nina's visit.
      expect(await code(setVisitStatus(prisma, techNina, { visitId: v.id, to: 'dispatched', idempotencyKey: uniqueKey('s') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(setVisitStatus(prisma, techJake, { visitId: v.id, to: 'en_route', idempotencyKey: uniqueKey('s') }))).toBe(Codes.NOT_AUTHORIZED)
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'dispatched', idempotencyKey: uniqueKey('s'), now: NOW })
      expect(await code(setVisitStatus(prisma, techNina, { visitId: v.id, to: 'done', idempotencyKey: uniqueKey('s') }))).toBe(Codes.INVALID_TRANSITION)
      for (const to of ['en_route', 'on_site', 'working', 'done']) await setVisitStatus(prisma, techNina, { visitId: v.id, to, deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: NOW })
      expect((await visitOf(v.id)).status).toBe('done')
      expect((await prisma.job.findUniqueOrThrow({ where: { id: booked.jobId } })).status).toBe('in_progress')
      const events = await prisma.visitStatusEvent.findMany({ where: { visitId: v.id }, orderBy: { createdAt: 'asc' }, select: { toStatus: true } })
      expect(events.map(e => e.toStatus)).toEqual(['scheduled', 'dispatched', 'en_route', 'on_site', 'working', 'done'])
      // The history is append-only.
      await expect(prisma.visitStatusEvent.updateMany({ where: { visitId: v.id }, data: { note: 'edited' } })).rejects.toThrow()
      await expect(prisma.visitStatusEvent.deleteMany({ where: { visitId: v.id } })).rejects.toThrow()
    })

    it('a required checklist blocks done until it is filled in', { timeout: 60_000 }, async () => {
      const booked = await book('AC-TUNE', '8–10 AM', 19)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_alvarez'], idempotencyKey: uniqueKey('a'), now: NOW })
      for (const to of ['dispatched', 'en_route', 'on_site', 'working']) await setVisitStatus(prisma, dispatcher, { visitId: v.id, to, idempotencyKey: uniqueKey('s'), now: NOW })
      expect(await code(setVisitStatus(prisma, techSofia, { visitId: v.id, to: 'done', idempotencyKey: uniqueKey('s'), now: NOW }))).toBe(Codes.GUARD_FAILED)
      const answers = { thermostat: 'Set 72, calling', filter: 'Replaced 16x25x1', pressures: '118/325', delta_t: '19 F', condensate: 'Clear' }
      // Only the assigned tech (or dispatch) fills it in, every item answered; agents never do.
      expect(await code(submitChecklist(prisma, agent, { visitId: v.id, answers, idempotencyKey: uniqueKey('c') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(submitChecklist(prisma, techJake, { visitId: v.id, answers, idempotencyKey: uniqueKey('c') }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(submitChecklist(prisma, techSofia, { visitId: v.id, answers: { ...answers, delta_t: ' ' }, idempotencyKey: uniqueKey('c') }))).toBe(Codes.INVALID_INPUT)
      const key = uniqueKey('c')
      await submitChecklist(prisma, techSofia, { visitId: v.id, answers, idempotencyKey: key, now: NOW })
      expect(await submitChecklist(prisma, techSofia, { visitId: v.id, answers, idempotencyKey: key, now: NOW })).toMatchObject({ replay: true })
      expect(await prisma.checklistResponse.count({ where: { visitId: v.id } })).toBe(1)
      expect(await code(setVisitStatus(prisma, techSofia, { visitId: v.id, to: 'done', idempotencyKey: uniqueKey('s'), now: NOW }))).toBe('OK')
    })

    it('a duplicate device event is ignored; a late one is kept as a correction for review', { timeout: 60_000 }, async () => {
      const booked = await book('ELEC-DIAG', '2–4 PM', 20)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_bennett'], idempotencyKey: uniqueKey('a'), now: NOW })
      const grace = userActor('seed_user_bennett', ['canAccessDashboard', 'canWorkVisits'])
      const enRoute = uniqueKey('dev')
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'dispatched', idempotencyKey: uniqueKey('s'), now: NOW })
      await setVisitStatus(prisma, grace, { visitId: v.id, to: 'en_route', deviceEventKey: enRoute, idempotencyKey: uniqueKey('s'), now: NOW })
      await setVisitStatus(prisma, grace, { visitId: v.id, to: 'on_site', deviceEventKey: uniqueKey('dev'), idempotencyKey: uniqueKey('s'), now: NOW })
      // The phone retries the en-route event (same device key): a no-op.
      expect(await setVisitStatus(prisma, grace, { visitId: v.id, to: 'en_route', deviceEventKey: enRoute, idempotencyKey: uniqueKey('s'), now: NOW })).toMatchObject({ duplicate: true, status: 'on_site' })
      // A queued "en route" from the other phone arrives after on-site: a correction, not a move back.
      expect(await setVisitStatus(prisma, grace, { visitId: v.id, to: 'en_route', deviceEventKey: uniqueKey('dev'), clientRecordedAt: NOW.toISOString(), idempotencyKey: uniqueKey('s'), now: NOW })).toMatchObject({ correction: true, status: 'on_site' })
      expect(await visitOf(v.id)).toMatchObject({ status: 'on_site', needsReview: true })
      expect(await prisma.visitStatusEvent.count({ where: { visitId: v.id, kind: 'correction' } })).toBe(1)
      // Without a device key, a backwards move is simply refused.
      expect(await code(setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'en_route', idempotencyKey: uniqueKey('s'), now: NOW }))).toBe(Codes.INVALID_TRANSITION)
    })

    it('no access puts the job on hold with a call-back task; cancelling a job frees its window', { timeout: 60_000 }, async () => {
      const booked = await book('LEAK-REP', '8–10 AM', 21)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_castillo'], idempotencyKey: uniqueKey('a'), now: NOW })
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'en_route', idempotencyKey: uniqueKey('s'), now: NOW })
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'on_site', idempotencyKey: uniqueKey('s'), now: NOW })
      expect(await code(setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'no_access', idempotencyKey: uniqueKey('s'), now: NOW }))).toBe(Codes.INVALID_INPUT)
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'no_access', reason: 'Knocked, called twice, texted', idempotencyKey: uniqueKey('s'), now: NOW })
      expect(await prisma.job.findUniqueOrThrow({ where: { id: booked.jobId } })).toMatchObject({ status: 'on_hold', holdReason: 'access' })
      expect(await prisma.task.count({ where: { kind: 'job.no_access', subjectId: booked.jobId } })).toBe(1)

      const c = await book('PANEL-EST', '2–4 PM', 22)
      const { window: before } = await windowFor('PANEL-EST', '2–4 PM')
      const cj = await prisma.job.findUniqueOrThrow({ where: { id: c.jobId } })
      expect(await code(cancelJob(prisma, csr, { jobId: cj.id, expectedVersion: cj.version, reason: 'changed my mind', idempotencyKey: uniqueKey('c'), now: NOW }))).toBe(Codes.INVALID_INPUT)
      await cancelJob(prisma, csr, { jobId: cj.id, expectedVersion: cj.version, reason: 'customer_request', idempotencyKey: uniqueKey('c'), now: NOW })
      const { window: after } = await windowFor('PANEL-EST', '2–4 PM')
      expect(Number.parseInt(hours(before.bookedHours), 10) - Number.parseInt(hours(after.bookedHours), 10)).toBe(1)
      expect((await visitOf(c.visitId)).status).toBe('cancelled')
      expect(await prisma.capacityUsage.count({ where: { visitId: c.visitId } })).toBe(0)
      // A cancelled job stays cancelled.
      expect(await code(cancelJob(prisma, csr, { jobId: cj.id, expectedVersion: cj.version + 1, reason: 'duplicate', idempotencyKey: uniqueKey('c'), now: NOW }))).toBe(Codes.INVALID_TRANSITION)
    })
  })

  describe('leads', () => {
    it('ingest dedupes, starts the response clock, and moves new → contacted → qualified → booked', { timeout: 60_000 }, async () => {
      const a = await ingestLead(prisma, csr, { source: 'lsa', externalId: 'lsa-123', contactName: 'Pat Doe', phone: '512-555-0077', summary: 'water heater leaking', idempotencyKey: uniqueKey('l'), now: NOW })
      expect(a.duplicate).toBe(false)
      expect(await ingestLead(prisma, csr, { source: 'lsa', externalId: 'lsa-123', phone: '512-555-0077', idempotencyKey: uniqueKey('l'), now: NOW })).toMatchObject({ leadId: a.leadId, duplicate: true })
      expect(await ingestLead(prisma, csr, { source: 'web_form', phone: '+15125550077', idempotencyKey: uniqueKey('l'), now: new Date(NOW.getTime() + 60_000) })).toMatchObject({ leadId: a.leadId, duplicate: true })
      let lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.leadId } })
      expect(lead.respondDueAt?.getTime()).toBe(NOW.getTime() + 5 * 60_000)
      await markLeadContacted(prisma, csr, { leadId: lead.id, expectedVersion: lead.version, idempotencyKey: uniqueKey('c'), now: new Date(NOW.getTime() + 90_000) })
      lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.leadId } })
      expect(lead).toMatchObject({ status: 'contacted', firstResponseSeconds: 90 })
      expect(await code(qualifyLead(prisma, csr, { leadId: lead.id, expectedVersion: lead.version - 1, requestedJobTypeId: 'seed_jt_wh_diag', postalCode: '78704', idempotencyKey: uniqueKey('q') }))).toBe(Codes.STALE_STATE)
      expect(await code(qualifyLead(prisma, csr, { leadId: lead.id, expectedVersion: lead.version, requestedJobTypeId: 'seed_jt_wh_diag', postalCode: '78666', idempotencyKey: uniqueKey('q') }))).toBe(Codes.OUT_OF_AREA)
      await qualifyLead(prisma, csr, { leadId: lead.id, expectedVersion: lead.version, requestedJobTypeId: 'seed_jt_wh_diag', postalCode: '78704', idempotencyKey: uniqueKey('q') })
      const { windowId } = await windowFor('WH-DIAG', '2–4 PM')
      const job = await bookJob(prisma, csr, { windowId, jobTypeId: 'seed_jt_wh_diag', leadId: lead.id, customer: { firstName: 'Pat', lastName: 'Doe', phone: '512-555-0077' }, location: { address1: '12 Bluebonnet Ln', city: 'Austin', postalCode: '78704' }, smsConsent: true, idempotencyKey: uniqueKey('b'), now: NOW })
      const booked = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(booked).toMatchObject({ status: 'booked', jobId: job.jobId, customerId: job.customerId })
      // The new customer's yes to booking texts is on file.
      const point = await prisma.contactPoint.findFirstOrThrow({ where: { contact: { customerId: job.customerId }, kind: 'mobile' } })
      expect(await effectiveConsent(prisma, point.id)).toMatchObject({ transactional_sms: 'grant' })
      // Lost is not reachable from booked.
      expect(await code(loseLead(prisma, csr, { leadId: lead.id, expectedVersion: booked.version, reason: 'price', idempotencyKey: uniqueKey('x') }))).toBe(Codes.INVALID_TRANSITION)
    })

  })

  describe('messaging: consent and STOP', () => {
    it('STOP revokes booking and marketing texts; a repeat is harmless; START restores booking texts only', { timeout: 60_000 }, async () => {
      const h = HOUSEHOLDS[25]
      const stop = await receiveInboundSms(prisma, { from: h.phone, to: '+15125550100', body: ' Stop ', providerMessageId: `SM${uniqueKey('in')}` })
      expect(stop.keyword).toBe('stop')
      expect(await prisma.dncEntry.count({ where: { source: 'sms_stop' } })).toBe(2) // the seeded opt-out and this one
      // Carriers resend; a second STOP and a replayed webhook are both harmless.
      const again = { from: h.phone, to: '+15125550100', body: 'STOP', providerMessageId: `SM${uniqueKey('in')}` }
      await receiveInboundSms(prisma, again)
      expect(await receiveInboundSms(prisma, again)).toMatchObject({ duplicate: true })
      expect(await prisma.dncEntry.count({ where: { source: 'sms_stop' } })).toBe(2)
      const point = await prisma.contactPoint.findFirstOrThrow({ where: { contact: { customerId: h.id }, kind: 'mobile' } })
      expect(await effectiveConsent(prisma, point.id)).toMatchObject({ transactional_sms: 'revoke', marketing_sms: 'revoke' })
      await receiveInboundSms(prisma, { from: h.phone, to: '+15125550100', body: 'START', providerMessageId: `SM${uniqueKey('in')}` })
      expect(await effectiveConsent(prisma, point.id)).toMatchObject({ transactional_sms: 'grant', marketing_sms: 'revoke' })
      expect(await prisma.dncEntry.count({ where: { source: 'sms_stop' } })).toBe(1)
    })
  })

  describe('access codes and credentials', () => {
    it('the assigned tech sees a gate code once dispatched, an office reveal needs a reason, and every reveal is logged', { timeout: 60_000 }, async () => {
      const h = HOUSEHOLDS[26]
      const stored = await storeAccessSecret(prisma, csr, { locationId: h.location.id, kind: 'gate_code', label: 'Side gate', secret: '#4512', idempotencyKey: uniqueKey('s') })
      const receipts = await prisma.commandReceipt.findMany({ where: { command: 'access_secret.store' } })
      expect(JSON.stringify(receipts)).not.toContain('4512')
      expect(JSON.stringify(await prisma.accessSecret.findUniqueOrThrow({ where: { id: stored.accessSecretId } }))).not.toContain('4512')
      const booked = await book('AC-TUNE', '10 AM–12 PM', 26)
      const v = await visitOf(booked.visitId)
      await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_morrison'], idempotencyKey: uniqueKey('a'), now: NOW })
      expect(await code(revealAccessSecret(prisma, techJake, { accessSecretId: stored.accessSecretId, visitId: v.id }))).toBe(Codes.GUARD_FAILED)
      expect(await code(revealAccessSecret(prisma, techSofia, { accessSecretId: stored.accessSecretId, visitId: v.id }))).toBe(Codes.NOT_AUTHORIZED)
      expect(await code(revealAccessSecret(prisma, agent, { accessSecretId: stored.accessSecretId, visitId: v.id }))).toBe(Codes.NOT_AUTHORIZED)
      await setVisitStatus(prisma, dispatcher, { visitId: v.id, to: 'dispatched', idempotencyKey: uniqueKey('s'), now: NOW })
      expect((await revealAccessSecret(prisma, techJake, { accessSecretId: stored.accessSecretId, visitId: v.id })).value).toBe('#4512')
      expect(await code(revealAccessSecret(prisma, dispatcher, { accessSecretId: stored.accessSecretId, visitId: v.id }))).toBe(Codes.INVALID_INPUT)
      await revealAccessSecret(prisma, dispatcher, { accessSecretId: stored.accessSecretId, visitId: v.id, reason: 'Tech phone died' })
      expect(await prisma.accessSecretReveal.count({ where: { secretId: stored.accessSecretId } })).toBe(2)
      await expect(prisma.accessSecretReveal.deleteMany({ where: { secretId: stored.accessSecretId } })).rejects.toThrow()
    })

    it('a credential is verified by a person other than its holder', async () => {
      const cred = await prisma.credential.findFirstOrThrow({ where: { employeeId: 'seed_emp_haddad', status: 'pending_verification' } })
      const omar = userActor('seed_user_haddad', ['canAccessDashboard', 'canManagePeople'])
      expect(await code(verifyCredential(prisma, omar, { credentialId: cred.id, expectedVersion: cred.version, idempotencyKey: uniqueKey('v') }))).toBe(Codes.NOT_AUTHORIZED)
      const gm = userActor('seed_user_ortega', ['canAccessDashboard', 'canManagePeople'])
      await verifyCredential(prisma, gm, { credentialId: cred.id, expectedVersion: cred.version, idempotencyKey: uniqueKey('v') })
      expect(await prisma.credential.findUniqueOrThrow({ where: { id: cred.id } })).toMatchObject({ status: 'verified', verifiedById: 'seed_user_ortega' })
      // The database refuses a verified credential without a verifier.
      await expect(prisma.credential.update({ where: { id: cred.id }, data: { verifiedById: null } })).rejects.toThrow()
    })
  })

  it('unassigning needs a reason and returns the visit to the board', { timeout: 60_000 }, async () => {
    const booked = await book('HEAT-DIAG', '8–10 AM', 27)
    const v = await visitOf(booked.visitId)
    await assignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: v.version, employeeIds: ['seed_emp_morrison'], idempotencyKey: uniqueKey('a'), now: NOW })
    const s = await visitOf(v.id)
    expect(await code(unassignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: s.version, reason: ' ', idempotencyKey: uniqueKey('u') }))).toBe(Codes.INVALID_INPUT)
    await unassignVisit(prisma, dispatcher, { visitId: v.id, expectedVersion: s.version, reason: 'Jake out sick', idempotencyKey: uniqueKey('u') })
    expect((await visitOf(v.id)).status).toBe('unassigned')
    expect(await prisma.visitAssignment.count({ where: { visitId: v.id, active: true } })).toBe(0)
  })

  it('database guards: one active lead per visit, capacity never negative, holds have one holder', async () => {
    const booked = await book('HEAT-TUNE', '10 AM–12 PM', 28)
    await prisma.visitAssignment.create({ data: { visitId: booked.visitId, employeeId: 'seed_emp_chu', role: 'lead', active: true, assignedAt: NOW } })
    await expect(prisma.visitAssignment.create({ data: { visitId: booked.visitId, employeeId: 'seed_emp_morrison', role: 'lead', active: true, assignedAt: NOW } })).rejects.toThrow()
    const { windowId } = await windowFor('HEAT-TUNE', '10 AM–12 PM')
    await expect(prisma.arrivalWindow.update({ where: { id: windowId }, data: { bookedHours: '-1' } })).rejects.toThrow()
    await expect(prisma.bookingHold.create({ data: { publicCode: uniqueKey('HLD'), windowId, jobTypeId: 'seed_jt_heat_tune', hours: '1.5', source: 'csr', heldByUserId: 'seed_user_raman', heldByAgentId: agent.agentId, expiresAt: NOW, status: 'held' } })).rejects.toThrow()
  })

  it('the audit chain is intact after everything above', { timeout: 120_000 }, async () => {
    expect((await verifyAuditChain(prisma)).ok).toBe(true)
  })
})
