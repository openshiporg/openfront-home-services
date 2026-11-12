import type { Db } from '../lib/db'
import type { Actor } from '../lib/actor'
import { dayAt } from '../domain/membershipTime'
import { addDays } from '../lib/calendar'
import { activatePlanVersion, createPlan, sellMembership } from '../services/memberships'
import { activateAgreement, saveAgreement } from '../services/agreements'
import { HOUSEHOLDS, COMMERCIAL } from './operationsData'

const CLUB_WORDING = 'I agree that my Comfort Club membership renews every year for $199.00, charged to my card on file on the day after my term ends, until I cancel online or by phone. I can cancel at any time.'

/**
 * Membership sample data, through the real services: two plans, members at different points in their term,
 * and a quarterly service agreement for a property manager. Nothing is charged here: the first payments
 * wait for a staff member to press "Run billing". Idempotent: fixed keys.
 */
export async function seedMemberships(db: Db, opts: { owner: Actor; prefix?: string; now?: Date }) {
  const prefix = opts.prefix ?? 'seed:memberships'
  const owner = opts.owner
  const out: Record<string, unknown> = {}
  const today = dayAt('America/Chicago', opts.now ?? new Date())

  const club = await createPlan(db, owner, {
    name: 'Comfort Club', code: 'comfort-club', description: 'Two seasonal tune-ups, priority booking and member prices on repairs.', idempotencyKey: `${prefix}:plan:club`,
    draft: {
      priceMinor: '19900', billingFrequency: 'annual', termMonths: 12, autoRenew: true, renewalNoticeDays: 30, consentWording: CLUB_WORDING, cancellationRefundMethod: 'prorata',
      entitlements: [
        { code: 'ac_tuneup', name: 'Spring air-conditioning tune-up', quantity: 1, visit: true, seasonStart: '03-01', seasonEnd: '06-15', rollover: 'none' },
        { code: 'heat_tuneup', name: 'Fall heating tune-up', quantity: 1, visit: true, seasonStart: '10-01', seasonEnd: '12-15', rollover: 'none' },
        { code: 'trip_fee', name: 'Waived trip fee on repair visits', quantity: 4, visit: false, rollover: 'one_term' },
      ],
      benefits: [{ title: 'Priority booking', text: 'Members are offered the first open arrival window.' }, { title: 'Member prices', text: 'Repairs are priced from the member column of the price book.' }],
    },
  })
  await activatePlanVersion(db, owner, { versionId: club.versionId, idempotencyKey: `${prefix}:plan:club:publish` })
  const flow = await createPlan(db, owner, {
    name: 'Plumbing Protection', code: 'plumbing-protection', description: 'An annual plumbing inspection and a water heater flush, paid monthly.', idempotencyKey: `${prefix}:plan:plumb`,
    draft: {
      priceMinor: '1500', billingFrequency: 'monthly', termMonths: 12, autoRenew: false, renewalNoticeDays: 30, cancellationRefundMethod: 'none',
      entitlements: [
        { code: 'plumbing_inspection', name: 'Whole-home plumbing inspection', quantity: 1, visit: true, rollover: 'none' },
        { code: 'heater_flush', name: 'Water heater flush', quantity: 1, visit: true, rollover: 'none' },
      ],
      benefits: [{ title: 'No overtime charge', text: 'Evening and weekend calls are billed at the regular rate.' }],
    },
  })
  await activatePlanVersion(db, owner, { versionId: flow.versionId, idempotencyKey: `${prefix}:plan:plumb:publish` })
  const winter = await createPlan(db, owner, {
    name: 'Winter Safety Check', code: 'winter-safety-check', description: 'A two-month cover: one heating safety inspection, renewed only if the customer asks.', idempotencyKey: `${prefix}:plan:winter`,
    draft: {
      priceMinor: '8900', billingFrequency: 'annual', termMonths: 2, autoRenew: false, renewalNoticeDays: 30, cancellationRefundMethod: 'full_within_days', cancellationRefundDays: 14,
      entitlements: [{ code: 'heat_safety', name: 'Heating safety inspection', quantity: 1, visit: true, rollover: 'none' }],
    },
  })
  await activatePlanVersion(db, owner, { versionId: winter.versionId, idempotencyKey: `${prefix}:plan:winter:publish` })
  out.plans = [club.planId, flow.planId, winter.planId]

  // Members, started at different points: a few signed this week, two on a two-month plan that end soon.
  const members = [
    { h: HOUSEHOLDS[0], plan: club.planId, startsOn: addDays(today, -2), auto: true },
    { h: HOUSEHOLDS[4], plan: winter.planId, startsOn: addDays(today, -7), auto: false },
    { h: HOUSEHOLDS[5], plan: flow.planId, startsOn: addDays(today, -6), auto: false },
    { h: HOUSEHOLDS[8], plan: winter.planId, startsOn: addDays(today, -6), auto: false },
    { h: HOUSEHOLDS[11], plan: flow.planId, startsOn: addDays(today, -5), auto: false },
  ]
  const sold: string[] = []
  for (const [i, m] of members.entries()) {
    try {
      const r = await sellMembership(db, owner, {
        customerId: m.h.id, locationId: m.h.location.id, planId: m.plan, startsOn: m.startsOn, channel: i % 2 ? 'phone' : 'office', paymentMethodRef: `pm_card_visa`, paymentMethodLabel: 'Visa ending 4242',
        ...(m.auto ? { autoRenew: true, consent: { confirmed: true, wording: CLUB_WORDING, how: 'phone_recorded' as const, note: 'Agreed on the call and read the wording back.' } } : { autoRenew: false }),
        idempotencyKey: `${prefix}:sell:${i + 1}`,
      })
      sold.push(r.membershipId)
    } catch (e) {
      out[`member${i + 1}`] = e instanceof Error ? e.message : 'skipped'
    }
  }
  out.members = sold.length

  // A quarterly rooftop-unit agreement for the property manager.
  const agreement = await saveAgreement(db, owner, {
    name: 'Quarterly rooftop unit service', customerId: COMMERCIAL.id, locationId: COMMERCIAL.location.id, startsOn: addDays(today, -30), endsOn: addDays(today, 335),
    scope: 'Filter change, belts, coil clean and a full safety check on the three rooftop units, every quarter.', visitMonths: [3, 6, 9, 12], poNumber: 'PO-HCPM-2026-114', nteMinor: '450000', idempotencyKey: `${prefix}:agreement`,
  })
  await activateAgreement(db, owner, { agreementId: agreement.agreementId, idempotencyKey: `${prefix}:agreement:start` })
  out.agreement = agreement.agreementId
  return out
}
