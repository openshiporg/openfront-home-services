import { notFound } from 'next/navigation';
import { q, companyTimeZone } from '../../lib/server';
import { label, when, windowText } from '../../lib/format';
import { Page, Meta, Section, Status, Empty } from '../../components/ui';
import { ChecklistForm, RevealCode, VisitStatusButtons } from '../components/FieldActions';

type Visit = {
  id: string; ref: string; status: string; version: number; needsReview: boolean;
  window: { date: string; label: string } | null;
  job: {
    summary: string; priority: string;
    jobType: { name: string; checklistTemplate: { id: string; name: string; items: { key: string; label: string }[] | null } | null } | null;
    location: { address1: string; address2: string; city: string; postalCode: string; accessSecrets: { id: string; kind: string; label: string }[] } | null;
    customer: { displayName: string } | null;
  } | null;
  statusEvents: { toStatus: string; kind: string; occurredAt: string }[];
};

/** One visit on the tech's phone: where, what, access codes (logged), status buttons, the checklist. */
export default async function FieldVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, tz] = await Promise.all([
    q<{ visit: Visit | null; checklistResponsesCount: number }>(`
      query FieldVisit($id: ID!) {
        visit(where: { id: $id }) {
          id ref status version needsReview window { date label }
          job { summary priority jobType { name checklistTemplate { id name items } } location { address1 address2 city postalCode accessSecrets(where: { status: { equals: "active" } }) { id kind label } } customer { displayName } }
          statusEvents(orderBy: [{ occurredAt: asc }]) { toStatus kind occurredAt }
        }
        checklistResponsesCount(where: { visit: { id: { equals: $id } } })
      }`, { id }).catch(() => ({ visit: null, checklistResponsesCount: 0 })),
    companyTimeZone(),
  ]);
  const v = d.visit;
  if (!v) notFound();
  const path = `/dashboard/field/visits/${v.id}`;
  const checklist = v.job?.jobType?.checklistTemplate;
  const onSite = ['on_site', 'working', 'paused'].includes(v.status);
  const loc = v.job?.location;
  return (
    <Page title={v.job?.jobType?.name ?? 'Visit'} crumbs={[{ label: 'My day', href: '/dashboard/field/today' }]}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2"><Status value={v.status} /><span className="font-mono text-xs text-muted-foreground">{v.ref}</span>{v.job?.priority === 'emergency' ? <Status value="emergency" /> : null}</div>
        <p className="text-base font-medium">{windowText(v.window)}</p>
        <p className="text-sm">{v.job?.customer?.displayName}</p>
        {loc ? <a className="text-sm underline" href={`https://maps.apple.com/?daddr=${encodeURIComponent(`${loc.address1}, ${loc.city} ${loc.postalCode}`)}`}>{loc.address1}{loc.address2 ? `, ${loc.address2}` : ''}, {loc.city} {loc.postalCode}</a> : null}
        {v.job?.summary ? <p className="pt-1 text-sm text-muted-foreground">{v.job.summary}</p> : null}
      </div>
      <Section title="Status">
        <VisitStatusButtons visitId={v.id} status={v.status} version={v.version} path={path} />
        {v.needsReview ? <p className="text-xs text-amber-600">A status from this phone arrived out of order; the office will check it.</p> : null}
      </Section>
      {loc?.accessSecrets.length ? (
        <Section title="Access">
          <div className="space-y-2">{loc.accessSecrets.map(a => <div key={a.id}><RevealCode accessSecretId={a.id} visitId={v.id} label={`${label(a.kind)}${a.label ? ` · ${a.label}` : ''}`} /></div>)}</div>
          <Meta>Codes show for 15 minutes and every view is logged.</Meta>
        </Section>
      ) : null}
      {checklist ? (
        <Section title={checklist.name}>
          {d.checklistResponsesCount ? <p className="text-sm text-emerald-700">Checklist saved.</p>
            : onSite ? <ChecklistForm visitId={v.id} items={checklist.items ?? []} path={path} />
            : <Empty>Fill this in once you're on site. It's needed before you can mark the visit done.</Empty>}
        </Section>
      ) : null}
      <Section title="Timeline">
        {v.statusEvents.length ? <ol className="space-y-0.5 text-xs text-muted-foreground">{v.statusEvents.map((e, i) => <li key={i}>{when(e.occurredAt, tz, 'time')} · {label(e.toStatus)}{e.kind !== 'transition' ? ` (${label(e.kind).toLowerCase()})` : ''}</li>)}</ol> : <Empty>Nothing yet.</Empty>}
      </Section>
    </Page>
  );
}
