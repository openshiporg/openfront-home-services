import Link from 'next/link';
import { q, companyTimeZone, localToday, plusDays, requestTime } from '../../lib/server';
import { label, quantity, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat, Tabs } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { AssignControl } from '../components/AssignControl';

type Visit = {
  id: string; ref: string; status: string; version: number; needsReview: boolean; capacityHours: string;
  job: { id: string; ref: string; summary: string; priority: string; jobType: { name: string } | null; location: { city: string; postalCode: string } | null; customer: { displayName: string } | null } | null;
  assignments: { role: string; employee: { id: string; displayName: string } | null }[];
};
type Window = { id: string; label: string; startsAt: string; capacityHours: string; bookedHours: string; closed: boolean; businessUnit: { id: string; name: string } | null; visits: Visit[] };
type RawVisit = Visit & { window: { id: string } | null };
type Tech = { id: string; displayName: string; businessUnits: { id: string }[] };

const VISIT_FIELDS = 'id ref status version needsReview capacityHours job { id ref summary priority jobType { name } location { city postalCode } customer { displayName } } assignments(where: { active: { equals: true } }) { role employee { id displayName } }';
const NEXT: Record<string, { to: string; label: string }[]> = {
  scheduled: [{ to: 'dispatched', label: 'Dispatch' }],
  dispatched: [{ to: 'en_route', label: 'En route' }],
  en_route: [{ to: 'on_site', label: 'On site' }],
};

/**
 * Dispatch board (SM§4): one day's arrival windows by department with booked vs capacity, each visit
 * and who has it, recommendations with explanations, the tech strip and who is on call right now.
 */
