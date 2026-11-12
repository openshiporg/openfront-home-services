import { z } from 'zod'
import { authorizeOperation } from '../lib/agentGate'
import { actorAgentId, actorUserId, type Actor } from '../lib/actor'
import { auditCreate, casUpdate, lockRow } from '../lib/cas'
import { command } from '../lib/command'
import { addDays } from '../lib/calendar'
import type { Db, Tx } from '../lib/db'
import { Codes, DomainError } from '../lib/errors'
import { nextReference, publicCode } from '../lib/sequence'
import type { UnitOfWork } from '../lib/unitOfWork'
import type { Permission } from '../access'
import { resolvePolicyFromDb } from '../domain/policy'
import { dayAt, prorate, slotCount, slotDueDay, termDaysLeft, termEnd, termStart, windowFor, windowState, type Season } from '../domain/membershipTime'
import { asDate, companyToday, dayOf, money } from './billingShared'
import { placeOfLocation } from './salesShared'

/*
 * Memberships (STATE-MACHINES §10, SCHEMA §10). Nothing here runs on a timer: a season window, an expiry, a rollover, "due for
 * service" and "renewal coming" are worked out from the stored term dates and today's date whenever they are read.
 * Every change is a command with an idempotency key; the money side is in membershipBilling.ts.
 */

const MANAGE: Permission[] = ['canManageMemberships']
const SELL: Permission[] = ['canSellMemberships', 'canManageMemberships']

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')
const text = (v: unknown, field: string, min = 1, max = 400) => {
  const s = String(v ?? '').trim()
  if (s.length < min || s.length > max) throw new DomainError(Codes.INVALID_INPUT, min > 0 ? `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is needed.` : 'Too long.', { field })
  return s
}

// ── Plans ────────────────────────────────────────────────────────────────────────────────────────────────────────

const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'MM-DD')
export const entitlementSpec = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(2).max(80),
  quantity: z.number().int().min(1).max(12),
  /** A visit is something the crew comes out to do; the others are credits (a waived trip fee, a discount call). */
  visit: z.boolean().default(true),
  seasonStart: monthDay.nullish(),
  seasonEnd: monthDay.nullish(),
  rollover: z.enum(['none', 'one_term']).default('none'),
}).refine(e => (e.seasonStart == null) === (e.seasonEnd == null), 'A season needs both a start and an end.')
export type EntitlementSpec = z.infer<typeof entitlementSpec>
const benefitSpec = z.object({ title: z.string().min(2).max(80), text: z.string().min(2).max(240) })

export type PlanDraftInput = {
  name?: string; description?: string; priceMinor?: string; billingFrequency?: 'annual' | 'monthly'; termMonths?: number; autoRenew?: boolean
  renewalNoticeDays?: number; entitlements?: unknown; benefits?: unknown; cancellationRefundMethod?: 'none' | 'prorata' | 'full_within_days'; cancellationRefundDays?: number
  consentWording?: string
}

function draftData(input: PlanDraftInput) {
  const data: Record<string, unknown> = {}
  if (input.priceMinor !== undefined) {
    if (!/^\d{1,9}$/.test(String(input.priceMinor)) || BigInt(input.priceMinor) <= 0n) throw new DomainError(Codes.INVALID_INPUT, 'The price is whole cents, more than zero.', { field: 'priceMinor' })
    data.priceMinor = BigInt(input.priceMinor)
  }
  if (input.billingFrequency !== undefined) {
    if (!['annual', 'monthly'].includes(input.billingFrequency)) throw new DomainError(Codes.INVALID_INPUT, 'Billed annually or monthly.', { field: 'billingFrequency' })
    data.billingFrequency = input.billingFrequency
  }
  if (input.termMonths !== undefined) {
    if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 60) throw new DomainError(Codes.INVALID_INPUT, 'A term is 1 to 60 months.', { field: 'termMonths' })
    data.termMonths = input.termMonths
  }
  if (input.autoRenew !== undefined) data.autoRenew = !!input.autoRenew
  if (input.renewalNoticeDays !== undefined) {
    if (!Number.isInteger(input.renewalNoticeDays) || input.renewalNoticeDays < 0 || input.renewalNoticeDays > 120) throw new DomainError(Codes.INVALID_INPUT, 'Tell customers 0 to 120 days ahead.', { field: 'renewalNoticeDays' })
    data.renewalNoticeDays = input.renewalNoticeDays
  }
  if (input.entitlements !== undefined) {
    const parsed = z.array(entitlementSpec).max(20).safeParse(input.entitlements)
    if (!parsed.success) throw new DomainError(Codes.INVALID_INPUT, `What the plan includes is not valid: ${parsed.error.issues[0]?.message ?? 'check each line'}.`, { field: 'entitlements' })
    if (new Set(parsed.data.map(e => e.code)).size !== parsed.data.length) throw new DomainError(Codes.INVALID_INPUT, 'Each included item needs its own code.', { field: 'entitlements' })
    data.entitlements = parsed.data
  }
  if (input.benefits !== undefined) {
    const parsed = z.array(benefitSpec).max(12).safeParse(input.benefits)
    if (!parsed.success) throw new DomainError(Codes.INVALID_INPUT, 'Each benefit needs a title and a sentence.', { field: 'benefits' })
    data.benefits = parsed.data
  }
  if (input.cancellationRefundMethod !== undefined) {
    if (!['none', 'prorata', 'full_within_days'].includes(input.cancellationRefundMethod)) throw new DomainError(Codes.INVALID_INPUT, 'Choose how a cancellation is refunded.', { field: 'cancellationRefundMethod' })
    data.cancellationRefundMethod = input.cancellationRefundMethod
  }
  if (input.cancellationRefundDays !== undefined) {
    if (!Number.isInteger(input.cancellationRefundDays) || input.cancellationRefundDays < 0 || input.cancellationRefundDays > 365) throw new DomainError(Codes.INVALID_INPUT, 'The full-refund window is 0 to 365 days.', { field: 'cancellationRefundDays' })
    data.cancellationRefundDays = input.cancellationRefundDays
  }
  if (input.consentWording !== undefined) data.consentWording = String(input.consentWording).trim().slice(0, 1200)
  return data
}

