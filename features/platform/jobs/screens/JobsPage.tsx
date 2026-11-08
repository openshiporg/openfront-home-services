import { q, companyTimeZone } from '../../lib/server';
import { label, when, windowText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';

type Job = {
  id: string; ref: string; status: string; priority: string; source: string; summary: string; holdReason: string; createdAt: string;
  jobType: { name: string } | null; businessUnit: { name: string } | null; customer: { id: string; displayName: string } | null; location: { city: string; postalCode: string } | null;
  bookedByAgent: { name: string } | null;
  visits: { status: string; window: { date: string; label: string } | null; assignments: { employee: { displayName: string } | null }[] }[];
};

const VIEWS: Record<string, string[]> = {
  open: ['booked', 'scheduled', 'in_progress'],
  hold: ['on_hold'],
  done: ['work_complete', 'awaiting_inspection', 'completed', 'closed'],
  cancelled: ['cancelled'],
};

/** Jobs (SM§3): what's booked, under way, on hold or done; who booked it (a person or the AI receptionist). */
export default async function JobsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'open';
  const view = raw in VIEWS ? raw : 'open';
  const counts = Object.entries(VIEWS).map(([k, v]) => `${k}: jobsCount(where: { status: { in: ${JSON.stringify(v)} } })`).join('\n');
  const [d, tz] = await Promise.all([
    q<{ jobs: Job[] } & Record<string, number>>(`{
      jobs(where: { status: { in: ${JSON.stringify(VIEWS[view])} } }, orderBy: [{ createdAt: desc }], take: 150) {
        id ref status priority source summary holdReason createdAt jobType { name } businessUnit { name } customer { id displayName } location { city postalCode } bookedByAgent { name }
        visits(orderBy: [{ createdAt: desc }], take: 1) { status window { date label } assignments(where: { active: { equals: true } }) { employee { displayName } } }
      }
      ${counts}
    }`),
    companyTimeZone(),
  ]);
  return (
    <Page title="Jobs">
      <Tabs active={view} items={[
        { key: 'open', label: 'Open', href: '/dashboard/platform/jobs', count: d.open },
        { key: 'hold', label: 'On hold', href: '/dashboard/platform/jobs?view=hold', count: d.hold },
        { key: 'done', label: 'Done', href: '/dashboard/platform/jobs?view=done', count: d.done },
        { key: 'cancelled', label: 'Cancelled', href: '/dashboard/platform/jobs?view=cancelled', count: d.cancelled },
      ]} />
      <Section title="Jobs">
        {d.jobs.length ? d.jobs.map(j => {
          const v = j.visits[0];
          return (
            <Row key={j.id} href={`/dashboard/platform/jobs/${j.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                {/* One line: the title truncates before the status does; the job number moves to the meta line on phones. */}
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-medium">{j.jobType?.name ?? 'Job'}</span>
                  <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{j.ref}</span>
                  <Status value={j.status} className="shrink-0" />
                  {j.priority === 'emergency' ? <Status value="emergency" className="shrink-0" /> : null}
                </div>
                <Meta>
                  <span className="sm:hidden"><span className="font-mono">{j.ref}</span> · </span>{j.customer?.displayName ?? ''}{j.location ? ` · ${j.location.city} ${j.location.postalCode}` : ''} · {j.businessUnit?.name ?? ''}
                  {v?.window ? ` · ${windowText(v.window)}` : ''}{v?.assignments.length ? ` · ${v.assignments.map(a => a.employee?.displayName).join(', ')}` : ''}
                </Meta>
                <Meta><br />{j.bookedByAgent ? `Booked by the AI receptionist (${j.bookedByAgent.name})` : label(j.source, 'bookedVia')} · {when(j.createdAt, tz)}{j.holdReason ? ` · on hold: ${label(j.holdReason).toLowerCase()}` : ''}</Meta>
              </div>
            </Row>
          );
        }) : <Empty>No jobs here.</Empty>}
      </Section>
    </Page>
  );
}
