'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand, runUnkeyed } from '../../actions/commands';
import { pillClass } from '../../components/ActionButton';
import { inputClass } from '../../components/CommandForm';

const MOVES: Record<string, { to: string; label: string; ask?: string }[]> = {
  scheduled: [{ to: 'en_route', label: 'On my way' }],
  dispatched: [{ to: 'en_route', label: 'On my way' }],
  en_route: [{ to: 'on_site', label: 'Arrived' }, { to: 'no_access', label: 'No access', ask: 'What did you try (knocked, called, texted)?' }],
  on_site: [{ to: 'working', label: 'Start work' }, { to: 'no_access', label: 'No access', ask: 'What did you try (knocked, called, texted)?' }],
  working: [{ to: 'paused', label: 'Pause' }, { to: 'done', label: 'Done' }],
  paused: [{ to: 'working', label: 'Resume' }],
};

/**
 * A tech's status buttons. Each tap carries a device event key and the time on the phone, so a retry
 * after a dropped signal is recognised and an out-of-order tap is kept for review, never applied twice.
 */
export function VisitStatusButtons({ visitId, status, version, path }: { visitId: string; status: string; version: number; path: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState('');
  const pendingTap = React.useRef<{ to: string; vars: Record<string, unknown>; key: string } | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(MOVES[status] ?? []).map(m => (
          <button key={m.to} type="button" disabled={pending} className={cn(pillClass, 'h-11 border px-5 text-base')} onClick={() => {
            let reason: string | undefined;
            if (m.ask) { const a = window.prompt(m.ask); if (!a?.trim()) return; reason = a.trim(); }
            if (pendingTap.current?.to !== m.to) {
              const deviceEventKey = `tap:${crypto.randomUUID()}`;
              pendingTap.current = { to: m.to, key: `setVisitStatus:${deviceEventKey}`, vars: { visitId, to: m.to, expectedVersion: version, clientRecordedAt: new Date().toISOString(), deviceEventKey, reason } };
            }
            const tap = pendingTap.current;
            setError('');
            start(async () => {
              const r = await runCommand('setVisitStatus', tap.vars, tap.key, [path]);
              if (!r.ok) { setError(r.error); return; }
              pendingTap.current = null; router.refresh();
            });
          }}>{pending ? 'Saving' : m.label}</button>
        ))}
      </div>
      {error ? <p role="alert" className="break-words text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function ChecklistForm({ visitId, items, path }: { visitId: string; items: { key: string; label: string }[]; path: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState('');
  const key = React.useRef<{ key: string; body: string } | null>(null);
  return (
    <form className="space-y-3" onSubmit={e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const answers = Object.fromEntries(items.map(i => [i.key, String(form.get(i.key) ?? '').trim()]));
      const vars = { visitId, answers };
      const body = JSON.stringify(vars);
      if (key.current?.body !== body) key.current = { key: `submitChecklist:${crypto.randomUUID()}`, body };
      const k = key.current.key;
      setError('');
      start(async () => {
        const r = await runCommand('submitChecklist', vars, k, [path]);
        if (!r.ok) { setError(r.error); return; }
        key.current = null; router.refresh();
      });
    }}>
      {items.map(i => (
        <label key={i.key} className="flex flex-col gap-1 text-sm">{i.label}<input name={i.key} required className={inputClass} /></label>
      ))}
      <button type="submit" disabled={pending} className={cn(pillClass, 'h-11 border px-5 text-base')}>{pending ? 'Saving' : 'Save checklist'}</button>
      {error ? <p role="alert" className="break-words text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

/** Reveal a gate or lockbox code. Only the assigned tech on an active visit can; every reveal is logged. */
export function RevealCode({ accessSecretId, visitId, label }: { accessSecretId: string; visitId: string; label: string }) {
  const [pending, start] = React.useTransition();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState('');
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span>{label}</span>
      {value ? <span className="font-mono text-base">{value}</span> : (
        <button type="button" disabled={pending} className={cn(pillClass, 'border')} onClick={() => start(async () => {
          const r = await runUnkeyed('revealAccessSecret', { accessSecretId, visitId });
          if (!r.ok) setError(r.error); else setValue(String((r.data as { value?: string })?.value ?? ''));
        })}>{pending ? 'Opening' : 'Show code'}</button>
      )}
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