export async function createPlan(db: Db, actor: Actor, args: { name: string; code: string; description?: string | null; draft?: PlanDraftInput | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.plan_create', MANAGE, args)
  const name = text(args.name, 'name', 3, 80)
  const code = String(args.code ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) throw new DomainError(Codes.INVALID_INPUT, 'The code is lower-case letters, digits and dashes.', { field: 'code' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.plan_create', actor, idempotencyKey, params, now: args.now }, async uow => {
    if (await uow.tx.membershipPlan.findUnique({ where: { code }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, 'A plan already uses that code.', { field: 'code' })
    const plan = await uow.tx.membershipPlan.create({ data: { name, code, description: args.description?.trim() ?? '' }, select: { id: true } })
    const version = await uow.tx.membershipPlanVersion.create({ data: { planId: plan.id, versionNumber: 1, label: `${name} v1`, status: 'draft', createdById: actorUserId(actor), ...draftData(args.draft ?? {}) as object }, select: { id: true } })
    auditCreate(uow, actor, 'MembershipPlan', plan.id, 'membership.plan_created', { name, code })
    return { planId: plan.id, versionId: version.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Edit the plan's draft; if the plan has only active versions, start a new draft from the latest. */
export async function saveDraftVersion(db: Db, actor: Actor, args: { planId: string; draft: PlanDraftInput; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.plan_draft', MANAGE, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.plan_draft', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const plan = await lockRow<{ id: string; name: string; status: string }>(tx, 'MembershipPlan', args.planId)
    if (plan.status !== 'active') throw new DomainError(Codes.GUARD_FAILED, 'This plan is retired.')
    const data = draftData(args.draft)
    const draft = await tx.membershipPlanVersion.findFirst({ where: { planId: plan.id, status: 'draft' }, select: { id: true } })
    if (draft) {
      await tx.membershipPlanVersion.update({ where: { id: draft.id }, data: data as never })
      auditCreate(uow, actor, 'MembershipPlanVersion', draft.id, 'membership.plan_draft_saved', { fields: Object.keys(data) })
      return { versionId: draft.id }
    }
    const last = await tx.membershipPlanVersion.findFirstOrThrow({ where: { planId: plan.id }, orderBy: { versionNumber: 'desc' } })
    const created = await tx.membershipPlanVersion.create({
      data: {
        planId: plan.id, versionNumber: last.versionNumber + 1, label: `${plan.name} v${last.versionNumber + 1}`, status: 'draft', createdById: actorUserId(actor),
        priceMinor: last.priceMinor, billingFrequency: last.billingFrequency, termMonths: last.termMonths, autoRenew: last.autoRenew, renewalNoticeDays: last.renewalNoticeDays,
        entitlements: last.entitlements as never, benefits: last.benefits as never, cancellationRefundMethod: last.cancellationRefundMethod, cancellationRefundDays: last.cancellationRefundDays,
        consentWording: last.consentWording, ...data as object,
      },
      select: { id: true },
    })
    auditCreate(uow, actor, 'MembershipPlanVersion', created.id, 'membership.plan_draft_started', { from: last.versionNumber })
    return { versionId: created.id }
  })
  return { replay: result.replay, ...result.value }
}

/** Publish the draft. The previous active version is retired: members already on it keep it until they renew. */
export async function activatePlanVersion(db: Db, actor: Actor, args: { versionId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.plan_activate', MANAGE, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.plan_activate', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const v = await lockRow<{ id: string; planId: string; status: string; priceMinor: bigint; entitlements: unknown; autoRenew: boolean; consentWording: string; versionNumber: number }>(tx, 'MembershipPlanVersion', args.versionId)
    if (v.status !== 'draft') throw new DomainError(Codes.INVALID_TRANSITION, 'Only a draft is published.')
    if (v.priceMinor <= 0n) throw new DomainError(Codes.GUARD_FAILED, 'Set a price first.', { reason: 'price_missing' })
    if (!Array.isArray(v.entitlements) || !v.entitlements.length) throw new DomainError(Codes.GUARD_FAILED, 'List what the plan includes first.', { reason: 'entitlements_missing' })
    let policyVersion = ''
    if (v.autoRenew) {
      if (v.consentWording.trim().length < 30) throw new DomainError(Codes.GUARD_FAILED, 'Automatic renewal needs the wording the customer agrees to (what renews, for how much, how to cancel).', { reason: 'consent_wording_missing' })
      const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } })
      const today = await companyToday(tx, uow.now)
      const location = await tx.serviceLocation.findFirst({ select: { state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } })
      const policy = await resolvePolicyFromDb<{ affirmativeConsentRequired: boolean }>(tx, 'auto_renewal', placeOfLocation(location ?? { state: 'TX', postalCode: '', city: '', timeZone: company?.homeTimeZone ?? 'America/Chicago', propertyClass: 'residential' }), today)
      policyVersion = policy.versionId
    }
    await tx.membershipPlanVersion.updateMany({ where: { planId: v.planId, status: 'active' }, data: { status: 'retired' } })
    await tx.membershipPlanVersion.update({ where: { id: v.id }, data: { status: 'active', activatedAt: uow.now, autoRenewalPolicyVersion: policyVersion, consentWordingVersion: v.autoRenew ? `v${v.versionNumber}` : '' } })
    auditCreate(uow, actor, 'MembershipPlanVersion', v.id, 'membership.plan_activated', { planId: v.planId, versionNumber: v.versionNumber })
    return { versionId: v.id }
  })
  return { replay: result.replay, ...result.value }
}

export async function retirePlan(db: Db, actor: Actor, args: { planId: string; reason?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.plan_retire', MANAGE, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.plan_retire', actor, idempotencyKey, params, now: args.now }, async uow => {
    const plan = await lockRow<{ id: string; status: string; version: number }>(uow.tx, 'MembershipPlan', args.planId)
    await casUpdate(uow, { model: 'MembershipPlan', id: plan.id, version: plan.version, from: ['active'], to: 'retired', actor, eventType: 'membership.plan_retired', reason: args.reason ?? null })
    await uow.tx.membershipPlanVersion.updateMany({ where: { planId: plan.id, status: 'active' }, data: { status: 'retired' } })
    return { planId: plan.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Terms, grants and visits ──────────────────────────────────────────────────────────────────────────────────────

type VersionRow = { id: string; termMonths: number; billingFrequency: string; priceMinor: bigint; entitlements: unknown; renewalNoticeDays: number; cancellationRefundMethod: string; cancellationRefundDays: number; autoRenew: boolean }

/** One term with its payment schedule, the entitlements it grants and one open visit per visit-type unit. */
async function writeTerm(uow: UnitOfWork, membership: { id: string; startsOn: string }, version: VersionRow, n: number) {
  const { tx } = uow
  const start = termStart(membership.startsOn, version.termMonths, n)
  const end = termEnd(membership.startsOn, version.termMonths, n)
  const term = await tx.membershipTerm.create({
    data: { termKey: `${membership.id}:${n}`, membershipId: membership.id, termNumber: n, planVersionId: version.id, startsOn: asDate(start), endsOn: asDate(end), billingFrequency: version.billingFrequency, priceMinor: version.priceMinor, slots: slotCount(version.billingFrequency, version.termMonths), status: 'active' },
    select: { id: true },
  })
  const specs = (version.entitlements as EntitlementSpec[]) ?? []
  const grants: { id: string; code: string; quantity: number; rolloverPolicy: string }[] = []
  for (const spec of specs) {
    const season: Season = spec.seasonStart && spec.seasonEnd ? { startMonthDay: spec.seasonStart, endMonthDay: spec.seasonEnd } : null
    const w = windowFor(start, end, season)
    const grant = await tx.entitlementGrant.create({
      data: { grantKey: `${term.id}:${spec.code}`, membershipId: membership.id, termId: term.id, code: spec.code, name: spec.name, quantity: spec.quantity, windowStart: asDate(w.startDay), windowEnd: asDate(w.endDay), rolloverPolicy: spec.rollover },
      select: { id: true },
    })
    grants.push({ id: grant.id, code: spec.code, quantity: spec.quantity, rolloverPolicy: spec.rollover })
    if (spec.visit) {
      for (let i = 0; i < spec.quantity; i += 1) {
        await tx.recurringServiceEvent.create({ data: { eventKey: `${grant.id}:${i}`, membershipId: membership.id, grantId: grant.id, code: spec.code, name: spec.name, dueFrom: asDate(w.startDay), dueBy: asDate(w.endDay), status: 'open' } })
      }
    }
  }
  return { termId: term.id, start, end, grants }
}

export async function grantBalance(tx: Tx, grantId: string) {
  const grant = await tx.entitlementGrant.findUniqueOrThrow({ where: { id: grantId }, select: { quantity: true } })
  const used = await tx.entitlementEntry.aggregate({ where: { grantId }, _sum: { quantity: true } })
  return grant.quantity + (used._sum.quantity ?? 0)
}

// ── Selling ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type SellArgs = {
  customerId: string; locationId: string; planId: string; startsOn?: string | null; channel?: 'office' | 'field' | 'phone' | 'online'
  paymentMethodRef?: string | null; paymentMethodLabel?: string | null
  autoRenew?: boolean | null
  /** Staff confirm the customer agreed to the wording shown to them. Required, with the exact wording, when auto-renew is on. */
  consent?: { confirmed: boolean; wording: string; how: 'in_person' | 'phone_recorded' | 'signed_form' | 'online'; note?: string | null } | null
  idempotencyKey: string; now?: Date
}

export async function sellMembership(db: Db, actor: Actor, args: SellArgs) {
  await authorizeOperation(db, actor, 'membership.sell', SELL, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.sell', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const location = await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, customerId: true, state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } })
    if (!location || location.customerId !== args.customerId) throw new DomainError(Codes.NOT_FOUND, 'That address is not on this customer.', { field: 'locationId' })
    const plan = await tx.membershipPlan.findUnique({ where: { id: args.planId }, select: { id: true, name: true, status: true } })
    if (!plan || plan.status !== 'active') throw new DomainError(Codes.GUARD_FAILED, 'That plan is not for sale.', { reason: 'plan_not_active' })
    const version = await tx.membershipPlanVersion.findFirst({ where: { planId: plan.id, status: 'active' } })
    if (!version) throw new DomainError(Codes.GUARD_FAILED, 'That plan has no published version.', { reason: 'no_active_version' })
    const today = dayAt(location.timeZone, uow.now)
    const startsOn = args.startsOn ?? today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) throw new DomainError(Codes.INVALID_INPUT, 'The start date is a day.', { field: 'startsOn' })
    if (startsOn < addDays(today, -7) || startsOn > addDays(today, 90)) throw new DomainError(Codes.INVALID_INPUT, 'A membership starts within a week back or three months ahead.', { field: 'startsOn' })
    const live = await tx.membership.findFirst({ where: { customerId: args.customerId, locationId: location.id, planId: plan.id, status: { in: ['pending_payment', 'active', 'past_due', 'suspended', 'renewal_due'] } }, select: { ref: true } })
    if (live) throw new DomainError(Codes.GUARD_FAILED, `${live.ref} already covers this address on the same plan.`, { reason: 'already_member' })

    const wantsAuto = args.autoRenew ?? version.autoRenew
    if (wantsAuto && !version.autoRenew) throw new DomainError(Codes.GUARD_FAILED, 'This plan does not renew automatically.', { reason: 'auto_renew_not_offered' })
    let consentId: string | null = null
    if (wantsAuto) {
      const policy = await resolvePolicyFromDb<{ affirmativeConsentRequired: boolean }>(tx, 'auto_renewal', placeOfLocation(location), today)
      const c = args.consent
      if (policy.rules.affirmativeConsentRequired && (!c?.confirmed || c.wording?.trim() !== version.consentWording.trim())) {
        throw new DomainError(Codes.GUARD_FAILED, 'Automatic renewal needs the customer to agree to the exact wording on the plan, and you to confirm they did.', { reason: 'consent_required' })
      }
      if (!args.paymentMethodRef?.trim()) throw new DomainError(Codes.GUARD_FAILED, 'Automatic renewal needs a card on file.', { reason: 'payment_method_required' })
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId }, select: { displayName: true } })
      const consent = await tx.consentRecord.create({
        data: {
          purpose: 'auto_renewal', action: 'grant', channel: c?.how ?? 'in_person', policyVersionId: policy.versionId, wordingVersion: version.consentWordingVersion, recordedAt: uow.now,
          evidence: { wording: version.consentWording, planVersionId: version.id, customer: customer.displayName, how: c?.how ?? 'in_person', note: c?.note?.trim() ?? '', price: money(version.priceMinor), billing: version.billingFrequency, termMonths: version.termMonths } as never,
          actorKind: actor.kind === 'agent' ? 'agent' : actor.kind === 'user' ? 'user' : 'system', actorId: actorAgentId(actor) ?? actorUserId(actor) ?? '',
        },
        select: { id: true },
      })
      consentId = consent.id
    }

    const ref = await nextReference(tx, 'MBR', uow.now)
    const membership = await tx.membership.create({
      data: {
        ref, publicCode: publicCode('MBR'), customerId: args.customerId, locationId: location.id, planId: plan.id, planVersionId: version.id, status: 'pending_payment', startsOn: asDate(startsOn),
        paymentMethodRef: args.paymentMethodRef?.trim() ?? '', paymentMethodLabel: args.paymentMethodLabel?.trim().slice(0, 60) ?? '', autoRenew: wantsAuto, autoRenewConsentId: consentId,
        signupChannel: args.channel ?? 'office', soldById: actorUserId(actor),
      },
      select: { id: true, ref: true },
    })
    const term = await writeTerm(uow, { id: membership.id, startsOn }, version, 1)
    auditCreate(uow, actor, 'Membership', membership.id, 'membership.sold', { ref, plan: plan.name, startsOn, autoRenew: wantsAuto, consentId })
    return { membershipId: membership.id, ref, termId: term.termId, firstChargeDue: startsOn }
  })
  return { replay: result.replay, ...result.value }
}

