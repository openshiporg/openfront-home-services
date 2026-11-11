import { q, companyTimeZone } from '../../lib/server';
import { label, money, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';

type Inv = { id: string; ref: string; status: string; totalMinor: string; balanceMinor: string; dueDate: string | null; collectionsStatus: string; customer: { displayName: string } | null; payer: { name: string } | null; job: { ref: string } | null };

const VIEWS: Record<string, { statuses: string[]; title: string }> = {
  open: { statuses: ['posted', 'partially_paid'], title: 'Owed' },
  draft: { statuses: ['draft'], title: 'Drafts' },
  paid: { statuses: ['paid'], title: 'Paid' },
  closed: { statuses: ['written_off', 'voided', 'discarded'], title: 'Written off & voided' },
};

/** Invoices by state; the open view is the receivable. AR aging downloads from here. */
export default async function InvoicesPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'open';
  const view = raw in VIEWS ? raw : 'open';
  const counts = Object.entries(VIEWS).map(([k, v]) => `${k}: invoicesCount(where: { status: { in: ${JSON.stringify(v.statuses)} } })`).join('\n');
  const [d] = await Promise.all([
    q<{ invoices: Inv[] } & Record<string, number>>(`{
      invoices(where: { status: { in: ${JSON.stringify(VIEWS[view].statuses)} } }, orderBy: [{ ${view === 'open' ? 'dueDate: asc' : 'createdAt: desc'} }], take: 150) {
        id ref status totalMinor balanceMinor dueDate collectionsStatus customer { displayName } payer { name } job { ref }
      }
      ${counts}
    }`),
    companyTimeZone(),
  ]);
  const owed = d.invoices.reduce((s, i) => s + BigInt(i.balanceMinor), 0n);
  return (
    <Page title="Invoices">
      <Tabs active={view} items={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v.title, href: `/dashboard/platform/invoices${k === 'open' ? '' : `?view=${k}`}`, count: d[k] }))} />
      <Section title={`${VIEWS[view].title}${view === 'open' ? ` · ${money(owed.toString())}` : ''}`} aside={<a className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm" href="/api/reports/ar-aging">Export AR aging</a>}>
        {d.invoices.length ? d.invoices.map(i => (
          <Row key={i.id} href={`/dashboard/platform/invoices/${i.id}`}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 break-words font-medium">{i.payer?.name ?? i.customer?.displayName ?? i.ref}</span>
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{i.ref}</span>
                <Status value={i.status} className="shrink-0" />
                <span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(i.balanceMinor)}</span>
              </div>
              <Meta>{i.ref} · total {money(i.totalMinor)}{i.dueDate ? ` · due ${dateText(i.dueDate.slice(0, 10))}` : ''}{i.collectionsStatus !== 'current' ? ` · ${label(i.collectionsStatus).toLowerCase()}` : ''}{i.job ? ` · job ${i.job.ref}` : ''}</Meta>
            </div>
          </Row>
        )) : <Empty>Nothing here.</Empty>}
      </Section>
    </Page>
  );
}
