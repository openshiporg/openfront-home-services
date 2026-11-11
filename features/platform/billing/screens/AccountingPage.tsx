import { q, companyTimeZone, localToday, viewer } from '../../lib/server';
import { label, money, when, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { ExportForm } from '../components/BillingForms';

type Batch = { id: string; ref: string; status: string; periodFrom: string | null; periodTo: string | null; lineCount: number; debitMinor: string; creditMinor: string; createdAt: string };
type Period = { id: string; month: string; status: string; version: number };

/** AR periods and the accounting export. The export is a download of balanced journal lines; nothing is sent anywhere. */
export default async function AccountingPage() {
  const me = await viewer();
  const tz = await companyTimeZone();
  const d = await q<{ accountingExportBatches: Batch[]; arPeriods: Period[] }>(`{
    accountingExportBatches(orderBy: [{ createdAt: desc }], take: 40) { id ref status periodFrom periodTo lineCount debitMinor creditMinor createdAt }
    arPeriods(orderBy: [{ month: desc }], take: 12) { id month status version }
  }`);
  const paths = ['/dashboard/platform/accounting'];
  return (
    <Page title="Accounting">
      <Section title="Export journal entries">
        <p className="text-xs text-muted-foreground">Builds balanced debit and credit lines for invoices, payments, refunds, credits and write-offs in the range. Lines already exported are never repeated. Download the file and import it into your books.</p>
        {me.can('canManageAccounting') || me.can('canManageInvoices') ? <ExportForm today={localToday(tz)} /> : null}
      </Section>
      <Section title={`Exports · ${d.accountingExportBatches.length}`}>
        {d.accountingExportBatches.length ? d.accountingExportBatches.map(b => (
          <Row key={b.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{b.ref}</span><Status value={b.status} /><span className="ml-auto text-sm tabular-nums">{b.lineCount} lines · {money(b.debitMinor)}</span></div>
              <Meta>{b.periodFrom && b.periodTo ? `${dateText(b.periodFrom.slice(0, 10))} to ${dateText(b.periodTo.slice(0, 10))} · ` : ''}built {when(b.createdAt, tz, 'day')}</Meta>
              <a className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm" href={`/api/accounting-exports/${b.id}/csv`}>Download CSV</a>
            </div>
          </Row>
        )) : <Empty>No exports yet.</Empty>}
      </Section>
      <Section title="Receivable periods" aside={<a className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm" href="/api/reports/ar-aging">Export AR aging</a>}>
        {d.arPeriods.length ? d.arPeriods.map(p => (
          <Row key={p.id}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{label(p.month.slice(0, 7))}</span><Status value={p.status} />
              {p.status === 'open' && me.can('canCloseAr') ? <ActionButton op="requestArPeriodClose" vars={{ periodId: p.id, expectedVersion: p.version }} confirm="Ask to close this period? A second person must approve; no entries post after it closes." paths={paths}>Request close</ActionButton> : null}
              {p.status === 'closed' && me.can('canCloseAr') ? <ActionButton op="reopenArPeriod" vars={{ periodId: p.id, expectedVersion: p.version }} ask="Why reopen this period?" paths={paths}>Reopen</ActionButton> : null}
            </div>
          </Row>
        )) : <Empty>No periods yet; the first opens with the first posted invoice.</Empty>}
      </Section>
    </Page>
  );
}
