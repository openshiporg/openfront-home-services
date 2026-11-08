import type { DomainTool } from './registry'

/*
 * Price book and estimate tools (INTEGRATIONS §11, Phase 2). An agent may look prices up, freeze a quote
 * it is about to read aloud, and draft estimates for a person to review. It cannot present, sell,
 * discount, publish a price book, or touch a cancellation notice: those are people's acts.
 * Internal cost and margin never appear in what these tools return (services strip them for agents).
 * Writes need an AgentScopeGrant for the exact tool name.
 */

const idempotencyKey = { type: 'string', minLength: 8, maxLength: 200, pattern: '^[A-Za-z0-9._:-]+$', description: 'Unique per intent. Reusing it returns the first result instead of acting twice.' }
const id = (description: string) => ({ type: 'string', minLength: 1, maxLength: 64, description })
const schema = (properties: Record<string, object>, required: string[]) => ({ type: 'object' as const, properties, required, additionalProperties: false })

const line = {
  type: 'object',
  properties: {
    itemKey: { type: 'string', minLength: 1, maxLength: 80, description: 'itemKey from pricebook.search' },
    quantity: { type: 'string', pattern: '^[0-9]{1,10}(\\.[0-9]{1,4})?$', description: 'Exact decimal as text, e.g. "1" or "2.5"' },
    cancellationClass: { type: 'string', enum: ['requested_repair', 'necessary_replacement_parts', 'additional_goods_services'], description: 'What the customer asked for (requested_repair), a part that repair needs, or something extra. Decides cancellation rights.' },
    description: { type: 'string', maxLength: 500 },
  },
  required: ['itemKey', 'quantity'],
  additionalProperties: false,
}
const lines = { type: 'array', items: line, minItems: 1, maxItems: 60 }
const option = {
  type: 'object',
  properties: {
    tier: { type: 'string', enum: ['good', 'better', 'best', 'single', 'custom'] },
    name: { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', maxLength: 2000, description: 'What the customer reads' },
    lines,
  },
  required: ['tier', 'name', 'lines'],
  additionalProperties: false,
}
const options = { type: 'array', items: option, minItems: 1, maxItems: 3, description: 'One option, or a good/better/best ladder' }
const title = { type: 'string', minLength: 3, maxLength: 160 }

export const PHASE2_TOOLS: DomainTool[] = [
  {
    name: 'pricebook.search',
    description: 'Search the active price book by words or item key. Returns customer prices, units and the cancellation class each item normally carries. Never returns cost or margin.',
    inputSchema: schema({ query: { type: 'string', maxLength: 120 }, businessUnitId: id('Business unit, when the trade matters'), kind: { type: 'string', enum: ['service_task', 'material', 'equipment', 'fee'] }, limit: { type: 'integer', minimum: 1, maximum: 50 } }, []),
    document: 'query SearchPriceBook($query: String, $businessUnitId: ID, $kind: String, $limit: Int) { searchPriceBook(query: $query, businessUnitId: $businessUnitId, kind: $kind, limit: $limit) }',
    field: 'searchPriceBook',
    writes: false,
  },
  {
    name: 'pricebook.quote',
    description: 'Price lines from the active price book and freeze them. Say only the prices this returns, and keep its quoteHash: a price you speak must come from a quote. Tax shown is an estimate.',
    inputSchema: schema({ lines, businessUnitId: id('Business unit'), memberPricing: { type: 'boolean' } }, ['lines']),
    document: 'query QuotePriceBook($lines: JSON!, $businessUnitId: ID, $memberPricing: Boolean) { quotePriceBook(lines: $lines, businessUnitId: $businessUnitId, memberPricing: $memberPricing) }',
    field: 'quotePriceBook',
    writes: false,
  },
  {
    name: 'estimate.draft',
    description: 'Draft an estimate on a job (or for a customer and address) with up to three options. It stays a draft until a person reviews and presents it. Prices come from the active price book.',
    inputSchema: schema({ jobId: id('Job id'), customerId: id('Customer id when there is no job'), locationId: id('Service address id when there is no job'), businessUnitId: id('Business unit'), title, options, idempotencyKey }, ['title', 'options', 'idempotencyKey']),
    document: 'mutation DraftEstimate($jobId: ID, $customerId: ID, $locationId: ID, $businessUnitId: ID, $title: String!, $options: JSON!, $idempotencyKey: String!) { draftEstimate(jobId: $jobId, customerId: $customerId, locationId: $locationId, businessUnitId: $businessUnitId, title: $title, options: $options, idempotencyKey: $idempotencyKey) }',
    field: 'draftEstimate',
    writes: true,
  },
  {
    name: 'estimate.draft_from_capture',
    description: "Draft an estimate from what a technician captured on a visit (the job comes from the visit). Mark the customer's own request as requested_repair and anything you suggest as additional_goods_services.",
    inputSchema: schema({ visitId: id('Visit id'), title, options, idempotencyKey }, ['visitId', 'title', 'options', 'idempotencyKey']),
    document: 'mutation DraftEstimateFromCapture($visitId: ID!, $title: String!, $options: JSON!, $idempotencyKey: String!) { draftEstimateFromCapture(visitId: $visitId, title: $title, options: $options, idempotencyKey: $idempotencyKey) }',
    field: 'draftEstimateFromCapture',
    writes: true,
  },
  {
    name: 'estimate.draft_followup',
    description: 'Draft a new version of a declined or expired estimate, re-priced from the active price book, for a person to review before anyone contacts the customer.',
    inputSchema: schema({ versionId: id('Estimate version id from estimate.summary'), idempotencyKey }, ['versionId', 'idempotencyKey']),
    document: 'mutation DraftFollowupEstimate($versionId: ID!, $idempotencyKey: String!) { draftFollowupEstimate(versionId: $versionId, idempotencyKey: $idempotencyKey) }',
    field: 'draftFollowupEstimate',
    writes: true,
  },
  {
    name: 'estimate.summary',
    description: "An estimate's status, current version, options and totals, and why it was declined. No cost, margin or contact details.",
    inputSchema: schema({ estimateId: id('Estimate id') }, ['estimateId']),
    document: 'query EstimateSummary($estimateId: ID!) { estimateSummary(estimateId: $estimateId) }',
    field: 'estimateSummary',
    writes: false,
  },
]
