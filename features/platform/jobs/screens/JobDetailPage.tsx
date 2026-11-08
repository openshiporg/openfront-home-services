import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JobSales } from '../../estimates/components/JobSales';
import { q, companyTimeZone } from '../../lib/server';
import { eventText, label, quantity, when, windowText, dateText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';

type Detail = {
  id: string; ref: string; publicCode: string; status: string; priority: string; source: string; summary: string; version: number; holdReason: string; holdFollowUpOn: string | null; cancelReason: string; createdAt: string;
  jobType: { name: string; code: string } | null; businessUnit: { name: string } | null; bookedBy: { name: string } | null; bookedByAgent: { name: string } | null;
  customer: { id: string; displayName: string; ref: string } | null; location: { address1: string; city: string; postalCode: string; serviceArea: { name: string } | null } | null;
  lead: { ref: string } | null;
  visits: {
    id: string; ref: string; status: string; version: number; capacityHours: string; needsReview: boolean; actualArrivalAt: string | null; actualDoneAt: string | null;
    window: { date: string; label: string } | null;
    assignments: { role: string; active: boolean; overrideReason: string; assignedAt: string | null; employee: { displayName: string } | null; assignedBy: { name: string } | null; assignedByAgent: { name: string } | null }[];
    statusEvents: { fromStatus: string; toStatus: string; kind: string; occurredAt: string; note: string; actorUser: { name: string } | null }[];
  }[];
};

const PATH = (id: string) => `/dashboard/platform/jobs/${id}`;

/** Job detail: visits with who did what when, the status timeline, texts sent, and the job's audit trail. */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, tz] = await Promise.all([
    q<{ job: Detail | null; messages: { id: string; template: string; status: string; blockedReason: string; version: number; createdAt: string; sentAt: string | null }[]; auditEvents: { eventType: string; at: string; actorUser: { name: string } | null; actorAgent: { name: string } | null }[] }>(`
      query Job($id: ID!, $entity: String!) {
        job(where: { id: $id }) {
          id ref publicCode status priority source summary version holdReason holdFollowUpOn cancelReason createdAt
          jobType { name code } businessUnit { name } bookedBy { name } bookedByAgent { name }
          customer { id displayName ref } location { address1 city postalCode serviceArea { name } } lead { ref }
          visits(orderBy: [{ createdAt: asc }]) {
            id ref status version capacityHours needsReview actualArrivalAt actualDoneAt window { date label }
            assignments(orderBy: [{ createdAt: asc }]) { role active overrideReason assignedAt employee { displayName } assignedBy { name } assignedByAgent { name } }
            statusEvents(orderBy: [{ occurredAt: asc }]) { fromStatus toStatus kind occurredAt note actorUser { name } }
          }
        }
        messages(where: { job: { id: { equals: $id } } }, orderBy: [{ createdAt: asc }]) { id template status blockedReason version createdAt sentAt }
        auditEvents(where: { entityId: { equals: $entity } }, orderBy: [{ seq: asc }], take: 50) { eventType at actorUser { name } actorAgent { name } }
      }`, { id, entity: id }).catch(() => ({ job: null, messages: [], auditEvents: [] })),
    companyTimeZone(),
  ]);
  const j = d.job;
  if (!j) notFound();
  const open = ['booked', 'scheduled', 'in_progress'].includes(j.status);
  return (
    <Page title={`${j.jobType?.name ?? 'Job'} · ${j.ref}`} crumbs={[{ label: 'Jobs', href: '/dashboard/platform/jobs' }]}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Status" value={<Status value={j.status} />} />
        <Stat name="Customer" value={j.customer ? <Link className="underline" href={`/dashboard/platform/customers/${j.customer.id}`}>{j.customer.displayName}</Link> : '—'} />
        <Stat name="Department" value={j.businessUnit?.name ?? '—'} />
        <Stat name="Customer reference" value={<span className="font-mono text-base">{j.publicCode}</span>} />
      </div>
      <Section title="Job">
        <p className="text-sm">{j.summary || 'No description.'}</p>
        <Meta>
          {j.location ? `${j.location.address1}, ${j.location.city} ${j.location.postalCode}${j.location.serviceArea ? ` · ${j.location.serviceArea.name}` : ''}` : ''}
          {' · '}{j.bookedByAgent ? `booked by the AI receptionist (${j.bookedByAgent.name})` : j.bookedBy ? `booked by ${j.bookedBy.name}${j.source === 'csr' ? ' on the phone' : j.source === 'online' ? ' online' : ''}` : label(j.source, 'bookedVia').toLowerCase()} {when(j.createdAt, tz)}{j.lead ? ` from lead ${j.lead.ref}` : ''}
          {j.holdReason ? ` · on hold (${label(j.holdReason).toLowerCase()}), follow up ${j.holdFollowUpOn ? dateText(j.holdFollowUpOn) : '—'}` : ''}{j.cancelReason ? ` · cancelled: ${label(j.cancelReason).toLowerCase()}` : ''}
        </Meta>
        <div className="flex flex-wrap gap-2 pt-2">
          {open ? <CommandForm op="holdJob" submit="Put on hold" fixed={{ jobId: j.id, expectedVersion: j.version }} paths={[PATH(j.id)]} fields={[
            { name: 'reason', label: 'Reason', kind: 'select', options: ['parts', 'customer_decision', 'financing', 'permit', 'authorization', 'access', 'other'].map(v => ({ value: v, label: label(v) })) },
            { name: 'followUpOn', label: 'Follow up on', kind: 'date', required: true, width: 'sm' },
          ]} /> : null}
          {j.status === 'on_hold' ? <ActionButton op="releaseJobHold" vars={{ jobId: j.id, expectedVersion: j.version }} paths={[PATH(j.id)]}>Release hold</ActionButton> : null}
          {['booked', 'scheduled', 'on_hold'].includes(j.status) ? <ActionButton op="cancelJob" vars={{ jobId: j.id, expectedVersion: j.version }} choices={['customer_request', 'duplicate', 'no_access', 'out_of_area', 'scheduling', 'weather', 'other'].map(v => ({ value: v, label: label(v) }))} paths={[PATH(j.id)]}>Cancel job</ActionButton> : null}
        </div>
      </Section>
      <Section title="Visits">
        {j.visits.map(v => (
          <div key={v.id} className="space-y-2 border-b py-3 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{v.ref} · {v.window ? windowText(v.window) : 'Not scheduled'} · {quantity(v.capacityHours)} h <Status value={v.status} /></span>
            </div>
            {v.needsReview ? <p className="text-xs text-amber-600">A device sent a status out of order; check the timeline.</p> : null}
            <Meta>
              {v.assignments.length ? v.assignments.map((a, i) => <span key={i} className={a.active ? '' : 'line-through'}>{a.employee?.displayName} ({label(a.role, 'crewRole').toLowerCase()}) by {a.assignedByAgent ? `AI agent ${a.assignedByAgent.name}` : a.assignedBy?.name ?? 'system'}{a.overrideReason ? ` · override: ${a.overrideReason}` : ''}{i < v.assignments.length - 1 ? '; ' : ''}</span>) : 'Not assigned'}
            </Meta>
            {v.statusEvents.length ? (
              <ol className="space-y-0.5 text-xs text-muted-foreground">
                {v.statusEvents.map((e, i) => <li key={i}>{when(e.occurredAt, tz, 'seconds')} · {label(e.fromStatus)} → {label(e.toStatus)}{e.kind !== 'transition' ? ` (${label(e.kind).toLowerCase()})` : ''}{e.actorUser ? ` · ${e.actorUser.name}` : ''}{e.note ? ` · ${e.note}` : ''}</li>)}
              </ol>
            ) : null}
          </div>
        ))}
      </Section>
      <JobSales jobId={j.id} jobTitle={`${j.jobType?.name ?? 'Estimate'}${j.customer ? ` · ${j.customer.displayName}` : ''}`} path={`/dashboard/platform/jobs/${j.id}`} tz={tz} />
      <Section title="Texts">
        {d.messages.length ? d.messages.map(m => (
          <Row key={m.id}>
            <div className="min-w-0 flex-1"><span className="font-medium">{label(m.template)}</span> <Status value={m.status} /><Meta> · {when(m.sentAt ?? m.createdAt, tz)}{m.blockedReason ? ` · held: ${label(m.blockedReason).toLowerCase()}` : ''}</Meta></div>
            <div className="flex flex-wrap items-center gap-2">
              {m.status === 'blocked' ? <ActionButton op="requeueMessage" vars={{ messageId: m.id, expectedVersion: m.version }} confirm="Send again? It is checked against consent and quiet hours again." paths={[PATH(j.id)]}>Retry</ActionButton> : null}
              {m.status === 'manual' ? <ActionButton op="markMessageSent" vars={{ messageId: m.id, expectedVersion: m.version }} paths={[PATH(j.id)]}>I sent it</ActionButton> : null}
            </div>
          </Row>
        )) : <Empty>No texts for this job.</Empty>}
      </Section>
      <Section title="Audit">
        {d.auditEvents.length ? (
          <ol className="space-y-0.5 text-xs text-muted-foreground">
            {d.auditEvents.map((e, i) => <li key={i}>{when(e.at, tz, 'seconds')} · {eventText(e.eventType)}{e.actorAgent ? ` · AI agent ${e.actorAgent.name}` : e.actorUser ? ` · ${e.actorUser.name}` : ''}</li>)}
          </ol>
        ) : <Empty>No audit events visible to you.</Empty>}
      </Section>
    </Page>
  );
}
