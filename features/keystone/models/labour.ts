import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { fixedChoice, lifecycle, minor, qty, rate, readOnly, systemText, versionField } from './domainFields'
import { isSignedIn, sys, type Permission, type Session } from '../access'
import { trackingFields } from './trackingFields'

/*
 * Labour and pay (SCHEMA §14, STATE-MACHINES §16). Timesheets and their segments are proposed from visit status events and move
 * open → submitted → approved → locked. Pay plan versions are immutable once active (database trigger). Earning lines are immutable
 * once their pay period is approved (database trigger); commission shares for one sale and role add up to 100 (deferred trigger).
 *
 * Every pay list is closed to agents and to anyone without a pay permission. A technician sees their own timesheets, and their own
 * earning lines only after the period is approved. Nothing here is writable through the generated API: every change is a command.
 */

export const TIMESHEET_STATUSES = ['open', 'submitted', 'approved', 'locked'] as const
export const SEGMENT_KINDS = ['job', 'drive', 'shop', 'supply_run', 'break_unpaid', 'break_paid', 'on_call_standby', 'training', 'pto'] as const
export const SEGMENT_SOURCES = ['status_event', 'manual', 'adjustment'] as const
export const PLAN_VERSION_STATUSES = ['draft', 'pending_approval', 'active', 'retired'] as const
export const PAY_PERIOD_STATUSES = ['open', 'calculating', 'review', 'approved', 'exported', 'closed'] as const
export const EARNING_KINDS = ['regular', 'overtime', 'commission', 'spiff', 'clawback', 'adjustment', 'pto'] as const
export const ATTRIBUTION_ROLES = ['sold_by', 'performed_by', 'lead_generated_by'] as const
export const EXPORT_TARGETS = ['csv', 'gusto', 'adp', 'paychex'] as const
export const EXPORT_STATUSES = ['building', 'ready', 'sent', 'acknowledged', 'failed'] as const
/** A period's lines are the technician's to read once the period has been approved. */
export const PAID_PERIOD_STATUSES = ['approved', 'exported', 'closed'] as const

const PAY: readonly Permission[] = ['canReadPay', 'canRunPayroll', 'canManagePayPlans', 'canApprovePayPlans', 'canApprovePayPeriods']
const TIME: readonly Permission[] = [...PAY, 'canApproveTimesheets']

type Args = { session?: (Session & { agent?: unknown }) | null }
const human = ({ session }: Args) => isSignedIn({ session }) && !session?.agent
const has = (session: Args['session'], names: readonly Permission[]) => names.some(name => session?.data?.role?.[name] === true)

/** Pay-permission holders see every row; a technician sees only the rows `own(userId)` selects; agents and everyone else see none. */
const payAccess = (all: readonly Permission[], own?: (userId: string) => Record<string, unknown>) => ({
  operation: {
    query: (args: Args) => human(args) && (has(args.session, all) || (!!own && has(args.session, ['canWorkVisits']))),
    create: sys, update: sys, delete: sys,
  },
  filter: {
    query: (args: Args) => {
      if (!human(args)) return false
      if (has(args.session, all)) return true
      if (own && has(args.session, ['canWorkVisits'])) return own(args.session!.itemId)
      return false
    },
  },
})

/** Field options for anything only pay-permission holders may read; read, filter and order follow one rule (a filter on a hidden field is a guessing oracle). */
const payRule = (args: Args) => human(args) && has(args.session, PAY)
const payOnly = { access: { read: payRule }, isFilterable: payRule, isOrderable: payRule }

const myTimesheet = (userId: string) => ({ employee: { user: { id: { equals: userId } } } })

