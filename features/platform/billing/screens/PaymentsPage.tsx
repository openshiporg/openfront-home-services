import { q } from '../../lib/server';
import { label, money, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { DepositForm } from '../components/BillingForms';

type Batch = { id: string; ref: string; businessDate: string | null; tenderGroup: string; status: string; version: number; expectedMinor: string; depositedMinor: string; feesMinor: string; varianceMinor: string; depositReference: string };
type Attempt = { id: string; status: string; version: number; amountMinor: string; method: string; invoice: { ref: string } | null };

/** Daily payment batches by tender, reconciled to the deposit or payout; card tries whose outcome is unknown wait here for a person. */
export default async function PaymentsPage() {
  const d = await q<{ paymentBatches: Batch[]; paymentAttempts: Attempt[] }>(`{
    paymentBatches(orderBy: [{ businessDate: desc }], take: 60) { id ref businessDate tenderGroup status version expectedMinor depositedMinor feesMinor varianceMinor depositReference }
    paymentAttempts(where: { status: { in: ["started", "unknown"] } }, orderBy: [{ createdAt: desc }], take: 30) { id status version amountMinor method invoice { ref } }
  }`);
  const paths = ['/dashboard/platform/payments'];
  return (
    <Page title="Payments">
      {d.paymentAttempts.length ? (
        <Section title={`Card and ACH tries still open · ${d.paymentAttempts.length}`}>
          {d.paymentAttempts.map(a => (
            <Row key={a.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{a.invoice?.ref ?? 'Payment'} · {label(a.method).toLowerCase()}</span><Status value={a.status} /><span className="ml-auto font-mono text-sm tabular-nums">{money(a.amountMinor)}</span></div>
                <Meta>{a.status === 'unknown' ? 'The result is not known. It is never retried automatically; check the processor and resolve it with what you find.' : 'In progress.'}</Meta>
                {a.status === 'started' ? <ActionButton op="markAttemptUnknown" vars={{ attemptId: a.id, expectedVersion: a.version }} paths={paths}>Mark result unknown</ActionButton> : null}
                {a.status === 'unknown' ? <ActionButton op="resolveAttemptFailed" vars={{ attemptId: a.id, expectedVersion: a.version }} ask="What proves it did not go through? (processor record, at least 10 characters)" paths={paths}>Confirm it failed</ActionButton> : null}
              </div>
            </Row>
          ))}
        </Section>
      ) : null}
      <Section title={`Batches · ${d.paymentBatches.length}`}>
        {d.paymentBatches.length ? d.paymentBatches.map(b => (
          <Row key={b.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{b.businessDate ? dateText(b.businessDate.slice(0, 10)) : b.ref} · {label(b.tenderGroup)}</span><span className="font-mono text-xs text-muted-foreground">{b.ref}</span><Status value={b.status} /><span className="ml-auto font-mono text-sm tabular-nums">{money(b.expectedMinor)}</span></div>
              <Meta>{b.feesMinor !== '0' ? `fees ${money(b.feesMinor)} · ` : ''}{['reconciled', 'exported'].includes(b.status) ? `deposited ${money(b.depositedMinor)} (${b.depositReference}) · variance ${money(b.varianceMinor)}` : 'expected after fees'}</Meta>
              {b.status === 'open' ? <ActionButton op="closePaymentBatch" vars={{ batchId: b.id, expectedVersion: b.version }} confirm="Close this batch? Closed batches take no more payments." paths={paths}>Close batch</ActionButton> : null}
              {b.status === 'closed' ? <DepositForm batchId={b.id} expectedVersion={b.version} expected={b.expectedMinor} /> : null}
            </div>
          </Row>
        )) : <Empty>No payments recorded yet.</Empty>}
      </Section>
    </Page>
  );
}
