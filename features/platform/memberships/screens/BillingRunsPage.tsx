import { notFound } from 'next/navigation';
import { q, companyTimeZone, localToday, viewer } from '../../lib/server';
import { money, when, dateText, label } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { BillingRunForm } from '../components/MembershipForms';

type Run = { id: string; ref: string; period: string; status: string; queuedCount: number; chargedCount: number; failedCount: number; unknownCount: number; remainingCount: number; chargedMinor: string; startedAt: string | null; startedBy: { name: string } | null };
type Attempt = { id: string; termNumber: number; slot: number; dueOn: string; amountMinor: string | null; status: string; failureNote: string; membership: { id: string; ref: string; status: string; customer: { displayName: string } | null } | null };

const monthName = (p: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${p}-01T00:00:00Z`));

/** Billing runs. A staff button charges every payment due that month, once each; nothing runs on its own. */
export default async function BillingRunsPage() {
  const me = await viewer();
  if (!me.can('canManageMemberships') && !me.can('canManageInvoices') && !me.can('canManageAccounting')) notFound();
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const d = await q<{ membershipBillingRuns: Run[]; membershipBillingAttempts: Attempt[] }>(`{
    membershipBillingRuns(orderBy: [{ startedAt: desc }], take: 30) { id ref period status queuedCount chargedCount failedCount unknownCount remainingCount chargedMinor startedAt startedBy { name } }
    membershipBillingAttempts(where: { status: { in: ["failed", "unknown", "charging"] }, membership: { status: { in: ["pending_payment", "active", "past_due"] } } }, orderBy: [{ dueOn: asc }], take: 60) { id termNumber slot dueOn amountMinor status failureNote membership { id ref status customer { displayName } } }
  }`);
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const periods = [0, 1, -1, -2].map(off => { const dt = new Date(Date.UTC(y, m - 1 + off, 1)); const p = dt.toISOString().slice(0, 7); return { value: p, label: monthName(p) }; });
  const paths = ['/dashboard/platform/billing-runs'];
  return (
    <Page title="Billing runs">
      <Section title="Run billing">
        <Meta>Charges every membership payment that falls due in the month you pick, to the card on file. Running it twice is safe: a payment that went through is never charged again, and a declined card is not tried again until someone updates it and presses Retry.</Meta>
        {me.can('canManageMemberships') ? <BillingRunForm periods={periods} /> : <Empty>Only membership managers run billing.</Empty>}
      </Section>
      {d.membershipBillingAttempts.length ? (
        <Section title={`Payments that need a look · ${d.membershipBillingAttempts.length}`}>
          {d.membershipBillingAttempts.map(a => (
            <Row key={a.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{a.membership?.customer?.displayName ?? 'Customer'} · {a.membership?.ref}</span><Status value={a.status} /><span className="ml-auto text-sm tabular-nums">{money(a.amountMinor ?? '0')}</span></div>
                <Meta>Term {a.termNumber}, payment {a.slot + 1} · due {dateText(a.dueOn)}{a.failureNote ? ` · ${a.failureNote}` : ''}{a.status === 'unknown' ? ' · The card processor did not answer. Check and retry will ask it first, so the customer is never charged twice.' : ''}{a.status === 'failed' ? ' · Card declined: update card, then Retry (on the membership).' : ''}</Meta>
                {me.can('canManageMemberships') && a.status === 'unknown' ? <ActionButton op="retryMembershipCharge" vars={{ attemptId: a.id }} paths={paths}>Check and retry</ActionButton> : null}
                {a.status === 'failed' && a.membership ? <a className="text-sm underline" href={`/dashboard/platform/memberships/${a.membership.id}`}>Open membership</a> : null}
              </div>
            </Row>
          ))}
        </Section>
      ) : null}
      <Section title={`Past runs · ${d.membershipBillingRuns.length}`}>
        {d.membershipBillingRuns.length ? d.membershipBillingRuns.map(r => (
          <Row key={r.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{monthName(r.period)}</span><Status value={r.status} /><span className="ml-auto text-sm tabular-nums">{money(r.chargedMinor)} charged</span></div>
              <Meta>{r.ref} · {r.queuedCount} due · {r.chargedCount} charged · {r.failedCount} declined · {r.unknownCount} waiting on the processor · {r.remainingCount} left{r.startedAt ? ` · ${when(r.startedAt, tz, 'full')}` : ''}{r.startedBy ? ` by ${r.startedBy.name}` : ''}</Meta>
            </div>
          </Row>
        )) : <Empty>No billing run yet.</Empty>}
      </Section>
      <Meta>Payment statuses: {label('queued')}, {label('succeeded')}, {label('failed')}, {label('unknown')}. A run is completed when nothing is left, partial when a payment waits on a new card or the processor.</Meta>
    </Page>
  );
}
