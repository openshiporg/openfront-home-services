import { q } from '../../lib/server';
import { label } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Tabs } from '../../components/ui';
import { CommandForm } from '../../components/CommandForm';

type Customer = {
  id: string; ref: string; kind: string; displayName: string; doNotService: boolean;
  locations: { city: string; postalCode: string }[]; jobsCount: number; source: { name: string } | null;
};

/** Customers: households and commercial accounts with their service addresses. */
export default async function CustomersPage({ searchParams }: { searchParams?: Promise<{ q?: string; kind?: string }> }) {
  const sp = (await searchParams) ?? {};
  const search = (sp.q ?? '').trim().slice(0, 80);
  const kind = sp.kind === 'commercial' || sp.kind === 'residential' ? sp.kind : 'all';
  const filters = [
    '{ mergedInto: null }',
    kind !== 'all' ? `{ kind: { equals: "${kind}" } }` : null,
    search ? '{ OR: [{ displayName: { contains: $search, mode: insensitive } }, { ref: { contains: $search, mode: insensitive } }, { locations: { some: { postalCode: { startsWith: $search } } } }] }' : null,
  ].filter(Boolean).join(', ');
  const d = await q<{ customers: Customer[]; all: number; residential: number; commercial: number }>(`
    query Customers${search ? '($search: String!)' : ''} {
      customers(where: { AND: [${filters}] }, orderBy: [{ displayName: asc }], take: 100) {
        id ref kind displayName doNotService locations(take: 2) { city postalCode } jobsCount source { name }
      }
      all: customersCount(where: { mergedInto: null })
      residential: customersCount(where: { mergedInto: null, kind: { equals: "residential" } })
      commercial: customersCount(where: { mergedInto: null, kind: { equals: "commercial" } })
    }`, search ? { search } : {});
  const href = (k: string) => `/dashboard/platform/customers${k !== 'all' ? `?kind=${k}` : ''}`;
  return (
    <Page title="Customers">
      <form className="flex flex-wrap gap-2" action="/dashboard/platform/customers">
        <input name="q" defaultValue={search} placeholder="Name, ref or ZIP" className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm" />
        {kind !== 'all' ? <input type="hidden" name="kind" value={kind} /> : null}
        <button className="h-9 rounded-md border px-3 text-sm" type="submit">Search</button>
      </form>
      <Tabs active={kind} items={[
        { key: 'all', label: 'All', href: href('all'), count: d.all },
        { key: 'residential', label: 'Residential', href: href('residential'), count: d.residential },
        { key: 'commercial', label: 'Commercial', href: href('commercial'), count: d.commercial },
      ]} />
      <Section title="Add a customer">
        <CommandForm op="addCustomer" submit="Add customer" paths={['/dashboard/platform/customers']}
          nest={{ customer: ['firstName', 'lastName', 'phone', 'email'], location: { fields: ['address1', 'city', 'postalCode'], requires: 'address1', fixed: { state: 'TX' } } }}
          fields={[
            { name: 'firstName', label: 'First name', required: true, width: 'sm' },
            { name: 'lastName', label: 'Last name', required: true, width: 'sm' },
            { name: 'phone', label: 'Mobile', kind: 'tel', width: 'sm' },
            { name: 'email', label: 'Email', kind: 'email' },
            { name: 'address1', label: 'Service address', width: 'lg' },
            { name: 'city', label: 'City', width: 'sm', defaultValue: 'Austin' },
            { name: 'postalCode', label: 'ZIP', width: 'sm' },
          ]} />
      </Section>
      <Section title={search ? `Matching "${search}"` : 'Customers'}>
        {d.customers.length ? d.customers.map(c => (
          <Row key={c.id} href={`/dashboard/platform/customers/${c.id}`}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.displayName}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
                {c.doNotService ? <span className="text-xs text-red-600">do not service</span> : null}
              </div>
              <Meta>{label(c.kind)} · {c.locations.map(l => `${l.city} ${l.postalCode}`).join('; ') || 'no address'}{c.source ? ` · ${c.source.name}` : ''}</Meta>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{c.jobsCount} jobs</span>
          </Row>
        )) : <Empty>No customers match.</Empty>}
      </Section>
    </Page>
  );
}
