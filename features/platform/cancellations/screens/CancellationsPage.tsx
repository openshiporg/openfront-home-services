import { q, companyTimeZone, requestTime } from '../../lib/server';
import { deadlineText, label, money, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';

type Notice = {
  id: string; ref: string; rule: string; status: string; transactionAt: string; cancelBy: string; deliveredAt: string | null; coveredAmountMinor: string; refundDueBy: string | null; refundDueMinor: string;
  customer: { displayName: string } | null; job: { ref: string } | null; startOverride: { status: string } | null;
};

const VIEWS: Record<string, { statuses: string[]; title: string }> = {
  deliver: { statuses: ['issued'], title: 'Waiting for delivery' },
  open: { statuses: ['delivered'], title: 'Window open' },
  refund: { statuses: ['cancelled_by_buyer'], title: 'Refund due' },
  closed: { statuses: ['expired_uncancelled', 'refunded', 'waived'], title: 'Closed' },
};

/**
 * Cancellation notices (the cooling-off queue): notices the buyer has not been given yet, sales still
 * inside their cancellation window, and cancellations waiting on a refund. Deadlines are business days in
 * the company's time zone, computed by the server.
 */
export default async function CancellationsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'deliver';
  const view = raw in VIEWS ? raw : 'deliver';
  const counts = Object.entries(VIEWS).map(([k, v]) => `${k}: cancellationNoticesCount(where: { status: { in: ${JSON.stringify(v.statuses)} } })`).join('\n');
  const order = view === 'refund' ? '{ refundDueBy: asc }' : view === 'closed' ? '{ transactionAt: desc }' : '{ cancelBy: asc }';
  const now = requestTime();
  const [d, tz] = await Promise.all([
    q<{ cancellationNotices: Notice[] } & Record<string, number>>(`{
      cancellationNotices(where: { status: { in: ${JSON.stringify(VIEWS[view].statuses)} } }, orderBy: [${order}], take: 150) {
        id ref rule status transactionAt cancelBy deliveredAt coveredAmountMinor refundDueBy refundDueMinor customer { displayName } job { ref } startOverride { status }
      }
      ${counts}
    }`),
    companyTimeZone(),
  ]);
  return (
    <Page title="Cancellations">
      <Tabs active={view} items={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v.title, href: `/dashboard/platform/cancellations${k === 'deliver' ? '' : `?view=${k}`}`, count: d[k] }))} />
      <Section title={VIEWS[view].title}>
        {d.cancellationNotices.length ? d.cancellationNotices.map(n => {
          const late = n.status === 'cancelled_by_buyer' && n.refundDueBy && Date.parse(n.refundDueBy) < now;
          return (
            <Row key={n.id} href={`/dashboard/platform/cancellations/${n.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-medium">{n.customer?.displayName ?? n.ref}</span>
                  <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{n.ref}</span>
                  <Status value={n.status} className="shrink-0" />
                </div>
                <Meta>
                  <span className="sm:hidden"><span className="font-mono">{n.ref}</span> · </span>{label(n.rule)} · covers {money(n.coveredAmountMinor)}
                  {n.status === 'cancelled_by_buyer' ? <> · refund {money(n.refundDueMinor)} by <span className={late ? 'font-medium text-red-600' : ''}>{n.refundDueBy ? deadlineText(n.refundDueBy, tz) : '—'}</span></> : ` · sold ${when(n.transactionAt, tz)} · cancel by ${deadlineText(n.cancelBy, tz)}`}
                  {n.status === 'issued' ? ' · not yet given to the buyer' : ''}{n.startOverride ? ` · early start ${label(n.startOverride.status).toLowerCase()}` : ''}{n.job ? ` · job ${n.job.ref}` : ''}
                </Meta>
              </div>
            </Row>
          );
        }) : <Empty>Nothing here.</Empty>}
      </Section>
    </Page>
  );
}