export const Timesheet = list({
  access: payAccess(TIME, myTimesheet),
  ui: { labelField: 'workDate', listView: { initialColumns: ['employee', 'workDate', 'status', 'totalHours', 'approvedBy'] } },
  fields: {
    employee: relationship({ ref: 'Employee', ...readOnly }),
    workDate: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    workweekStart: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(TIMESHEET_STATUSES),
    submittedAt: timestamp({ ...readOnly }),
    approvedBy: relationship({ ref: 'User', ...readOnly }),
    approvedAt: timestamp({ ...readOnly }),
    rejectReason: systemText(),
    totalHours: qty({ ...readOnly }),
    segments: relationship({ ref: 'TimeSegment.timesheet', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const TimeSegment = list({
  access: payAccess(TIME, u => ({ timesheet: myTimesheet(u) })),
  ui: { labelField: 'kind', listView: { initialColumns: ['timesheet', 'kind', 'startsAt', 'endsAt', 'hours', 'source'] } },
  fields: {
    timesheet: relationship({ ref: 'Timesheet.segments', ...readOnly }),
    kind: fixedChoice(SEGMENT_KINDS),
    startsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    endsAt: timestamp({ validation: { isRequired: true }, ...readOnly }),
    hours: qty({ ...readOnly }),
    visit: relationship({ ref: 'Visit', ...readOnly }),
    source: fixedChoice(SEGMENT_SOURCES),
    sourceKey: systemText({ indexed: true }),
    adjusts: relationship({ ref: 'TimeSegment', ...readOnly }),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    /** Set when the pay period that paid this time is exported; time with no pay period yet is still owed. */
    payPeriod: relationship({ ref: 'PayPeriod', ...readOnly }),
    note: systemText(),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

export const PayPlan = list({
  access: payAccess(PAY),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'active'] } },
  fields: {
    name: text({ isIndexed: 'unique', validation: { isRequired: true }, ...readOnly }),
    active: checkbox({ defaultValue: false, ...readOnly }),
    versions: relationship({ ref: 'PayPlanVersion.plan', many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

const planJson = () => json({ ...readOnly } as never)

export const PayPlanVersion = list({
  access: payAccess(PAY),
  ui: { labelField: 'versionNumber', listView: { initialColumns: ['plan', 'versionNumber', 'status', 'activatedAt'] } },
  fields: {
    plan: relationship({ ref: 'PayPlan.versions', ...readOnly }),
    versionNumber: integer({ validation: { isRequired: true }, ...readOnly }),
    hourlyRates: planJson(),
    overtime: planJson(),
    commission: planJson(),
    spiffs: planJson(),
    clawbacks: planJson(),
    laterEngine: planJson(),
    status: lifecycle(PLAN_VERSION_STATUSES),
    contentHash: systemText(),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly }),
    activatedAt: timestamp({ ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

export const PayPlanAssignment = list({
  access: payAccess(PAY),
  ui: { labelField: 'from', listView: { initialColumns: ['employee', 'planVersion', 'from', 'to'] } },
  fields: {
    employee: relationship({ ref: 'Employee', ...readOnly }),
    planVersion: relationship({ ref: 'PayPlanVersion', ...readOnly }),
    from: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    to: calendarDay({ ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

export const CommissionAttribution = list({
  access: payAccess(PAY),
  ui: { labelField: 'role', listView: { initialColumns: ['employee', 'role', 'sharePct', 'workLine', 'membership', 'financingApplication'] } },
  fields: {
    workLine: relationship({ ref: 'WorkLine', ...readOnly }),
    membership: relationship({ ref: 'Membership', ...readOnly }),
    financingApplication: relationship({ ref: 'FinancingApplication', ...readOnly }),
    employee: relationship({ ref: 'Employee', ...readOnly }),
    role: fixedChoice(ATTRIBUTION_ROLES),
    sharePct: rate({ required: true, ...readOnly }),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    ...trackingFields,
  },
})

/** A technician reads the dates of a period once it is approved, so their statement can say which one it is; the totals and hashes stay with pay roles. */
export const PayPeriod = list({
  access: payAccess(PAY, () => ({ status: { in: [...PAID_PERIOD_STATUSES] } })),
  ui: { labelField: 'startsOn', listView: { initialColumns: ['startsOn', 'endsOn', 'payDate', 'status', 'inputsHash'] } },
  fields: {
    startsOn: calendarDay({ validation: { isRequired: true }, isIndexed: 'unique', ...readOnly }),
    endsOn: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    payDate: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(PAY_PERIOD_STATUSES),
    approval: relationship({ ref: 'ApprovalRequest', ...readOnly, ...payOnly }),
    inputsHash: text({ ...readOnly, ...payOnly }),
    summary: json({ ...readOnly, ...payOnly } as never),
    calculatedAt: timestamp({ ...readOnly, ...payOnly }),
    earningLines: relationship({ ref: 'EarningLine.payPeriod', many: true, ...readOnly, ...payOnly }),
    batches: relationship({ ref: 'PayrollExportBatch.payPeriod', many: true, ...readOnly, ...payOnly }),
    version: versionField(),
    ...trackingFields,
  },
})

/** What a technician may read of their own pay: lines of periods that have been approved. */
const myPaidLines = (userId: string) => ({ employee: { user: { id: { equals: userId } } }, payPeriod: { status: { in: [...PAID_PERIOD_STATUSES] } } })

/** Immutable earning lines (I-L2): a database trigger refuses any update, and any delete once the period is approved. */
export const EarningLine = list({
  access: payAccess(PAY, myPaidLines),
  ui: { labelField: 'kind', listView: { initialColumns: ['payPeriod', 'employee', 'workweekStart', 'kind', 'hours', 'amountMinor'] } },
  fields: {
    payPeriod: relationship({ ref: 'PayPeriod.earningLines', ...readOnly }),
    employee: relationship({ ref: 'Employee', ...readOnly }),
    workweekStart: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    kind: fixedChoice(EARNING_KINDS),
    hours: qty({ ...readOnly }),
    rateMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ required: true }),
    basisType: systemText(),
    basisId: systemText({ indexed: true }),
    basisVersion: integer({ defaultValue: 0, ...readOnly }),
    payPlanVersion: relationship({ ref: 'PayPlanVersion', ...readOnly }),
    earningCode: systemText(),
    regularRateReview: checkbox({ defaultValue: false, ...readOnly }),
    reverses: relationship({ ref: 'EarningLine', ...readOnly }),
    lineKey: systemText({ indexed: true }),
    note: systemText(),
    ...trackingFields,
  },
})

/** One export per period and target. Exporting locks the period's lines and timesheets; the file is rebuilt from the locked lines. */
export const PayrollExportBatch = list({
  access: payAccess(PAY),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'payPeriod', 'target', 'status', 'lineCount', 'totalMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    payPeriod: relationship({ ref: 'PayPeriod.batches', ...readOnly }),
    target: fixedChoice(EXPORT_TARGETS),
    status: lifecycle(EXPORT_STATUSES, 'ready'),
    lineCount: integer({ defaultValue: 0, ...readOnly }),
    totalMinor: minor({ defaultValue: 0n }),
    sha256: systemText(),
    createdBy: relationship({ ref: 'User', ...readOnly }),
    version: versionField(),
    ...trackingFields,
  },
})
