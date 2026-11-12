import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { keystoneContext } from '@/features/keystone/context';
import { renewalsComing } from '@/features/keystone/services/agreements';
import { viewer } from '../../lib/server';
import { money, dateText, phoneText, label } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CopyMessage } from '../components/MembershipForms';

/** Renewals coming up. Nothing is sent from here: copy the message or export the list, then mark the customer as told. */
export default async function RenewalsPage() {
  const me = await viewer();
  if (!me.can('canSellMemberships') && !me.can('canManageMemberships')) notFound();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const baseUrl = host ? `${h.get('x-forwarded-proto') ?? 'https'}://${host}` : '';
  const rows = await renewalsComing(keystoneContext.prisma as never, { withinDays: 60, baseUrl });
  const paths = ['/dashboard/platform/renewals'];
  return (
    <Page title="Renewals">
      <Section
        title={`Ending in the next 60 days · ${rows.length}`}
        aside={<a className="inline-flex h-11 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm md:h-8" href="/api/membership-renewals/csv">Export CSV</a>}
      >
        {rows.length ? rows.map(r => (
          <Row key={r.membershipId}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{r.customer} · {r.plan}</span><Status value={r.noticeStatus === 'none' ? 'new' : r.noticeStatus} /><span className="ml-auto text-sm tabular-nums">{money(r.priceMinor)}</span></div>
              <Meta>{r.daysLeft >= 0 ? `Ends ${dateText(r.termEnds)} (${r.daysLeft} days)` : `Ended ${dateText(r.termEnds)}`} · {r.autoRenew ? 'renews automatically' : 'renews only if the customer says yes'} · {r.phone ? `${phoneText(r.phone)} · ` : ''}{r.address}</Meta>
              <p className="max-w-2xl break-words rounded-md bg-muted/50 p-3 text-sm">{r.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyMessage text={r.message} />
                {r.noticeStatus !== 'contacted' ? <ActionButton op="recordRenewalNotice" vars={{ membershipId: r.membershipId, status: 'contacted' }} paths={paths}>Mark customer told</ActionButton> : null}
                {r.noticeStatus === 'none' || r.noticeStatus === 'drafted' ? <ActionButton op="recordRenewalNotice" vars={{ membershipId: r.membershipId, status: 'dismissed' }} paths={paths}>Dismiss</ActionButton> : null}
                {!r.autoRenew && r.daysLeft <= 0 ? <ActionButton op="renewMembership" vars={{ membershipId: r.membershipId }} confirm="Customer said yes? This starts the next term." paths={paths}>Renew now</ActionButton> : null}
              </div>
              {r.noticeStatus !== 'none' ? <Meta>Notice: {label(r.noticeStatus)}</Meta> : null}
            </div>
          </Row>
        )) : <Empty>No memberships end in the next 60 days.</Empty>}
      </Section>
    </Page>
  );
}
