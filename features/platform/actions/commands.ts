'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

/**
 * The only custom operations the dashboard screens can call. Each takes an idempotency key that the
 * client makes once per intent and reuses on retry, so a lost response never acts twice.
 */
const OPS: Record<string, Record<string, string>> = {
  decideApprovalRequest: { requestId: 'ID!', decision: 'String!', reason: 'String', expectedVersion: 'Int!' },
  cancelApprovalRequest: { requestId: 'ID!', expectedVersion: 'Int!', reason: 'String' },
  bindAgentApp: { agentId: 'ID!', oauthAppId: 'ID!', expectedVersion: 'Int!' },
  unbindAgentApp: { agentId: 'ID!', expectedVersion: 'Int!' },
  requestCompanyControls: { changes: 'JSON!', reason: 'String!' },
  setCompanyOnboardingStatus: { status: 'String!', expectedVersion: 'Int!' },
  // Phase 1: booking, CRM, leads, dispatch, field
  holdWindow: { windowId: 'ID!', jobTypeId: 'ID!', source: 'String!', minutes: 'Int', customerDraft: 'JSON' },
  releaseHold: { holdId: 'ID!' },
  bookJob: { holdId: 'ID', windowId: 'ID', jobTypeId: 'ID!', customerId: 'ID', locationId: 'ID', customer: 'JSON', location: 'JSON', summary: 'String', source: 'String', leadId: 'ID', smsConsent: 'Boolean' },
  addCustomer: { customer: 'JSON!', location: 'JSON', smsConsent: 'Boolean' },
  addServiceLocation: { customerId: 'ID!', location: 'JSON!' },
  addContactPoint: { contactId: 'ID!', kind: 'String!', value: 'String!', isPrimary: 'Boolean' },
  storeAccessSecret: { locationId: 'ID!', kind: 'String!', label: 'String', secret: 'String!' },
  ingestLead: { source: 'String!', campaignId: 'ID', contactName: 'String', phone: 'String', email: 'String', summary: 'String', requestedJobTypeId: 'ID', postalCode: 'String' },
  markLeadContacted: { leadId: 'ID!', expectedVersion: 'Int!' },
  qualifyLead: { leadId: 'ID!', expectedVersion: 'Int!', requestedJobTypeId: 'ID!', locationId: 'ID', postalCode: 'String' },
  loseLead: { leadId: 'ID!', expectedVersion: 'Int!', reason: 'String!' },
  markLeadSpam: { leadId: 'ID!', expectedVersion: 'Int!' },
  mergeLead: { leadId: 'ID!', expectedVersion: 'Int!', intoLeadId: 'ID!' },
  recommendDispatch: { visitId: 'ID!' },
  assignVisit: { visitId: 'ID!', expectedVersion: 'Int!', employeeIds: '[ID!]!', leadEmployeeId: 'ID', recommendationId: 'ID', overrideReason: 'String' },
  unassignVisit: { visitId: 'ID!', expectedVersion: 'Int!', reason: 'String!' },
  setVisitStatus: { visitId: 'ID!', to: 'String!', expectedVersion: 'Int', reason: 'String', clientRecordedAt: 'String', deviceEventKey: 'String', lat: 'String', lng: 'String' },
  submitChecklist: { visitId: 'ID!', answers: 'JSON!' },
  holdJob: { jobId: 'ID!', expectedVersion: 'Int!', reason: 'String!', followUpOn: 'String!' },
  releaseJobHold: { jobId: 'ID!', expectedVersion: 'Int!' },
  cancelJob: { jobId: 'ID!', expectedVersion: 'Int!', reason: 'String!' },
  recordConsent: { contactPointId: 'ID', customerId: 'ID', phone: 'String', purpose: 'String!', action: 'String!', channel: 'String!', evidence: 'JSON', wordingVersion: 'String' },
  handoffToHuman: { callId: 'ID!', reason: 'String!', summary: 'String' },
  pageOnCall: { callId: 'ID', businessUnitId: 'ID', summary: 'String!' },
  verifyCredential: { credentialId: 'ID!', expectedVersion: 'Int!' },
  revokeCredential: { credentialId: 'ID!', expectedVersion: 'Int!', reason: 'String!' },
  materializeWindows: { from: 'String!', days: 'Int!', businessUnitIds: '[ID!]' },
  refreshTimedStates: {},
  // Phase 2: price book, estimates, cancellation rights
  openPriceBook: { name: 'String!', code: 'String!', businessUnitIds: '[ID!]' },
  startPriceBookDraft: { priceBookId: 'ID!', label: 'String' },
  saveDraftItems: { versionId: 'ID!', items: 'JSON!', expectedVersion: 'Int' },
  removeDraftItems: { versionId: 'ID!', itemKeys: '[String!]!', expectedVersion: 'Int' },
  submitPriceBookVersion: { versionId: 'ID!', effectiveAt: 'String', expectedVersion: 'Int!', note: 'String' },
  reopenPriceBookDraft: { versionId: 'ID!', expectedVersion: 'Int!', reason: 'String' },
  discardPriceBookVersion: { versionId: 'ID!', expectedVersion: 'Int!', reason: 'String' },
  importSupplierCosts: { priceBookId: 'ID!', supplier: 'String!', costs: 'JSON!' },
  openEstimate: { jobId: 'ID', customerId: 'ID', locationId: 'ID', businessUnitId: 'ID', title: 'String!', options: 'JSON' },
  saveEstimateOption: { versionId: 'ID!', optionId: 'ID', tier: 'String!', name: 'String!', description: 'String', memberPricing: 'Boolean', lines: 'JSON!', expectedVersion: 'Int' },
  removeEstimateOption: { versionId: 'ID!', optionId: 'ID!', expectedVersion: 'Int!' },
  repriceEstimateVersion: { versionId: 'ID!', expectedVersion: 'Int!' },
  setEstimateDiscount: { versionId: 'ID!', discountBps: 'Int!', reason: 'String', expectedVersion: 'Int!' },
  reopenEstimateVersion: { versionId: 'ID!', expectedVersion: 'Int!' },
  presentEstimate: { versionId: 'ID!', via: 'String', notes: 'String', expectedVersion: 'Int!' },
  sellEstimate: { versionId: 'ID!', optionId: 'ID!', expectedVersion: 'Int!', authorization: 'JSON!', saleLocation: 'String!', initiatedBy: 'String!', depositMinor: 'String', emergencyWaiver: 'JSON', acrContext: '[String!]', exclusions: '[String!]' },
  declineEstimate: { versionId: 'ID!', reason: 'String!', note: 'String', expectedVersion: 'Int!' },
  requoteEstimate: { versionId: 'ID!', expectedVersion: 'Int!' },
  draftFollowupEstimate: { versionId: 'ID!' },
  discardEstimateVersion: { versionId: 'ID!', expectedVersion: 'Int!', reason: 'String' },
  deliverCancellationNotice: { noticeId: 'ID!', method: 'String!', acknowledgedBy: 'String!', signature: 'JSON', messageId: 'ID', expectedVersion: 'Int!' },
  waiveCancellationNotice: { noticeId: 'ID!', waiver: 'JSON!', expectedVersion: 'Int!' },
  recordBuyerCancellation: { noticeId: 'ID!', via: 'String!', sentAt: 'String!', note: 'String', expectedVersion: 'Int!' },
  markCancellationRefunded: { noticeId: 'ID!', evidence: 'JSON!', expectedVersion: 'Int!' },
  requestCancellationHoldOverride: { noticeId: 'ID!', reason: 'String!', expectedVersion: 'Int!' },
};

