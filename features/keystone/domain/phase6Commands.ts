/*
 * The Phase 6 commands (timesheets, pay plans, credit splits, pay periods) as plain data: the GraphQL schema and the dashboard's
 * command table are both built from this. Every command takes an idempotency key. Each entry is [service module, function, arguments].
 */
type Args = Record<string, string>

export const PHASE6: Record<string, [string, string, Args]> = {
  proposeTimesheet: ['labour', 'proposeTimesheet', { employeeId: 'ID', workDate: 'String!' }],
  addTimeSegment: ['labour', 'addSegment', { timesheetId: 'ID!', kind: 'String!', startsAt: 'String!', endsAt: 'String!', note: 'String' }],
  removeTimeSegment: ['labour', 'removeSegment', { segmentId: 'ID!' }],
  submitTimesheet: ['labour', 'submitTimesheet', { timesheetId: 'ID!', expectedVersion: 'Int!' }],
  approveTimesheet: ['labour', 'approveTimesheet', { timesheetId: 'ID!', expectedVersion: 'Int!' }],
  rejectTimesheet: ['labour', 'rejectTimesheet', { timesheetId: 'ID!', reason: 'String!', expectedVersion: 'Int!' }],
  adjustTimesheet: ['labour', 'adjustTimesheet', { timesheetId: 'ID!', kind: 'String!', startsAt: 'String!', endsAt: 'String!', reason: 'String!' }],
  definePayPlan: ['labour', 'createPayPlan', { name: 'String!', terms: 'JSON!' }],
  savePayPlanDraft: ['labour', 'savePayPlanDraft', { planId: 'ID!', terms: 'JSON!' }],
  requestPayPlanPublish: ['labour', 'requestPayPlanPublish', { versionId: 'ID!' }],
  publishPayPlanVersion: ['labour', 'publishPayPlanVersion', { versionId: 'ID!', requestId: 'ID!' }],
  assignPayPlan: ['labour', 'assignPayPlan', { employeeId: 'ID!', planVersionId: 'ID!', from: 'String!' }],
  setAttribution: ['labour', 'setAttribution', { workLineId: 'ID', membershipId: 'ID', financingApplicationId: 'ID', role: 'String!', shares: 'JSON!' }],
  openPayPeriod: ['labour', 'openPayPeriod', { startsOn: 'String!', endsOn: 'String!', payDate: 'String!' }],
  calculatePayPeriod: ['labour', 'calculatePayPeriod', { payPeriodId: 'ID!' }],
  addPayAdjustment: ['labour', 'addPayAdjustment', { payPeriodId: 'ID!', employeeId: 'ID!', amountMinor: 'String!', reason: 'String!' }],
  requestPayPeriodApproval: ['labour', 'requestPayPeriodApproval', { payPeriodId: 'ID!' }],
  approvePayPeriod: ['labour', 'approvePayPeriod', { payPeriodId: 'ID!', requestId: 'ID!', expectedVersion: 'Int!' }],
  reopenPayPeriod: ['labour', 'reopenPayPeriod', { payPeriodId: 'ID!', reason: 'String!', expectedVersion: 'Int!' }],
  exportPayPeriod: ['labour', 'exportPayPeriod', { payPeriodId: 'ID!', target: 'String!' }],
}

export const PHASE6_OPS: Record<string, Args> = Object.fromEntries(Object.entries(PHASE6).map(([name, [, , args]]) => [name, args]))
