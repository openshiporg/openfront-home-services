import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, companyTimeZone } from '../../lib/server';
import { dateText, label, phoneText, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';

type Point = { id: string; kind: string; value: string | null; isPrimary: boolean; consents: { purpose: string; action: string; channel: string; recordedAt: string; actorKind: string }[] };
type Detail = {
  id: string; ref: string; kind: string; displayName: string; organizationName: string; doNotService: boolean; doNotServiceReason: string; createdAt: string;
  source: { name: string } | null;
  taxExemptCertificate: { id: string; title: string; expiresAt: string | null } | null;
  contacts: { id: string; firstName: string; lastName: string; role: string; points: Point[] }[];
  locations: { id: string; ref: string; address1: string; address2: string; city: string; postalCode: string; propertyType: string; serviceArea: { name: string } | null; accessSecrets: { id: string; kind: string; label: string; status: string; revealsCount: number }[] }[];
  jobs: { id: string; ref: string; status: string; createdAt: string; jobType: { name: string } | null }[];
};

const PURPOSES = ['transactional_sms', 'marketing_sms', 'marketing_email', 'call_recording'];

/** Latest event per purpose wins (consent records are append-only). */
function effective(point: Point) {
  const latest = new Map<string, Point['consents'][number]>();
  for (const c of [...point.consents].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))) latest.set(c.purpose, c);
  return latest;
}