export async function updatePaymentMethod(db: Db, actor: Actor, args: { membershipId: string; paymentMethodRef: string; paymentMethodLabel: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.payment_method', SELL, { ...args, paymentMethodRef: '[redacted]' })
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.payment_method', actor, idempotencyKey, params: { ...params, paymentMethodRef: '[redacted]' }, now: args.now }, async uow => {
    const m = await lockRow<{ id: string; status: string }>(uow.tx, 'Membership', args.membershipId)
    if (['cancelled', 'transferred', 'expired'].includes(m.status)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${m.status}.`)
    if (!/^pm_[A-Za-z0-9_]{6,100}$/.test(args.paymentMethodRef.trim())) throw new DomainError(Codes.INVALID_INPUT, 'That is not a saved card reference.', { field: 'paymentMethodRef' })
    await uow.tx.membership.update({ where: { id: m.id }, data: { paymentMethodRef: args.paymentMethodRef.trim(), paymentMethodLabel: text(args.paymentMethodLabel, 'paymentMethodLabel', 2, 60) } })
    auditCreate(uow, actor, 'Membership', m.id, 'membership.payment_method_set', { label: args.paymentMethodLabel })
    return { membershipId: m.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Entitlements ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Use one of the member's entitlements today. The grant row is locked first, so two bookings at once take turns; the database trigger
 * refuses a balance below zero even if this check were skipped.
 */
export async function debitEntitlement(uow: UnitOfWork, actor: Actor, args: { membershipId: string; code: string; key: string; jobId?: string | null; reason?: string }) {
  const { tx } = uow
  const membership = await tx.membership.findUnique({ where: { id: args.membershipId }, select: { id: true, status: true, location: { select: { timeZone: true } } } })
  if (!membership) throw new DomainError(Codes.NOT_FOUND, 'Membership not found.')
  if (!['active', 'past_due'].includes(membership.status)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${membership.status.replace(/_/g, ' ')}, so its visits cannot be used.`, { reason: 'membership_not_usable' })
  const existing = await tx.entitlementEntry.findUnique({ where: { key: args.key }, select: { id: true, grantId: true } })
  if (existing) return { entryId: existing.id, grantId: existing.grantId as string, replay: true }
  const today = dayAt(membership.location?.timeZone ?? 'America/Chicago', uow.now)
  const grants = await tx.entitlementGrant.findMany({ where: { membershipId: membership.id, code: args.code, windowStart: { lte: asDate(today) }, windowEnd: { gte: asDate(today) } }, orderBy: { windowEnd: 'asc' }, select: { id: true } })
  if (!grants.length) throw new DomainError(Codes.GUARD_FAILED, 'That is not included right now (out of season, or not on this plan).', { reason: 'not_in_window' })
  for (const g of grants) {
    await lockRow(tx, 'EntitlementGrant', g.id)
    if ((await grantBalance(tx, g.id)) > 0) {
      const entry = await tx.entitlementEntry.create({ data: { key: args.key, grantId: g.id, kind: 'debit', quantity: -1, jobId: args.jobId ?? null, reason: args.reason ?? '', occurredAt: uow.now, createdById: actorUserId(actor) }, select: { id: true } })
      return { entryId: entry.id, grantId: g.id, replay: false }
    }
  }
  throw new DomainError(Codes.GUARD_FAILED, 'None left on this membership for this period.', { reason: 'none_left' })
}

export async function restoreEntitlement(uow: UnitOfWork, actor: Actor, args: { debitEntryId: string; reason: string }) {
  const { tx } = uow
  const debit = await tx.entitlementEntry.findUnique({ where: { id: args.debitEntryId }, select: { id: true, grantId: true, kind: true, jobId: true } })
  if (!debit || debit.kind !== 'debit' || !debit.grantId) throw new DomainError(Codes.NOT_FOUND, 'That use was not found.')
  const key = `restore:${debit.id}`
  if (await tx.entitlementEntry.findUnique({ where: { key }, select: { id: true } })) return { restored: false }
  await lockRow(tx, 'EntitlementGrant', debit.grantId)
  await tx.entitlementEntry.create({ data: { key, grantId: debit.grantId, kind: 'restore', quantity: 1, jobId: debit.jobId, reason: args.reason, occurredAt: uow.now, createdById: actorUserId(actor) } })
  return { restored: true }
}

/** A visit from the call list is booked on a job. The job is looked up by its reference. */
export async function bookVisit(db: Db, actor: Actor, args: { eventId: string; jobRef: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.visit_book', [...SELL, 'canBook'], args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.visit_book', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const event = await lockRow<{ id: string; status: string; version: number; membershipId: string | null; agreementId: string | null; grantId: string | null; code: string }>(tx, 'RecurringServiceEvent', args.eventId)
    if (event.status !== 'open') throw new DomainError(Codes.GUARD_FAILED, event.status === 'booked' ? 'This visit is already booked.' : 'This visit was skipped.', { reason: 'not_open' })
    const job = await tx.job.findFirst({ where: { ref: args.jobRef.trim().toUpperCase() }, select: { id: true, customerId: true, status: true, ref: true, poNumber: true, nteMinor: true } })
    if (!job) throw new DomainError(Codes.NOT_FOUND, 'No job has that reference.', { field: 'jobRef' })
    if (job.status === 'cancelled') throw new DomainError(Codes.GUARD_FAILED, 'That job is cancelled.')
    let entryId: string | null = null
    if (event.membershipId) {
      const m = await tx.membership.findUniqueOrThrow({ where: { id: event.membershipId }, select: { customerId: true } })
      if (m.customerId !== job.customerId) throw new DomainError(Codes.GUARD_FAILED, 'That job belongs to a different customer.', { field: 'jobRef' })
      const used = await debitEntitlement(uow, actor, { membershipId: event.membershipId, code: event.code, key: `visit:${event.id}`, jobId: job.id, reason: `Booked on ${job.ref}` })
      entryId = used.entryId
    } else if (event.agreementId) {
      const a = await tx.serviceAgreement.findUniqueOrThrow({ where: { id: event.agreementId }, select: { customerId: true, status: true, poNumber: true, nteMinor: true } })
      if (a.status !== 'active') throw new DomainError(Codes.GUARD_FAILED, 'The agreement is not active.')
      if (a.customerId !== job.customerId) throw new DomainError(Codes.GUARD_FAILED, 'That job belongs to a different customer.', { field: 'jobRef' })
      // The agreement's PO and not-to-exceed go onto the job, so its invoice carries the PO and cannot bill past the cap.
      if (a.poNumber && job.poNumber && job.poNumber !== a.poNumber) throw new DomainError(Codes.GUARD_FAILED, `That job is on PO ${job.poNumber}; the agreement's PO is ${a.poNumber}.`, { reason: 'po_mismatch' })
      const nte = a.nteMinor > 0n ? (job.nteMinor && job.nteMinor > 0n && job.nteMinor < a.nteMinor ? job.nteMinor : a.nteMinor) : job.nteMinor
      await tx.job.update({ where: { id: job.id }, data: { poNumber: a.poNumber || job.poNumber, nteMinor: nte, version: { increment: 1 } } })
    }
    await casUpdate(uow, { model: 'RecurringServiceEvent', id: event.id, version: event.version, from: ['open'], to: 'booked', actor, eventType: 'membership.visit_booked', data: { jobId: job.id } })
    return { eventId: event.id, jobId: job.id, entryId }
  })
  return { replay: result.replay, ...result.value }
}

