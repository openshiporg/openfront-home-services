import Link from 'next/link';
import { q, companyTimeZone, viewer } from '../../lib/server';
import { label, money, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat, Tabs } from '../../components/ui';
import { CommandForm } from '../../components/CommandForm';

type Version = { id: string; versionNumber: number; label: string; status: string; source: string; effectiveAt: string | null; publishedAt: string | null; submittedAt: string | null; itemsCount: number; publishedBy: { name: string } | null; submittedBy: { name: string } | null; approval: { status: string } | null };
type Book = { id: string; name: string; code: string; activeVersion: { id: string; versionNumber: number; label: string } | null; versions: Version[] };
type Item = { id: string; itemKey: string; name: string; kind: string; trade: string; uom: string; tier: string; ladderKey: string; unitPriceMinor: string; memberUnitPriceMinor: string | null; pricingMethod: string; cancellationClassDefault: string; costMinor?: string };

/** A version still waiting on its maker after a rejection shows as Rejected, not as waiting. */
const stateOf = (v: { status: string; approval: { status: string } | null }) => (v.status === 'pending_approval' && v.approval?.status === 'rejected' ? 'rejected' : v.status);

const KINDS = ['all', 'service_task', 'material', 'equipment', 'fee'];

const SOURCE: Record<string, string> = { manual: 'Entered by hand', copy: 'Copied from the previous version', supplier_import: 'Supplier cost import' };

/**
 * Price book (D§12): the active version's items, the version history, and the open draft. Prices change
 * only by drafting a new version that a second person approves; published versions never change.
 */