/** Commands that act without an idempotency key (each is a logged read, not a state change). */
const UNKEYED: Record<string, Record<string, string>> = {
  revealAccessSecret: { accessSecretId: 'ID!', visitId: 'ID!', reason: 'String' },
};

/** Domain reads the interactive screens (booking wizard, dispatch board) call from the browser. */
const READS: Record<string, Record<string, string>> = {
  lookupCustomer: { phone: 'String', email: 'String', name: 'String', postalCode: 'String' },
  lookupLocations: { customerId: 'ID!', postalCode: 'String' },
  customerHistory: { customerId: 'ID!', limit: 'Int' },
  matchJobType: { description: 'String!', postalCode: 'String' },
  availableWindows: { jobTypeId: 'ID!', postalCode: 'String!', from: 'String!', days: 'Int' },
  checkEligibility: { visitId: 'ID!', employeeIds: '[ID!]!' },
  searchPriceBook: { query: 'String', businessUnitId: 'ID', kind: 'String', limit: 'Int' },
  quotePriceBook: { lines: 'JSON!', businessUnitId: 'ID', memberPricing: 'Boolean', discountBps: 'Int' },
};

function pick(spec: Record<string, string>, variables: Record<string, unknown>) {
  const keys = Object.keys(variables).filter((k) => k in spec && variables[k] !== undefined && variables[k] !== '');
  return {
    decl: keys.map((k) => `$${k}: ${spec[k]}`),
    args: keys.map((k) => `${k}: $${k}`),
    // Form fields arrive as text; an Int argument typed as digits is sent as a number.
    vars: Object.fromEntries(keys.map((k) => [k, /^Int!?$/.test(spec[k]) && typeof variables[k] === 'string' && /^-?\d{1,9}$/.test(variables[k] as string) ? Number(variables[k]) : variables[k]])) as Record<string, unknown>,
  };
}