/** The job was cancelled or the visit was not done: put the visit back and give the entitlement back. */
export async function releaseVisit(db: Db, actor: Actor, args: { eventId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.visit_release', [...SELL, 'canBook'], args)
  const reason = text(args.reason, 'reason', 3, 200)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.visit_release', actor, idempotencyKey, params, now: args.now }, async uow => {
    const event = await lockRow<{ id: string; status: string; version: number }>(uow.tx, 'RecurringServiceEvent', args.eventId)
    if (event.status !== 'booked') throw new DomainError(Codes.GUARD_FAILED, 'This visit is not booked.')
    const debit = await uow.tx.entitlementEntry.findUnique({ where: { key: `visit:${event.id}` }, select: { id: true } })
    if (debit) await restoreEntitlement(uow, actor, { debitEntryId: debit.id, reason })
    await casUpdate(uow, { model: 'RecurringServiceEvent', id: event.id, version: event.version, from: ['booked'], to: 'open', actor, eventType: 'membership.visit_released', reason, data: { jobId: null } })
    return { eventId: event.id }
  })
  return { replay: result.replay, ...result.value }
}

// ── Renewal ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The next term, written in the caller's transaction. Leftovers expire; a plan that rolls over carries up to one term's worth. */
export async function renewInTx(uow: UnitOfWork, actor: Actor, membershipId: string, today: string) {
  const { tx } = uow
  const m = await lockRow<{ id: string; status: string; startsOn: Date; planId: string }>(tx, 'Membership', membershipId)
  if (!['active', 'past_due'].includes(m.status)) throw new DomainError(Codes.GUARD_FAILED, `A ${m.status.replace(/_/g, ' ')} membership is not renewed.`, { reason: 'not_renewable' })
  const last = await tx.membershipTerm.findFirstOrThrow({ where: { membershipId: m.id, status: 'active' }, orderBy: { termNumber: 'desc' }, include: { grants: true } })
  const version = await tx.membershipPlanVersion.findFirstOrThrow({ where: { planId: m.planId, status: 'active' } })
  const n = last.termNumber + 1
  const anchor = ymd(m.startsOn)
  // The new term starts where the last ended, so it is chained to the same anchor day; a term that is already over is not sold again.
  if (termEnd(anchor, version.termMonths, n) < today) throw new DomainError(Codes.GUARD_FAILED, 'This membership lapsed too long ago to renew. Sell a new one.', { reason: 'lapsed' })
  const pending = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, termNumber: n }, select: { id: true } })
  if (pending) throw new DomainError(Codes.GUARD_FAILED, 'The next term already exists.', { reason: 'already_renewed' })
  const term = await writeTerm(uow, { id: m.id, startsOn: anchor }, version, n)
  for (const prev of last.grants) {
    await lockRow(tx, 'EntitlementGrant', prev.id)
    const left = await grantBalance(tx, prev.id)
    if (left <= 0) continue
    await tx.entitlementEntry.create({ data: { key: `expire:${prev.id}`, grantId: prev.id, kind: 'expire', quantity: -left, reason: 'Term ended', occurredAt: uow.now, createdById: actorUserId(actor) } })
    if (prev.rolloverPolicy === 'one_term') {
      const next = term.grants.find(g => g.code === prev.code)
      const carry = next ? Math.min(left, prev.quantity) : 0
      if (next && carry > 0) await tx.entitlementEntry.create({ data: { key: `rollover:${next.id}`, grantId: next.id, kind: 'rollover', quantity: carry, reason: 'Carried over from the last term', occurredAt: uow.now, createdById: actorUserId(actor) } })
    }
  }
  auditCreate(uow, actor, 'Membership', m.id, 'membership.renewed', { termNumber: n, start: term.start, end: term.end, planVersionId: version.id })
  return { termId: term.termId, termNumber: n, start: term.start, end: term.end }
}

