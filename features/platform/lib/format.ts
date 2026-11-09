/**
 * Display formatting for exact values. Inputs are the strings GraphQL returns for bigInt and
 * decimal fields; nothing here turns money into a float.
 */

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function splitDecimal(value: string) {
  const text = value.trim()
  const negative = text.startsWith('-')
  const [whole = '0', fraction = ''] = text.replace(/^[+-]/, '').split('.')
  return { negative, whole: whole.replace(/^0+(?=\d)/, '') || '0', fraction }
}

/** Minor units ("123456") → "$1,234.56". */
export function money(minor: string | bigint | null | undefined, currency = 'USD', digits = 2) {
  if (minor === null || minor === undefined || minor === '') return '—'
  const text = String(minor)
  if (!/^-?\d+$/.test(text)) return '—'
  const negative = text.startsWith('-')
  const abs = text.replace('-', '').padStart(digits + 1, '0')
  const whole = abs.slice(0, abs.length - digits)
  const fraction = digits ? `.${abs.slice(-digits)}` : ''
  const symbol = currency === 'USD' ? '$' : `${currency} `
  return `${negative ? '−' : ''}${symbol}${group(whole.replace(/^0+(?=\d)/, ''))}${fraction}`
}

/** An exact decimal string trimmed to at most `maxPlaces` (truncating display only) and at least `minPlaces`. */
export function decimalText(value: string | null | undefined, options: { minPlaces?: number; maxPlaces?: number; prefix?: string } = {}) {
  if (value === null || value === undefined || value === '') return '—'
  if (!/^[+-]?\d*(\.\d*)?$/.test(String(value).trim())) return '—'
  const { negative, whole, fraction } = splitDecimal(String(value))
  const max = options.maxPlaces ?? 10
  const min = options.minPlaces ?? 0
  let f = fraction.slice(0, max).replace(/0+$/, '')
  if (f.length < min) f = f.padEnd(min, '0')
  const isZero = /^0*$/.test(whole + f)
  return `${negative && !isZero ? '−' : ''}${options.prefix ?? ''}${group(whole)}${f ? `.${f}` : ''}`
}

/** A unit price in dollars from a decimal string: at least cents, up to 4 places. */
export const price = (value: string | null | undefined) => decimalText(value, { minPlaces: 2, maxPlaces: 4, prefix: '$' })

/** Quantity: up to 4 places (SCHEMA qty is 18,4: hours, feet, pounds of refrigerant). */
export const quantity = (value: string | null | undefined) => decimalText(value, { maxPlaces: 4 })

