'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { runCommand, runQuery } from '../../actions/commands';
import { pillClass } from '../../components/ActionButton';
import { inputClass } from '../../components/CommandForm';
import { dayText, phoneText } from '../../lib/format';

type JobTypeOption = { id: string; code: string; name: string; businessUnit: string; priority: string };
type Match = { customerId: string; ref: string; name: string; phone: string | null; doNotService: boolean; locations: { locationId: string; address: string; city: string; postalCode: string; inServiceArea: boolean }[] };
type TypeMatch = { jobTypeId: string; name: string; code: string; priority: string; bookableByAi: boolean; emergency: { script: string; page: boolean } | null };
type Window = { windowId: string; date: string; label: string; startsAt: string; remainingHours: string };
type Hold = { holdId: string; label: string; expiresAt: string; windowId: string };
type Booked = { jobId: string; ref: string; publicCode: string; window: string; date: string };

const Step = ({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) => (
  <section className="space-y-3 border-b pb-5">
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      <span className={cn('inline-flex size-6 items-center justify-center rounded-full font-mono text-xs', done ? 'bg-emerald-500 text-white' : 'bg-muted')}>{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

const field = (label: string, input: React.ReactNode, wide = false) => (
  <label className={cn('flex w-full flex-col gap-1 text-xs text-muted-foreground', wide ? 'sm:w-80' : 'sm:w-48')}>{label}{input}</label>
);

/** One key per intent: the same request reuses its key, a changed request gets a new one. */
function useKeyed(op: string) {
  const ref = React.useRef<{ key: string; body: string } | null>(null);
  return (vars: Record<string, unknown>) => {
    const body = JSON.stringify(vars);
    if (ref.current?.body !== body) ref.current = { key: `${op}:${crypto.randomUUID()}`, body };
    return ref.current.key;
  };
}

/**
 * Book a job (CSR): find or add the customer, match the problem to a job type, pick a window with room,
 * hold it while you confirm details, then book. Capacity, service area, consent and duplicate requests
 * are all checked on the server; this screen only collects the answers.
 */
export function BookingWizard({ jobTypes, today, timeZone }: { jobTypes: JobTypeOption[]; today: string; timeZone: string }) {
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState({ phone: '', name: '', postalCode: '' });
  const [matches, setMatches] = React.useState<Match[] | null>(null);
  const [picked, setPicked] = React.useState<{ customerId: string; locationId: string; name: string; postalCode: string; address: string } | null>(null);
  const [draft, setDraft] = React.useState({ firstName: '', lastName: '', phone: '', email: '', address1: '', city: 'Austin', postalCode: '', smsConsent: false });
  const [newCustomer, setNewCustomer] = React.useState(false);
  const [problem, setProblem] = React.useState('');
  const [typeMatches, setTypeMatches] = React.useState<TypeMatch[] | null>(null);
  const [emergency, setEmergency] = React.useState<{ script: string; page: boolean } | null>(null);
  const [jobTypeId, setJobTypeId] = React.useState('');
  const [from, setFrom] = React.useState(today);
  const [windows, setWindows] = React.useState<{ inArea: boolean; windows: Window[] } | null>(null);
  const [hold, setHold] = React.useState<Hold | null>(null);
  const [booked, setBooked] = React.useState<Booked | null>(null);
  const holdKey = useKeyed('holdWindow');
  const bookKey = useKeyed('bookJob');
  const releaseKey = useKeyed('releaseHold');

  const zip = picked?.postalCode ?? draft.postalCode;
  const haveCustomer = !!picked || (newCustomer && draft.firstName && draft.lastName && draft.phone && draft.address1 && /^\d{5}$/.test(draft.postalCode));
  const fmt = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const day = (d: string) => dayText(d);

  async function run<T>(label: string, fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, then: (data: T) => void) {
    setBusy(label); setError('');
    const r = await fn();
    setBusy('');
    if (!r.ok) setError(r.error); else then(r.data as T);
  }

  const lookup = () => run<{ matches: Match[] }>('lookup', () => runQuery('lookupCustomer', query.phone ? { phone: query.phone } : { name: query.name, postalCode: query.postalCode }), d => setMatches(d.matches));
  const match = () => run<{ matches: TypeMatch[]; emergency: { script: string; page: boolean } | null }>('match', () => runQuery('matchJobType', { description: problem, postalCode: zip || undefined }), d => {
    setTypeMatches(d.matches.slice(0, 4)); setEmergency(d.emergency);
    if (d.matches[0]) setJobTypeId(d.matches[0].jobTypeId);
  });
  const findWindows = () => run<{ inArea: boolean; windows: Window[] }>('windows', () => runQuery('availableWindows', { jobTypeId, postalCode: zip, from, days: 7 }), d => setWindows(d));
  const holdIt = (w: Window) => {
    const vars = { windowId: w.windowId, jobTypeId, source: 'csr', minutes: 15 };
    return run<Hold>('hold', () => runCommand('holdWindow', vars, holdKey(vars)), d => setHold({ ...d, windowId: w.windowId }));
  };
  const release = () => {
    if (!hold) return;
    const vars = { holdId: hold.holdId };
    return run('release', () => runCommand('releaseHold', vars, releaseKey(vars)), () => { setHold(null); findWindows(); });
  };
  const book = () => {
    if (!hold) return;
    const vars: Record<string, unknown> = picked
      ? { holdId: hold.holdId, jobTypeId, customerId: picked.customerId, locationId: picked.locationId, summary: problem, source: 'csr' }
      : { holdId: hold.holdId, jobTypeId, customer: { firstName: draft.firstName, lastName: draft.lastName, phone: draft.phone, email: draft.email || undefined }, location: { address1: draft.address1, city: draft.city, state: 'TX', postalCode: draft.postalCode }, smsConsent: draft.smsConsent, summary: problem, source: 'csr' };
    return run<Booked>('book', () => runCommand('bookJob', vars, bookKey(vars), ['/dashboard/platform/dispatch', '/dashboard/platform/jobs']), d => setBooked(d));
  };

  if (booked) {
    return (
      <div className="space-y-3 rounded-lg border p-5">
        <p className="text-lg font-semibold">Booked {booked.ref}</p>
        <p className="text-sm text-muted-foreground">{day(booked.date)}, arrival {booked.window}. Customer reference {booked.publicCode}. A confirmation text is queued and checked against consent and quiet hours when it sends.</p>
        <div className="flex flex-wrap gap-2">
          <Link className={cn(pillClass, 'border')} href={`/dashboard/platform/jobs/${booked.jobId}`}>Open the job</Link>
          <button type="button" className={cn(pillClass, 'border')} onClick={() => window.location.reload()}>Book another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Step n={1} title="Who is calling" done={!!haveCustomer}>
        {picked ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{picked.name}</span><span className="text-muted-foreground">{picked.address}, {picked.postalCode}</span>
            <button type="button" className="text-xs underline" onClick={() => { setPicked(null); setWindows(null); }}>Change</button>
          </div>
        ) : newCustomer ? (
          <div className="flex flex-wrap items-end gap-2">
            {field('First name', <input className={inputClass} value={draft.firstName} onChange={e => setDraft({ ...draft, firstName: e.target.value })} />)}
            {field('Last name', <input className={inputClass} value={draft.lastName} onChange={e => setDraft({ ...draft, lastName: e.target.value })} />)}
            {field('Mobile', <input className={inputClass} type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />)}
            {field('Email (optional)', <input className={inputClass} type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />)}
            {field('Service address', <input className={inputClass} value={draft.address1} onChange={e => setDraft({ ...draft, address1: e.target.value })} />, true)}
            {field('City', <input className={inputClass} value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} />)}
            {field('ZIP', <input className={inputClass} inputMode="numeric" maxLength={5} value={draft.postalCode} onChange={e => setDraft({ ...draft, postalCode: e.target.value })} />)}
            <label className="flex w-full items-center gap-2 text-sm"><input type="checkbox" checked={draft.smsConsent} onChange={e => setDraft({ ...draft, smsConsent: e.target.checked })} />Caller agreed to appointment texts (confirmation, on-the-way). Read the consent wording before ticking.</label>
            <button type="button" className="text-xs underline" onClick={() => setNewCustomer(false)}>Search instead</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              {field('Phone', <input className={inputClass} type="tel" value={query.phone} onChange={e => setQuery({ ...query, phone: e.target.value })} placeholder="512-555-0130" />)}
              <span className="pb-2 text-xs text-muted-foreground">or</span>
              {field('Last name', <input className={inputClass} value={query.name} onChange={e => setQuery({ ...query, name: e.target.value })} />)}
              {field('ZIP', <input className={inputClass} inputMode="numeric" maxLength={5} value={query.postalCode} onChange={e => setQuery({ ...query, postalCode: e.target.value })} />)}
              <button type="button" disabled={!!busy || !(query.phone || (query.name && query.postalCode))} className={cn(pillClass, 'border')} onClick={lookup}>{busy === 'lookup' ? 'Searching' : 'Find'}</button>
              <button type="button" className={cn(pillClass, 'border')} onClick={() => setNewCustomer(true)}>New customer</button>
            </div>
            {matches ? (matches.length ? (
              <ul className="divide-y rounded-md border">
                {matches.map(m => m.locations.map(l => (
                  <li key={l.locationId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">{m.ref} · {m.phone ? phoneText(m.phone) : 'no mobile'} · {l.address}, {l.city} {l.postalCode}</span>{m.doNotService ? <span className="ml-2 text-xs text-red-600">do not service</span> : null}{!l.inServiceArea ? <span className="ml-2 text-xs text-amber-600">outside service area</span> : null}</span>
                    <button type="button" disabled={m.doNotService} className={cn(pillClass, 'border')} onClick={() => setPicked({ customerId: m.customerId, locationId: l.locationId, name: m.name, postalCode: l.postalCode, address: l.address })}>Use</button>
                  </li>
                )))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No match. Add them as a new customer.</p>) : null}
          </div>
        )}
      </Step>

      <Step n={2} title="What's wrong" done={!!jobTypeId}>
        <div className="flex flex-wrap items-end gap-2">
          {field('In the caller\'s words', <input className={inputClass} value={problem} onChange={e => setProblem(e.target.value)} placeholder="AC is blowing warm air" />, true)}
          <button type="button" disabled={!!busy || problem.trim().length < 3} className={cn(pillClass, 'border')} onClick={match}>{busy === 'match' ? 'Matching' : 'Suggest job type'}</button>
          {field('Job type', (
            <select className={inputClass} value={jobTypeId} onChange={e => { setJobTypeId(e.target.value); setWindows(null); }}>
              <option value="">Choose…</option>
              {jobTypes.map(t => <option key={t.id} value={t.id}>{t.name} · {t.businessUnit}</option>)}
            </select>
          ), true)}
        </div>
        {emergency ? (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="font-semibold">Emergency. Read this to the caller first:</p>
            <p>{emergency.script}</p>
            {emergency.page ? <p className="mt-1 text-xs">Then page the on-call technician from the call record.</p> : null}
          </div>
        ) : null}
        {typeMatches?.length ? <p className="text-xs text-muted-foreground">Suggested: {typeMatches.map(t => t.name).join(', ')}</p> : null}
      </Step>

      <Step n={3} title="Arrival window" done={!!hold}>
        <div className="flex flex-wrap items-end gap-2">
          {field('From', <input className={inputClass} type="date" value={from} min={today} onChange={e => setFrom(e.target.value)} />)}
          <button type="button" disabled={!!busy || !jobTypeId || !/^\d{5}$/.test(zip) || !!hold} className={cn(pillClass, 'border')} onClick={findWindows}>{busy === 'windows' ? 'Checking' : 'Show windows with room'}</button>
        </div>
        {windows && !windows.inArea ? <p className="text-sm text-amber-700">ZIP {zip} is outside the service area for this department. Don't book; take a message for a manager.</p> : null}
        {windows?.inArea ? (windows.windows.length ? (
          <div className="flex flex-wrap gap-2">
            {windows.windows.map(w => (
              <button key={w.windowId} type="button" disabled={!!busy || !!hold} onClick={() => holdIt(w)}
                className={cn('rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50', hold?.windowId === w.windowId && 'border-emerald-500 ring-1 ring-emerald-500')}>
                <span className="block font-medium">{day(w.date)}</span>
                <span className="block">{w.label}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">{w.remainingHours} h open</span>
              </button>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No room in the next 7 days. Try a later date or ask a dispatcher about an overbook.</p>) : null}
        {hold ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Holding <span className="font-medium">{hold.label}</span> until {fmt(hold.expiresAt)}.</span>
            <button type="button" disabled={!!busy} className="text-xs underline" onClick={release}>Release</button>
          </div>
        ) : null}
      </Step>

      <Step n={4} title="Confirm">
        <button type="button" disabled={!!busy || !hold || !haveCustomer} className={cn(pillClass, 'border bg-foreground text-background')} onClick={book}>{busy === 'book' ? 'Booking' : 'Book the job'}</button>
      </Step>
      {error ? <p role="alert" className="break-words text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
