import { notFound } from 'next/navigation';
import { keystoneContext } from '@/features/keystone/context';
import { dueForService } from '@/features/keystone/services/agreements';
import { viewer } from '../../lib/server';
import { dateText, phoneText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';

/** The call list: visits members and agreements are owed, soonest deadline first. Worked out from today's date on every load. */
export default async function DueForServicePage() {
  const me = await viewer();
  if (!me.can('canSellMemberships') && !me.can('canManageMemberships') && !me.can('canBook') && !me.can('canDispatch')) notFound();
  const rows = await dueForService(keystoneContext.prisma as never, { horizonDays: 45, take: 300 });
  const groups = [
    { key: 'overdue', title: 'Overdue', rows: rows.filter(r => r.state === 'overdue') },
    { key: 'due', title: 'Open now', rows: rows.filter(r => r.state === 'due') },
    { key: 'upcoming', title: 'Opening in the next 45 days', rows: rows.filter(r => r.state === 'upcoming') },
  ];
  return (
    <Page title="Due for service">
      <Meta>Call these customers to book their visit. When you book the job, link it to the visit on the member&apos;s page so the visit is counted once.</Meta>
      {groups.map(g => (
        <Section key={g.key} title={`${g.title} · ${g.rows.length}`}>
          {g.rows.length ? g.rows.map(r => (
            <Row key={r.eventId} href={r.source === 'membership' ? undefined : undefined}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{r.customer} · {r.name}</span><Status value={r.state === 'upcoming' ? 'scheduled' : r.state === 'due' ? 'new' : 'breached'} /><span className="ml-auto text-sm tabular-nums">by {dateText(r.dueBy)}</span></div>
                <Meta>{r.phone ? `${phoneText(r.phone)} · ` : ''}{r.address} · {r.source === 'membership' ? 'member' : 'service agreement'} {r.sourceRef} · opens {dateText(r.dueFrom)}</Meta>
              </div>
            </Row>
          )) : <Empty>{g.key === 'overdue' ? 'Nothing is overdue.' : 'Nothing here.'}</Empty>}
        </Section>
      ))}
    </Page>
  );
}