export async function renewMembership(db: Db, actor: Actor, args: { membershipId: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.renew', SELL, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.renew', actor, idempotencyKey, params, now: args.now }, async uow => {
    const m = await uow.tx.membership.findUnique({ where: { id: args.membershipId }, select: { location: { select: { timeZone: true } } } })
    if (!m) throw new DomainError(Codes.NOT_FOUND, 'Membership not found.')
    return renewInTx(uow, actor, args.membershipId, dayAt(m.location?.timeZone ?? 'America/Chicago', uow.now))
  })
  return { replay: result.replay, ...result.value }
}

// ── Cancelling and transferring ───────────────────────────────────────────────────────────────────────────────────

/** What the customer is owed back for the current term if they cancel on `day`, by the plan's own rule. */
export function refundFor(rule: { method: string; days: number }, paidMinor: bigint, term: { start: string; end: string }, day: string) {
  if (paidMinor <= 0n || rule.method === 'none') return 0n
  if (rule.method === 'prorata') {
    const { left, total } = termDaysLeft(term.start, term.end, day)
    return prorate(paidMinor, left, total)
  }
  return day <= addDays(term.start, rule.days) ? paidMinor : 0n
}

export async function cancelMembershipInTx(uow: UnitOfWork, actor: Actor, membershipId: string, reason: string, via: 'staff' | 'online') {
  const { tx } = uow
  const m = await lockRow<{ id: string; status: string; version: number; planVersionId: string | null; ref: string }>(tx, 'Membership', membershipId)
  if (['cancelled', 'transferred', 'expired'].includes(m.status)) return { membershipId: m.id, ref: m.ref, status: m.status, refundOwedMinor: '0', already: true }
  const loc = await tx.membership.findUniqueOrThrow({ where: { id: m.id }, select: { location: { select: { timeZone: true } } } })
  const today = dayAt(loc.location?.timeZone ?? 'America/Chicago', uow.now)
  const term = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, status: 'active', startsOn: { lte: asDate(today) }, endsOn: { gte: asDate(today) } }, orderBy: { termNumber: 'desc' } })
  const version = term?.planVersionId ? await tx.membershipPlanVersion.findUnique({ where: { id: term.planVersionId } }) : null
  let refund = 0n
  if (term && version) {
    const paid = await tx.membershipBillingAttempt.aggregate({ where: { membershipId: m.id, termId: term.id, status: 'succeeded' }, _sum: { amountMinor: true } })
    refund = refundFor({ method: version.cancellationRefundMethod, days: version.cancellationRefundDays }, paid._sum.amountMinor ?? 0n, { start: ymd(term.startsOn), end: ymd(term.endsOn) }, today)
  }
  await casUpdate(uow, { model: 'Membership', id: m.id, version: m.version, from: [m.status], to: 'cancelled', actor, eventType: 'membership.cancelled', reason, data: { cancelledAt: uow.now, cancelReason: reason, cancelEffectiveOn: asDate(today), refundOwedMinor: refund }, audit: { via, refundOwedMinor: refund.toString() } })
  await tx.membershipTerm.updateMany({ where: { membershipId: m.id, status: 'active', endsOn: { gte: asDate(today) } }, data: { status: 'cancelled' } })
  await tx.recurringServiceEvent.updateMany({ where: { membershipId: m.id, status: 'open' }, data: { status: 'skipped' } })
  return { membershipId: m.id, ref: m.ref, status: 'cancelled', refundOwedMinor: refund.toString(), already: false }
}

