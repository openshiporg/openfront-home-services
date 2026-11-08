import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, companyTimeZone, viewer } from '../../lib/server';
import { deadlineText, eventText, label, money, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { BuyerCancelForm, DeliverForm, RefundForm } from '../components/NoticeActions';

type RuleResult = { rule: string; title: string; applies: boolean; cancelBy?: string | null; lastDay?: string | null; businessDays?: number; coveredAmountMinor?: string; reasons?: string[] };
type Notice = {
  id: string; ref: string; rule: string; evaluation: { results: { results?: RuleResult[] } | null; evaluatedAt: string } | null; status: string; version: number; language: string; noticeTemplate: string;
  transactionAt: string; cancelBy: string; deliveredAt: string | null; deliveryEvidence: { method?: string; acknowledgedBy?: string } | null; coveredAmountMinor: string;
  cancelledAt: string | null; cancellationReceivedVia: string; refundDueBy: string | null; refundDueMinor: string; refundEvidence: { method?: string; reference?: string } | null;
  customer: { id: string; displayName: string } | null; job: { id: string; ref: string } | null;
  estimateVersion: { versionNumber: number; estimate: { id: string; ref: string } | null } | null; changeOrder: { ref: string } | null;
  coveredWorkLines: { id: string; description: string; amountMinor: string; status: string }[];
  noticeDocument: { id: string } | null; waiverDocument: { id: string; title: string } | null; startOverride: { id: string; status: string } | null;
};

const OPEN = ['issued', 'delivered'];

/** One cancellation notice: which rule applies and why, what it covers, the deadline, and the buyer's cancellation and refund. */
export default async function CancellationNoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await viewer();
  const [d, tz] = await Promise.all([
    q<{ cancellationNotice: Notice | null; auditEvents: { eventType: string; at: string; actorUser: { name: string } | null; actorAgent: { name: string } | null }[] }>(`
      query N($id: ID!, $entity: String!) {
        cancellationNotice(where: { id: $id }) {
          id ref rule evaluation { results evaluatedAt } status version language noticeTemplate transactionAt cancelBy deliveredAt deliveryEvidence coveredAmountMinor
          cancelledAt cancellationReceivedVia refundDueBy refundDueMinor refundEvidence
          customer { id displayName } job { id ref } estimateVersion { versionNumber estimate { id ref } } changeOrder { ref }
          coveredWorkLines { id description amountMinor status } noticeDocument { id } waiverDocument { id title } startOverride { id status }
        }
        auditEvents(where: { entityId: { equals: $entity } }, orderBy: [{ seq: asc }], take: 40) { eventType at actorUser { name } actorAgent { name } }
      }`, { id, entity: id }).catch(() => ({ cancellationNotice: null, auditEvents: [] })),
    companyTimeZone(),
  ]);
  const n = d.cancellationNotice;
  if (!n) notFound();
  const sells = me.can('canSellEstimates') || me.can('canPresentEstimates');
  const office = me.can('canManageInvoices') || me.can('canManageCustomers');
  const open = OPEN.includes(n.status);
  const rules = n.evaluation?.results?.results ?? [];
  return (
    <Page title={`${n.ref} · ${n.customer?.displayName ?? 'Cancellation notice'}`} crumbs={[{ label: 'Cancellations', href: '/dashboard/platform/cancellations' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Status" value={<Status value={n.status} />} />
        <Stat name="Rule" value={label(n.rule)} />
        <Stat name="Covers" value={money(n.coveredAmountMinor)} />
        <Stat name="Cancel by" value={deadlineText(n.cancelBy, tz)} />
      </div>
      <Section title="Sale">
        <p className="text-xs text-muted-foreground">
          Sold {when(n.transactionAt, tz)}
          {n.customer ? <> · <Link className="underline" href={`/dashboard/platform/customers/${n.customer.id}`}>{n.customer.displayName}</Link></> : null}
          {n.estimateVersion?.estimate ? <> · estimate <Link className="underline" href={`/dashboard/platform/estimates/${n.estimateVersion.estimate.id}`}>{n.estimateVersion.estimate.ref}</Link> v{n.estimateVersion.versionNumber}</> : null}
          {n.changeOrder ? ` · change order ${n.changeOrder.ref}` : ''}
          {n.job ? <> · job <Link className="underline" href={`/dashboard/platform/jobs/${n.job.id}`}>{n.job.ref}</Link></> : null}
          {` · notice in ${n.language === 'es' ? 'Spanish' : n.language === 'en' ? 'English' : n.language.toUpperCase()}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {n.deliveredAt ? `Given to ${n.deliveryEvidence?.acknowledgedBy ?? 'the buyer'} ${when(n.deliveredAt, tz)}${n.deliveryEvidence?.method ? ` (${label(n.deliveryEvidence.method).toLowerCase()})` : ''}` : n.status === 'issued' ? 'Not yet given to the buyer. The window does not close until the buyer has the notice.' : ''}
          {n.cancelledAt ? ` · cancelled ${when(n.cancelledAt, tz)}${n.cancellationReceivedVia ? ` by ${label(n.cancellationReceivedVia).toLowerCase()}` : ''}` : ''}
          {n.status === 'cancelled_by_buyer' && n.refundDueBy ? ` · refund ${money(n.refundDueMinor)} by ${deadlineText(n.refundDueBy, tz)}` : ''}
          {n.refundEvidence ? ` · refunded${n.refundEvidence.method ? ` (${label(n.refundEvidence.method).toLowerCase()}${n.refundEvidence.reference ? ` ${n.refundEvidence.reference}` : ''})` : ''}` : ''}
          {n.startOverride ? ` · early start ${label(n.startOverride.status).toLowerCase()}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {n.noticeDocument ? <a className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm" href={`/api/cancellation-notices/${n.id}/pdf`} target="_blank" rel="noreferrer">Open notice PDF</a> : null}
          {open && sells && !n.startOverride ? <ActionButton op="requestCancellationHoldOverride" vars={{ noticeId: n.id, expectedVersion: n.version }} ask="Why must the work start before the window closes?" paths={[`/dashboard/platform/cancellations/${n.id}`]}>Ask to start early</ActionButton> : null}
        </div>
      </Section>
      {n.status === 'issued' && sells ? <Section title="Give the buyer the notice"><DeliverForm noticeId={n.id} expectedVersion={n.version} buyer={n.customer?.displayName ?? ''} /></Section> : null}
      {open && (sells || office) ? <Section title="The buyer cancelled"><BuyerCancelForm noticeId={n.id} expectedVersion={n.version} /></Section> : null}
      {n.status === 'cancelled_by_buyer' && office ? <Section title="Refund"><RefundForm noticeId={n.id} expectedVersion={n.version} dueMinor={n.refundDueMinor} dueText={money(n.refundDueMinor)} /></Section> : null}
      <Section title={`Covered work · ${n.coveredWorkLines.length}`}>
        {n.coveredWorkLines.length ? n.coveredWorkLines.map(w => (
          <Row key={w.id}><div className="flex min-w-0 flex-1 items-center gap-2"><span className="min-w-0 truncate">{w.description}</span><Status value={w.status} className="shrink-0" /><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(w.amountMinor)}</span></div></Row>
        )) : <Empty>No work lines.</Empty>}
      </Section>
      <Section title="Why this right applies">
        {rules.length ? rules.map((r, i) => (
          <Row key={i}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate font-medium">{r.title || label(r.rule)}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{r.applies ? `applies${r.cancelBy ? ` · ${r.businessDays ?? ''} business days, cancel by ${deadlineText(r.cancelBy, tz)}` : ''}` : 'does not apply'}</span></div>
              <Meta>{r.coveredAmountMinor ? `covers ${money(r.coveredAmountMinor)}` : ''}{r.reasons?.length ? `${r.coveredAmountMinor ? ' · ' : ''}${r.reasons.map(x => label(x).toLowerCase()).join(' · ')}` : ''}</Meta>
            </div>
          </Row>
        )) : <Empty>No rule detail stored.</Empty>}
      </Section>
      <Section title="Audit">
        {d.auditEvents.length ? <ol className="space-y-0.5 text-xs text-muted-foreground">{d.auditEvents.map((a, i) => <li key={i}>{when(a.at, tz, 'seconds')} · {eventText(a.eventType)}{a.actorAgent ? ` · AI agent ${a.actorAgent.name}` : a.actorUser ? ` · ${a.actorUser.name}` : ''}</li>)}</ol> : <Empty>No audit events visible to you.</Empty>}
      </Section>
    </Page>
  );
}