export default async function DispatchPage({ searchParams }: { searchParams?: Promise<{ date?: string; bu?: string }> }) {
  const sp = (await searchParams) ?? {};
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const nowIso = new Date(requestTime()).toISOString();
  const d = await q<{ businessUnits: { id: string; name: string }[]; arrivalWindows: Omit<Window, 'visits'>[]; visits: RawVisit[]; employees: Tech[]; shifts: { employee: { id: string } | null; startsAt: string; endsAt: string; kind: string }[]; onCallRotations: { escalationOrder: number; businessUnit: { name: string } | null; employee: { displayName: string } | null; endsAt: string }[]; review: number }>(`
    query Board($date: CalendarDay!, $now: DateTime!) {
      businessUnits(where: { active: { equals: true }, capacityEnabled: { equals: true } }, orderBy: [{ name: asc }]) { id name }
      arrivalWindows(where: { date: { equals: $date } }, orderBy: [{ startsAt: asc }], take: 200) {
        id label startsAt capacityHours bookedHours closed businessUnit { id name }
      }
      visits(where: { window: { date: { equals: $date } }, status: { not: { in: ["cancelled"] } } }, orderBy: [{ createdAt: asc }], take: 500) { ${VISIT_FIELDS} window { id } }
      employees(where: { dispatchable: { equals: true }, status: { equals: "active" } }, orderBy: [{ displayName: asc }]) { id displayName businessUnits { id } }
      shifts(where: { date: { equals: $date } }) { employee { id } startsAt endsAt kind }
      onCallRotations(where: { startsAt: { lte: $now }, endsAt: { gt: $now } }, orderBy: [{ escalationOrder: asc }]) { escalationOrder businessUnit { name } employee { displayName } endsAt }
      review: visitsCount(where: { needsReview: { equals: true } })
    }`, { date, now: nowIso });
  const bu = sp.bu && d.businessUnits.some(b => b.id === sp.bu) ? sp.bu : 'all';
  const all: Window[] = d.arrivalWindows.map(w => ({ ...w, visits: d.visits.filter(v => v.window?.id === w.id) }));
  const windows = all.filter(w => bu === 'all' || w.businessUnit?.id === bu);
  const visits = windows.flatMap(w => w.visits);
  const unassigned = visits.filter(v => v.status === 'unassigned').length;
  const loadOf = (id: string) => d.visits.filter(v => v.assignments.some(a => a.employee?.id === id)).length;
  const href = (o: { date?: string; bu?: string }) => `/dashboard/platform/dispatch?date=${o.date ?? date}${(o.bu ?? bu) !== 'all' ? `&bu=${o.bu ?? bu}` : ''}`;
  const path = '/dashboard/platform/dispatch';

  return (
    <Page title="Dispatch board">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link className="rounded-md border px-2 py-1" href={href({ date: plusDays(date, -1) })}>←</Link>
        <span className="font-medium">{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T00:00:00Z`))}</span>
        <Link className="rounded-md border px-2 py-1" href={href({ date: plusDays(date, 1) })}>→</Link>
        {date !== today ? <Link className="text-xs underline" href={href({ date: today })}>Today</Link> : null}
      </div>
      <Tabs active={bu} items={[{ key: 'all', label: 'All', href: href({ bu: 'all' }) }, ...d.businessUnits.map(b => ({ key: b.id, label: b.name, href: href({ bu: b.id }) }))]} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Visits" value={visits.length} />
        <Stat name="Unassigned" value={<span className={unassigned ? 'text-amber-600' : ''}>{unassigned}</span>} />
        <Stat name="Booked hours" value={`${quantity(sumText(windows.map(w => w.bookedHours)))} / ${quantity(sumText(windows.map(w => w.capacityHours)))}`} />
        <Stat name="Needs review" value={d.review} />
      </div>

      <Section title="On call now">
        {d.onCallRotations.length ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {d.onCallRotations.map((o, i) => <span key={i}><span className="font-medium">{o.employee?.displayName}</span> <span className="text-muted-foreground">{o.businessUnit?.name} · {o.escalationOrder === 1 ? 'primary' : 'backup'} until {when(o.endsAt, tz)}</span></span>)}
          </div>
        ) : <Empty>Nobody is on call right now. Set up the rota on the Technicians screen.</Empty>}
      </Section>

      {windows.length ? groupBy(windows, w => w.businessUnit?.name ?? 'Other').map(([name, rows]) => {
        const techs = d.employees.filter(t => t.businessUnits.some(b => b.id === rows[0].businessUnit?.id)).map(t => ({ id: t.id, name: `${t.displayName} (${loadOf(t.id)})` }));
        return (
          <Section key={name} title={name}>
            {rows.map(w => (
              <div key={w.id} className="border-b py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{w.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{quantity(w.bookedHours)} of {quantity(w.capacityHours)} h booked{w.closed ? ' · closed' : ''}</span>
                </div>
                {w.visits.length ? w.visits.map(v => (
                  <Row key={v.id} className="pl-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="font-medium underline-offset-2 hover:underline" href={`/dashboard/platform/jobs/${v.job?.id}`}>{v.job?.jobType?.name ?? 'Visit'}</Link>
                        <span className="font-mono text-xs text-muted-foreground">{v.ref}</span>
                        <Status value={v.status} />
                        {v.job?.priority === 'emergency' ? <Status value="emergency" /> : null}
                        {v.needsReview ? <span className="text-xs text-amber-600">status sent out of order; check the job</span> : null}
                      </div>
                      <Meta>{v.job?.customer?.displayName ?? ''}{v.job?.location ? ` · ${v.job.location.city} ${v.job.location.postalCode}` : ''} · {quantity(v.capacityHours)} h{v.job?.summary ? ` · ${v.job.summary}` : ''}</Meta>
                      {v.assignments.length ? <Meta><br />{v.assignments.map(a => `${a.employee?.displayName} (${label(a.role, 'crewRole').toLowerCase()})`).join(', ')}</Meta> : null}
                      {v.status === 'unassigned' ? <AssignControl visitId={v.id} version={v.version} techs={techs} path={path} /> : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(NEXT[v.status] ?? []).map(n => <ActionButton key={n.to} op="setVisitStatus" vars={{ visitId: v.id, to: n.to, expectedVersion: v.version }} paths={[path]}>{n.label}</ActionButton>)}
                      {['scheduled', 'dispatched'].includes(v.status) ? <ActionButton op="unassignVisit" vars={{ visitId: v.id, expectedVersion: v.version }} ask="Why take it off this tech?" paths={[path]}>Unassign</ActionButton> : null}
                    </div>
                  </Row>
                )) : <p className="py-2 pl-3 text-xs text-muted-foreground">Open</p>}
              </div>
            ))}
          </Section>
        );
      }) : <Empty>No arrival windows on this day. Windows open from the templates in Settings, three weeks ahead.</Empty>}

      <Section title="Technicians today">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {d.employees.map(t => {
            const shift = d.shifts.find(s => s.employee?.id === t.id && s.kind === 'regular');
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{t.displayName}</span>
                <span className="text-xs text-muted-foreground">{shift ? `${when(shift.startsAt, tz, 'time')}–${when(shift.endsAt, tz, 'time')}` : 'off'} · {loadOf(t.id)} visits</span>
              </div>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}

function groupBy<T>(rows: T[], key: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return [...map.entries()];
}

/** Sum decimal strings exactly (scaled integers), for display. */
function sumText(values: string[]) {
  let total = BigInt(0);
  for (const v of values) {
    const [w = '0', f = ''] = String(v ?? '0').split('.');
    total += BigInt(w || '0') * BigInt(10000) + BigInt((f + '0000').slice(0, 4));
  }
  const whole = total / BigInt(10000);
  const frac = (total % BigInt(10000)).toString().padStart(4, '0');
  return `${whole}.${frac}`;
}
