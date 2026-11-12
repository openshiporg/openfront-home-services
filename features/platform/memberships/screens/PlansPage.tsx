import { notFound } from 'next/navigation';
import { q, viewer } from '../../lib/server';
import { money, label } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { PlanForm } from '../components/MembershipForms';

type Version = { id: string; versionNumber: number; status: string; priceMinor: string; billingFrequency: string; termMonths: number; autoRenew: boolean; cancellationRefundMethod: string; cancellationRefundDays: number; entitlements: { name: string; quantity: number; seasonStart?: string; seasonEnd?: string }[] | null };
type Plan = { id: string; name: string; status: string; versions: Version[] };

const MD = (v?: string) => { const m = /^(\d\d)-(\d\d)$/.exec(v ?? ''); return m ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[1]) - 1]} ${Number(m[2])}` : (v ?? ''); };
const REFUND: Record<string, string> = { none: 'no refund on cancelling', prorata: 'unused days refunded on cancelling' };

/** Plans and their versions. A published version never changes; a change is a new draft, published when ready. */
export default async function PlansPage() {
  const me = await viewer();
  if (!me.can('canManageMemberships') && !me.can('canSellMemberships') && !me.can('canManagePriceBook')) notFound();
  const d = await q<{ membershipPlans: Plan[] }>(`{
    membershipPlans(orderBy: [{ name: asc }]) { id name status versions(orderBy: [{ versionNumber: desc }]) { id versionNumber status priceMinor billingFrequency termMonths autoRenew cancellationRefundMethod cancellationRefundDays entitlements } }
  }`);
  const canEdit = me.can('canManageMemberships') || me.can('canManagePriceBook');
  const paths = ['/dashboard/platform/membership-plans'];
  return (
    <Page title="Membership plans">
      {canEdit ? <Section title="New plan"><PlanForm /></Section> : null}
      <Section title={`Plans · ${d.membershipPlans.length}`}>
        {d.membershipPlans.length ? d.membershipPlans.map(p => {
          const shown = p.versions.find(v => v.status === 'active') ?? p.versions[0];
          const draft = p.versions.find(v => v.status === 'draft');
          return (
            <Row key={p.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{p.name}</span><Status value={p.status === 'retired' ? 'retired' : shown?.status ?? 'draft'} />{shown ? <span className="ml-auto text-sm tabular-nums">{money(shown.priceMinor)} {shown.billingFrequency === 'monthly' ? 'a month' : 'a year'}</span> : null}</div>
                {shown ? (
                  <Meta>
                    Version {shown.versionNumber} · {shown.termMonths}-month term · {(shown.entitlements ?? []).map(e => `${e.quantity} × ${e.name}${e.seasonStart ? ` (${MD(e.seasonStart)} to ${MD(e.seasonEnd)})` : ''}`).join(', ') || 'nothing included yet'} · {shown.autoRenew ? 'renews automatically' : 'does not renew automatically'} · {shown.cancellationRefundMethod === 'full_within_days' ? `full refund in the first ${shown.cancellationRefundDays} days` : REFUND[shown.cancellationRefundMethod] ?? label(shown.cancellationRefundMethod)}
                  </Meta>
                ) : null}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    {draft ? <ActionButton op="activateMembershipPlanVersion" vars={{ versionId: draft.id }} confirm="Publish this version? A published version cannot be edited. Members already on the plan keep the version they bought." paths={paths}>Publish version {draft.versionNumber}</ActionButton> : null}
                    {p.status === 'active' ? <ActionButton op="retireMembershipPlan" vars={{ planId: p.id }} ask="Why stop selling this plan? Current members keep it." paths={paths}>Stop selling</ActionButton> : null}
                  </div>
                ) : null}
              </div>
            </Row>
          );
        }) : <Empty>No plans yet. Create the first one above.</Empty>}
      </Section>
    </Page>
  );
}
