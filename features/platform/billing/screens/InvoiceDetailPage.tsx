import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, companyTimeZone, viewer } from '../../lib/server';
import { label, money, when, dateText, eventText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CreditMemoForm, PaymentForm, RefundRequestForm } from '../components/BillingForms';

type Inv = {
  id: string; ref: string; status: string; version: number; payerKind: string; propertyClass: string; contractTaxMode: string; invoiceDate: string | null; dueDate: string | null; collectionsStatus: string; poNumber: string; progressReason: string;
  subtotalMinor: string; discountMinor: string; taxMinor: string; totalMinor: string; balanceMinor: string;
  customer: { id: string; displayName: string } | null; payer: { name: string } | null; job: { id: string; ref: string } | null;
  lines: { id: string; description: string; quantity: string; amountMinor: string; taxMinor: string; taxable: boolean; taxCategory: string }[];
  allocations: { id: string; kind: string; amountMinor: string; createdAt: string; payment: { id: string; ref: string; method: string; amountMinor: string; reference: string; feeMinor: string; refunds: { ref: string; amountMinor: string }[] | null } | null }[];
  creditMemos: { id: string; ref: string; status: string; reason: string; totalMinor: string }[];
};

/** One invoice: lines with the tax that was applied, payments and credits, and what can be done next. */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await viewer();
  const [d, tz] = await Promise.all([
    q<{ invoice: Inv | null; auditEvents: { eventType: string; at: string; actorUser: { name: string } | null }[] }>(`
      query I($id: ID!, $entity: String!) {
        invoice(where: { id: $id }) {
          id ref status version payerKind propertyClass contractTaxMode invoiceDate dueDate collectionsStatus poNumber progressReason subtotalMinor discountMinor taxMinor totalMinor balanceMinor
          customer { id displayName } payer { name } job { id ref }
          lines(orderBy: [{ sortOrder: asc }]) { id description quantity amountMinor taxMinor taxable taxCategory }
          allocations(orderBy: [{ createdAt: asc }]) { id kind amountMinor createdAt payment { id ref method amountMinor reference feeMinor refunds { ref amountMinor } } }
          creditMemos(orderBy: [{ createdAt: asc }]) { id ref status reason totalMinor }
        }
        auditEvents(where: { entityId: { equals: $entity } }, orderBy: [{ seq: asc }], take: 40) { eventType at actorUser { name } }
      }`, { id, entity: id }).catch(() => ({ invoice: null, auditEvents: [] })),
    companyTimeZone(),
  ]);
  const i = d.invoice;
  if (!i) notFound();
  const paths = [`/dashboard/platform/invoices/${i.id}`, '/dashboard/platform/invoices'];
  const bills = me.can('canManageInvoices') || me.can('canPostInvoices');
  const takes = me.can('canManagePayments') || me.can('canTakePayments');
  const live = ['posted', 'partially_paid'].includes(i.status);
  const applied = i.allocations.filter(a => a.kind === 'apply' && a.payment);
  // Membership invoices: a refund credits the invoice (paid, then refunded); it is never owed again.
  const membership = i.lines.some(l => l.taxCategory === 'membership');
  const refundedMinor = [...new Map(applied.map(a => [a.payment!.id, a.payment!])).values()].reduce((n, p) => n + (p.refunds ?? []).reduce((m, r) => m + BigInt(r.amountMinor), 0n), 0n);
  const reopenedByRefund = membership && refundedMinor > 0n && BigInt(i.balanceMinor) > 0n;
  return (
    <Page title={`${i.ref} · ${i.payer?.name ?? i.customer?.displayName ?? 'Invoice'}`} crumbs={[{ label: 'Invoices', href: '/dashboard/platform/invoices' }]}>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        <Stat name="Status" value={membership && refundedMinor > 0n && !reopenedByRefund ? 'Paid, then refunded' : <Status value={i.status} />} />
        <Stat name="Total" value={money(i.totalMinor)} />
        <Stat name="Balance" value={money(i.balanceMinor)} />
        <Stat name="Due" value={i.dueDate ? dateText(i.dueDate.slice(0, 10)) : '—'} />
      </div>
      <Section title="Invoice">
        <p className="text-xs text-muted-foreground">
          {i.customer ? <><Link className="underline" href={`/dashboard/platform/customers/${i.customer.id}`}>{i.customer.displayName}</Link> · </> : null}
          {i.job ? <>job <Link className="underline" href={`/dashboard/platform/jobs/${i.job.id}`}>{i.job.ref}</Link> · </> : null}
          {label(i.propertyClass).toLowerCase()} property · {label(i.contractTaxMode).toLowerCase()} contract{i.poNumber ? ` · PO ${i.poNumber}` : ''}{i.progressReason ? ` · progress billing: ${i.progressReason}` : ''}
          {i.collectionsStatus !== 'current' ? ` · collections: ${label(i.collectionsStatus).toLowerCase()}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {i.status === 'draft' && bills ? <>
            <ActionButton op="postInvoice" vars={{ invoiceId: i.id, expectedVersion: i.version }} paths={paths}>Post invoice</ActionButton>
            <ActionButton op="discardInvoiceDraft" vars={{ invoiceId: i.id, expectedVersion: i.version }} ask="Why discard this draft?" paths={paths}>Discard draft</ActionButton>
          </> : null}
          {live && bills ? <ActionButton op="requestWriteOff" vars={{ invoiceId: i.id }} ask="Why write this off? A second person must approve." paths={paths}>Request write-off</ActionButton> : null}
          {i.status === 'posted' && bills && !applied.length ? <ActionButton op="voidInvoice" vars={{ invoiceId: i.id }} ask="Why void this invoice?" confirm="Void this invoice with a full credit memo?" paths={paths}>Void</ActionButton> : null}
        </div>
      </Section>
      <Section title={`Lines · ${i.lines.length}`}>
        {i.lines.length ? i.lines.map(l => (
          <Row key={l.id}><div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3"><span className="min-w-0 basis-full break-words sm:basis-0 sm:flex-1">{l.description}</span><span className="text-xs text-muted-foreground">{l.taxable ? `tax ${money(l.taxMinor)}` : 'no tax'}</span><span className="ml-auto font-mono text-sm tabular-nums">{money(l.amountMinor)}</span></div></Row>
        )) : <Empty>No lines.</Empty>}
        <p className="text-right text-xs text-muted-foreground">Subtotal {money(i.subtotalMinor)}{BigInt(i.discountMinor) ? ` · discount −${money(i.discountMinor)}` : ''} · tax {money(i.taxMinor)} · <span className="font-medium text-foreground">total {money(i.totalMinor)}</span></p>
      </Section>
      {membership && refundedMinor > 0n ? (
        <Section title="Refunded">
          <Meta>{money(refundedMinor.toString())} of this membership payment was refunded. A refunded membership payment is not billed again: the invoice is credited the same amount and the term it paid for is closed.</Meta>
          {reopenedByRefund && me.can('canIssueRefunds') ? <ActionButton op="settleRefundedMembershipInvoice" vars={{ invoiceId: i.id }} paths={paths} confirm="This refund reopened the invoice. Credit the refunded amount so it is not owed, and close the membership term it paid for?">Credit the refund</ActionButton> : null}
        </Section>
      ) : null}
      {live && takes && !reopenedByRefund ? <Section title="Record a payment"><PaymentForm invoiceId={i.id} balanceMinor={i.balanceMinor} /></Section> : null}
      <Section title={`Payments and credits · ${i.allocations.length}`}>
        {i.allocations.length ? i.allocations.map(a => (
          <Row key={a.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3"><span className="font-medium">{a.payment?.ref ?? 'Credit'} · {label(a.kind).toLowerCase()}{a.payment ? ` · ${label(a.payment.method).toLowerCase()}` : ''}</span><span className="ml-auto font-mono text-sm tabular-nums">{money(a.amountMinor)}</span></div>
              <Meta>{when(a.createdAt, tz)}{a.payment?.reference ? ` · ${a.payment.reference}` : ''}</Meta>
              {a.kind === 'apply' && a.payment && me.can('canIssueRefunds') ? <RefundRequestForm invoiceId={i.id} paymentId={a.payment.id} max={a.amountMinor} /> : null}
            </div>
          </Row>
        )) : <Empty>No payments yet.</Empty>}
      </Section>
      {(live || i.status === 'paid') && bills ? <Section title="Credit memo"><CreditMemoForm invoiceId={i.id} /></Section> : null}
      {i.creditMemos.length ? <Section title={`Credit memos · ${i.creditMemos.length}`}>{i.creditMemos.map(c => <Row key={c.id}><div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3"><span className="font-medium">{c.ref} · {label(c.reason).toLowerCase()}</span><Status value={c.status} /><span className="ml-auto font-mono text-sm tabular-nums">{money(c.totalMinor)}</span></div></Row>)}</Section> : null}
      <Section title="Audit">
        {d.auditEvents.length ? <ol className="space-y-0.5 text-xs text-muted-foreground">{d.auditEvents.map((a, n) => <li key={n}>{when(a.at, tz, 'seconds')} · {eventText(a.eventType)}{a.actorUser ? ` · ${a.actorUser.name}` : ''}</li>)}</ol> : <Empty>No audit events visible to you.</Empty>}
      </Section>
    </Page>
  );
}
