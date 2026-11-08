/**
 * `npm run seed`: load Summit Plumbing & Air into the database named by DATABASE_URL.
 *
 * Create the owner first at /dashboard/init (Dana Whitfield, dana.whitfield@summitplumbingair.com);
 * the seeded staff list then skips her and every other seeded person signs in after a reset.
 *
 * 1. The company spine and operations, through the same idempotent steps as the onboarding cards.
 * 2. The price book's history (v1-v3 published by the owner after the general manager submitted each,
 *    and a v4 draft with a supplier cost import).
 * 3. A first working day (the next day with open arrival windows), through the same services the
 *    dashboard and the AI receptionist call: inbound leads, office bookings, one recorded AI call
 *    that books, one caller handed to a person, and the dispatcher's assignments.
 * 4. Estimates on that work: a replacement presented with good/better/best, an add-on sold at the
 *    customer's home with its notice of cancellation delivered, a declined estimate, and a draft.
 *
 * Every step has a fixed idempotency key, so a second run replays and creates nothing.
 */
import { PrismaClient } from '@prisma/client'
import { permissionNames, type Permission } from '../features/keystone/access'
import { systemActor, type Actor } from '../features/keystone/lib/actor'
import { command } from '../features/keystone/lib/command'
import { localDate } from '../features/keystone/lib/calendar'
import { seedCompanyPlatform } from '../features/keystone/seed/platform'
import { seedOperations } from '../features/keystone/seed/operations'
import { seedPriceBook } from '../features/keystone/seed/pricebook'
import { seedSales } from '../features/keystone/seed/sales'
import { ROLES } from '../features/keystone/seed/company'
import { HOUSEHOLDS } from '../features/keystone/seed/operationsData'
import { availableWindows, bookJob, holdWindow, materializeWindows } from '../features/keystone/services/booking'
import { assignVisit, recommendDispatch } from '../features/keystone/services/dispatch'
import { completeCall, handoffToHuman, ingestLead, matchJobType, startInboundCall } from '../features/keystone/services/crm'

const TZ = { timeZone: 'America/Chicago' }
const RECEPTIONIST_TOOLS = ['customer.lookup', 'location.lookup', 'customer.history', 'jobtype.match', 'capacity.windows', 'booking.hold', 'booking.release', 'booking.confirm', 'consent.record', 'handoff.to_human', 'page.on_call', 'dispatch.recommend', 'dispatch.eligibility']

function staffActor(userId: string, name: string, roleId: string): Actor {
  const role = ROLES.find(r => r.id === roleId)
  if (!role) throw new Error(`Unknown role ${roleId}`)
  return { kind: 'user', userId, name, permissions: new Set<Permission>(role.permissions.filter(p => permissionNames.includes(p))) }
}