export const bps = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value} bps`)

export function when(iso: string | null | undefined, tz = 'America/Chicago', style: 'full' | 'time' | 'day' | 'seconds' = 'full') {
  if (!iso) return ''
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions =
    style === 'time' ? { hour: 'numeric', minute: '2-digit' }
    : style === 'seconds' ? { hour: 'numeric', minute: '2-digit', second: '2-digit' }
    : style === 'day' ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style === 'day' ? undefined : 'short', ...opts }).format(d)
}

/**
 * Words people use for stored codes. Codes stay in the database and API; screens show these.
 * A namespace is used where the same code reads differently by context ("csr" is a booking
 * channel on a job and a job title on an employee).
 */
const COMMON: Record<string, string> = {
  // People and actors
  csr: 'Customer service rep', ai_agent: 'AI receptionist', human: 'Office staff', ivr: 'Phone menu', voicemail: 'Voicemail',
  technician: 'Technician', dispatcher: 'Dispatcher', apprentice: 'Apprentice', helper: 'Helper', sales: 'Sales', lead: 'Lead tech',
  manager: 'Manager', warehouse: 'Warehouse', office: 'Office', owner: 'Owner', tenant: 'Tenant', property_manager: 'Property manager',
  site_contact: 'Site contact', spouse: 'Spouse', billing: 'Billing contact', llm_agent: 'AI agent', rules_engine: 'Rules engine',
  external_mcp_client: 'External AI client', system: 'System', webhook: 'Webhook', agent: 'AI agent', user: 'Staff member', customer: 'Customer',
  // Channels and sources
  call: 'Phone call', web_form: 'Website form', sms: 'Text', sms_keyword: 'Text reply', email: 'Email', chat: 'Chat', voice: 'Phone',
  phone: 'Phone', portal: 'Customer portal', paper: 'Paper form', in_person: 'In person', import: 'Imported', online: 'Online booking',
  online_booking: 'Online booking', lsa: 'Google Local Services', marketplace: 'Marketplace', tech_generated: 'Technician referral',
  membership: 'Membership', google_lsa: 'Google Local Services', google_ads: 'Google Ads', seo: 'Search (organic)', yard_sign: 'Yard sign',
  truck_wrap: 'Truck wrap', direct_mail: 'Direct mail', tv_radio: 'TV and radio', referral: 'Referral', repeat: 'Repeat customer',
  inbound: 'Inbound', outbound: 'Outbound', mobile: 'Mobile', landline: 'Landline', voip: 'Internet phone',
  // Consent purposes
  transactional_sms: 'Appointment texts', transactional_voice: 'Appointment calls', marketing_sms: 'Marketing texts',
  marketing_email: 'Marketing email', marketing_voice: 'Marketing calls', ai_voice_outbound: 'AI calls to the customer',
  call_recording: 'Call recording', auto_renewal: 'Automatic renewal', transactional: 'Appointment', marketing: 'Marketing', internal: 'Internal',
  // Call dispositions and message holds
  not_booked: 'Not booked', existing_job: 'Existing job', emergency_paged: 'On-call tech paged', transferred: 'Transferred',
  opted_out: 'Customer opted out',
  // Reasons
  parts: 'Waiting on parts', customer_decision: 'Customer deciding', financing: 'Financing', permit: 'Permit', authorization: 'Authorization',
  access: 'Access', customer_request: 'Customer asked', duplicate: 'Duplicate', no_access: 'No access', out_of_area: 'Outside our area',
  scheduling: 'Scheduling conflict', weather: 'Weather', price: 'Price', timing: 'Timing', no_answer: 'No answer', competitor: 'Went with a competitor',
  not_serviceable: 'Work we do not do', other: 'Other',
  // Statuses
  pending_verification: 'Needs checking', work_complete: 'Work complete', en_route: 'On the way', on_site: 'On site', on_hold: 'On hold',
  in_progress: 'In progress', ai_answering: 'AI answering', human_answering: 'Staff answering', handoff_requested: 'Wants a person',
  awaiting_inspection: 'Awaiting inspection', pending_approval: 'Awaiting approval', awaiting_approval: 'Awaiting approval',
  waiting_customer: 'Waiting on customer', waiting_staff: 'Waiting on staff', on_leave: 'On leave', cancelled_by_buyer: 'Cancelled by customer',
  manual: 'Send by hand',
  // Kinds and categories
  residential: 'Residential', commercial: 'Commercial', single_family: 'Single-family home', multifamily: 'Multifamily', townhome: 'Townhome',
  condo: 'Condo', mobile_home: 'Mobile home', gate_code: 'Gate code', lockbox: 'Lockbox', alarm: 'Alarm code', garage: 'Garage code', pet: 'Pet note',
  hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical', general: 'General', standard: 'Standard', extended: 'Extended', urgent: 'Urgent',
  emergency: 'Emergency', maintenance: 'Maintenance', regular: 'Regular', on_call: 'On call', overtime: 'Overtime', holiday: 'Holiday',
  closure: 'Closure', special_open: 'Special opening', legal_business_days: 'Legal business days', company_hours: 'Company hours',
  state_trade_license: 'State trade license', epa_608: 'EPA 608', nate: 'NATE', osha: 'OSHA', backflow: 'Backflow tester',
  driver_license: "Driver's license", manufacturer: 'Manufacturer', type_i: 'Type I', type_ii: 'Type II', type_iii: 'Type III',
  universal: 'Universal', none: 'None', transition: 'Status change', correction: 'Correction', zip: 'ZIP', zip_list: 'ZIP list',
  home_solicitation: 'Home solicitation', home_improvement_contract: 'Home improvement contract', contact_hours: 'Contact hours',
  refrigerant: 'Refrigerant', licensing: 'Licensing', sales_tax: 'Sales tax', wage_hour: 'Wage and hour', lien: 'Liens', privacy: 'Privacy',
  booking_confirmation: 'Booking confirmation', on_the_way: 'On the way', high: 'High', normal: 'Normal', low: 'Low',
  // Price book, estimates and cancellation rights (Phase 2)
  service_task: 'Service task', material: 'Material', equipment: 'Equipment', fee: 'Fee', discount: 'Discount', bundle: 'Bundle',
  fixed: 'Fixed price', formula: 'Formula', disposal: 'Disposal', permit_passthrough: 'Permit (pass-through)', warranty_reimbursed: 'Warranty reimbursed',
  labor: 'Labor', good: 'Good', better: 'Better', best: 'Best', requested_repair: 'Requested repair',
  necessary_replacement_parts: 'Part the repair needs', additional_goods_services: 'Add-on (beyond the request)',
  buyer_residence: "At the buyer's home", other_non_merchant: 'Elsewhere (not our premises)', merchant_place: 'At our office', remote: 'By phone or online',
  solicited: 'We approached the buyer', supplier_import: 'Supplier cost import', onboarding: 'Setup', staff: 'Staff', presented: 'Presented', sold: 'Sold',
  declined: 'Declined', superseded: 'Superseded', discarded: 'Discarded', published: 'Published', issued: 'Issued', waived: 'Waived (emergency)',
  expired_uncancelled: 'Window closed', refunded: 'Refunded', chose_competitor: 'Chose a competitor', will_call_back: 'Will call back',
  financing_declined: 'Financing declined', no_longer_needed: 'No longer needed', signed_on_device: 'Signed on the device', emailed: 'Emailed',
  printed_acknowledged: 'Printed and acknowledged', handed_paper_copy: 'Handed a paper copy', signature_on_device: 'Signature on the device',
  verbal_recorded: 'Recorded verbal approval', written_paper: 'Signed paper copy', po_number: 'Purchase order', signed_form: 'Signed cancellation form',
  mail: 'Mail', processor_refund: 'Card refund', check: 'Check', nothing_paid: 'Nothing was paid', printed: 'Printed',
  ftc_16cfr429: 'FTC Cooling-Off Rule', tx_bcc_601: 'Texas home solicitation',
  right_applies: 'Right to cancel applies', requested_repair_lines_excluded: 'Repairs the customer asked for are excluded', requested_work_not_solicited: 'Customer-requested work is not a solicited sale',
  tx_acr_consumer_initiated: 'HVAC work the customer asked for is exempt', tx_acr_consumer_initiated_not_available: 'HVAC exemption not available (warranty or installation fault)',
  at_merchant_place_of_business: 'Sold at our place of business', not_a_covered_location: 'Not a covered location', not_personally_solicited: 'Not a personal solicitation',
  no_covered_lines: 'No covered lines', below_threshold: 'Below the dollar threshold', not_more_than_threshold: 'Not over the dollar threshold',
  emergency_waiver_incomplete: 'Emergency waiver incomplete', emergency_waiver_not_available: 'This rule allows no emergency waiver', waived_by_buyer_emergency: 'Buyer waived it for an emergency',
  excluded_emergency_waiver: 'Emergency waiver',
  'cancellation.undelivered': 'Notice never delivered', 'cancellation.refund': 'Cooling-off refund', 'estimate.send': 'Send estimate',
  'job.no_access': 'No access', 'job.hold_follow_up': 'Hold follow-up', 'message.blocked': 'Text not sent', 'message.manual_send': 'Send text by hand',
}

const BY_CONTEXT: Record<string, Record<string, string>> = {
  /** Job.source / BookingHold.source: how the booking came in. */
  bookedVia: {
    csr: 'Booked by phone (front desk)', online: 'Booked online', ai_agent: 'Booked by the AI receptionist',
    tech_generated: 'Created by a technician', membership: 'Booked from a membership', import: 'Imported',
  },
  /** Lead.source. */
  leadSource: { ai_agent: 'AI receptionist', call: 'Phone call', membership: 'Membership' },
  /** Call.answeredBy. */
  answeredBy: { human: 'Office staff', ai_agent: 'AI receptionist' },
  /** Assignment.role on a visit. */
  crewRole: { lead: 'Lead tech', helper: 'Helper', sales: 'Sales', apprentice: 'Apprentice' },
  /** Contact.role on a customer. */
  contactRole: { lead: 'Lead' },
  /** Speakers in a call transcript. */
  transcript: { agent: 'AI', assistant: 'AI', ai: 'AI', caller: 'Caller', customer: 'Caller', user: 'Caller', human: 'Staff' },
}

/** "csr" → "Customer service rep"; unknown codes fall back to "Some code". */
export function label(value: string | null | undefined, context?: keyof typeof BY_CONTEXT | string) {
  if (!value) return ''
  const known = (context ? BY_CONTEXT[context]?.[value] : undefined) ?? COMMON[value]
  if (known) return known
  const text = value.replaceAll('_', ' ').replaceAll('.', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A calendar day ("2026-11-10") → "Tue, Nov 10"; adds the year when it is not `thisYear`. */
export function dayText(date: string | null | undefined, thisYear?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? ''
  const withYear = thisYear !== undefined && date.slice(0, 4) !== thisYear.slice(0, 4)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(`${date}T00:00:00Z`))
}

/** A deadline: one that falls at local midnight reads as "end of Thu, Nov 12" (the last full day), anything else as a time. */
export function deadlineText(iso: string | null | undefined, tz = 'America/Chicago') {
  if (!iso) return ''
  const hm = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return hm === '00:00' ? `end of ${lastDayBefore(iso, tz)}` : when(iso, tz)
}

/** The last day an end-exclusive instant covers (an estimate valid until midnight Dec 10 is good through Dec 9). */
export const lastDayBefore = (iso: string | null | undefined, tz = 'America/Chicago') => (iso ? when(new Date(Date.parse(iso) - 1).toISOString(), tz, 'day') : '')

/** A calendar day without the weekday: "Mar 4, 2027" (expiry and effective dates). */
export function dateText(date: string | null | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`))
}

