import { notFound } from 'next/navigation';
import { q, companyTimeZone, localToday, viewer } from '../../lib/server';
import { money, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { stateOn } from '@/features/keystone/services/memberships';
import { SellForm } from '../components/MembershipForms';

type M = {
  id: string; ref: string; status: string; startsOn: string; autoRenew: boolean; paymentMethodLabel: string;
  customer: { id: string; displayName: string } | null; location: { address1: string; city: string } | null; plan: { name: string } | null;
  planVersion: { renewalNoticeDays: number; priceMinor: string; billingFrequency: string } | null;
  terms: { startsOn: string; endsOn: string; status: string; termNumber: number }[];
};

/** Memberships with where each stands today. "Renewal due" and "expired" are worked out from the term dates on every load. */
export default async function MembershipsPage({ searchParams }: { searchParams?: Promise<{ show?: string }> }) {
  const me = await viewer();
  if (!me.can('canSellMemberships') && !me.can('canManageMemberships')) notFound();
  const show = (await searchParams)?.show ?? 'current';
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const d = await q<{ memberships: M[]; membershipPlans: { id: string; name: string; versions: { autoRenew: boolean; consentWording: string; status: string }[] }[]; customers: { id: string; displayName: string; locations: { id: string; address1: string; city: string }[] }[] }>(`{
    memberships(orderBy: [{ createdAt: desc }], take: 200) { id ref status startsOn autoRenew paymentMethodLabel customer { id displayName } location { address1 city } plan { name } planVersion { renewalNoticeDays priceMinor billingFrequency } terms(orderBy: [{ termNumber: asc }]) { startsOn endsOn status termNumber } }
    membershipPlans(where: { status: { equals: "active" } }, orderBy: [{ name: asc }]) { id name versions(where: { status: { equals: "active" } }) { autoRenew consentWording status } }
    customers(orderBy: [{ displayName: asc }], take: 300) { id displayName locations { id address1 city } }
  }`);
  const rows = d.memberships.map(m => ({ ...m, state: stateOn({ status: m.status, terms: m.terms.map(t => ({ startsOn: new Date(t.startsOn), endsOn: new Date(t.endsOn), status: t.status })), noticeDays: m.planVersion?.renewalNoticeDays ?? 30 }, today) }));
  const current = rows.filter(r => ['active', 'past_due', 'renewal_due', 'pending_payment', 'suspended'].includes(r.state));
  const shown = show === 'all' ? rows : show === 'ended' ? rows.filter(r => ['expired', 'cancelled', 'transferred'].includes(r.state)) : current;
  const places = d.customers.flatMap(c => c.locations.map(l => ({ value: `${c.id}|${l.id}`, label: `${c.displayName} · ${l.address1}, ${l.city}` })));
  const plans = d.membershipPlans.filter(p => p.versions[0]).map(p => ({ id: p.id, name: p.name, autoRenew: p.versions[0].autoRenew, consentWording: p.versions[0].consentWording }));
  const tab = (key: string, text: string) => <a key={key} href={`?show=${key}`} className={`inline-flex h-11 items-center rounded-md border px-3 text-sm font-medium md:h-9 ${show === key ? 'bg-muted' : 'bg-background'}`}>{text}</a>;
  return (
    <Page title="Memberships">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Members now" value={rows.filter(r => ['active', 'renewal_due', 'past_due'].includes(r.state)).length} />
        <Stat name="Renewing soon" value={rows.filter(r => r.state === 'renewal_due').length} />
        <Stat name="Payment past due" value={rows.filter(r => r.state === 'past_due').length} />
        <Stat name="Waiting on first payment" value={rows.filter(r => r.state === 'pending_payment').length} />
      </div>
      {me.can('canSellMemberships') || me.can('canManageMemberships') ? (
        <Section title="Sell a membership">
          {plans.length && places.length ? <SellForm places={places} plans={plans} /> : <Empty>{plans.length ? 'Add a customer with an address first.' : 'Publish a plan first, under Membership plans.'}</Empty>}
        </Section>
      ) : null}
      <div className="flex flex-wrap gap-2">{tab('current', 'Current')}{tab('ended', 'Ended')}{tab('all', 'All')}</div>
      <Section title={`Members · ${shown.length}`}>
        {shown.length ? shown.map(m => {
          const t = m.terms.filter(x => x.status === 'active').pop();
          return (
            <Row key={m.id} href={`/dashboard/platform/memberships/${m.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{m.customer?.displayName ?? 'Customer'} · {m.plan?.name ?? 'Plan'}</span><Status value={m.state} /><span className="ml-auto text-sm tabular-nums">{m.planVersion ? `${money(m.planVersion.priceMinor)} ${m.planVersion.billingFrequency === 'monthly' ? 'a month' : 'a year'}` : ''}</span></div>
                <Meta>{m.ref} · {m.location ? `${m.location.address1}, ${m.location.city} · ` : ''}{t ? `term ${t.termNumber} runs ${dateText(t.startsOn)} to ${dateText(t.endsOn)}` : `started ${dateText(m.startsOn)}`}{m.autoRenew ? ' · renews automatically' : ''}{m.paymentMethodLabel ? ` · ${m.paymentMethodLabel}` : ''}</Meta>
              </div>
            </Row>
          );
        }) : <Empty>No memberships here yet.</Empty>}
      </Section>
    </Page>
  );
}
