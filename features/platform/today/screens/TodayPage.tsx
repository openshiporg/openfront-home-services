import Link from 'next/link';
import { q, companyTimeZone, localToday, requestTime } from '../../lib/server';
import { quantity, when } from '../../lib/format';
import { ActionButton } from '../../components/ActionButton';
import { Page, Row, Empty, Meta, Section, Stat, Status } from '../../components/ui';

type Window = { label: string; capacityHours: string; bookedHours: string; businessUnit: { id: string; name: string } | null };

/** Scaled-integer sum of decimal strings (display only; no floats). */
function sum(values: string[]) {
  let t = BigInt(0);
  for (const v of values) { const [w = '0', f = ''] = String(v ?? '0').split('.'); t += BigInt(w || '0') * BigInt(10000) + BigInt((f + '0000').slice(0, 4)); }
  return `${t / BigInt(10000)}.${(t % BigInt(10000)).toString().padStart(4, '0')}`;
}
function pct(part: string, whole: string) {
  const s = (v: string) => { const [w = '0', f = ''] = v.split('.'); return BigInt(w || '0') * BigInt(10000) + BigInt((f + '0000').slice(0, 4)); };
  const d = s(whole);
  return d === BigInt(0) ? '—' : `${(s(part) * BigInt(100)) / d}%`;
}

