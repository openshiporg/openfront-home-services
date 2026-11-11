import Link from 'next/link';
import { q, viewer } from '../../lib/server';
import { money } from '../../lib/format';
import { Row, Empty, Meta, Section, Status } from '../../components/ui';
import { CommandForm } from '../../components/CommandForm';

type Inv = { id: string; ref: string; status: string; totalMinor: string; balanceMinor: string };

/** Invoices on one job, and the way to start the next one from its finished work lines. */
export async function JobBilling({ jobId, path }: { jobId: string; path: string }) {
  const me = await viewer();
  if (!(me.can('canManageInvoices') || me.can('canPostInvoices'))) return null;
  const d = await q<{ invoices: Inv[] }>(`query($id: ID!) { invoices(where: { job: { id: { equals: $id } } }, orderBy: [{ createdAt: asc }]) { id ref status totalMinor balanceMinor } }`, { id: jobId }).catch(() => ({ invoices: [] as Inv[] }));
  return (
    <Section title={`Invoices · ${d.invoices.length}`}>
      {d.invoices.length ? d.invoices.map(i => (
        <Row key={i.id} href={`/dashboard/platform/invoices/${i.id}`}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3"><span className="font-medium">{i.ref}</span><Status value={i.status} /><Meta>balance {money(i.balanceMinor)}</Meta><span className="ml-auto font-mono text-sm tabular-nums">{money(i.totalMinor)}</span></div>
        </Row>
      )) : <Empty>Not invoiced yet.</Empty>}
      <CommandForm op="createInvoiceDraft" submit="Draft an invoice from the work lines" fixed={{ jobId }} paths={[path, '/dashboard/platform/invoices']} fields={[
        { name: 'progressReason', label: 'Progress billing reason (only if the work is not finished)', width: 'lg' },
      ]} />
      <p className="text-xs text-muted-foreground">Drafts come from work lines at their frozen estimate prices. <Link className="underline" href="/dashboard/platform/invoices?view=draft">Open drafts</Link></p>
    </Section>
  );
}