/** Customer 360: contacts and consent, service addresses (access codes stay sealed), and jobs. */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, tz] = await Promise.all([
    q<{ customer: Detail | null }>(`
      query Customer($id: ID!) {
        customer(where: { id: $id }) {
          id ref kind displayName organizationName doNotService doNotServiceReason createdAt source { name } taxExemptCertificate { id title expiresAt }
          contacts { id firstName lastName role points { id kind value isPrimary consents(orderBy: [{ recordedAt: asc }]) { purpose action channel recordedAt actorKind } } }
          locations(where: { mergedInto: null }) { id ref address1 address2 city postalCode propertyType serviceArea { name } accessSecrets { id kind label status revealsCount } }
          jobs(orderBy: [{ createdAt: desc }], take: 20) { id ref status createdAt jobType { name } }
        }
      }`, { id }).catch(() => ({ customer: null })),
    companyTimeZone(),
  ]);
  const c = d.customer;
  if (!c) notFound();
  const path = `/dashboard/platform/customers/${c.id}`;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const cert = c.taxExemptCertificate;
  const certExpired = !!cert?.expiresAt && cert.expiresAt <= today;
  return (
    <Page title={c.displayName} crumbs={[{ label: 'Customers', href: '/dashboard/platform/customers' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Ref" value={<span className="font-mono text-base">{c.ref}</span>} />
        <Stat name="Kind" value={label(c.kind)} />
        <Stat name="Source" value={c.source?.name ?? '—'} />
        <Stat name="Jobs" value={c.jobs.length} />
      </div>
      {c.doNotService ? <p className="rounded-md border border-red-300 p-3 text-sm text-red-700">Do not service{c.doNotServiceReason ? `: ${c.doNotServiceReason}` : ''}. Only a manager can book this customer.</p> : null}

      {cert ? (
        <Section title="Tax exemption certificate">
          <Row>
            <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{cert.title}</span>{certExpired ? <span className="rounded border border-red-300 px-1.5 text-xs font-medium text-red-700">Expired</span> : <span className="rounded border border-emerald-300 px-1.5 text-xs font-medium text-emerald-700">Valid</span>}</span>
            <Meta>{cert.expiresAt ? `${certExpired ? 'Expired' : 'Expires'} ${dateText(cert.expiresAt)}` : 'No expiry date'}{certExpired ? ' · invoices are taxed' : ' · nonresidential work is not taxed'}</Meta>
          </Row>
        </Section>
      ) : null}

      <Section title="Contacts and consent">
        {c.contacts.map(ct => (
          <div key={ct.id} className="space-y-2 border-b py-3 last:border-b-0">
            <p className="text-sm font-medium">{ct.firstName} {ct.lastName} <span className="text-xs text-muted-foreground">{label(ct.role, 'contactRole')}</span></p>
            {ct.points.map(p => {
              const eff = effective(p);
              return (
                <Row key={p.id} className="pl-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="font-mono text-sm">{p.value ? (p.kind === 'email' ? p.value : phoneText(p.value)) : 'hidden'}</span> <Meta>{label(p.kind)}{p.isPrimary ? ' · primary' : ''}</Meta>
                    {p.kind !== 'email' ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {PURPOSES.filter(x => !x.endsWith('email')).map(purpose => {
                          const e = eff.get(purpose);
                          return <span key={purpose} className="inline-flex items-center gap-1.5 text-xs"><span className={`size-2 shrink-0 rounded-full ${e?.action === 'grant' ? 'bg-emerald-500' : e?.action === 'revoke' ? 'bg-red-500' : 'bg-muted-foreground/40'}`} /><span>{label(purpose)}: {e?.action === 'grant' ? 'yes' : e?.action === 'revoke' ? 'no' : 'not asked'}</span><span className="text-muted-foreground">{e ? ` · ${label(e.channel).toLowerCase()}, ${when(e.recordedAt, tz)}` : ''}</span></span>;
                        })}
                      </div>
                    ) : null}
                  </div>
                  {p.kind !== 'email' ? (
                    <div className="flex flex-wrap gap-2">
                      {eff.get('transactional_sms')?.action !== 'grant'
                        ? <ActionButton op="recordConsent" vars={{ contactPointId: p.id, purpose: 'transactional_sms', action: 'grant', channel: 'phone', evidence: { note: 'Verbal consent on a call' } }} confirm="Did the customer agree, just now, to appointment texts?" paths={[path]}>Texts OK</ActionButton>
                        : <ActionButton op="recordConsent" vars={{ contactPointId: p.id, purpose: 'transactional_sms', action: 'revoke', channel: 'phone', evidence: { note: 'Customer asked to stop texts' } }} confirm="Record that the customer does not want texts?" paths={[path]}>Stop texts</ActionButton>}
                    </div>
                  ) : null}
                </Row>
              );
            })}
            <div className="pl-3"><CommandForm op="addContactPoint" submit="Add" fixed={{ contactId: ct.id }} paths={[path]} fields={[
              { name: 'kind', label: 'Kind', kind: 'select', options: [{ value: 'mobile', label: 'Mobile' }, { value: 'landline', label: 'Landline' }, { value: 'email', label: 'Email' }], width: 'sm' },
              { name: 'value', label: 'Number or email', required: true },
            ]} /></div>
          </div>
        ))}
      </Section>

      <Section title="Service addresses">
        {c.locations.map(l => (
          <div key={l.id} className="space-y-2 border-b py-3 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{l.address1}{l.address2 ? `, ${l.address2}` : ''}, {l.city} {l.postalCode}</span>
              <Meta>{l.ref} · {label(l.propertyType)} · {l.serviceArea ? l.serviceArea.name : 'outside the service area'}</Meta>
            </div>
            {l.accessSecrets.length ? (
              <ul className="space-y-1 pl-3 text-xs text-muted-foreground">
                {l.accessSecrets.map(a => <li key={a.id}>{label(a.kind)}{a.label ? ` · ${a.label}` : ''} · sealed · revealed {a.revealsCount} times (only to the assigned tech on a visit)</li>)}
              </ul>
            ) : null}
            <div className="pl-3"><CommandForm op="storeAccessSecret" submit="Save code" fixed={{ locationId: l.id }} paths={[path]} fields={[
              { name: 'kind', label: 'Kind', kind: 'select', options: ['gate_code', 'lockbox', 'alarm', 'garage', 'pet', 'other'].map(v => ({ value: v, label: label(v) })), width: 'sm' },
              { name: 'label', label: 'Label', width: 'sm' },
              { name: 'secret', label: 'Code', kind: 'password', required: true, width: 'sm' },
            ]} /></div>
          </div>
        ))}
        <CommandForm op="addServiceLocation" submit="Add address" fixed={{ customerId: c.id }} paths={[path]}
          nest={{ location: { fields: ['address1', 'city', 'postalCode'], fixed: { state: 'TX' } } }}
          fields={[{ name: 'address1', label: 'Address', required: true, width: 'lg' }, { name: 'city', label: 'City', defaultValue: 'Austin', width: 'sm' }, { name: 'postalCode', label: 'ZIP', required: true, width: 'sm' }]} />
      </Section>

      <Section title="Jobs" aside={<Link className="text-xs underline" href="/dashboard/platform/book">Book a job</Link>}>
        {c.jobs.length ? c.jobs.map(j => (
          <Row key={j.id} href={`/dashboard/platform/jobs/${j.id}`}>
            <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{j.jobType?.name ?? 'Job'}</span><span className="font-mono text-xs text-muted-foreground">{j.ref}</span><Status value={j.status} /></span>
            <Meta>{when(j.createdAt, tz)}</Meta>
          </Row>
        )) : <Empty>No jobs yet.</Empty>}
      </Section>
    </Page>
  );
}
