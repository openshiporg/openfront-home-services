import { q, viewer } from '../../lib/server';
import { label, money, when } from '../../lib/format';
import { companyTimeZone } from '../../lib/server';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { FundingForm, ProgramForm } from '../components/BillingForms';

type App = { id: string; ref: string; status: string; version: number; amountMinor: string; partnerReference: string; createdAt: string; customer: { displayName: string } | null; program: { name: string } | null; invoice: { ref: string } | null };
type Program = { id: string; name: string; partner: string; minMinor: string; maxMinor: string; termsNote: string; applyUrl: string; active: boolean };

const NEXT: Record<string, string[]> = { started: ['submitted'], submitted: ['approved', 'declined', 'needs_info'], needs_info: ['submitted'], approved: ['docs_signed'], docs_signed: ['awaiting_funding'] };

/**
 * Financing is a record of an offer made by a lender. Nothing here calls a lender or sends anything:
 * staff note what the partner told the customer, and the payout when it arrives.
 */
export default async function FinancingPage() {
  const me = await viewer();
  const [d, tz] = await Promise.all([
    q<{ financingApplications: App[]; financingPrograms: Program[] }>(`{
      financingApplications(orderBy: [{ createdAt: desc }], take: 100) { id ref status version amountMinor partnerReference createdAt customer { displayName } program { name } invoice { ref } }
      financingPrograms(orderBy: [{ name: asc }]) { id name partner minMinor maxMinor termsNote applyUrl active }
    }`),
    companyTimeZone(),
  ]);
  const paths = ['/dashboard/platform/financing'];
  const manage = me.can('canManageInvoices') || me.can('canOfferFinancing');
  return (
    <Page title="Financing">
      <Section title={`Applications · ${d.financingApplications.length}`}>
        {d.financingApplications.length ? d.financingApplications.map(a => (
          <Row key={a.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{a.customer?.displayName ?? a.ref}</span><span className="font-mono text-xs text-muted-foreground">{a.ref}</span><Status value={a.status} /><span className="ml-auto font-mono text-sm tabular-nums">{money(a.amountMinor)}</span></div>
              <Meta>{a.program?.name ?? ''}{a.invoice ? ` · invoice ${a.invoice.ref}` : ''}{a.partnerReference ? ` · partner ref ${a.partnerReference}` : ''} · started {when(a.createdAt, tz, 'day')}</Meta>
              {manage ? <div className="flex flex-wrap gap-2">
                {(NEXT[a.status] ?? []).map(to => <ActionButton key={to} op="recordFinancingStatus" vars={{ applicationId: a.id, to, expectedVersion: a.version }} paths={paths}>{`Mark ${label(to).toLowerCase()}`}</ActionButton>)}
                {['started', 'submitted', 'needs_info', 'approved', 'docs_signed', 'awaiting_funding'].includes(a.status) ? <ActionButton op="recordFinancingStatus" vars={{ applicationId: a.id, to: 'cancelled', expectedVersion: a.version }} confirm="Cancel this application?" paths={paths}>Cancel</ActionButton> : null}
              </div> : null}
              {manage && a.status === 'awaiting_funding' ? <FundingForm applicationId={a.id} expectedVersion={a.version} amountMinor={a.amountMinor} /> : null}
            </div>
          </Row>
        )) : <Empty>No financing applications. Start one from a customer or invoice once a program is set up.</Empty>}
      </Section>
      <Section title={`Programs · ${d.financingPrograms.length}`}>
        {d.financingPrograms.length ? d.financingPrograms.map(p => (
          <Row key={p.id}><div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{p.name}</span><Status value={p.active ? 'active' : 'retired'} /><span className="ml-auto text-sm tabular-nums">{money(p.minMinor)} to {money(p.maxMinor)}</span></div><Meta>{p.partner}{p.termsNote ? ` · ${p.termsNote}` : ''}{p.applyUrl ? ` · ${p.applyUrl}` : ''}</Meta></div></Row>
        )) : <Empty>No programs yet.</Empty>}
        {manage ? <ProgramForm /> : null}
      </Section>
    </Page>
  );
}