/** An arrival window: "Tue, Nov 10 · 12–2 PM". */
export const windowText = (w: { date: string; label: string } | null | undefined) => (w ? `${dayText(w.date)} · ${w.label}` : '')

/** Whole basis points → "−5.92%" (exact: integer arithmetic). */
export function bpsPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isSafeInteger(value)) return '—'
  const abs = Math.abs(value)
  return `${value < 0 ? '−' : ''}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}%`
}

/** An exact decimal fraction string ("0.3333") → "33.3%", truncated to `places` for display. */
export function fractionPercent(value: string | null | undefined, places = 1) {
  if (value === null || value === undefined || !/^-?\d+(\.\d+)?$/.test(String(value))) return '—'
  const { negative, whole, fraction } = splitDecimal(String(value))
  const f = fraction.padEnd(2 + places, '0')
  const percentWhole = `${whole}${f.slice(0, 2)}`.replace(/^0+(?=\d)/, '')
  const rest = f.slice(2, 2 + places)
  return decimalText(`${negative ? '-' : ''}${percentWhole}${rest ? `.${rest}` : ''}`, { minPlaces: places, maxPlaces: places }) + '%'
}

const EVENTS: Record<string, string> = {
  'job.created': 'Job created', 'job.scheduled': 'Job scheduled', 'job.in_progress': 'Work started', 'job.on_hold': 'Put on hold',
  'job.hold_released': 'Hold released', 'job.cancelled': 'Job cancelled', 'booking_hold.converted': 'Window hold booked',
  'booking_hold.expired': 'Window hold expired', 'booking_hold.released': 'Window hold released', 'call.completed': 'Call ended',
  'call.handoff_requested': 'Caller asked for a person', 'call.on_call_paged': 'On-call tech paged', 'credential.verified': 'Credential verified',
  'credential.revoked': 'Credential revoked', 'lead.booked': 'Lead booked', 'lead.contacted': 'Lead contacted', 'lead.lost': 'Lead lost',
  'lead.merged': 'Lead merged', 'lead.qualified': 'Lead qualified', 'lead.spam': 'Lead marked spam', 'message.blocked': 'Text held back',
  'message.handed_off': 'Text handed to the provider', 'message.requeued': 'Text queued again', 'message.sending': 'Text sending',
  'message.sent_by_hand': 'Text sent by hand', 'message.sent': 'Text sent', 'visit.cancelled': 'Visit cancelled',
  'visit.status_correction': 'Visit status corrected', 'visit.unassigned': 'Technician removed', 'visit.dispatched': 'Technician assigned',
  'visit.scheduled': 'Visit scheduled', 'visit.en_route': 'Technician on the way', 'visit.on_site': 'Technician arrived', 'visit.working': 'Work started',
  'visit.paused': 'Work paused', 'visit.done': 'Visit done', 'visit.no_access': 'No access at the home', 'approval.requested': 'Approval requested',
  'approval.approved': 'Approved', 'approval.rejected': 'Rejected', 'approval.cancelled': 'Approval cancelled', 'approval.consumed': 'Approval used',
  'approval.expired': 'Approval expired', 'dispatch_recommendation.applied': 'Dispatch suggestion applied',
  'dispatch_recommendation.overridden': 'Dispatch suggestion overridden', 'dispatch_recommendation.expired': 'Dispatch suggestion expired',
  'consent.sms_stop': 'Customer texted STOP', 'consent.sms_start': 'Customer texted START', 'company.controls_changed': 'Company controls changed',
  'company.onboarding_status_changed': 'Setup status changed', 'capacity.templates_loaded': 'Arrival windows set up',
  'capacity.windows_materialized': 'Arrival windows opened', 'calendar.exceptions_loaded': 'Holidays loaded',
  'access_secret.revealed': 'Access code shown', 'access_secret.stored': 'Access code saved', 'call.started': 'Call started',
  'contact_point.created': 'Phone or email added', 'customer.created': 'Customer added', 'lead.created': 'Lead received',
  'location.created': 'Address added', 'visit.created': 'Visit created', 'visit.assigned': 'Technician assigned',
  'credential.created': 'Credential added', 'employee.created': 'Team member added', 'user.created': 'User added',
  'policy_version.activated': 'Rule version made active', 'company.created': 'Company set up',
  'estimate.created': 'Estimate started', 'estimate_version.option_saved': 'Option saved', 'estimate_version.presented': 'Estimate presented',
  'estimate_version.sold': 'Estimate sold', 'estimate_version.declined': 'Estimate declined', 'estimate_version.expired': 'Estimate expired',
  'estimate_version.superseded': 'Replaced by a new version', 'estimate_version.repriced': 'Re-priced from the price book',
  'estimate_version.discount_set': 'Discount set', 'estimate_version.discount_requested': 'Discount sent for approval',
  'estimate_version.cancelled_by_buyer': 'Cancelled by the customer', 'cancellation_notice.issued': 'Cancellation notice issued',
  'cancellation_notice.delivered': 'Notice delivered', 'cancellation_notice.waived': 'Waived for an emergency',
  'cancellation_notice.cancelled_by_buyer': 'Customer cancelled', 'cancellation_notice.refunded': 'Refund recorded',
  'cancellation_notice.expired_uncancelled': 'Cancellation window closed', 'cancellation_notice.override_requested': 'Early start requested',
  'pricebook_version.submitted': 'Sent for approval', 'pricebook_version.published': 'Published', 'pricebook_version.activated': 'Made active',
  'pricebook_version.retired': 'Retired', 'pricebook_version.items_saved': 'Items saved', 'document.rendered': 'Document rendered',
  'authorization.recorded': 'Customer authorized',
}

