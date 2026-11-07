import { q, companyTimeZone } from '../../lib/server';
import { label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';

type Task = { id: string; kind: string; title: string; detail: string; subjectType: string; subjectId: string; dueAt: string | null; status: string; priority: string; assignee: { name: string } | null; role: { name: string } | null };

const PRIORITY: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Work queues raised by the system (overdue registrations, follow-ups, exceptions) for a person or a role. */
export default async function TasksPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const view = (await searchParams)?.view === 'closed' ? 'closed' : 'open';
  const where = view === 'open' ? '{ status: { in: ["open", "in_progress"] } }' : '{ status: { in: ["done", "cancelled"] } }';
  const [d, tz] = await Promise.all([
    q<{ tasks: Task[]; open: number; closed: number }>(`{
      tasks(where: ${where}, orderBy: [{ dueAt: asc }], take: 200) { id kind title detail subjectType subjectId dueAt status priority assignee { name } role { name } }
      open: tasksCount(where: { status: { in: ["open", "in_progress"] } })
      closed: tasksCount(where: { status: { in: ["done", "cancelled"] } })
    }`),
    companyTimeZone(),
  ]);
  const tasks = [...d.tasks].sort((a, b) => (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9));
  const now = Date.now();
  return (
    <Page title="Tasks">
      <Tabs active={view} items={[
        { key: 'open', label: 'Open', href: '/dashboard/platform/tasks', count: d.open },
        { key: 'closed', label: 'Closed', href: '/dashboard/platform/tasks?view=closed', count: d.closed },
      ]} />
      <Section title={view === 'open' ? 'Open work' : 'Done or cancelled'}>
        {tasks.length ? tasks.map(t => (
          <Row key={t.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.title}</span><span className="font-mono text-xs uppercase text-muted-foreground">{label(t.priority)}</span></div>
              <Meta>{label(t.kind)}{t.subjectType ? ` · ${t.subjectType} ${t.subjectId}` : ''}{t.assignee ? ` · ${t.assignee.name}` : t.role ? ` · ${t.role.name}` : ''}{t.detail ? ` · ${t.detail}` : ''}</Meta>
            </div>
            <div className="space-y-1 text-right">
              <Status value={t.status} />
              {t.dueAt ? <p className={`text-xs ${new Date(t.dueAt).getTime() < now && view === 'open' ? 'text-red-600' : 'text-muted-foreground'}`}>Due {when(t.dueAt, tz)}</p> : null}
            </div>
          </Row>
        )) : <Empty>{view === 'open' ? 'Nothing waiting.' : 'No closed tasks yet.'}</Empty>}
      </Section>
    </Page>
  );
}