/** Today: booked vs capacity by department, calls and who answered, unassigned visits, techs in the field, waiting work. */
export default async function TodayPage() {
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const nowMs = requestTime();
  const since = new Date(`${today}T00:00:00Z`).getTime() - 12 * 3600_000;
  const d = await q<{
    arrivalWindows: Window[]; unassigned: number; visits: number; inField: { status: string; assignments: { employee: { displayName: string } | null }[]; job: { jobType: { name: string } | null; location: { city: string } | null } | null }[];
    calls: number; aiCalls: number; aiBooked: number; handoffs: number; newLeads: number; lateLeads: number; approvals: number; tasks: number; review: number;
    onCall: { escalationOrder: number; employee: { displayName: string } | null; businessUnit: { name: string } | null }[];
  }>(`
    query Today($date: CalendarDay!, $since: DateTime!, $now: DateTime!) {
      arrivalWindows(where: { date: { equals: $date } }) { label capacityHours bookedHours businessUnit { id name } }
      visits: visitsCount(where: { window: { date: { equals: $date } }, status: { not: { equals: "cancelled" } } })
      unassigned: visitsCount(where: { window: { date: { equals: $date } }, status: { equals: "unassigned" } })
      inField: visits(where: { status: { in: ["en_route", "on_site", "working", "paused"] } }, take: 30) { status assignments(where: { active: { equals: true } }) { employee { displayName } } job { jobType { name } location { city } } }
      calls: callsCount(where: { createdAt: { gte: $since } })
      aiCalls: callsCount(where: { createdAt: { gte: $since }, answeredBy: { equals: "ai_agent" } })
      aiBooked: callsCount(where: { createdAt: { gte: $since }, answeredBy: { equals: "ai_agent" }, NOT: [{ job: null }] })
      handoffs: callsCount(where: { status: { equals: "handoff_requested" } })
      newLeads: leadsCount(where: { status: { equals: "new" } })
      lateLeads: leadsCount(where: { status: { equals: "new" }, respondDueAt: { lt: $now } })
      approvals: approvalRequestsCount(where: { status: { equals: "pending" } })
      tasks: tasksCount(where: { status: { in: ["open", "in_progress"] } })
      review: visitsCount(where: { needsReview: { equals: true } })
      onCall: onCallRotations(where: { startsAt: { lte: $now }, endsAt: { gt: $now } }, orderBy: [{ escalationOrder: asc }]) { escalationOrder employee { displayName } businessUnit { name } }
    }`, { date: today, since: new Date(since).toISOString(), now: new Date(nowMs).toISOString() });
  const units = new Map<string, Window[]>();
  for (const w of d.arrivalWindows) units.set(w.businessUnit?.name ?? 'Other', [...(units.get(w.businessUnit?.name ?? 'Other') ?? []), w]);
  const booked = sum(d.arrivalWindows.map(w => w.bookedHours));
  const capacity = sum(d.arrivalWindows.map(w => w.capacityHours));
  const link = (href: string, n: number, warn = false) => <Link href={href} className={warn && n ? 'text-amber-600 underline' : 'underline-offset-2 hover:underline'}>{n}</Link>;
  return (
    <Page title="Today">
      <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(nowMs))}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat name="Booked" value={`${pct(booked, capacity)}`} />
        <Stat name="Visits" value={link('/dashboard/platform/dispatch', d.visits)} />
        <Stat name="Unassigned" value={link('/dashboard/platform/dispatch', d.unassigned, true)} />
        <Stat name="Calls" value={link('/dashboard/platform/calls', d.calls)} />
        <Stat name="AI answered / booked" value={`${d.aiCalls} / ${d.aiBooked}`} />
        <Stat name="New leads (late)" value={<Link className={d.lateLeads ? 'text-red-600 underline' : ''} href="/dashboard/platform/leads">{d.newLeads} ({d.lateLeads})</Link>} />
      </div>
      <Section title="Capacity by department">
        {units.size ? [...units.entries()].map(([name, ws]) => {
          const b = sum(ws.map(w => w.bookedHours)); const c = sum(ws.map(w => w.capacityHours));
          return (
            <Row key={name}>
              <span className="font-medium">{name}</span>
              <span className="flex items-center gap-3">
                <span className="hidden gap-1 sm:flex">{ws.map((w, i) => <span key={i} title={`${w.label}: ${quantity(w.bookedHours)} of ${quantity(w.capacityHours)} h`} className="h-2 w-8 overflow-hidden rounded bg-muted"><span className="block h-full bg-emerald-500" style={{ width: pct(w.bookedHours, w.capacityHours).replace('—', '0%') }} /></span>)}</span>
                <span className="font-mono text-xs text-muted-foreground">{quantity(b)} / {quantity(c)} h</span>
              </span>
            </Row>
          );
        }) : <Empty>No windows today (closed day or not opened yet).</Empty>}
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="In the field now">
          {d.inField.length ? d.inField.map((v, i) => (
            <Row key={i}><span className="flex flex-wrap items-center gap-2 text-sm"><span>{v.assignments.map(a => a.employee?.displayName).join(', ') || '—'}</span><Status value={v.status} /><Meta>{v.job?.jobType?.name} · {v.job?.location?.city}</Meta></span></Row>
          )) : <Empty>Nobody is out on a visit right now.</Empty>}
        </Section>
        <Section title="Waiting on someone">
          <Row href="/dashboard/platform/approvals"><span>Approvals</span><span className="font-mono">{d.approvals}</span></Row>
          <Row href="/dashboard/platform/tasks"><span>Open tasks</span><span className="font-mono">{d.tasks}</span></Row>
          <Row href="/dashboard/platform/calls?view=handoff"><span>Calls the AI handed to a person</span><span className="font-mono">{d.handoffs}</span></Row>
          <Row href="/dashboard/platform/dispatch"><span>Visits needing review</span><span className="font-mono">{d.review}</span></Row>
          <Row><span>On call</span><Meta>{d.onCall.map(o => `${o.employee?.displayName} (${o.businessUnit?.name}${o.escalationOrder === 1 ? '' : ', backup'})`).join(', ') || 'nobody'}</Meta></Row>
        </Section>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Meta>Updated {when(new Date(nowMs).toISOString(), tz, 'time')}</Meta>
        <ActionButton op="refreshTimedStates" vars={{}} paths={['/dashboard/platform/today']}>Refresh holds, estimates and price books</ActionButton>
      </div>
    </Page>
  );
}
