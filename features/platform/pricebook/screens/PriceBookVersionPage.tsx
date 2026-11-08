import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, companyTimeZone, viewer } from '../../lib/server';
import { decimalText, eventText, label, money, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';
import { DraftItemForm } from '../components/DraftItemForm';

type Diff = {
  added: { itemKey: string; name: string; unitPriceMinor: string }[]; removed: { itemKey: string; name: string; unitPriceMinor: string }[];
  repriced: { itemKey: string; name: string; fromMinor: string; toMinor: string; changeBps: string | null }[]; changed: { itemKey: string; name: string; fields: string[] }[]; unchanged: number;
};
type Review = { id: string; status: string; versionNumber: number; contentHash: string; diffReport: Diff | null; live: { diff: Diff; findings: { itemKey: string; code: string; message: string }[]; formula: { itemKey: string; unitPriceMinor: string }[] | { error: string } } | null };
type CostReport = { supplier: string; importedAt: string; changes: { itemKey: string; name: string; fromMinor: string; toMinor: string; marginBpsAfter: string | null }[]; unknown: string[] };
type Version = {
  id: string; versionNumber: number; label: string; status: string; source: string; notes: string; version: number; contentHash: string; effectiveAt: string | null;
  submittedAt: string | null; publishedAt: string | null; activatedAt: string | null; retiredAt: string | null; itemsCount: number;
  priceBook: { id: string; name: string } | null; basedOn: { id: string; versionNumber: number } | null;
  submittedBy: { name: string } | null; publishedBy: { name: string } | null; approval: { id: string; status: string; version: number; requestedBy: { id: string } | null } | null;
  costChangeReport?: CostReport | null;
};

const PATH = (id: string) => `/dashboard/platform/pricebook/versions/${id}`;
const SOURCE: Record<string, string> = { manual: 'Entered by hand', copy: 'Copied from the previous version', supplier_import: 'Supplier cost import' };

/** Basis points as a string ("1250") → "+12.50%" without going through a float. */
const pct = (bps: string | null) => (bps === null ? '' : `${bps.startsWith('-') ? '' : '+'}${bpsText(bps)}`);
const bpsText = (bps: string) => decimalText(`${bps.startsWith('-') ? '-' : ''}${bps.replace('-', '').padStart(3, '0').replace(/(\d{2})$/, '.$1')}`, { minPlaces: 2, maxPlaces: 2 }) + '%';

/** One price book version: what it changes against the active version, what blocks it, and who approves it. */
export default async function PriceBookVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await viewer();
  const seesCost = me.can('canManagePriceBook') || me.can('canApprovePriceBook');
  const [d, tz] = await Promise.all([
    q<{ priceBookVersion: Version | null; priceBookVersionReview: Review | null; auditEvents: { eventType: string; at: string; actorUser: { name: string } | null }[] }>(`
      query V($id: ID!, $entity: String!) {
        priceBookVersion(where: { id: $id }) {
          id versionNumber label status source notes version contentHash effectiveAt submittedAt publishedAt activatedAt retiredAt itemsCount
          priceBook { id name } basedOn { id versionNumber } submittedBy { name } publishedBy { name } approval { id status version requestedBy { id } }${seesCost ? ' costChangeReport' : ''}
        }
        priceBookVersionReview(versionId: $id)
        auditEvents(where: { entityId: { equals: $entity } }, orderBy: [{ seq: asc }], take: 40) { eventType at actorUser { name } }
      }`, { id, entity: id }).catch(() => ({ priceBookVersion: null, priceBookVersionReview: null, auditEvents: [] })),
    companyTimeZone(),
  ]);
  const v = d.priceBookVersion;
  if (!v) notFound();
  const review = d.priceBookVersionReview;
  const diff = review?.live?.diff ?? review?.diffReport ?? null;
  const findings = review?.live?.findings ?? [];
  const draft = v.status === 'draft';
  const path = PATH(v.id);
  const cost = v.costChangeReport ?? null;
  const ownRequest = v.approval?.requestedBy?.id === me.id;
  return (
    <Page title={`v${v.versionNumber} · ${v.label || 'Price book version'}`} crumbs={[{ label: 'Price book', href: '/dashboard/platform/pricebook' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Status" value={<Status value={v.status} />} />
        <Stat name="Items" value={v.itemsCount} />
        <Stat name="Based on" value={v.basedOn ? <Link className="underline" href={PATH(v.basedOn.id)}>v{v.basedOn.versionNumber}</Link> : '—'} />
        <Stat name="Effective" value={v.effectiveAt ? when(v.effectiveAt, tz) : '—'} />
      </div>
      <Section title="Version">
        <p className="text-xs text-muted-foreground">
          {v.notes || (SOURCE[v.source] ?? label(v.source))}
          {v.submittedAt ? ` · sent for approval ${when(v.submittedAt, tz)}${v.submittedBy ? ` by ${v.submittedBy.name}` : ''}` : ''}
          {v.publishedAt ? ` · approved ${when(v.publishedAt, tz)}${v.publishedBy ? ` by ${v.publishedBy.name}` : ''}` : ''}
          {v.retiredAt ? ` · retired ${when(v.retiredAt, tz)}` : ''}
        </p>
        {v.contentHash ? <p className="break-all font-mono text-[11px] text-muted-foreground">content {v.contentHash}</p> : null}
        {['published', 'active', 'retired'].includes(v.status) ? <p className="text-xs text-muted-foreground">Published versions never change. Estimates priced from this version keep these prices even after a new version is active.</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {draft && me.can('canManagePriceBook') ? (
            <CommandForm op="submitPriceBookVersion" submit="Send for approval" fixed={{ versionId: v.id, expectedVersion: v.version }} paths={[path, '/dashboard/platform/pricebook']} fields={[
              { name: 'note', label: 'Note for the approver', width: 'lg' },
            ]} />
          ) : null}
          {v.status === 'pending_approval' && me.can('canManagePriceBook') ? <ActionButton op="reopenPriceBookDraft" vars={{ versionId: v.id, expectedVersion: v.version }} ask="Why reopen it?" paths={[path]}>Withdraw and edit</ActionButton> : null}
          {draft && me.can('canManagePriceBook') ? <ActionButton op="discardPriceBookVersion" vars={{ versionId: v.id, expectedVersion: v.version }} ask="Why discard this draft?" paths={[path, '/dashboard/platform/pricebook']}>Discard draft</ActionButton> : null}
          {v.status === 'pending_approval' && v.approval?.status === 'pending' && me.can('canApprovePriceBook') && !ownRequest ? (
            <>
              <ActionButton op="decideApprovalRequest" vars={{ requestId: v.approval.id, decision: 'approve', expectedVersion: v.approval.version }} confirm="Publish these prices? They can't be changed once published." paths={[path, '/dashboard/platform/pricebook']}>Approve and publish</ActionButton>
              <ActionButton op="decideApprovalRequest" vars={{ requestId: v.approval.id, decision: 'reject', expectedVersion: v.approval.version }} ask="Why reject it?" paths={[path]}>Reject</ActionButton>
            </>
          ) : null}
          {v.status === 'pending_approval' && ownRequest ? <Meta>You sent this for approval; someone else approves it.</Meta> : null}
        </div>
      </Section>
      {findings.length ? (
        <Section title={`Fix before sending · ${findings.length}`}>
          {findings.slice(0, 50).map((f, i) => <Row key={i}><div className="min-w-0 flex-1"><span className="font-mono text-xs">{f.itemKey}</span> <Meta>· {f.message}</Meta></div></Row>)}
        </Section>
      ) : null}
      <Section title={diff ? `${['draft', 'pending_approval'].includes(v.status) ? 'Changes against the active version' : `Changes from ${v.basedOn ? `v${v.basedOn.versionNumber}` : 'the previous version'}`} · ${diff.unchanged} unchanged` : 'Changes'}>
        {!diff ? <Empty>The change report appears once the version is a draft or sent for approval.</Empty> : (
          <div className="space-y-4">
            {diff.repriced.length ? (
              <div>
                <h3 className="pb-1 text-sm font-medium">Price changes · {diff.repriced.length}</h3>
                {diff.repriced.map(r => (
                  <Row key={r.itemKey}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 break-words">{r.name}</span><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(r.fromMinor)} → {money(r.toMinor)}</span></div>
                      <Meta><span className="font-mono">{r.itemKey}</span>{r.changeBps ? ` · ${pct(r.changeBps)}` : ''}</Meta>
                    </div>
                  </Row>
                ))}
              </div>
            ) : null}
            {diff.added.length ? (
              <div>
                <h3 className="pb-1 text-sm font-medium">New items · {diff.added.length}</h3>
                {diff.added.map(r => <Row key={r.itemKey}><div className="flex min-w-0 flex-1 items-center gap-2"><span className="min-w-0 break-words">{r.name}</span><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(r.unitPriceMinor)}</span></div></Row>)}
              </div>
            ) : null}
            {diff.removed.length ? (
              <div>
                <h3 className="pb-1 text-sm font-medium">Removed · {diff.removed.length}</h3>
                {diff.removed.map(r => <Row key={r.itemKey}><div className="flex min-w-0 flex-1 items-center gap-2"><span className="min-w-0 break-words line-through">{r.name}</span><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(r.unitPriceMinor)}</span></div></Row>)}
              </div>
            ) : null}
            {diff.changed.length ? (
              <div>
                <h3 className="pb-1 text-sm font-medium">Other edits · {diff.changed.length}</h3>
                {diff.changed.map(r => <Row key={r.itemKey}><div className="min-w-0 flex-1"><span>{r.name}</span> <Meta>· {r.fields.map(f => label(f).toLowerCase()).join(', ')}</Meta></div></Row>)}
              </div>
            ) : null}
            {!diff.repriced.length && !diff.added.length && !diff.removed.length && !diff.changed.length ? <Empty>No changes yet.</Empty> : null}
          </div>
        )}
      </Section>
      {cost ? (
        <Section title={`Supplier costs from ${cost.supplier} · ${cost.changes.length}`}>
          {cost.changes.slice(0, 100).map(c => (
            <Row key={c.itemKey}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 break-words">{c.name}</span><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(c.fromMinor)} → {money(c.toMinor)}</span></div>
                <Meta><span className="font-mono">{c.itemKey}</span>{c.marginBpsAfter !== null ? ` · margin after ${bpsText(c.marginBpsAfter)}` : ''}</Meta>
              </div>
            </Row>
          ))}
          {cost.unknown.length ? <Meta>Not in this book: {cost.unknown.join(', ')}</Meta> : null}
        </Section>
      ) : null}
      {draft && me.can('canManagePriceBook') ? (
        <Section title="Add or change an item">
          <DraftItemForm versionId={v.id} expectedVersion={v.version} path={path} />
        </Section>
      ) : null}
      <Section title="Audit">
        {d.auditEvents.length ? <ol className="space-y-0.5 text-xs text-muted-foreground">{d.auditEvents.map((e, i) => <li key={i}>{when(e.at, tz, 'seconds')} · {eventText(e.eventType)}{e.actorUser ? ` · ${e.actorUser.name}` : ''}</li>)}</ol> : <Empty>No audit events visible to you.</Empty>}
      </Section>
    </Page>
  );
}
