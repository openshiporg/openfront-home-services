import { q, companyTimeZone } from '../../lib/server';
import { lastDayBefore, money, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';

type Est = {
  id: string; ref: string; title: string; status: string; source: string; createdAt: string;
  customer: { displayName: string } | null; businessUnit: { name: string } | null; job: { id: string; ref: string } | null; createdByAgent: { name: string } | null;
  currentVersion: { versionNumber: number; status: string; presentedAt: string | null; validUntil: string | null; options: { totalMinor: string }[] } | null;
};

const VIEWS: Record<string, string[]> = { open: ['open'], sold: ['sold'], declined: ['declined', 'expired'], cancelled: ['cancelled', 'discarded'] };

/** Estimates: drafts and presented options waiting on the customer, sales, and the ones that got away. */
export default async function EstimatesPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'open';
  const view = raw in VIEWS ? raw : 'open';
  const counts = Object.entries(VIEWS).map(([k, v]) => `${k}: estimatesCount(where: { status: { in: ${JSON.stringify(v)} } })`).join('\n');
  const [d, tz] = await Promise.all([
    q<{ estimates: Est[] } & Record<string, number>>(`{
      estimates(where: { status: { in: ${JSON.stringify(VIEWS[view])} } }, orderBy: [{ createdAt: desc }], take: 150) {
        id ref title status source createdAt customer { displayName } businessUnit { name } job { id ref } createdByAgent { name }
        currentVersion { versionNumber status presentedAt validUntil options(orderBy: [{ sortOrder: asc }]) { totalMinor } }
      }
      ${counts}
    }`),
    companyTimeZone(),
  ]);
  return (
    <Page title="Estimates">
      <Tabs active={view} items={[
        { key: 'open', label: 'Open', href: '/dashboard/platform/estimates', count: d.open },
        { key: 'sold', label: 'Sold', href: '/dashboard/platform/estimates?view=sold', count: d.sold },
        { key: 'declined', label: 'Declined or expired', href: '/dashboard/platform/estimates?view=declined', count: d.declined },
        { key: 'cancelled', label: 'Cancelled', href: '/dashboard/platform/estimates?view=cancelled', count: d.cancelled },
      ]} />
      <Section title="Estimates">
        {d.estimates.length ? d.estimates.map(e => {
          const v = e.currentVersion;
          const totals = (v?.options ?? []).map(o => BigInt(o.totalMinor)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          const range = totals.length ? (totals.length === 1 ? money(totals[0]) : `${money(totals[0])}–${money(totals[totals.length - 1])}`) : '';
          return (
            <Row key={e.id} href={`/dashboard/platform/estimates/${e.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words font-medium">{e.title}</span>
                  <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{e.ref}</span>
                  <Status value={e.status === 'open' && v ? v.status : e.status} className="shrink-0" />
                </div>
                <Meta>
                  <span className="sm:hidden"><span className="font-mono">{e.ref}</span> · </span>{e.customer?.displayName ?? ''}{e.businessUnit ? ` · ${e.businessUnit.name}` : ''}
                  {v ? ` · v${v.versionNumber}` : ''}{range ? ` · ${range}` : ''}
                  {v?.presentedAt ? ` · presented ${when(v.presentedAt, tz)}` : ` · started ${when(e.createdAt, tz)}`}{v?.validUntil && e.status === 'open' ? ` · good through ${lastDayBefore(v.validUntil, tz)}` : ''}
                  {e.createdByAgent ? ` · drafted by AI agent ${e.createdByAgent.name}` : ''}{e.job ? ` · job ${e.job.ref}` : ''}
                </Meta>
              </div>
            </Row>
          );
        }) : <Empty>No estimates here.</Empty>}
      </Section>
    </Page>
  );
}