export async function runQuery(op: string, variables: Record<string, unknown>) {
  const spec = READS[op];
  if (!spec) return { ok: false as const, error: 'Unknown lookup' };
  const { decl, args, vars } = pick(spec, variables);
  const res = await keystoneClient(`query Read${decl.length ? `(${decl.join(', ')})` : ''} { ${op}${args.length ? `(${args.join(', ')})` : ''} }`, vars);
  if (!res.success) return { ok: false as const, error: res.error || 'Lookup failed' };
  return { ok: true as const, data: (res.data as Record<string, unknown>)?.[op] };
}

export async function runUnkeyed(op: string, variables: Record<string, unknown>, paths: string[] = []) {
  const spec = UNKEYED[op];
  if (!spec) return { ok: false as const, error: 'Unknown action' };
  const { decl, args, vars } = pick(spec, variables);
  const res = await keystoneClient(`mutation Run(${decl.join(', ')}) { ${op}(${args.join(', ')}) }`, vars);
  if (!res.success) return { ok: false as const, error: res.error || 'Action failed' };
  for (const p of paths) revalidatePath(p);
  return { ok: true as const, data: (res.data as Record<string, unknown>)?.[op] };
}

const KEY = /^[A-Za-z0-9._:-]{8,200}$/;

export async function runCommand(op: string, variables: Record<string, unknown>, idempotencyKey: string, paths: string[] = []) {
  const spec = OPS[op];
  if (!spec) return { ok: false as const, error: 'Unknown action' };
  if (!KEY.test(idempotencyKey)) return { ok: false as const, error: 'Missing request key. Reload the page and try again.' };
  const picked = pick(spec, variables);
  const decl = [...picked.decl, '$idempotencyKey: String!'];
  const args = [...picked.args, 'idempotencyKey: $idempotencyKey'];
  const res = await keystoneClient(`mutation Run(${decl.join(', ')}) { ${op}(${args.join(', ')}) }`, { ...picked.vars, idempotencyKey });
  if (!res.success) return { ok: false as const, error: res.error || 'Action failed' };
  for (const p of paths) revalidatePath(p);
  return { ok: true as const, data: (res.data as Record<string, unknown>)?.[op] };
}
