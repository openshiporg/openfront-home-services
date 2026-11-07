import Link from 'next/link';
import { q, companyTimeZone } from '../../lib/server';
import { label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat, Tabs } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';

type Call = {
  id: string; direction: string; fromMasked: string; answeredBy: string; status: string; disposition: string; summary: string; durationSeconds: number | null;
  startedAt: string | null; createdAt: string; recordingDisclosurePlayed: boolean; emergency: { matched?: string[] } | null; transcript: { speaker?: string; role?: string; text: string }[] | null;
  lead: { id: string; ref: string } | null; job: { id: string; ref: string } | null;
};

const VIEWS: Record<string, string> = { all: '{}', ai: '{ answeredBy: { equals: "ai_agent" } }', handoff: '{ status: { equals: "handoff_requested" } }' };
const PATHS = ['/dashboard/platform/calls'];

const ANSWERED: Record<string, string> = { ai_agent: 'the AI receptionist', human: 'the office', ivr: 'the phone menu', voicemail: 'voicemail' };

/** Call log (I§4): who answered (a person or the AI receptionist), what happened, and what it led to. */
export default async function CallsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view ?? 'all';
  const view = raw in VIEWS ? raw : 'all';
  const [d, tz] = await Promise.all([
    q<{ calls: Call[]; all: number; ai: number; handoff: number; aiBooked: number; humanBooked: number; human: number }>(`{
      calls(where: ${VIEWS[view]}, orderBy: [{ createdAt: desc }], take: 100) {
        id direction fromMasked answeredBy status disposition summary durationSeconds startedAt createdAt recordingDisclosurePlayed emergency transcript
        lead { id ref } job { id ref }
      }
      all: callsCount
      ai: callsCount(where: { answeredBy: { equals: "ai_agent" } })
      human: callsCount(where: { answeredBy: { equals: "human" } })
      handoff: callsCount(where: { status: { equals: "handoff_requested" } })
      aiBooked: callsCount(where: { answeredBy: { equals: "ai_agent" }, NOT: [{ job: null }] })
      humanBooked: callsCount(where: { answeredBy: { equals: "human" }, NOT: [{ job: null }] })
    }`),
    companyTimeZone(),
  ]);
  const rate = (booked: number, total: number) => (total ? `${Math.floor((booked * 100) / total)}%` : '—');
  return (
    <Page title="Calls">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat name="Calls" value={d.all} />
        <Stat name="AI answered" value={d.ai} />
        <Stat name="AI booking rate" value={rate(d.aiBooked, d.ai)} />
        <Stat name="Office booking rate" value={rate(d.humanBooked, d.human)} />
      </div>
      <Tabs active={view} items={[
        { key: 'all', label: 'All', href: '/dashboard/platform/calls', count: d.all },
        { key: 'ai', label: 'AI receptionist', href: '/dashboard/platform/calls?view=ai', count: d.ai },
        { key: 'handoff', label: 'Needs a person', href: '/dashboard/platform/calls?view=handoff', count: d.handoff },
      ]} />
      <Section title="Call log">
        {d.calls.length ? d.calls.map(c => (
          <Row key={c.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.fromMasked || 'Unknown number'}</span>
                <Status value={c.status} />
                {c.emergency ? <Status value="emergency" /> : null}
              </div>
              {c.summary ? <p className="break-words text-sm">{c.summary}</p> : null}
              <Meta>
                {label(c.direction)}{c.answeredBy ? ` · answered by ${ANSWERED[c.answeredBy] ?? label(c.answeredBy).toLowerCase()}` : ''} · {when(c.startedAt ?? c.createdAt, tz)}{c.durationSeconds !== null ? ` · ${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : ''}
                {c.recordingDisclosurePlayed ? ' · recording disclosed' : ''}{c.disposition ? ` · ${label(c.disposition).toLowerCase()}` : ''}
              </Meta>
              {Array.isArray(c.transcript) && c.transcript.length ? (
                <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Transcript ({c.transcript.length} turns)</summary>
                  <ol className="mt-1 space-y-0.5">{c.transcript.slice(0, 40).map((t, i) => <li key={i}><span className="font-medium">{label(t.speaker ?? t.role, 'transcript')}:</span> {t.text}</li>)}</ol>
                </details>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {c.job ? <Link className="text-xs underline" href={`/dashboard/platform/jobs/${c.job.id}`}>Job {c.job.ref}</Link> : c.lead ? <Link className="text-xs underline" href="/dashboard/platform/leads">Lead {c.lead.ref}</Link> : null}
              {c.emergency ? <ActionButton op="pageOnCall" vars={{ callId: c.id }} ask="One line for the on-call tech (what and where):" paths={PATHS}>Page on-call</ActionButton> : null}
            </div>
          </Row>
        )) : <Empty>No calls yet. Calls appear here when the phone system or the AI receptionist is connected.</Empty>}
      </Section>
    </Page>
  );
}
