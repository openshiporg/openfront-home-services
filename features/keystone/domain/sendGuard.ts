import { localTime, weekday, localDate } from '../lib/calendar'
import type { ContactHoursRules } from './policySchemas'

/*
 * Send-time guard (I-K1, SM§17). Runs in the outbox worker just before a message leaves, never at
 * enqueue time, because consent can change while a message waits. Pure: the caller loads effective
 * consent, the do-not-contact state, the resolved contact-hours policy and registration status.
 *
 * - Every purpose needs effective consent for its consent purpose (transactional SMS for booking
 *   confirmations and on-the-way texts; marketing SMS for promotions).
 * - The internal DNC list blocks everything except transactional messages the customer asked for.
 * - Quiet hours apply in the recipient's local zone to the purposes the policy lists. With the
 *   seeded federal + Texas packs, transactional texts are not restricted; marketing and AI outbound
 *   are (Texas: 9 a.m.-9 p.m., Sunday from noon).
 * - SMS needs an approved 10DLC registration.
 * A blocked message is never sent later automatically (a person re-queues it).
 */

export type MessagePurpose = 'transactional' | 'marketing'
export type ConsentPurpose = 'transactional_sms' | 'marketing_sms' | 'marketing_email'
export type BlockReason = 'no_consent' | 'opted_out' | 'dnc' | 'quiet_hours' | 'unregistered_10dlc' | 'policy_unresolved'

export type GuardInput = {
  purpose: MessagePurpose
  channel: 'sms' | 'email'
  /** Latest consent event per consent purpose for this contact point: 'grant' | 'revoke' | undefined. */
  consent: Partial<Record<string, 'grant' | 'revoke'>>
  onInternalDnc: boolean
  /** Merged (stricter-wins) contact-hours rules for the recipient's place, or null if unresolved. */
  contactHours: ContactHoursRules | null
  recipientTimeZone: string
  at: Date
  tenDlcApproved: boolean
}

export type GuardResult = { allowed: true; consentPurpose: ConsentPurpose } | { allowed: false; reason: BlockReason; consentPurpose: ConsentPurpose; detail: string }

export function consentPurposeFor(purpose: MessagePurpose, channel: 'sms' | 'email'): ConsentPurpose {
  if (purpose === 'transactional') return 'transactional_sms'
  return channel === 'email' ? 'marketing_email' : 'marketing_sms'
}

/** The policy purpose quiet hours are keyed by. */
const hoursPurpose = (purpose: MessagePurpose) => (purpose === 'transactional' ? 'transactional' : 'marketing')

export function inContactHours(rules: ContactHoursRules, timeZone: string, at: Date) {
  const date = localDate({ timeZone }, at)
  const day = weekday(date)
  const window = day === 0 ? rules.sunday : day === 6 ? rules.saturday : rules.weekdays
  const now = localTime(timeZone, at)
  return { allowed: now >= window.start && now < window.end, window, localTime: now, localDate: date }
}

export function evaluateSend(input: GuardInput): GuardResult {
  const consentPurpose = consentPurposeFor(input.purpose, input.channel)
  const block = (reason: BlockReason, detail: string): GuardResult => ({ allowed: false, reason, consentPurpose, detail })

  // Transactional email goes to an address the customer gave for this job; it needs no SMS consent.
  const needsConsent = !(input.purpose === 'transactional' && input.channel === 'email')
  const state = input.consent[consentPurpose]
  if (needsConsent && state === 'revoke') return block('opted_out', `The recipient revoked ${consentPurpose.replaceAll('_', ' ')}.`)
  if (needsConsent && state !== 'grant') return block('no_consent', `No ${consentPurpose.replaceAll('_', ' ')} consent on file.`)
  if (input.onInternalDnc && input.purpose !== 'transactional') return block('dnc', 'The recipient is on the do-not-contact list.')

  const restricted = input.contactHours?.purposes.includes(hoursPurpose(input.purpose) as never) ?? input.purpose !== 'transactional'
  if (restricted) {
    if (!input.contactHours) return block('policy_unresolved', 'No contact-hours policy resolves for the recipient, so marketing is held.')
    const hours = inContactHours(input.contactHours, input.recipientTimeZone, input.at)
    if (!hours.allowed) return block('quiet_hours', `It is ${hours.localTime} for the recipient; allowed ${hours.window.start}-${hours.window.end}.`)
  }
  if (input.channel === 'sms' && !input.tenDlcApproved) return block('unregistered_10dlc', 'Business texting registration (10DLC) is not approved.')
  return { allowed: true, consentPurpose }
}

/** STOP-family keywords revoke consent before any other processing (I-K2, CTIA). */
export const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']
export const START_WORDS = ['START', 'UNSTOP', 'YES']
export const HELP_WORDS = ['HELP', 'INFO']

export function classifyKeyword(body: string): 'stop' | 'start' | 'help' | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (STOP_WORDS.includes(word)) return 'stop'
  if (START_WORDS.includes(word)) return 'start'
  if (HELP_WORDS.includes(word)) return 'help'
  return null
}
