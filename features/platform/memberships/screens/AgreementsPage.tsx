import { notFound } from 'next/navigation';
import { q, viewer } from '../../lib/server';
import { money, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { AgreementForm } from '../components/MembershipForms';

type A = { id: string; ref: string; name: string; status: string; startsOn: string; endsOn: string; scope: string; visitMonths: string[] | null; nteMinor: string | null; customer: { displayName: string } | null; location: { address1: string; city: string } | null; events: { status: string }[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Service agreements: planned maintenance for commercial customers, on a fixed set of months. Visits show up in Due for service. */
export default async function AgreementsPage() {
  const me = await viewer();
  const can = me.can('canManageMemberships');
  if (!can && !me.can('canManageInvoices') && !me.can('canManageAccounting') && !me.can('canBook') && !me.can('canDispatch')) notFound();
  const d = await q<{ serviceAgreements: A[]; customers: { id: string; displayName: string; locations: { id: string; address1: string; city: string }[] }[] }>(`{
    serviceAgreements(orderBy: [{ startsOn: desc }], take: 100) { id ref name status startsOn endsOn scope visitMonths nteMinor customer { displayName } location { address1 city } events { status } }
    customers(where: { kind: { equals: "commercial" } }, orderBy: [{ displayName: asc }], take: 200) { id displayName locations { id address1 city } }
  }`);
  const places = d.customers.flatMap(c => c.locations.map(l => ({ value: `${c.id}|${l.id}`, label: `${c.displayName} · ${l.address1}, ${l.city}` })));
  const paths = ['/dashboard/platform/agreements'];
  return (
    <Page title="Service agreements">
      {can ? <Section title="New agreement">{places.length ? <AgreementForm places={places} /> : <Empty>Add a commercial customer with an address first.</Empty>}</Section> : null}
      <Section title={`Agreements · ${d.serviceAgreements.length}`}>
        {d.serviceAgreements.length ? d.serviceAgreements.map(a => (
          <Row key={a.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{a.name} · {a.customer?.displayName}</span><Status value={a.status} />{a.nteMinor && a.nteMinor !== '0' ? <span className="ml-auto text-sm tabular-nums">up to {money(a.nteMinor)}</span> : null}</div>
              <Meta>{a.ref} · {a.location ? `${a.location.address1}, ${a.location.city} · ` : ''}{dateText(a.startsOn)} to {dateText(a.endsOn)} · visits in {(a.visitMonths ?? []).map(m => MONTHS[Number(m) - 1]).filter(Boolean).join(', ') || 'no months set'} · {a.events.filter(e => e.status === 'open').length} open, {a.events.filter(e => e.status === 'booked').length} booked</Meta>
              <Meta>{a.scope}</Meta>
              {can ? (
                <div className="flex flex-wrap gap-2">
                  {a.status === 'draft' ? <ActionButton op="activateServiceAgreement" vars={{ agreementId: a.id }} confirm="Start this agreement? Its visits are added to Due for service." paths={paths}>Start agreement</ActionButton> : null}
                  {a.status !== 'ended' ? <ActionButton op="endServiceAgreement" vars={{ agreementId: a.id }} ask="Why is the agreement ending?" paths={paths}>End agreement</ActionButton> : null}
                </div>
              ) : null}
            </div>
          </Row>
        )) : <Empty>No service agreements yet.</Empty>}
      </Section>
    </Page>
  );
}
