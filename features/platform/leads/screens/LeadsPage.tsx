import Link from 'next/link';
import { q, companyTimeZone, requestTime } from '../../lib/server';
import { label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';

type Lead = {
  id: string; ref: string; source: string; contactName: string; phoneE164: string | null; summary: string; status: string; lostReason: string; version: number;
  createdAt: string; respondDueAt: string | null; firstResponseSeconds: number | null;
  campaign: { name: string } | null; requestedJobType: { name: string } | null; customer: { id: string; displayName: string } | null; job: { id: string; ref: string } | null;
};

const OPEN = ['new', 'contacted', 'qualified'];
const VIEWS: Record<string, string[]> = { open: OPEN, booked: ['booked', 'converted'], closed: ['lost', 'spam', 'merged'] };
const PATHS = ['/dashboard/platform/leads'];

function respondedIn(seconds: number | null) {
  if (seconds === null) return null;
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/** Leads inbox (SM§1): every request for service with its response clock, source and outcome. */
export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'open';
  const view = raw in VIEWS ? raw : 'open';
  const statuses = JSON.stringify(VIEWS[view]);
  const [d, tz] = await Promise.all([
    q<{ leads: Lead[]; open: number; booked: number; closed: number; jobTypes: { id: string; name: string }[]; campaigns: { id: string; name: string }[] }>(`{
      leads(where: { status: { in: ${statuses} } }, orderBy: [{ createdAt: desc }], take: 100) {
        id ref source contactName phoneE164 summary status lostReason version createdAt respondDueAt firstResponseSeconds
        campaign { name } requestedJobType { name } customer { id displayName } job { id ref }
      }
      open: leadsCount(where: { status: { in: ${JSON.stringify(VIEWS.open)} } })
      booked: leadsCount(where: { status: { in: ${JSON.stringify(VIEWS.booked)} } })
      closed: leadsCount(where: { status: { in: ${JSON.stringify(VIEWS.closed)} } })
      jobTypes(where: { active: { equals: true } }, orderBy: [{ name: asc }]) { id name }
      campaigns(where: { active: { equals: true } }, orderBy: [{ name: asc }]) { id name }
    }`),
    companyTimeZone(),
  ]);
  const now = requestTime();
  return (
    <Page title="Leads">
      <Tabs active={view} items={[
        { key: 'open', label: 'Open', href: '/dashboard/platform/leads', count: d.open },
        { key: 'booked', label: 'Booked', href: '/dashboard/platform/leads?view=booked', count: d.booked },
        { key: 'closed', label: 'Lost or spam', href: '/dashboard/platform/leads?view=closed', count: d.closed },
      ]} />
      {view === 'open' ? (
        <Section title="Take a lead">
          <CommandForm op="ingestLead" submit="Add lead" paths={PATHS} fields={[
            { name: 'contactName', label: 'Name', required: true },
            { name: 'phone', label: 'Phone', kind: 'tel' },
            { name: 'postalCode', label: 'ZIP', width: 'sm' },
            { name: 'summary', label: 'What they need', width: 'lg' },
            { name: 'source', label: 'Source', kind: 'select', options: ['call', 'web_form', 'sms', 'lsa', 'marketplace', 'tech_generated'].map(v => ({ value: v, label: label(v) })) },
            { name: 'campaignId', label: 'Campaign', kind: 'select', options: [{ value: '', label: 'None' }, ...d.campaigns.map(c => ({ value: c.id, label: c.name }))] },
          ]} />
        </Section>
      ) : null}
      <Section title={view === 'open' ? 'Waiting on us' : view === 'booked' ? 'Booked' : 'Closed'}>
        {d.leads.length ? d.leads.map(l => {
          const late = l.status === 'new' && l.respondDueAt !== null && new Date(l.respondDueAt).getTime() < now;
          return (
            <Row key={l.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.contactName || 'Unknown caller'}</span>
                  <span className="font-mono text-xs text-muted-foreground">{l.ref}</span>
                  {l.customer ? <Link className="text-xs underline" href={`/dashboard/platform/customers/${l.customer.id}`}>{l.customer.displayName}</Link> : null}
                </div>
                {l.summary ? <p className="break-words text-sm">{l.summary}</p> : null}
                <Meta>
                  {label(l.source)}{l.campaign ? ` · ${l.campaign.name}` : ''}{l.requestedJobType ? ` · ${l.requestedJobType.name}` : ''}{l.phoneE164 ? ` · ${l.phoneE164}` : ''} · {when(l.createdAt, tz)}
                  {l.firstResponseSeconds !== null ? ` · answered in ${respondedIn(l.firstResponseSeconds)}` : ''}
                  {l.lostReason ? ` · ${label(l.lostReason)}` : ''}
                </Meta>
                {l.job ? <Meta><br /><Link className="underline" href={`/dashboard/platform/jobs/${l.job.id}`}>Job {l.job.ref}</Link></Meta> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Status value={l.status} />
                {l.status === 'new' && l.respondDueAt ? <span className={`text-xs ${late ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>{late ? 'Overdue since' : 'Respond by'} {when(l.respondDueAt, tz, 'time')}</span> : null}
                {l.status === 'new' ? <ActionButton op="markLeadContacted" vars={{ leadId: l.id, expectedVersion: l.version }} paths={PATHS}>Contacted</ActionButton> : null}
                {OPEN.includes(l.status) ? <Link className="text-xs underline" href="/dashboard/platform/book">Book</Link> : null}
                {OPEN.includes(l.status) ? <ActionButton op="loseLead" vars={{ leadId: l.id, expectedVersion: l.version }} ask={`Why was it lost? (${['price', 'timing', 'out_of_area', 'no_answer', 'competitor', 'not_serviceable', 'duplicate', 'other'].join(', ')})`} paths={PATHS}>Lost</ActionButton> : null}
                {OPEN.includes(l.status) ? <ActionButton op="markLeadSpam" vars={{ leadId: l.id, expectedVersion: l.version }} confirm="Mark this lead as spam?" paths={PATHS}>Spam</ActionButton> : null}
              </div>
            </Row>
          );
        }) : <Empty>{view === 'open' ? 'No open leads. New calls, forms and LSA leads land here.' : 'Nothing here yet.'}</Empty>}
      </Section>
    </Page>
  );
}
