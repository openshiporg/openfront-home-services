import { q, companyTimeZone, localToday, plusDays } from '../../lib/server';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';

type Visit = {
  id: string; ref: string; status: string;
  window: { date: string; label: string; startsAt: string } | null;
  job: { summary: string; priority: string; jobType: { name: string } | null; location: { address1: string; city: string; postalCode: string } | null; customer: { displayName: string } | null } | null;
};

/** A technician's day (staff, mobile first): their visits today and tomorrow, in window order. */
export default async function FieldTodayPage() {
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const me = await q<{ authenticatedItem: { id: string; name: string } | null }>(`{ authenticatedItem { ... on User { id name } } }`);
  const userId = me.authenticatedItem?.id ?? '';
  const d = await q<{ visits: Visit[] }>(`
    query Mine($user: ID!, $from: CalendarDay!, $to: CalendarDay!) {
      visits(where: { assignments: { some: { active: { equals: true }, employee: { user: { id: { equals: $user } } } } }, window: { date: { gte: $from, lte: $to } } }, orderBy: [{ plannedStart: asc }], take: 40) {
        id ref status window { date label startsAt }
        job { summary priority jobType { name } location { address1 city postalCode } customer { displayName } }
      }
    }`, { user: userId, from: today, to: plusDays(today, 1) });
  const days = [today, plusDays(today, 1)];
  return (
    <Page title="My day">
      {days.map(day => {
        const rows = d.visits.filter(v => v.window?.date === day).sort((a, b) => (a.window?.startsAt ?? '').localeCompare(b.window?.startsAt ?? ''));
        return (
          <Section key={day} title={day === today ? 'Today' : 'Tomorrow'}>
            {rows.length ? rows.map(v => (
              <Row key={v.id} href={`/dashboard/field/visits/${v.id}`} className="py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-base font-medium">{v.window?.label}</span>{v.job?.priority === 'emergency' ? <Status value="emergency" /> : null}</div>
                  <p className="text-sm">{v.job?.jobType?.name} · {v.job?.customer?.displayName}</p>
                  <Meta>{v.job?.location ? `${v.job.location.address1}, ${v.job.location.city}` : ''}{v.job?.summary ? ` · ${v.job.summary}` : ''}</Meta>
                </div>
                <Status value={v.status} />
              </Row>
            )) : <Empty>No visits.</Empty>}
          </Section>
        );
      })}
    </Page>
  );
}
