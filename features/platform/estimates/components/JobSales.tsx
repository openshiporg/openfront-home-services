import Link from 'next/link';
import { q, viewer } from '../../lib/server';
import { deadlineText, label, money, quantity, when } from '../../lib/format';
import { Row, Empty, Meta, Section, Status } from '../../components/ui';
import { OptionBuilder } from './OptionBuilder';

type Est = { id: string; ref: string; title: string; status: string; currentVersion: { versionNumber: number; status: string; options: { totalMinor: string }[] } | null };
type WorkLine = { id: string; description: string; quantity: string; uom: string; amountMinor: string; status: string; cancellationClass: string; cancellationNotices: { id: string; ref: string; status: string; cancelBy: string }[] };

/**
 * Estimates and sold work on one job, shared by the office job page and the tech's visit page (the
 * presentation view on the tablet is the estimate page itself). Prices are the server's, never the screen's.
 */
export async function JobSales({ jobId, jobTitle, path, tz }: { jobId: string; jobTitle: string; path: string; tz: string }) {
  const me = await viewer();
  const d = await q<{ estimates: Est[]; workLines: WorkLine[] }>(`
    query S($id: ID!) {
      estimates(where: { job: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }]) { id ref title status currentVersion { versionNumber status options { totalMinor } } }
      workLines(where: { job: { id: { equals: $id } } }, orderBy: [{ createdAt: asc }]) { id description quantity uom amountMinor status cancellationClass cancellationNotices { id ref status cancelBy } }
    }`, { id: jobId }).catch(() => ({ estimates: [], workLines: [] }));
  const notices = new Map(d.workLines.flatMap(w => w.cancellationNotices).map(n => [n.id, n]));
  return (
    <>
      <Section title="Estimates">
        {d.estimates.length ? d.estimates.map(e => {
          const totals = (e.currentVersion?.options ?? []).map(o => money(o.totalMinor));
          return (
            <Row key={e.id} href={`/dashboard/platform/estimates/${e.id}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 break-words font-medium">{e.title}</span><Status value={e.status === 'open' && e.currentVersion ? e.currentVersion.status : e.status} className="shrink-0" /></div>
                <Meta><span className="font-mono">{e.ref}</span>{e.currentVersion ? ` · v${e.currentVersion.versionNumber}` : ''}{totals.length ? ` · ${totals.join(' / ')}` : ''}</Meta>
              </div>
            </Row>
          );
        }) : <Empty>No estimates on this job.</Empty>}
        {me.can('canPresentEstimates') ? (
          <details className="pt-2">
            <summary className="cursor-pointer text-sm font-medium">Start an estimate</summary>
            <div className="pt-2"><OptionBuilder path={path} create={{ jobId, defaultTitle: jobTitle }} /></div>
          </details>
        ) : null}
      </Section>
      {d.workLines.length ? (
        <Section title="Sold work">
          {d.workLines.map(w => (
            <Row key={w.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 break-words">{w.description}</span><Status value={w.status} className="shrink-0" /><span className="ml-auto shrink-0 font-mono text-sm tabular-nums">{money(w.amountMinor)}</span></div>
                <Meta>{quantity(w.quantity)} {w.uom} · {label(w.cancellationClass).toLowerCase()}</Meta>
              </div>
            </Row>
          ))}
          {[...notices.values()].map(n => (
            <Meta key={n.id}>
              Right to cancel: <Link className="underline" href={`/dashboard/platform/cancellations/${n.id}`}>{n.ref}</Link> · {label(n.status).toLowerCase()} · cancel by {deadlineText(n.cancelBy, tz)}
              {['issued', 'delivered'].includes(n.status) ? ' · covered work waits until the window closes' : ''}
            </Meta>
          ))}
        </Section>
      ) : null}
    </>
  );
}
