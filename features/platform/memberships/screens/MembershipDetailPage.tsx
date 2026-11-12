import { notFound } from 'next/navigation';
import { q, companyTimeZone, localToday, viewer } from '../../lib/server';
import { money, dateText, label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { stateOn } from '@/features/keystone/services/memberships';
import { windowState } from '@/features/keystone/domain/membershipTime';

type D = {
  id: string; ref: string; publicCode: string; status: string; startsOn: string; autoRenew: boolean; paymentMethodLabel: string; cancelReason: string; cancelEffectiveOn: string | null; refundOwedMinor: string | null;
  customer: { id: string; displayName: string } | null; location: { address1: string; city: string } | null; plan: { name: string } | null;
  planVersion: { renewalNoticeDays: number; priceMinor: string; billingFrequency: string; cancellationRefundMethod: string; benefits: { title: string; text: string }[] | null } | null;
  autoRenewConsent: { recordedAt: string; channel: string; evidence: { wording?: string; how?: string; note?: string } | null } | null;
  terms: { id: string; termNumber: number; startsOn: string; endsOn: string; status: string; priceMinor: string }[];
};
type Grant = { id: string; name: string; quantity: number; windowStart: string; windowEnd: string; term: { termNumber: number } | null; entries: { quantity: number; kind: string }[] };
type Event = { id: string; name: string; dueFrom: string; dueBy: string; status: string; job: { ref: string } | null };
type Attempt = { id: string; termNumber: number; slot: number; dueOn: string; amountMinor: string | null; status: string; failureNote: string; invoice: { ref: string } | null };

/** One membership: what it includes and what is left, visits, payments, and the actions. */
export default async function MembershipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await viewer();
  if (!me.can('canSellMemberships') && !me.can('canManageMemberships')) notFound();
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const d = await q<{ membership: D | null; entitlementGrants: Grant[]; recurringServiceEvents: Event[]; membershipBillingAttempts: Attempt[] }>(`query M($id: ID!) {
    membership(where: { id: $id }) { id ref publicCode status startsOn autoRenew paymentMethodLabel cancelReason cancelEffectiveOn refundOwedMinor customer { id displayName } location { address1 city } plan { name }
      planVersion { renewalNoticeDays priceMinor billingFrequency cancellationRefundMethod benefits } autoRenewConsent { recordedAt channel evidence }
      terms(orderBy: [{ termNumber: asc }]) { id termNumber startsOn endsOn status priceMinor } }
    entitlementGrants(where: { membership: { id: { equals: $id } } }, orderBy: [{ windowEnd: asc }]) { id name quantity windowStart windowEnd term { termNumber } entries { quantity kind } }
    recurringServiceEvents(where: { membership: { id: { equals: $id } } }, orderBy: [{ dueFrom: asc }]) { id name dueFrom dueBy status job { ref } }
    membershipBillingAttempts(where: { membership: { id: { equals: $id } } }, orderBy: [{ termNumber: asc }, { slot: asc }]) { id termNumber slot dueOn amountMinor status failureNote invoice { ref } }
  }`, { id }).catch(() => null) ?? { membership: null, entitlementGrants: [], recurringServiceEvents: [], membershipBillingAttempts: [] };
  const m = d.membership;
  if (!m) notFound();
  const state = stateOn({ status: m.status, terms: m.terms.map(t => ({ startsOn: new Date(t.startsOn), endsOn: new Date(t.endsOn), status: t.status })), noticeDays: m.planVersion?.renewalNoticeDays ?? 30 }, today);
  const live = !['cancelled', 'transferred'].includes(m.status);
  const paths = [`/dashboard/platform/memberships/${m.id}`, '/dashboard/platform/memberships'];
  const canManage = me.can('canManageMemberships') || me.can('canSellMemberships');
  return (
    <Page title={`${m.customer?.displayName ?? 'Member'} · ${m.plan?.name ?? 'Membership'}`} crumbs={[{ label: 'Memberships', href: '/dashboard/platform/memberships' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Standing" value={<Status value={state} />} />
        <Stat name="Price" value={m.planVersion ? `${money(m.planVersion.priceMinor)} ${m.planVersion.billingFrequency === 'monthly' ? 'a month' : 'a year'}` : '—'} />
        <Stat name="Started" value={dateText(m.startsOn)} />
        <Stat name="Card on file" value={m.paymentMethodLabel || 'None'} />
      </div>
      <Meta>{m.ref} · {m.location ? `${m.location.address1}, ${m.location.city}` : ''} · {m.autoRenew ? 'renews automatically' : 'does not renew automatically'}. The customer can cancel online at /membership/{m.publicCode}</Meta>
      {m.status === 'cancelled' ? <Meta>Cancelled{m.cancelEffectiveOn ? ` on ${dateText(m.cancelEffectiveOn)}` : ''}: {m.cancelReason}. {m.refundOwedMinor && m.refundOwedMinor !== '0' ? `Refund owed to the customer: ${money(m.refundOwedMinor)}. Pay it from the invoice.` : 'No refund owed.'}</Meta> : null}
      {live && canManage ? (
        <div className="flex flex-wrap gap-2">
          {['active', 'past_due'].includes(m.status) ? <ActionButton op="renewMembership" vars={{ membershipId: m.id }} paths={paths} confirm="Start the next term now? The next payment is billed in the next billing run.">Renew for another term</ActionButton> : null}
          <ActionButton op="cancelMembership" vars={{ membershipId: m.id }} ask="Why is it being cancelled?" paths={paths}>Cancel membership</ActionButton>
        </div>
      ) : null}

      <Section title="What is included">
        {d.entitlementGrants.length ? d.entitlementGrants.map(g => {
          const left = g.quantity + g.entries.reduce((a, e) => a + e.quantity, 0);
          const w = windowState(today, { startDay: g.windowStart, endDay: g.windowEnd });
          return (
            <Row key={g.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{g.name}</span><span className="ml-auto text-sm tabular-nums">{left} of {g.quantity} left</span></div>
                <Meta>Term {g.term?.termNumber ?? 1} · usable {dateText(g.windowStart)} to {dateText(g.windowEnd)} · {w === 'open' ? 'open now' : w === 'upcoming' ? 'not open yet' : 'window has ended'}</Meta>
              </div>
            </Row>
          );
        }) : <Empty>Nothing is included in this plan.</Empty>}
        {(m.planVersion?.benefits ?? []).map(b => <Row key={b.title}><div><span className="font-medium">{b.title}</span> <Meta>{b.text}</Meta></div></Row>)}
      </Section>

      <Section title="Visits owed">
        {d.recurringServiceEvents.length ? d.recurringServiceEvents.map(e => (
          <Row key={e.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{e.name}</span><Status value={e.status} /></div>
              <Meta>Between {dateText(e.dueFrom)} and {dateText(e.dueBy)}{e.job ? ` · job ${e.job.ref}` : ''}</Meta>
              {e.status === 'booked' && canManage ? <ActionButton op="releaseMembershipVisit" vars={{ eventId: e.id }} ask="Why is the visit being given back?" paths={paths}>Give the visit back</ActionButton> : null}
            </div>
          </Row>
        )) : <Empty>No visits are owed.</Empty>}
      </Section>

      <Section title="Payments">
        {d.membershipBillingAttempts.length ? d.membershipBillingAttempts.map(a => (
          <Row key={a.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">Term {a.termNumber} · payment {a.slot + 1}</span><Status value={a.status} /><span className="ml-auto text-sm tabular-nums">{money(a.amountMinor ?? '0')}</span></div>
              <Meta>Due {dateText(a.dueOn)}{a.invoice ? ` · invoice ${a.invoice.ref}` : ''}{a.failureNote ? ` · ${a.failureNote}` : ''}</Meta>
              {['unknown', 'failed'].includes(a.status) && me.can('canManageMemberships') ? <ActionButton op="retryMembershipCharge" vars={{ attemptId: a.id }} paths={paths} confirm="Ask the card processor what happened, and charge again only if it never saw the first try?">Check and retry</ActionButton> : null}
            </div>
          </Row>
        )) : <Empty>Nothing has been billed yet. Payments are made in the billing run.</Empty>}
      </Section>

      <Section title="Terms">
        {m.terms.map(t => <Row key={t.id}><span className="font-medium">Term {t.termNumber}</span><Meta>{dateText(t.startsOn)} to {dateText(t.endsOn)} · {money(t.priceMinor)} · {label(t.status)}</Meta></Row>)}
      </Section>

      {m.autoRenewConsent ? (
        <Section title="Automatic renewal consent">
          <Meta>Agreed {label(m.autoRenewConsent.evidence?.how ?? m.autoRenewConsent.channel).toLowerCase()} on {when(m.autoRenewConsent.recordedAt, tz, 'day')}. Wording shown to the customer: “{m.autoRenewConsent.evidence?.wording ?? ''}”. This record cannot be changed.</Meta>
        </Section>
      ) : null}
    </Page>
  );
}
