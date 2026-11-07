'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand } from '../actions/commands';

export function PillTrack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1', className)}>{children}</div>;
}

export const pillClass = 'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-background px-3 text-sm font-medium shadow-sm transition disabled:opacity-50';

const newKey = (op: string) => `${op}:${crypto.randomUUID()}`;

/**
 * Runs one named command. The idempotency key is made once per intent and kept until the command
 * succeeds, so retrying after a timeout replays the first result instead of acting twice.
 */
export function ActionButton({ op, vars, children, paths, confirm, ask, choices, onDone, className }: {
  op: string; vars: Record<string, unknown>; children: React.ReactNode; paths?: string[]; confirm?: string;
  /** Prompt for a reason; the answer goes in vars.reason. */
  ask?: string;
  /** Pick a reason from a list instead of typing one; the chosen value goes in vars.reason. */
  choices?: { value: string; label: string }[];
  onDone?: (data: unknown) => void; className?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState('');
  const [choosing, setChoosing] = React.useState(false);
  const [choice, setChoice] = React.useState('');
  const key = React.useRef<{ key: string; body: string } | null>(null);

  function run(reason: string | undefined) {
    setError('');
    const variables = reason !== undefined ? { ...vars, reason } : vars;
    const body = JSON.stringify(variables);
    // Same intent, same key; a changed reason or target is a new intent.
    if (key.current?.body !== body) key.current = { key: newKey(op), body };
    const idempotencyKey = key.current.key;
    start(async () => {
      const r = await runCommand(op, variables, idempotencyKey, paths);
      if (!r.ok) setError(r.error);
      else { key.current = null; setChoosing(false); onDone?.(r.data); router.refresh(); }
    });
  }

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      {choices && choosing ? (
        <span className="inline-flex max-w-full flex-wrap items-center gap-1">
          <select
            aria-label="Reason"
            autoFocus
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="h-8 min-w-0 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Reason…</option>
            {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="button" disabled={pending || !choice} className={cn(pillClass, className)} onClick={() => run(choice)}>
            {pending ? 'Working' : children}
          </button>
          <button type="button" disabled={pending} className="h-8 px-2 text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => { setChoosing(false); setError(''); }}>
            Back
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          className={cn(pillClass, className)}
          onClick={() => {
            if (choices) { setChoosing(true); return; }
            if (confirm && !window.confirm(confirm)) return;
            let reason: string | undefined;
            if (ask) {
              const answer = window.prompt(ask);
              if (answer === null) return;
              reason = answer.trim();
            }
            run(reason);
          }}
        >
          {pending ? 'Working' : children}
        </button>
      )}
      {error ? <span role="alert" className="max-w-xs break-words text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
