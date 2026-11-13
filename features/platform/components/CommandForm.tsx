'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand } from '../actions/commands';
import { pillClass } from './ActionButton';

export type FormField =
  | { name: string; label: string; kind?: 'text' | 'tel' | 'email' | 'date' | 'datetime-local' | 'password' | 'hidden'; required?: boolean; placeholder?: string; defaultValue?: string; width?: 'sm' | 'md' | 'lg' }
  | { name: string; label: string; kind: 'select'; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string; width?: 'sm' | 'md' | 'lg' };

export const inputClass = 'h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

const WIDTH = { sm: 'sm:w-36', md: 'sm:w-56', lg: 'sm:w-80' };

/** Group flat form values into nested objects; blank values are dropped, and a group missing its required field is left out. */
function nestValues(spec: NonNullable<Parameters<typeof CommandForm>[0]['nest']>, values: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [group, def] of Object.entries(spec)) {
    const d = Array.isArray(def) ? { fields: def } : def;
    if (d.requires && !values[d.requires]) continue;
    const obj: Record<string, string> = { ...(d.fixed ?? {}) };
    for (const f of d.fields) if (values[f]) obj[f] = values[f];
    out[group] = obj;
  }
  return out;
}

export type RowSpec = { count: number; fields: string[]; requires?: string; split?: string[] };

/**
 * Gather `group.i.field` form values into an array of objects (order lines, counted items). A row missing its `requires` field is
 * left out; a `split` field becomes a list (comma or newline separated, for serial numbers).
 */
export function rowValues(spec: Record<string, RowSpec>, values: Record<string, string>) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [group, d] of Object.entries(spec)) {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < d.count; i += 1) {
      const at = (f: string) => values[`${group}.${i}.${f}`] ?? '';
      if (d.requires && !at(d.requires)) continue;
      const row: Record<string, unknown> = {};
      for (const f of d.fields) {
        const v = at(f);
        if (!v) continue;
        row[f] = d.split?.includes(f) ? v.split(/[\s,]+/).map(s => s.trim()).filter(Boolean) : v;
      }
      rows.push(row);
    }
    out[group] = rows;
  }
  return out;
}

/**
 * A small form that runs one named command. Field values are strings; `shape` turns them into the
 * command's variables (for example nesting a customer object). One idempotency key per intent.
 */
export function CommandForm({ op, fields, fixed = {}, nest, rows, shape, submit, paths, onDone, className }: {
  op: string; fields: FormField[]; fixed?: Record<string, unknown>; submit: string; paths?: string[];
  /** Serializable lists for server screens: { lines: { count: 3, fields: ['itemId', 'quantity'], requires: 'itemId' } } reads `lines.0.itemId` and so on. */
  rows?: Record<string, RowSpec>;
  /** Serializable nesting for server screens: { customer: ['firstName', ...], location: { fields: [...], requires: 'address1', fixed: { state: 'TX' } } }. */
  nest?: Record<string, string[] | { fields: string[]; requires?: string; fixed?: Record<string, string> }>;
  /** Client-only: functions cannot cross from a server screen. */
  shape?: (values: Record<string, string>) => Record<string, unknown>;
  onDone?: (data: unknown) => void; className?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState('');
  const key = React.useRef<{ key: string; body: string } | null>(null);
  return (
    <form
      className={cn('flex flex-wrap items-end gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const values = Object.fromEntries(fields.map((f) => [f.name, String(form.get(f.name) ?? '').trim()]));
        const flat = rows ? Object.fromEntries(Object.entries(values).filter(([k]) => !Object.keys(rows).some(g => k.startsWith(`${g}.`)))) : values;
        const variables = { ...fixed, ...(shape ? shape(values) : nest ? nestValues(nest, values) : flat), ...(rows ? rowValues(rows, values) : {}) };
        const body = JSON.stringify(variables);
        if (key.current?.body !== body) key.current = { key: `${op}:${crypto.randomUUID()}`, body };
        const idempotencyKey = key.current.key;
        setError(''); setDone('');
        const target = e.currentTarget;
        start(async () => {
          const r = await runCommand(op, variables, idempotencyKey, paths);
          if (!r.ok) { setError(r.error); return; }
          key.current = null; target.reset(); setDone('Saved'); onDone?.(r.data); router.refresh();
        });
      }}
    >
      {fields.filter((f) => f.kind === 'hidden').map((f) => <input key={f.name} type="hidden" name={f.name} defaultValue={f.defaultValue} />)}
      {fields.filter((f) => f.kind !== 'hidden').map((f) => (
        <label key={f.name} className={cn('flex w-full flex-col gap-1 text-xs text-muted-foreground', WIDTH[f.width ?? 'md'])}>
          {f.label}
          {f.kind === 'select' ? (
            <select name={f.name} required={f.required} defaultValue={f.defaultValue} className={inputClass}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input name={f.name} type={f.kind ?? 'text'} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue} className={inputClass} autoComplete="off" />
          )}
        </label>
      ))}
      <button type="submit" disabled={pending} className={cn(pillClass, 'border')}>{pending ? 'Working' : submit}</button>
      {error ? <span role="alert" className="w-full break-words text-xs text-red-600">{error}</span> : null}
      {done && !error ? <span className="w-full text-xs text-emerald-600">{done}</span> : null}
    </form>
  );
}
