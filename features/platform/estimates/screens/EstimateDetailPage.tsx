import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, companyTimeZone, viewer } from '../../lib/server';
import { bpsPercent, deadlineText, eventText, label, lastDayBefore, money, quantity, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { DiscountForm } from '../components/DiscountForm';
import { OptionBuilder } from '../components/OptionBuilder';
import { SellForm } from '../components/SellForm';

type Line = { id: string; itemKey: string; description: string; quantity: string; uom: string; unitPriceMinor: string; amountMinor: string; discountMinor: string; cancellationClass: string; isAddOn: boolean };
type Option = { id: string; tier: string; name: string; description: string; subtotalMinor: string; discountMinor: string; estimatedTaxMinor: string; totalMinor: string; contentHash: string; lines: Line[] };
type Version = {
  id: string; versionNumber: number; label: string; status: string; version: number; discountBps: number; discountReason: string; notes: string;
  presentedAt: string | null; presentedVia: string; validUntil: string | null; contentHash: string; soldAt: string | null; declineReason: string; declineNote: string;
  depositRequiredMinor: string | null; presentedBy: { name: string } | null; priceBookVersion: { id: string; versionNumber: number } | null;
  discountApproval: { status: string } | null; soldOption: { id: string; name: string } | null; pdf: { id: string } | null; options: Option[];
};
type Est = {
  id: string; ref: string; publicCode: string; title: string; status: string; source: string; createdAt: string;
  customer: { id: string; displayName: string } | null; location: { address1: string; city: string; postalCode: string } | null; businessUnit: { name: string } | null;
  job: { id: string; ref: string } | null; createdBy: { name: string } | null; createdByAgent: { name: string } | null; currentVersion: { id: string } | null;
  versions: Version[];
};
type Notice = { id: string; ref: string; rule: string; status: string; cancelBy: string; coveredAmountMinor: string; estimateVersion: { id: string } | null };

const PATH = (id: string) => `/dashboard/platform/estimates/${id}`;
const VERSION = `id versionNumber label status version discountBps discountReason notes presentedAt presentedVia validUntil contentHash soldAt declineReason declineNote depositRequiredMinor
  presentedBy { name } priceBookVersion { id versionNumber } discountApproval { status } soldOption { id name } pdf { id }
  options(orderBy: [{ sortOrder: asc }]) { id tier name description subtotalMinor discountMinor estimatedTaxMinor totalMinor contentHash
    lines(orderBy: [{ sortOrder: asc }]) { id itemKey description quantity uom unitPriceMinor amountMinor discountMinor cancellationClass isAddOn } }`;

/**
 * One estimate: the current version's good/better/best options, built from the active price book while a
 * draft and frozen once presented; the sale and its cooling-off notice; and every earlier version.
 */
export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await viewer();
  const [d, tz] = await Promise.all([
    q<{ estimate: Est | null; cancellationNotices: Notice[] }>(`
      query E($id: ID!) {
        estimate(where: { id: $id }) {
          id ref publicCode title status source createdAt customer { id displayName } location { address1 city postalCode } businessUnit { name }
          job { id ref } createdBy { name } createdByAgent { name } currentVersion { id }
          versions(orderBy: [{ versionNumber: desc }]) { ${VERSION} }
        }
        cancellationNotices(where: { estimateVersion: { estimate: { id: { equals: $id } } } }, orderBy: [{ transactionAt: desc }]) { id ref rule status cancelBy coveredAmountMinor estimateVersion { id } }
      }`, { id }).catch(() => ({ estimate: null, cancellationNotices: [] })),
    companyTimeZone(),
  ]);
  const e = d.estimate;
  if (!e) notFound();
  const path = PATH(e.id);
  const current = e.versions.find(v => v.id === e.currentVersion?.id) ?? e.versions[0];
  const earlier = e.versions.filter(v => v.id !== current?.id);
  const versionAudit = current ? await q<{ auditEvents: { eventType: string; at: string; actorUser: { name: string } | null; actorAgent: { name: string } | null }[] }>(`
    query A($ids: [String!]) { auditEvents(where: { entityId: { in: $ids } }, orderBy: [{ seq: asc }], take: 80) { eventType at actorUser { name } actorAgent { name } } }`, { ids: [e.id, ...e.versions.map(v => v.id)] }).catch(() => ({ auditEvents: [] })) : { auditEvents: [] };
  const canEdit = me.can('canPresentEstimates');
  const canSell = me.can('canSellEstimates');
  const draft = current?.status === 'draft';
  const presented = current?.status === 'presented';
  return (
    <Page title={`${e.title} · ${e.ref}`} crumbs={[{ label: 'Estimates', href: '/dashboard/platform/estimates' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Status" value={<Status value={e.status === 'open' && current ? current.status : e.status} />} />
        <Stat name="Customer" value={e.customer ? <Link className="underline" href={`/dashboard/platform/customers/${e.customer.id}`}>{e.customer.displayName}</Link> : '—'} />
        <Stat name="Version" value={current ? `v${current.versionNumber}` : '—'} />
        <Stat name="Price book" value={current?.priceBookVersion ? <Link className="underline" href={`/dashboard/platform/pricebook/versions/${current.priceBookVersion.id}`}>v{current.priceBookVersion.versionNumber}</Link> : '—'} />
      </div>
      <Section title="Estimate">
        <p className="text-xs text-muted-foreground">
          {e.location ? `${e.location.address1}, ${e.location.city} ${e.location.postalCode}` : ''}{e.businessUnit ? ` · ${e.businessUnit.name}` : ''}
          {e.job ? <> · job <Link className="underline" href={`/dashboard/platform/jobs/${e.job.id}`}>{e.job.ref}</Link></> : null}
          {' · '}{e.createdByAgent ? `drafted by AI agent ${e.createdByAgent.name}` : e.createdBy ? `started by ${e.createdBy.name}` : ''} {when(e.createdAt, tz)}
          {current?.presentedAt ? ` · presented ${when(current.presentedAt, tz)}${current.presentedBy ? ` by ${current.presentedBy.name}` : ''}${current.presentedVia ? ` (${label(current.presentedVia).toLowerCase()})` : ''}` : ''}
          {current?.validUntil && presented ? ` · good through ${lastDayBefore(current.validUntil, tz)}` : ''}
          {current?.declineReason ? ` · declined: ${label(current.declineReason).toLowerCase()}${current.declineNote ? ` (${current.declineNote})` : ''}` : ''}
        </p>
        {current?.contentHash ? <p className="break-all font-mono text-[11px] text-muted-foreground">snapshot {current.contentHash}</p> : null}
        {current && current.discountBps ? <p className="text-xs text-muted-foreground">Discount {bpsPercent(current.discountBps)}{current.discountReason ? ` · ${current.discountReason}` : ''}{current.discountApproval ? ` · approval ${label(current.discountApproval.status).toLowerCase()}` : ''}</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {current?.pdf ? <a className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm" href={`/api/estimates/${current.id}/pdf`} target="_blank" rel="noreferrer">Open PDF</a> : null}
          {draft && canEdit && current.options.length ? <ActionButton op="presentEstimate" vars={{ versionId: current.id, expectedVersion: current.version, via: 'in_person' }} confirm="Present these options? They are frozen once presented; a change needs a new version." paths={[path]}>Present</ActionButton> : null}
          {draft && canEdit ? <ActionButton op="repriceEstimateVersion" vars={{ versionId: current.id, expectedVersion: current.version }} paths={[path]}>Re-price from the active price book</ActionButton> : null}
          {current?.status === 'pending_approval' && canEdit ? <ActionButton op="reopenEstimateVersion" vars={{ versionId: current.id, expectedVersion: current.version }} paths={[path]}>Withdraw discount request</ActionButton> : null}
          {presented && canEdit ? <ActionButton op="requoteEstimate" vars={{ versionId: current.id, expectedVersion: current.version }} confirm="Start a new version at today's prices? This version stays exactly as presented." paths={[path]}>Re-quote as a new version</ActionButton> : null}
          {presented && canEdit ? <ActionButton op="declineEstimate" vars={{ versionId: current.id, expectedVersion: current.version }} choices={['price', 'timing', 'chose_competitor', 'will_call_back', 'financing_declined', 'no_longer_needed', 'other'].map(v => ({ value: v, label: label(v) }))} paths={[path]}>Customer declined</ActionButton> : null}
          {current && ['declined', 'expired'].includes(current.status) && canEdit ? <ActionButton op="draftFollowupEstimate" vars={{ versionId: current.id }} paths={[path]}>Draft a follow-up</ActionButton> : null}
          {draft && canEdit ? <ActionButton op="discardEstimateVersion" vars={{ versionId: current.id, expectedVersion: current.version }} ask="Why discard this draft?" paths={[path]}>Discard draft</ActionButton> : null}
        </div>
        {draft && canEdit && current.options.length ? (
          <DiscountForm versionId={current.id} expectedVersion={current.version} path={path} />
        ) : null}
      </Section>
      {current ? (
        <Section title={`Options · v${current.versionNumber}`}>
          {current.options.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {current.options.map(o => (
                <div key={o.id} className={`min-w-0 space-y-2 rounded-lg border p-3 ${current.soldOption?.id === o.id ? 'border-emerald-500' : ''}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    {o.tier && !['single', 'custom'].includes(o.tier) ? <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">{label(o.tier)}</span> : null}
                    <span className="min-w-0 break-words font-medium">{o.name}</span>
                    {current.soldOption?.id === o.id ? <Status value="sold" className="ml-auto shrink-0" /> : null}
                  </div>
                  {o.description ? <p className="text-xs text-muted-foreground">{o.description}</p> : null}
                  <ul className="space-y-1 text-sm">
                    {o.lines.map(l => (
                      <li key={l.id} className="flex min-w-0 items-baseline gap-2">
                        <span className="min-w-0 flex-1">{l.description}<span className="block text-xs text-muted-foreground">{quantity(l.quantity)} {l.uom} × {money(l.unitPriceMinor)} · {label(l.cancellationClass).toLowerCase()}</span></span>
                        <span className="shrink-0 font-mono text-xs tabular-nums">{money(l.amountMinor)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-0.5 border-t pt-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{money(o.subtotalMinor)}</span></div>
                    {o.discountMinor !== '0' ? <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono tabular-nums">−{money(o.discountMinor)}</span></div> : null}
                    <div className="flex justify-between"><span className="text-muted-foreground">Estimated tax</span><span className="font-mono tabular-nums">{money(o.estimatedTaxMinor)}</span></div>
                    <div className="flex justify-between text-sm font-semibold"><span>Total</span><span className="font-mono tabular-nums">{money(o.totalMinor)}</span></div>
                  </div>
                  {draft && canEdit ? <ActionButton op="removeEstimateOption" vars={{ versionId: current.id, optionId: o.id, expectedVersion: current.version }} confirm={`Remove ${o.name}?`} paths={[path]}>Remove option</ActionButton> : null}
                </div>
              ))}
            </div>
          ) : <Empty>No options yet.</Empty>}
          {draft && canEdit && current.options.length < 3 ? <OptionBuilder versionId={current.id} expectedVersion={current.version} path={path} /> : null}
          {draft ? <Meta>Prices come from the active price book when you save. Tax is an estimate; the invoice carries the binding figure.</Meta> : null}
        </Section>
      ) : null}
      {presented && canSell && current.options.length ? (
        <Section title="Record the sale">
          <SellForm versionId={current.id} expectedVersion={current.version} path={path} signer={e.customer?.displayName ?? ''} options={current.options.map(o => ({ id: o.id, name: o.name, tier: o.tier, totalMinor: o.totalMinor }))} />
        </Section>
      ) : null}
      {d.cancellationNotices.length ? (
        <Section title="Cancellation notices">
          {d.cancellationNotices.map(n => (
            <Row key={n.id} href={`/dashboard/platform/cancellations/${n.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 break-words font-medium">{label(n.rule)}</span><span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{n.ref}</span><Status value={n.status} className="shrink-0" /></div>
                <Meta><span className="sm:hidden"><span className="font-mono">{n.ref}</span> · </span>covers {money(n.coveredAmountMinor)} · cancel by {deadlineText(n.cancelBy, tz)}</Meta>
              </div>
            </Row>
          ))}
        </Section>
      ) : null}
      {earlier.length ? (
        <Section title="Earlier versions">
          {earlier.map(v => (
            <Row key={v.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-xs text-muted-foreground">v{v.versionNumber}</span><span className="min-w-0 break-words">{v.options.map(o => `${o.name} ${money(o.totalMinor)}`).join(' · ')}</span><Status value={v.status} className="shrink-0" /></div>
                <Meta>{v.presentedAt ? `presented ${when(v.presentedAt, tz)}` : 'never presented'}{v.priceBookVersion ? ` · price book v${v.priceBookVersion.versionNumber}` : ''}{v.pdf ? <> · <a className="underline" href={`/api/estimates/${v.id}/pdf`} target="_blank" rel="noreferrer">PDF</a></> : null}</Meta>
              </div>
            </Row>
          ))}
        </Section>
      ) : null}
      <Section title="Audit">
        {versionAudit.auditEvents.length ? <ol className="space-y-0.5 text-xs text-muted-foreground">{versionAudit.auditEvents.map((a, i) => <li key={i}>{when(a.at, tz, 'seconds')} · {eventText(a.eventType)}{a.actorAgent ? ` · AI agent ${a.actorAgent.name}` : a.actorUser ? ` · ${a.actorUser.name}` : ''}</li>)}</ol> : <Empty>No audit events visible to you.</Empty>}
      </Section>
    </Page>
  );
}