/**
 * A membership payment was refunded. No plan here re-bills a refund, so the term it paid for is closed: what is left of its
 * entitlements expires (append-only entries), its open visits are skipped, and a membership left with no term is cancelled.
 */
export async function closeTermForRefund(uow: UnitOfWork, actor: Actor, a: { membershipId: string; termId: string | null; reason: string }) {
  const { tx } = uow
  const m = await lockRow<{ id: string; status: string; version: number }>(tx, 'Membership', a.membershipId)
  const grants = await tx.entitlementGrant.findMany({ where: { membershipId: m.id, ...(a.termId ? { termId: a.termId } : {}) }, select: { id: true } })
  for (const g of grants) {
    await lockRow(tx, 'EntitlementGrant', g.id)
    const left = await grantBalance(tx, g.id)
    if (left > 0) await tx.entitlementEntry.create({ data: { key: `refund:${g.id}`, grantId: g.id, kind: 'expire', quantity: -left, reason: `Payment refunded: ${a.reason}`.slice(0, 200), occurredAt: uow.now, createdById: actorUserId(actor) } })
  }
  if (grants.length) await tx.recurringServiceEvent.updateMany({ where: { grantId: { in: grants.map(g => g.id) }, status: 'open' }, data: { status: 'skipped' } })
  if (a.termId) await tx.membershipTerm.updateMany({ where: { id: a.termId, status: 'active' }, data: { status: 'cancelled' } })
  const liveTerms = await tx.membershipTerm.count({ where: { membershipId: m.id, status: 'active' } })
  if (!liveTerms && !['cancelled', 'transferred', 'expired'].includes(m.status)) {
    const loc = await tx.membership.findUniqueOrThrow({ where: { id: m.id }, select: { location: { select: { timeZone: true } } } })
    await casUpdate(uow, { model: 'Membership', id: m.id, version: m.version, from: [m.status], to: 'cancelled', actor, eventType: 'membership.cancelled', reason: a.reason, data: { cancelledAt: uow.now, cancelReason: `Payment refunded: ${a.reason}`.slice(0, 300), cancelEffectiveOn: asDate(dayAt(loc.location?.timeZone ?? 'America/Chicago', uow.now)) }, audit: { via: 'refund' } })
  }
  auditCreate(uow, actor, 'Membership', m.id, 'membership.term_closed_by_refund', { termId: a.termId, grants: grants.length })
}

