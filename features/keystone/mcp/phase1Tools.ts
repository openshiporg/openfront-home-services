import type { DomainTool } from './registry'

/*
 * Booking, CRM and dispatch tools (INTEGRATIONS §11, Phase 1). These are what the inbound AI
 * receptionist uses. Reads are masked for agents. Writes need an AgentScopeGrant for the exact tool
 * name; the server refuses (SCOPE_DENIED) and records the attempt otherwise. Access codes, merges and
 * cancellations are deliberately absent.
 */

const idempotencyKey = { type: 'string', minLength: 8, maxLength: 200, pattern: '^[A-Za-z0-9._:-]+$', description: 'Unique per intent. Reusing it returns the first result instead of acting twice.' }
const id = (description: string) => ({ type: 'string', minLength: 1, maxLength: 64, description })
const zip = { type: 'string', pattern: '^[0-9]{5}$', description: 'Five-digit ZIP of the service address' }
const date = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', description: 'Local date, YYYY-MM-DD' }
const phone = { type: 'string', maxLength: 32, description: 'Caller phone number as heard; normalised on the server' }

const schema = (properties: Record<string, object>, required: string[]) => ({ type: 'object' as const, properties, required, additionalProperties: false })

export const PHASE1_TOOLS: DomainTool[] = [
  {
    name: 'customer.lookup',
    description: 'Find an existing customer by phone, email, or name plus ZIP. Returns masked names, phones and addresses (agents never see full contact details) with location ids for booking.',
    inputSchema: schema({ phone, email: { type: 'string', maxLength: 200 }, name: { type: 'string', maxLength: 120 }, postalCode: zip }, []),
    document: 'query LookupCustomer($phone: String, $email: String, $name: String, $postalCode: String) { lookupCustomer(phone: $phone, email: $email, name: $name, postalCode: $postalCode) }',
    field: 'lookupCustomer',
    writes: false,
  },
  {
    name: 'customer.history',
    description: "A customer's recent jobs (type, status, city, next visit) so you can say what was done before. No prices or contact details.",
    inputSchema: schema({ customerId: id('Customer id from customer.lookup'), limit: { type: 'integer', minimum: 1, maximum: 25 } }, ['customerId']),
    document: 'query CustomerHistory($customerId: ID!, $limit: Int) { customerHistory(customerId: $customerId, limit: $limit) }',
    field: 'customerHistory',
    writes: false,
  },
  {
    name: 'jobtype.match',
    description: "Match the caller's description of the problem to bookable job types. If `emergency` is returned, read its script to the caller first (for example: leave the house and call the gas company), then call page.on_call.",
    inputSchema: schema({ description: { type: 'string', minLength: 3, maxLength: 1000 }, postalCode: zip }, ['description']),
    document: 'query MatchJobType($description: String!, $postalCode: String) { matchJobType(description: $description, postalCode: $postalCode) }',
    field: 'matchJobType',
    writes: false,
  },
  {
    name: 'capacity.windows',
    description: 'Arrival windows with room for this job type at this ZIP, from a date for up to 31 days. `inArea: false` means the address is outside the service area: do not book, hand off.',
    inputSchema: schema({ jobTypeId: id('Job type id from jobtype.match'), postalCode: zip, from: date, days: { type: 'integer', minimum: 1, maximum: 31 } }, ['jobTypeId', 'postalCode', 'from']),
    document: 'query AvailableWindows($jobTypeId: ID!, $postalCode: String!, $from: String!, $days: Int) { availableWindows(jobTypeId: $jobTypeId, postalCode: $postalCode, from: $from, days: $days) }',
    field: 'availableWindows',
    writes: false,
  },
  {
    name: 'booking.hold',
    description: 'Hold an arrival window for 10 minutes while you collect the caller details. CAPACITY_FULL means it just filled: offer the next window.',
    inputSchema: schema({ windowId: id('Window id from capacity.windows'), jobTypeId: id('Job type id'), source: { type: 'string', enum: ['ai_agent'] }, idempotencyKey }, ['windowId', 'jobTypeId', 'source', 'idempotencyKey']),
    document: 'mutation HoldWindow($windowId: ID!, $jobTypeId: ID!, $source: String!, $idempotencyKey: String!) { holdWindow(windowId: $windowId, jobTypeId: $jobTypeId, source: $source, idempotencyKey: $idempotencyKey) }',
    field: 'holdWindow',
    writes: true,
  },
  {
    name: 'booking.release',
    description: 'Release a hold you placed (the caller chose another time or hung up).',
    inputSchema: schema({ holdId: id('Hold id from booking.hold'), idempotencyKey }, ['holdId', 'idempotencyKey']),
    document: 'mutation ReleaseHold($holdId: ID!, $idempotencyKey: String!) { releaseHold(holdId: $holdId, idempotencyKey: $idempotencyKey) }',
    field: 'releaseHold',
    writes: true,
  },
  {
    name: 'booking.confirm',
    description: 'Book the job on a held window. Pass customerId+locationId for a known customer, or `customer` {firstName,lastName,phone,email} and `location` {address1,city,state,postalCode} for a new one. Set smsConsent only if the caller agreed to booking texts. A confirmation text is queued (sent only with consent).',
    inputSchema: schema({
      holdId: id('Hold id from booking.hold'), jobTypeId: id('Job type id'), customerId: id('Existing customer id'), locationId: id('Existing location id'),
      customer: { type: 'object', description: '{firstName, lastName, phone, email}' }, location: { type: 'object', description: '{address1, address2, city, state, postalCode}' },
      summary: { type: 'string', maxLength: 1000, description: 'What the caller described, in their words' }, smsConsent: { type: 'boolean' }, idempotencyKey,
    }, ['holdId', 'jobTypeId', 'idempotencyKey']),
    document: 'mutation BookJob($holdId: ID, $jobTypeId: ID!, $customerId: ID, $locationId: ID, $customer: JSON, $location: JSON, $summary: String, $smsConsent: Boolean, $idempotencyKey: String!) { bookJob(holdId: $holdId, jobTypeId: $jobTypeId, customerId: $customerId, locationId: $locationId, customer: $customer, location: $location, summary: $summary, smsConsent: $smsConsent, source: "ai_agent", idempotencyKey: $idempotencyKey) }',
    field: 'bookJob',
    writes: true,
  },
  {
    name: 'consent.record',
    description: "Record what the caller said about texts: a grant of booking texts (transactional_sms) or call recording, or a revocation of anything. Marketing consent can't be granted by phone here.",
    inputSchema: schema({ customerId: id('Customer id'), phone, purpose: { type: 'string', enum: ['transactional_sms', 'marketing_sms', 'marketing_email', 'marketing_voice', 'call_recording'] }, action: { type: 'string', enum: ['grant', 'revoke'] }, channel: { type: 'string', enum: ['phone'] }, idempotencyKey }, ['customerId', 'phone', 'purpose', 'action', 'channel', 'idempotencyKey']),
    document: 'mutation RecordConsent($customerId: ID, $phone: String, $purpose: String!, $action: String!, $channel: String!, $idempotencyKey: String!) { recordConsent(customerId: $customerId, phone: $phone, purpose: $purpose, action: $action, channel: $channel, idempotencyKey: $idempotencyKey) }',
    field: 'recordConsent',
    writes: true,
  },
  {
    name: 'handoff.to_human',
    description: 'Ask for a person to take the call (the caller asked, the job is not bookable by you, the address is out of area, or anything is unclear). Raises an urgent office task.',
    inputSchema: schema({ callId: id('Call id'), reason: { type: 'string', minLength: 3, maxLength: 200 }, summary: { type: 'string', maxLength: 1000 }, idempotencyKey }, ['callId', 'reason', 'idempotencyKey']),
    document: 'mutation Handoff($callId: ID!, $reason: String!, $summary: String, $idempotencyKey: String!) { handoffToHuman(callId: $callId, reason: $reason, summary: $summary, idempotencyKey: $idempotencyKey) }',
    field: 'handoffToHuman',
    writes: true,
  },
  {
    name: 'page.on_call',
    description: 'Emergency: page the on-call technician now (gas smell, active leak, no heat in freezing weather, sparking panel). Give the safety script first.',
    inputSchema: schema({ callId: id('Call id'), businessUnitId: id('Business unit id, if known'), summary: { type: 'string', minLength: 3, maxLength: 300 }, idempotencyKey }, ['summary', 'idempotencyKey']),
    document: 'mutation PageOnCall($callId: ID, $businessUnitId: ID, $summary: String!, $idempotencyKey: String!) { pageOnCall(callId: $callId, businessUnitId: $businessUnitId, summary: $summary, idempotencyKey: $idempotencyKey) }',
    field: 'pageOnCall',
    writes: true,
  },
  {
    name: 'dispatch.recommend',
    description: 'Rank technicians for a visit: eligibility (licences, EPA 608) first, then shift, overlaps, drive time, skills, past visits and load. Every candidate comes with its reasons. A proposal only.',
    inputSchema: schema({ visitId: id('Visit id'), idempotencyKey }, ['visitId', 'idempotencyKey']),
    document: 'mutation RecommendDispatch($visitId: ID!, $idempotencyKey: String!) { recommendDispatch(visitId: $visitId, idempotencyKey: $idempotencyKey) }',
    field: 'recommendDispatch',
    writes: true,
  },
  {
    name: 'dispatch.apply',
    description: 'Assign an unassigned visit to technicians (only with this grant; never reassigns). Eligibility is re-checked; NOT_ELIGIBLE or SCHEDULE_CONFLICT come back with reasons, and STALE_STATE means someone else moved it first.',
    inputSchema: schema({ visitId: id('Visit id'), expectedVersion: { type: 'integer', minimum: 0 }, employeeIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 }, recommendationId: id('Recommendation id'), idempotencyKey }, ['visitId', 'expectedVersion', 'employeeIds', 'idempotencyKey']),
    document: 'mutation AssignVisit($visitId: ID!, $expectedVersion: Int!, $employeeIds: [ID!]!, $recommendationId: ID, $idempotencyKey: String!) { assignVisit(visitId: $visitId, expectedVersion: $expectedVersion, employeeIds: $employeeIds, recommendationId: $recommendationId, idempotencyKey: $idempotencyKey) }',
    field: 'assignVisit',
    writes: true,
  },
]