/** An audit event type ("job.on_hold") → "Put on hold"; unknown types read as "Job · on hold". */
export function eventText(type: string | null | undefined) {
  if (!type) return ''
  if (EVENTS[type]) return EVENTS[type]
  const [entity = '', ...rest] = type.split('.')
  return `${label(entity)}${rest.length ? ` ${rest.join(' ').replaceAll('_', ' ')}` : ''}`
}

/** "+15125550130" → "(512) 555-0130"; other numbers are shown as stored. */
export function phoneText(e164: string | null | undefined) {
  if (!e164) return ''
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

const ACTIONS: Record<string, string> = {
  'agent_grant.activate': 'Turn on an AI agent permission', 'ar_period.close': 'Close a receivables period', 'booking.overbook': 'Overbook an arrival window',
  'campaign.send': 'Send a marketing campaign', 'cancellation.start_override': 'Start work inside the cancellation window', 'company.controls': 'Change company controls', 'credit.issue': 'Issue a customer credit',
  'customer.merge': 'Merge customers', 'estimate.discount': 'Discount an estimate', 'file_affidavit': 'File a lien affidavit',
  'invoice.write_off': 'Write off an invoice', 'notice_to_owner': 'Send a notice to the owner', 'pay_period.approve': 'Approve a pay period',
  'pay_plan.publish': 'Publish a pay plan', 'policy.publish': 'Publish a rule version', 'pricebook.publish': 'Publish the price book',
  'purchase_order.submit': 'Submit a purchase order', 'refund.issue': 'Issue a refund', 'role.assign_approval': 'Give someone approval rights',
  'stock.variance': 'Accept a stock count difference', 'warranty.write_off': 'Write off a warranty claim',
}

/** An approval action code ("refund.issue") → "Issue a refund". */
export const actionText = (action: string | null | undefined) => (action ? ACTIONS[action] ?? eventText(action) : '')

/** A permission field ("canApproveRefunds") → "Can approve refunds". */
export function permissionText(permission: string | null | undefined) {
  if (!permission) return ''
  const words = permission.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\bar\b/g, 'AR').replace(/\bpii\b/g, 'PII')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