export async function cancelMembership(db: Db, actor: Actor, args: { membershipId: string; reason: string; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.cancel', SELL, args)
  const reason = text(args.reason, 'reason', 3, 300)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.cancel', actor, idempotencyKey, params, now: args.now }, uow => cancelMembershipInTx(uow, actor, args.membershipId, reason, 'staff'))
  return { replay: result.replay, ...result.value }
}

/** The customer cancels from the link on their receipt. The work is done in the request; there is no queue. */
export async function cancelOnline(db: Db, args: { publicCode: string; reason?: string | null; now?: Date }) {
  const code = String(args.publicCode ?? '').trim().toUpperCase()
  if (!/^MBR-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) throw new DomainError(Codes.NOT_FOUND, 'We could not find that membership.')
  const found = await db.membership.findUnique({ where: { publicCode: code }, select: { id: true } })
  if (!found) throw new DomainError(Codes.NOT_FOUND, 'We could not find that membership.')
  const actor: Actor = { kind: 'system', name: 'membership-online-cancel' }
  const reason = args.reason?.trim().slice(0, 300) || 'Cancelled online by the customer'
  const result = await command(db, { name: 'membership.cancel_online', actor, idempotencyKey: `online-cancel:${found.id}`, params: { code }, now: args.now }, uow => cancelMembershipInTx(uow, actor, found.id, reason, 'online'))
  return result.value
}

/** The home was sold: the old membership ends here and the buyer gets the rest of the current term, with what is left unused. */
export async function transferMembership(db: Db, actor: Actor, args: { membershipId: string; newCustomerId: string; newLocationId?: string | null; idempotencyKey: string; now?: Date }) {
  await authorizeOperation(db, actor, 'membership.transfer', MANAGE, args)
  const { idempotencyKey, now: _now, ...params } = args
  const result = await command(db, { name: 'membership.transfer', actor, idempotencyKey, params, now: args.now }, async uow => {
    const { tx } = uow
    const old = await lockRow<{ id: string; status: string; version: number; customerId: string | null; locationId: string | null; planId: string | null; planVersionId: string | null; startsOn: Date; ref: string }>(tx, 'Membership', args.membershipId)
    if (!['active', 'past_due'].includes(old.status)) throw new DomainError(Codes.GUARD_FAILED, `A ${old.status.replace(/_/g, ' ')} membership is not transferred.`)
    if (old.customerId === args.newCustomerId) throw new DomainError(Codes.INVALID_INPUT, 'Choose the new owner, a different customer.', { field: 'newCustomerId' })
    const locationId = args.newLocationId ?? old.locationId
    const location = await tx.serviceLocation.findUnique({ where: { id: locationId ?? '' }, select: { id: true, customerId: true, timeZone: true } })
    if (!location || location.customerId !== args.newCustomerId) throw new DomainError(Codes.GUARD_FAILED, 'Add the new owner at that address first.', { reason: 'new_owner_not_at_address' })
    const today = dayAt(location.timeZone, uow.now)
    const term = await tx.membershipTerm.findFirst({ where: { membershipId: old.id, status: 'active', startsOn: { lte: asDate(today) }, endsOn: { gte: asDate(today) } }, include: { grants: true } })
    if (!term) throw new DomainError(Codes.GUARD_FAILED, 'There is no current term to hand over.', { reason: 'no_current_term' })
    const ref = await nextReference(tx, 'MBR', uow.now)
    const created = await tx.membership.create({
      data: { ref, publicCode: publicCode('MBR'), customerId: args.newCustomerId, locationId: location.id, planId: old.planId, planVersionId: term.planVersionId, status: 'active', startsOn: old.startsOn, signupChannel: 'office', soldById: actorUserId(actor) },
      select: { id: true },
    })
    const nextTerm = await tx.membershipTerm.create({
      data: { termKey: `${created.id}:${term.termNumber}`, membershipId: created.id, termNumber: term.termNumber, planVersionId: term.planVersionId, startsOn: term.startsOn, endsOn: term.endsOn, billingFrequency: term.billingFrequency, priceMinor: term.priceMinor, slots: term.slots, status: 'active' },
      select: { id: true },
    })
    for (const g of term.grants) {
      await lockRow(tx, 'EntitlementGrant', g.id)
      const left = await grantBalance(tx, g.id)
      if (left <= 0) continue
      const grant = await tx.entitlementGrant.create({ data: { grantKey: `${nextTerm.id}:${g.code}`, membershipId: created.id, termId: nextTerm.id, code: g.code, name: g.name, quantity: left, windowStart: g.windowStart, windowEnd: g.windowEnd, rolloverPolicy: g.rolloverPolicy }, select: { id: true } })
      await tx.entitlementEntry.create({ data: { key: `transfer:${g.id}`, grantId: g.id, kind: 'expire', quantity: -left, reason: `Handed over to ${ref}`, occurredAt: uow.now, createdById: actorUserId(actor) } })
      const open = await tx.recurringServiceEvent.findMany({ where: { grantId: g.id, status: 'open' }, orderBy: { dueBy: 'asc' }, take: left })
      for (const [i, e] of open.entries()) await tx.recurringServiceEvent.create({ data: { eventKey: `${grant.id}:${i}`, membershipId: created.id, grantId: grant.id, code: e.code, name: e.name, dueFrom: e.dueFrom, dueBy: e.dueBy, status: 'open' } })
    }
    // Payment slots already due and not charged stay with the old owner's membership as written off history: the buyer starts clean.
    await tx.recurringServiceEvent.updateMany({ where: { membershipId: old.id, status: 'open' }, data: { status: 'skipped' } })
    await tx.membershipTerm.updateMany({ where: { membershipId: old.id, status: 'active' }, data: { status: 'cancelled' } })
    await casUpdate(uow, { model: 'Membership', id: old.id, version: old.version, from: [old.status], to: 'transferred', actor, eventType: 'membership.transferred', data: { transferredToId: created.id, cancelledAt: uow.now, cancelReason: 'Home sold', cancelEffectiveOn: asDate(today) } })
    auditCreate(uow, actor, 'Membership', created.id, 'membership.received_transfer', { from: old.ref, ref })
    return { oldMembershipId: old.id, membershipId: created.id, ref }
  })
  return { replay: result.replay, ...result.value }
}

// ── Reading: everything below is worked out from stored days and today ─────────────────────────────────────────────

export type MemberState = 'pending_payment' | 'active' | 'past_due' | 'renewal_due' | 'expired' | 'cancelled' | 'transferred' | 'suspended'

/** The membership's state today. "Renewal due" and "expired" are never stored. */
export function stateOn(row: { status: string; terms: { startsOn: Date | null; endsOn: Date | null; status: string }[]; noticeDays: number }, today: string): MemberState {
  if (['cancelled', 'transferred', 'pending_payment', 'suspended'].includes(row.status)) return row.status as MemberState
  const live = row.terms.filter(t => t.status === 'active')
  const lastEnd = live.map(t => ymd(t.endsOn)).sort().pop() ?? ''
  if (!lastEnd || lastEnd < today) return 'expired'
  if (row.status === 'past_due') return 'past_due'
  return addDays(today, row.noticeDays) >= lastEnd ? 'renewal_due' : 'active'
}

export type GrantView = { id: string; code: string; name: string; quantity: number; balance: number; windowStart: string; windowEnd: string; window: 'upcoming' | 'open' | 'expired'; rolloverPolicy: string }

export async function grantsFor(tx: Tx | Db, membershipId: string, today: string): Promise<GrantView[]> {
  const grants = await tx.entitlementGrant.findMany({ where: { membershipId }, orderBy: [{ windowEnd: 'asc' }, { code: 'asc' }], include: { entries: { select: { quantity: true } } } })
  return grants.map(g => ({
    id: g.id, code: g.code, name: g.name, quantity: g.quantity, balance: g.quantity + g.entries.reduce((a, e) => a + e.quantity, 0), windowStart: ymd(g.windowStart), windowEnd: ymd(g.windowEnd),
    window: windowState(today, { startDay: ymd(g.windowStart), endDay: ymd(g.windowEnd) }), rolloverPolicy: g.rolloverPolicy,
  }))
}

/** The member's plan code if they have a current paid-up membership at this address today (what member prices hang on). */
export async function activePlanCode(tx: Tx | Db, customerId: string, locationId: string | null, on: Date) {
  const rows = await tx.membership.findMany({
    where: { customerId, status: { in: ['active', 'past_due'] }, ...(locationId ? { locationId } : {}) },
    select: { plan: { select: { code: true } }, location: { select: { timeZone: true } }, terms: { where: { status: 'active' }, select: { startsOn: true, endsOn: true } } },
  })
  for (const r of rows) {
    const today = dayAt(r.location?.timeZone ?? 'America/Chicago', on)
    if (r.terms.some(t => ymd(t.startsOn) <= today && ymd(t.endsOn) >= today) && r.plan) return r.plan.code
  }
  return null
}

export { dayOf, slotDueDay }