export default async function PriceBookPage({ searchParams }: { searchParams?: Promise<{ kind?: string; q?: string; page?: string }> }) {
  const sp = (await searchParams) ?? {};
  const kind = KINDS.includes(sp.kind ?? '') ? sp.kind! : 'all';
  const search = (sp.q ?? '').trim().slice(0, 60);
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? '1', 10) || 1));
  const PER = 50;
  const me = await viewer();
  const seesCost = me.can('canManagePriceBook') || me.can('canApprovePriceBook');
  const [d, tz] = await Promise.all([
    q<{ priceBooks: Book[] }>(`{
      priceBooks(take: 5) {
        id name code activeVersion { id versionNumber label }
        versions(orderBy: [{ versionNumber: desc }]) { id versionNumber label status source effectiveAt publishedAt submittedAt itemsCount publishedBy { name } submittedBy { name } approval { status } }
      }
    }`),
    companyTimeZone(),
  ]);
  const book = d.priceBooks[0];
  const activeId = book?.activeVersion?.id;
  const where = [`priceBookVersion: { id: { equals: $v } }`, 'active: { equals: true }', kind !== 'all' ? `kind: { equals: "${kind}" }` : '', search ? `OR: [{ name: { contains: $s, mode: insensitive } }, { itemKey: { contains: $S } }]` : ''].filter(Boolean).join(', ');
  const items = activeId ? (await q<{ priceBookItems: Item[]; priceBookItemsCount: number }>(`
    query Items($v: ID!, $take: Int!, $skip: Int!${search ? ', $s: String!, $S: String!' : ''}) {
      priceBookItems(where: { ${where} }, orderBy: [{ ladderKey: asc }, { sortOrder: asc }, { name: asc }], take: $take, skip: $skip) {
        id itemKey name kind trade uom tier ladderKey unitPriceMinor memberUnitPriceMinor pricingMethod cancellationClassDefault${seesCost ? ' costMinor' : ''}
      }
      priceBookItemsCount(where: { ${where} })
    }`, { v: activeId, take: PER, skip: (page - 1) * PER, ...(search ? { s: search, S: search.toUpperCase() } : {}) })) : { priceBookItems: [], priceBookItemsCount: 0 };
  const open = book?.versions.find(v => ['draft', 'pending_approval'].includes(v.status));
  const pageHref = (n: number) => `/dashboard/platform/pricebook?${new URLSearchParams({ ...(kind !== 'all' ? { kind } : {}), ...(search ? { q: search } : {}), page: String(n) })}`;
  const href = (k: string) => `/dashboard/platform/pricebook${k === 'all' ? '' : `?kind=${k}`}`;
  return (
    <Page title="Price book">
      {!book ? <Empty>No price book yet. Load one from setup.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat name="Book" value={book.name} />
            <Stat name="Active version" value={book.activeVersion ? `v${book.activeVersion.versionNumber}` : '—'} />
            <Stat name="Items" value={book.versions.find(v => v.id === activeId)?.itemsCount ?? 0} />
            <Stat name="Open draft" value={open ? <Link className="underline" href={`/dashboard/platform/pricebook/versions/${open.id}`}>v{open.versionNumber} <Status value={stateOf(open)} /></Link> : 'None'} />
          </div>
          <Section title="Versions">
            {book.versions.map(v => (
              <Row key={v.id} href={`/dashboard/platform/pricebook/versions/${v.id}`}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">v{v.versionNumber}</span>
                    <span className="min-w-0 break-words font-medium">{v.label || 'Untitled version'}</span>
                    <Status value={stateOf(v)} className="shrink-0" />
                  </div>
                  <Meta>
                    {v.itemsCount} items · {SOURCE[v.source] ?? label(v.source)}
                    {v.publishedAt ? ` · published ${when(v.publishedAt, tz)}${v.publishedBy ? ` (approved by ${v.publishedBy.name})` : ''}` : v.submittedAt ? ` · sent for approval ${when(v.submittedAt, tz)}${v.submittedBy ? ` by ${v.submittedBy.name}` : ''}` : ''}
                    {v.effectiveAt ? ` · effective ${when(v.effectiveAt, tz)}` : ''}
                  </Meta>
                </div>
              </Row>
            ))}
            {!open && me.can('canManagePriceBook') ? (
              <div className="pt-2">
                <CommandForm op="startPriceBookDraft" submit="Start a new draft" fixed={{ priceBookId: book.id }} paths={['/dashboard/platform/pricebook']} fields={[
                  { name: 'label', label: 'What is changing', placeholder: 'Winter 2027 price review', width: 'lg' },
                ]} />
              </div>
            ) : null}
          </Section>
          <Tabs active={kind} items={KINDS.map(k => ({ key: k, label: k === 'all' ? 'All' : label(k), href: href(k) }))} />
          <form className="flex flex-wrap items-end gap-2" action="/dashboard/platform/pricebook">
            {kind !== 'all' ? <input type="hidden" name="kind" value={kind} /> : null}
            <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-80">Search name or code
              <input name="q" defaultValue={search} className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm" autoComplete="off" />
            </label>
            <button type="submit" className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm">Search</button>
          </form>
          <Section title={`Active items (v${book.activeVersion?.versionNumber ?? '—'}) · ${items.priceBookItemsCount}`}>
            {items.priceBookItems.length ? items.priceBookItems.map(i => (
              <Row key={i.id}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 break-words font-medium">{i.name}</span>
                    <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{i.itemKey}</span>
                    <span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(i.unitPriceMinor)}</span>
                  </div>
                  <Meta>
                    <span className="sm:hidden"><span className="font-mono">{i.itemKey}</span> · </span>{label(i.kind)} · {label(i.trade)} · per {i.uom}
                    {i.tier ? ` · ${label(i.tier)} tier` : ''}{i.pricingMethod === 'formula' ? ' · formula price' : ''}
                    {i.memberUnitPriceMinor ? ` · member ${money(i.memberUnitPriceMinor)}` : ''}
                    {i.kind !== 'material' ? ` · ${label(i.cancellationClassDefault).toLowerCase()}` : ''}
                    {seesCost && i.costMinor !== undefined ? ` · cost ${money(i.costMinor)}` : ''}
                  </Meta>
                </div>
              </Row>
            )) : <Empty>No items match.</Empty>}
            {items.priceBookItemsCount > PER ? (
              <div className="flex flex-wrap items-center gap-3 pt-2 text-sm">
                <Meta>Showing {(page - 1) * PER + 1}–{(page - 1) * PER + items.priceBookItems.length} of {items.priceBookItemsCount}</Meta>
                {page > 1 ? <Link className="underline" href={pageHref(page - 1)}>Previous</Link> : null}
                {page * PER < items.priceBookItemsCount ? <Link className="underline" href={pageHref(page + 1)}>Next</Link> : null}
              </div>
            ) : null}
          </Section>
        </>
      )}
    </Page>
  );
}
