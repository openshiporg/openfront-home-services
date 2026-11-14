import { notFound } from 'next/navigation';
import { q, viewer, companyTimeZone, localToday, plusDays } from '../../lib/server';
import { money, dateText, label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';
import { NewPayPlanForm, EditPayPlanDraftForm } from '../components/PayPlanForms';

/*
 * Timesheets, pay plans, pay periods and pay statements. Plain server screens over the Phase 6 commands. Every read goes through the
 * signed-in person's session, so the list rules decide what comes back: a technician sees their own time and their own approved pay
 * and nothing else. Nothing here sends anything to anyone; the export is a file a person takes to payroll.
 */

async function gate(...perms: string[]) {
  const me = await viewer();
  if (!perms.some(p => me.can(p))) notFound();
  return me;
}
const csv = (href: string, text = 'Export CSV') => <a className="inline-flex h-11 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm md:h-8" href={href}>{text}</a>;
const hrs = (v: string | null | undefined) => (v === null || v === undefined ? '0' : String(Number.parseFloat(v)));
const KINDS = ['shop', 'supply_run', 'break_unpaid', 'break_paid', 'training', 'on_call_standby', 'pto'];

type Segment = { id: string; kind: string; startsAt: string; endsAt: string; hours: string | null; source: string; note: string };
type Sheet = { id: string; workDate: string; status: string; version: number; totalHours: string | null; rejectReason: string; employee: { displayName: string } | null; approvedBy: { name: string } | null; segments: Segment[] };

const SHEET_FIELDS = `id workDate status version totalHours rejectReason employee { displayName } approvedBy { name } segments(orderBy: [{ startsAt: asc }]) { id kind startsAt endsAt hours source note }`;

function SheetBody({ s, tz, mine, approver }: { s: Sheet; tz: string; mine: boolean; approver: boolean }) {
  const paths = ['/dashboard/platform/timesheets', '/dashboard/platform/my-timesheet'];
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{dateText(s.workDate)}</span>
        {!mine ? <span>{s.employee?.displayName ?? 'Unknown'}</span> : null}
        <Status value={s.status} />
        <Meta>{hrs(s.totalHours)} hours{s.approvedBy ? ` · approved by ${s.approvedBy.name}` : ''}</Meta>
      </div>
      {s.rejectReason && s.status === 'open' ? <Meta>Sent back: {s.rejectReason}</Meta> : null}
      {s.segments.map(g => (
        <div key={g.id} className="flex flex-wrap items-center gap-x-3 text-sm">
          <span className="w-28">{label(g.kind)}</span>
          <Meta>{when(g.startsAt, tz, 'time')} to {when(g.endsAt, tz, 'time')} · {hrs(g.hours)} h · {g.source === 'status_event' ? 'from the visit record' : g.source === 'adjustment' ? `added by an approver${g.note ? `: ${g.note}` : ''}` : `entered by hand${g.note ? `: ${g.note}` : ''}`}</Meta>
          {mine && s.status === 'open' && g.source === 'manual' ? <ActionButton op="removeTimeSegment" vars={{ segmentId: g.id }} paths={paths} className="h-8">Remove</ActionButton> : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {mine && s.status === 'open' ? <ActionButton op="submitTimesheet" vars={{ timesheetId: s.id, expectedVersion: s.version }} paths={paths} confirm="Send this day in for approval?">Send in for approval</ActionButton> : null}
        {approver && !mine && s.status === 'submitted' ? <>
          <ActionButton op="approveTimesheet" vars={{ timesheetId: s.id, expectedVersion: s.version }} paths={paths}>Approve</ActionButton>
          <ActionButton op="rejectTimesheet" vars={{ timesheetId: s.id, expectedVersion: s.version }} ask="Why is it being sent back?" paths={paths}>Send back</ActionButton>
        </> : null}
      </div>
      {mine && s.status === 'open' ? (
        <CommandForm op="addTimeSegment" submit="Add time" fixed={{ timesheetId: s.id }} paths={paths} fields={[
          { name: 'kind', label: 'Kind', kind: 'select', options: KINDS.map(v => ({ value: v, label: label(v) })), width: 'sm' },
          { name: 'startsAt', label: 'From', kind: 'datetime-local', required: true }, { name: 'endsAt', label: 'To', kind: 'datetime-local', required: true },
          { name: 'note', label: 'Note', width: 'md' },
        ]} />
      ) : null}
      {approver && !mine && s.status === 'approved' ? (
        <CommandForm op="adjustTimesheet" submit="Add missed time" fixed={{ timesheetId: s.id }} paths={paths} fields={[
          { name: 'kind', label: 'Kind', kind: 'select', options: ['job', 'drive', ...KINDS].map(v => ({ value: v, label: label(v) })), width: 'sm' },
          { name: 'startsAt', label: 'From', kind: 'datetime-local', required: true }, { name: 'endsAt', label: 'To', kind: 'datetime-local', required: true },
          { name: 'reason', label: 'Reason', required: true },
        ]} />
      ) : null}
    </div>
  );
}

// ── My timesheet (the technician's own day) ─────────────────────────────────────────────────────────────────────

export async function MyTimesheetPage() {
  const me = await gate('canWorkVisits');
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const days = Array.from({ length: 7 }, (_, i) => plusDays(today, -i));
  const d = await q<{ timesheets: Sheet[] }>(`query { timesheets(where: { employee: { user: { id: { equals: "${me.id}" } } } }, orderBy: [{ workDate: desc }], take: 14) { ${SHEET_FIELDS} } }`);
  const have = new Set(d.timesheets.map(s => s.workDate.slice(0, 10)));
  return (
    <Page title="My timesheet">
      <Section title="Open a day">
        <Meta>Your time comes from your visit record. Open a day to pull it in, add anything the visits did not capture, then send it in.</Meta>
        <div className="flex flex-wrap gap-2">
          {days.filter(x => !have.has(x)).map(x => <ActionButton key={x} op="proposeTimesheet" vars={{ workDate: x }} paths={['/dashboard/platform/my-timesheet']}>{dateText(x)}</ActionButton>)}
        </div>
      </Section>
      <Section title="Your days">
        {d.timesheets.length === 0 ? <Empty>No days yet. Open today above.</Empty> : d.timesheets.map(s => (
          <Row key={s.id}>
            <SheetBody s={s} tz={tz} mine approver={false} />
            {s.status === 'open' ? <ActionButton op="proposeTimesheet" vars={{ workDate: s.workDate.slice(0, 10) }} paths={['/dashboard/platform/my-timesheet']}>Refresh from visits</ActionButton> : null}
          </Row>
        ))}
      </Section>
    </Page>
  );
}

// ── Timesheets approval ─────────────────────────────────────────────────────────────────────────────────────────

export async function TimesheetsPage({ status }: { status?: string }) {
  const me = await gate('canApproveTimesheets', 'canRunPayroll');
  const tz = await companyTimeZone();
  const filter = ['submitted', 'approved', 'open', 'locked'].includes(status ?? '') ? (status as string) : 'submitted';
  const d = await q<{ timesheets: (Sheet & { employee: { displayName: string; user?: { id: string } | null } | null })[] }>(`{ timesheets(where: { status: { equals: "${filter}" } }, orderBy: [{ workDate: desc }], take: 200) { ${SHEET_FIELDS.replace('employee { displayName }', 'employee { displayName user { id } }')} } }`);
  const mineOf = (s: { employee: { user?: { id: string } | null } | null }) => !!s.employee?.user?.id && s.employee.user.id === me.id;
  return (
    <Page title="Timesheets">
      <Section title="Show" aside={null}>
        <div className="flex flex-wrap gap-2">
          {['submitted', 'approved', 'open', 'locked'].map(s => <a key={s} href={`/dashboard/platform/timesheets?status=${s}`} className={`inline-flex h-11 items-center rounded-md border px-3 text-sm md:h-8 ${s === filter ? 'bg-muted font-medium' : 'bg-background'}`}>{label(s)}</a>)}
        </div>
      </Section>
      <Section title={`${label(filter)} days`}>
        {d.timesheets.length === 0 ? <Empty>Nothing here.</Empty> : d.timesheets.map(s => <Row key={s.id}><SheetBody s={s} tz={tz} mine={mineOf(s)} approver={me.can('canApproveTimesheets')} /></Row>)}
      </Section>
    </Page>
  );
}

// ── Pay plans ───────────────────────────────────────────────────────────────────────────────────────────────────

type Version = { id: string; versionNumber: number; status: string; version: number; contentHash: string; hourlyRates: Record<string, string> | null; overtime: { weeklyThresholdHours: string; multiplier: string } | null; commission: { basis: string; rules: { scope: string; kind: string; value: string; splitBasis?: string }[] } | null; spiffs: Record<string, string> | null; clawbacks: Record<string, unknown> | null; approval: { id: string; status: string; version: number; requestedBy: { id: string } | null } | null };

export async function PayPlansPage() {
  const me = await gate('canManagePayPlans', 'canApprovePayPlans');
  const d = await q<{ payPlans: { id: string; name: string; versions: Version[] }[]; employees: { id: string; displayName: string }[]; payPlanAssignments: { id: string; from: string; to: string | null; employee: { displayName: string } | null; planVersion: { versionNumber: number; plan: { name: string } | null } | null }[] }>(`{
    payPlans(orderBy: [{ name: asc }]) { id name versions(orderBy: [{ versionNumber: desc }]) { id versionNumber status version contentHash hourlyRates overtime commission spiffs clawbacks approval { id status version requestedBy { id } } } }
    employees(where: { status: { equals: "active" } }, orderBy: [{ displayName: asc }], take: 300) { id displayName }
    payPlanAssignments(where: { to: { equals: null } }, orderBy: [{ from: desc }], take: 300) { id from to employee { displayName } planVersion { versionNumber plan { name } } }
  }`).catch(() => notFound());
  const active = d.payPlans.flatMap(p => p.versions.filter(v => v.status === 'active').map(v => ({ value: v.id, label: `${p.name} v${v.versionNumber}` })));
  const manage = me.can('canManagePayPlans');
  return (
    <Page title="Pay plans">
      {manage ? (
        <Section title="New pay plan">
          <NewPayPlanForm />
        </Section>
      ) : null}
      {d.payPlans.length === 0 ? <Section title="Plans"><Empty>No pay plans yet.</Empty></Section> : d.payPlans.map(p => (
        <Section key={p.id} title={p.name}>
          {p.versions.map(v => (
            <Row key={v.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">Version {v.versionNumber}</span><Status value={v.status} /><Meta>{v.contentHash.slice(0, 10)}</Meta></div>
                <Meta>
                  {money(v.hourlyRates?.default)} an hour · overtime x{v.overtime?.multiplier} after {v.overtime?.weeklyThresholdHours} hours · commission on {label(v.commission?.basis)}
                  {v.commission?.rules.map(r => ` · ${r.kind === 'percent_of_sold' ? `${r.value}% of the sale` : `${money(r.value)} per task`} (${r.scope})`).join('')}
                  {Object.entries(v.spiffs ?? {}).map(([k, a]) => ` · ${k.toUpperCase()} spiff ${money(a)}`).join('')}
                </Meta>
              </div>
              <div className="flex flex-wrap gap-2">
                {manage && v.status === 'draft' ? <ActionButton op="requestPayPlanPublish" vars={{ versionId: v.id }} paths={['/dashboard/platform/pay-plans']} confirm="Ask for approval to publish this version?">Ask for approval</ActionButton> : null}
                {v.status === 'pending_approval' && v.approval && me.can('canApprovePayPlans') && v.approval.requestedBy?.id !== me.id ? <>
                  <ActionButton op="decideApprovalRequest" vars={{ requestId: v.approval.id, decision: 'approve', expectedVersion: v.approval.version }} paths={['/dashboard/platform/pay-plans']}>Approve</ActionButton>
                  <ActionButton op="decideApprovalRequest" vars={{ requestId: v.approval.id, decision: 'reject', expectedVersion: v.approval.version }} ask="Why is it rejected?" paths={['/dashboard/platform/pay-plans']}>Reject</ActionButton>
                </> : null}
                {manage && v.status === 'pending_approval' && v.approval?.status === 'approved' ? <ActionButton op="publishPayPlanVersion" vars={{ versionId: v.id, requestId: v.approval.id }} paths={['/dashboard/platform/pay-plans']}>Publish</ActionButton> : null}
              </div>
            </Row>
          ))}
          {manage ? (
            <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">New version of {p.name}</summary>
              <EditPayPlanDraftForm planId={p.id} />
            </details>
          ) : null}
        </Section>
      ))}
      <Section title="Who is on which plan">
        {manage && active.length ? (
          <CommandForm op="assignPayPlan" submit="Assign" paths={['/dashboard/platform/pay-plans']} fields={[
            { name: 'employeeId', label: 'Person', kind: 'select', required: true, options: d.employees.map(e => ({ value: e.id, label: e.displayName })), width: 'md' },
            { name: 'planVersionId', label: 'Plan', kind: 'select', required: true, options: active, width: 'md' },
            { name: 'from', label: 'From', kind: 'date', required: true, width: 'sm' },
          ]} />
        ) : null}
        {d.payPlanAssignments.length === 0 ? <Empty>Nobody is on a plan yet.</Empty> : d.payPlanAssignments.map(a => (
          <Row key={a.id}><span>{a.employee?.displayName}</span><Meta>{a.planVersion?.plan?.name} v{a.planVersion?.versionNumber} · since {dateText(a.from)}</Meta></Row>
        ))}
      </Section>
    </Page>
  );
}

// ── Pay periods ─────────────────────────────────────────────────────────────────────────────────────────────────

type Period = { id: string; startsOn: string; endsOn: string; payDate: string; status: string; version: number; inputsHash: string; summary: { lineCount: number; totalMinor: string; byKind: Record<string, string>; reviewLines: number; warnings: { code: string; text: string }[] } | null; approval: { id: string; status: string; version: number; consumedAt: string | null; requestedBy: { id: string } | null } | null; batches: { id: string; ref: string; target: string; sha256: string; lineCount: number | null; totalMinor: string }[] };

export async function PayPeriodsPage() {
  const me = await gate('canRunPayroll', 'canApprovePayPeriods');
  const d = await q<{ payPeriods: Period[] }>(`{ payPeriods(orderBy: [{ startsOn: desc }], take: 30) { id startsOn endsOn payDate status version inputsHash summary approval { id status version consumedAt requestedBy { id } } batches { id ref target sha256 lineCount totalMinor } } }`).catch(() => notFound());
  const latest = d.payPeriods[0];
  const nextStart = latest ? plusDays(latest.endsOn.slice(0, 10), 1) : '';
  return (
    <Page title="Pay periods">
      {me.can('canRunPayroll') ? (
        <Section title="Open the next pay period">
          <Meta>A period is whole weeks, Monday to Sunday, starting the day after the last one ends.</Meta>
          <CommandForm op="openPayPeriod" submit="Open period" paths={['/dashboard/platform/pay-periods']} fields={[
            { name: 'startsOn', label: 'First day (a Monday)', kind: 'date', required: true, width: 'sm', defaultValue: nextStart },
            { name: 'endsOn', label: 'Last day (a Sunday)', kind: 'date', required: true, width: 'sm', defaultValue: nextStart ? plusDays(nextStart, 13) : '' },
            { name: 'payDate', label: 'Pay date', kind: 'date', required: true, width: 'sm', defaultValue: nextStart ? plusDays(nextStart, 18) : '' },
          ]} />
        </Section>
      ) : null}
      {d.payPeriods.length === 0 ? <Section title="Periods"><Empty>No pay periods yet.</Empty></Section> : d.payPeriods.map(p => {
        const paths = ['/dashboard/platform/pay-periods'];
        const sum = p.summary;
        return (
          <Section key={p.id} title={`${dateText(p.startsOn)} to ${dateText(p.endsOn)}`} aside={<Status value={p.status} />}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Stat name="Pay date" value={dateText(p.payDate)} />
              <Stat name="Lines" value={sum?.lineCount ?? 0} />
              <Stat name="Total" value={money(sum?.totalMinor ?? '0')} />
              {sum?.byKind ? Object.entries(sum.byKind).map(([k, a]) => <Stat key={k} name={label(k)} value={money(a)} />) : null}
            </div>
            {p.inputsHash ? <Meta>Calculation {p.inputsHash.slice(0, 12)}{sum?.reviewLines ? ` · ${sum.reviewLines} overtime line${sum.reviewLines === 1 ? '' : 's'} need a regular-rate review before payroll` : ''}</Meta> : null}
            {sum?.warnings?.map((w, i) => <Meta key={i}>Note: {w.text}</Meta>)}
            <div className="flex flex-wrap gap-2">
              {me.can('canRunPayroll') && ['open', 'review'].includes(p.status) ? <ActionButton op="calculatePayPeriod" vars={{ payPeriodId: p.id }} paths={paths}>{p.status === 'open' ? 'Calculate' : 'Calculate again'}</ActionButton> : null}
              {me.can('canRunPayroll') && p.status === 'review' && p.inputsHash && !(p.approval && ['pending', 'approved'].includes(p.approval.status) && !p.approval.consumedAt) ? <ActionButton op="requestPayPeriodApproval" vars={{ payPeriodId: p.id }} paths={paths}>Ask for approval</ActionButton> : null}
              {p.status === 'review' && p.approval?.status === 'pending' && me.can('canApprovePayPeriods') && p.approval.requestedBy?.id !== me.id ? <>
                <ActionButton op="decideApprovalRequest" vars={{ requestId: p.approval.id, decision: 'approve', expectedVersion: p.approval.version }} paths={paths} confirm={`Approve ${money(sum?.totalMinor ?? '0')} for payroll?`}>Approve the figures</ActionButton>
                <ActionButton op="decideApprovalRequest" vars={{ requestId: p.approval.id, decision: 'reject', expectedVersion: p.approval.version }} ask="Why is it rejected?" paths={paths}>Reject</ActionButton>
              </> : null}
              {p.status === 'review' && p.approval?.status === 'approved' && !p.approval.consumedAt && (me.can('canRunPayroll') || me.can('canApprovePayPeriods')) ? <ActionButton op="approvePayPeriod" vars={{ payPeriodId: p.id, requestId: p.approval.id, expectedVersion: p.version }} paths={paths} confirm="Lock these figures as approved?">Approve pay period</ActionButton> : null}
              {me.can('canRunPayroll') && p.status === 'approved' ? <>
                <ActionButton op="exportPayPeriod" vars={{ payPeriodId: p.id, target: 'csv' }} paths={paths} confirm="Export and lock this period? Anything that turns up later is paid in the next period.">Export (CSV) and lock</ActionButton>
                <ActionButton op="exportPayPeriod" vars={{ payPeriodId: p.id, target: 'gusto' }} paths={paths} confirm="Export and lock this period? Anything that turns up later is paid in the next period.">Export (Gusto) and lock</ActionButton>
                <ActionButton op="reopenPayPeriod" vars={{ payPeriodId: p.id, expectedVersion: p.version }} ask="Why is it being reopened?" paths={paths}>Back to review</ActionButton>
              </> : null}
              {['review', 'approved', 'exported', 'closed'].includes(p.status) ? csv(`/api/pay-periods/${p.id}/csv`, 'Lines (CSV)') : null}
              {p.batches.map(b => <span key={b.id}>{csv(`/api/pay-periods/${p.id}/export?target=${b.target}`, `${b.ref} · ${label(b.target)} file`)}</span>)}
            </div>
            {p.batches.map(b => <Meta key={b.id}>{b.ref}: {b.lineCount} lines, {money(b.totalMinor)}, fingerprint {b.sha256.slice(0, 16)}</Meta>)}
            {me.can('canRunPayroll') && ['open', 'review'].includes(p.status) ? <AdjustmentForm periodId={p.id} /> : null}
          </Section>
        );
      })}
    </Page>
  );
}

async function AdjustmentForm({ periodId }: { periodId: string }) {
  const d = await q<{ employees: { id: string; displayName: string }[] }>(`{ employees(where: { status: { equals: "active" } }, orderBy: [{ displayName: asc }], take: 300) { id displayName } }`);
  return (
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Add a pay adjustment</summary>
      <CommandForm op="addPayAdjustment" submit="Add adjustment" fixed={{ payPeriodId: periodId }} paths={['/dashboard/platform/pay-periods']} fields={[
        { name: 'employeeId', label: 'Person', kind: 'select', required: true, options: d.employees.map(e => ({ value: e.id, label: e.displayName })), width: 'md' },
        { name: 'amountMinor', label: 'Amount in cents (negative takes away)', required: true, width: 'md' },
        { name: 'reason', label: 'Reason', required: true, width: 'lg' },
      ]} />
    </details>
  );
}

// ── Pay statements (staff self-service) ─────────────────────────────────────────────────────────────────────────

type Line = { id: string; kind: string; hours: string | null; amountMinor: string; earningCode: string; note: string; workweekStart: string; regularRateReview: boolean; reverses: { id: string } | null; payPeriod: { id: string; startsOn: string; endsOn: string; payDate: string; status: string } | null };

export async function PayStatementsPage() {
  const me = await gate('canWorkVisits');
  const d = await q<{ earningLines: Line[] }>(`{ earningLines(where: { employee: { user: { id: { equals: "${me.id}" } } } }, orderBy: [{ workweekStart: desc }, { lineKey: asc }], take: 500) { id kind hours amountMinor earningCode note workweekStart regularRateReview reverses { id } payPeriod { id startsOn endsOn payDate status } } }`);
  const periods = new Map<string, { period: NonNullable<Line['payPeriod']>; lines: Line[] }>();
  for (const l of d.earningLines) {
    if (!l.payPeriod) continue;
    const e = periods.get(l.payPeriod.id) ?? { period: l.payPeriod, lines: [] };
    e.lines.push(l); periods.set(l.payPeriod.id, e);
  }
  const list = [...periods.values()].sort((a, b) => (a.period.startsOn < b.period.startsOn ? 1 : -1));
  return (
    <Page title="My pay">
      {list.length === 0 ? <Section title="Statements"><Empty>Your pay shows here once a pay period that includes you has been approved.</Empty></Section> : list.map(({ period, lines }) => (
        <Section key={period.id} title={`${dateText(period.startsOn)} to ${dateText(period.endsOn)}`} aside={<Meta>Paid {dateText(period.payDate)}</Meta>}>
          {lines.map(l => (
            <Row key={l.id}>
              <div className="min-w-0 flex-1"><span className="font-medium">{label(l.kind)}</span> <Meta>{l.hours ? `${hrs(l.hours)} hours · ` : ''}{l.note}{l.reverses ? ' · takes back an earlier payment' : ''}</Meta></div>
              <span className={`tabular-nums ${l.amountMinor.startsWith('-') ? 'text-red-600' : ''}`}>{money(l.amountMinor)}</span>
            </Row>
          ))}
          <Row><span className="font-medium">Total</span><span className="font-medium tabular-nums">{money(lines.reduce((a, l) => (BigInt(a) + BigInt(l.amountMinor)).toString(), '0'))}</span></Row>
        </Section>
      ))}
    </Page>
  );
}