async function step(name: string, work: () => Promise<unknown>) {
  const started = Date.now()
  const value = await work()
  console.log(`${name.padEnd(22)} ${String(Date.now() - started).padStart(6)} ms  ${JSON.stringify(value).slice(0, 160)}`)
  return value
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database.')
  const prisma = new PrismaClient({ log: [] })
  const system = systemActor('seed')
  try {
    await step('company', async () => (await command(prisma, { name: 'setup.load_company', actor: system, idempotencyKey: 'seed:company', params: {} }, uow => seedCompanyPlatform(uow, system))).value)
    await step('operations', async () => (await command(prisma, { name: 'setup.load_operations', actor: system, idempotencyKey: 'seed:operations', params: {} }, uow => seedOperations(uow, system))).value)
    const today = localDate(TZ, new Date())
    await step('windows', () => materializeWindows(prisma, system, { from: today, days: 21, idempotencyKey: `seed:windows:${today}` }))

    // The owner who set up the receptionist: the person who created the account, or the seeded owner.
    const ownerUser = await prisma.user.findFirst({ where: { OR: [{ email: 'dana.whitfield@summitplumbingair.com' }, { id: 'seed_user_whitfield' }] }, select: { id: true } })
    if (!ownerUser) throw new Error('No owner account found.')
    const OWNER_ID = ownerUser.id

    // The receptionist the owner set up, with the receptionist's grants (no dispatch.apply: people assign).
    const receptionist = await prisma.agentIdentity.upsert({ where: { name: 'Summit receptionist' }, update: {}, create: { name: 'Summit receptionist', kind: 'llm_agent', ownerId: OWNER_ID, status: 'active' } })
    const granted = new Set((await prisma.agentScopeGrant.findMany({ where: { agentId: receptionist.id, status: 'active' }, select: { tool: true } })).map(g => g.tool))
    const missing = RECEPTIONIST_TOOLS.filter(tool => !granted.has(tool))
    if (missing.length) await prisma.agentScopeGrant.createMany({ data: missing.map(tool => ({ agentId: receptionist.id, tool, autonomy: 'auto_within_policy', status: 'active', grantedById: OWNER_ID, effectiveFrom: new Date() })) })
    const agent: Actor = { kind: 'agent', agentId: receptionist.id, ownerUserId: OWNER_ID, name: receptionist.name, scopes: new Set(RECEPTIONIST_TOOLS) }

    // The price book: the general manager drafts each version and the owner approves it (maker-checker).
    const gm = staffActor('seed_user_ortega', 'Marcus Ortega', 'seed_role_gm')
    const owner = staffActor(OWNER_ID, 'Dana Whitfield', 'seed_role_owner')
    await step('price book', () => seedPriceBook(prisma, { maker: gm, checker: owner }))

    if (await prisma.job.count()) {
      console.log('activity               skipped: the company already has jobs')
      await step('sales', () => seedSales(prisma, { owner }))
      return
    }

    const csr = staffActor('seed_user_raman', 'Priya Raman', 'seed_role_csr')
    const dispatcher = staffActor('seed_user_brooks', 'Andre Brooks', 'seed_role_dispatcher')
    const firstOpen = async (jobTypeId: string, postalCode: string) => {
      const offer = await availableWindows(prisma, csr, { jobTypeId, postalCode, from: localDate(TZ, new Date(Date.now() + 86_400_000)), days: 14 })
      if (!offer.windows.length) throw new Error(`No open window for ${jobTypeId} in ${postalCode}`)
      return offer.windows
    }

    // Inbound leads waiting for the office.
    const leads = [
      { source: 'web_form', h: HOUSEHOLDS[40], summary: 'Water heater is making a popping noise and the water runs lukewarm.', jobTypeId: 'seed_jt_wh_diag', campaignId: null },
      { source: 'lsa', h: HOUSEHOLDS[41], summary: 'Would like a quote to replace a 15-year-old AC and furnace.', jobTypeId: 'seed_jt_hvac_est', campaignId: 'seed_campaign_lsa' },
      { source: 'web_form', h: HOUSEHOLDS[42], summary: 'Asking about a Level 2 charger for a new EV in the garage.', jobTypeId: 'seed_jt_ev', campaignId: null },
    ]
    for (const [i, l] of leads.entries()) {
      await step(`lead ${i + 1}`, () => ingestLead(prisma, system, { source: l.source, externalId: `seed-lead-${i + 1}`, campaignId: l.campaignId, contactName: l.h.displayName, phone: l.h.phone, email: l.h.email, summary: l.summary, requestedJobTypeId: l.jobTypeId, postalCode: l.h.location.postalCode, idempotencyKey: `seed:lead:${i + 1}` }))
    }

    // The office books the day's work.
    const bookings = [
      { h: HOUSEHOLDS[0], jobTypeId: 'seed_jt_drain', summary: 'Kitchen sink drains slowly and backs up into the other side.', slot: 0 },
      { h: HOUSEHOLDS[4], jobTypeId: 'seed_jt_heat_diag', summary: 'Furnace runs but blows cold air upstairs.', slot: 1 },
      { h: HOUSEHOLDS[5], jobTypeId: 'seed_jt_leak', summary: 'Water stain spreading on the ceiling under the upstairs bathroom.', slot: 1 },
      { h: HOUSEHOLDS[8], jobTypeId: 'seed_jt_elec_diag', summary: 'Two bedroom outlets and the ceiling fan stopped working.', slot: 0 },
      { h: HOUSEHOLDS[11], jobTypeId: 'seed_jt_ac_tune', summary: 'Seasonal cooling tune-up before a home sale.', slot: 2 },
      { h: HOUSEHOLDS[14], jobTypeId: 'seed_jt_drain', summary: 'Main line gurgles when the washing machine drains.', slot: 2 },
    ]
    const visits: string[] = []
    for (const [i, b] of bookings.entries()) {
      const windows = await firstOpen(b.jobTypeId, b.h.location.postalCode)
      const day = windows[0].date
      const sameDay = windows.filter(w => w.date === day)
      const window = sameDay[Math.min(b.slot, sameDay.length - 1)]
      const booked = await step(`booking ${i + 1}`, () => bookJob(prisma, csr, { windowId: window.windowId, jobTypeId: b.jobTypeId, customerId: b.h.id, locationId: b.h.location.id, summary: b.summary, source: 'csr', idempotencyKey: `seed:book:${i + 1}` })) as { visitId: string }
      visits.push(booked.visitId)
    }

    // A recorded call: the AI receptionist matches the problem, holds a window and books it.
    const caller = HOUSEHOLDS[2]
    const startedAt = new Date(Date.now() - 40 * 60_000)
    const call = await step('ai call', () => startInboundCall(prisma, { providerCallId: 'seed-call-1', provider: 'recording', from: caller.phone, to: '+15125550190', answeredBy: 'ai_agent', recordingDisclosurePlayed: true, startedAt })) as { callId: string }
    const description = "My AC is blowing warm air and the thermostat says it's cooling"
    const match = await matchJobType(prisma, agent, { description, postalCode: caller.location.postalCode })
    const jobTypeId = match.matches[0]?.jobTypeId ?? 'seed_jt_ac_diag'
    const offer = await availableWindows(prisma, agent, { jobTypeId, postalCode: caller.location.postalCode, from: localDate(TZ, new Date(Date.now() + 86_400_000)), days: 14 })
    const pick = offer.windows.find(w => w.label.startsWith('12')) ?? offer.windows[0]
    const hold = await holdWindow(prisma, agent, { windowId: pick.windowId, jobTypeId, source: 'ai_agent', idempotencyKey: 'seed:ai:hold' })
    const aiBooked = await step('ai booking', () => bookJob(prisma, agent, { holdId: hold.holdId, jobTypeId, customerId: caller.id, locationId: caller.location.id, summary: 'AC is blowing warm air and the thermostat says it\'s cooling', smsConsent: true, consentEvidence: { callId: call.callId }, idempotencyKey: 'seed:ai:book' })) as { jobId: string; visitId: string; window: string }
    visits.push(aiBooked.visitId)
    await completeCall(prisma, {
      providerCallId: 'seed-call-1', provider: 'recording', endedAt: new Date(startedAt.getTime() + 4 * 60_000 + 12_000), disposition: 'booked', jobId: aiBooked.jobId,
      transcript: [
        { speaker: 'agent', text: 'Thanks for calling Summit Plumbing & Air. This call is recorded. How can I help?' },
        { speaker: 'caller', text: description },
        { speaker: 'agent', text: `I can send a technician ${aiBooked.window}. Shall I book that?` },
        { speaker: 'caller', text: 'Yes please, and text me when they are on the way.' },
      ],
    })

    // A caller with a billing question: the receptionist hands off to the office.
    const billing = HOUSEHOLDS[19]
    const billingCall = await step('handoff call', () => startInboundCall(prisma, { providerCallId: 'seed-call-2', provider: 'recording', from: billing.phone, to: '+15125550191', answeredBy: 'ai_agent', recordingDisclosurePlayed: true, startedAt: new Date(Date.now() - 12 * 60_000) })) as { callId: string }
    await handoffToHuman(prisma, agent, { callId: billingCall.callId, reason: 'billing_question', summary: "Caller asking about a charge on last month's invoice.", idempotencyKey: 'seed:handoff:1' })

    // The dispatcher assigns the top eligible technician to most visits and leaves two for the board.
    for (const [i, visitId] of visits.slice(0, 5).entries()) {
      const rec = await recommendDispatch(prisma, dispatcher, { visitId, idempotencyKey: `seed:recommend:${i + 1}` })
      const best = rec.candidates.find(c => c.eligible)
      if (!best) continue
      await step(`assign ${i + 1}`, () => assignVisit(prisma, dispatcher, { visitId, expectedVersion: rec.visitVersion, employeeIds: [best.employeeId], recommendationId: rec.recommendationId, idempotencyKey: `seed:assign:${i + 1}` }))
    }

    // Estimates on the booked work: presented, sold with a cancellation notice, declined, and an agent's draft.
    await step('sales', () => seedSales(prisma, { owner }))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
  process.exit(1)
})
