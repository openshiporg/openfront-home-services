'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand, runQuery } from '../../actions/commands';
import { inputClass } from '../../components/CommandForm';
import { pillClass } from '../../components/ActionButton';
import { label, money } from '../../lib/format';

type Hit = { itemKey: string; name: string; kind: string; trade: string; uom: string; unitPriceMinor: string; tier: string; ladderKey: string };
type Line = { itemKey: string; name: string; uom: string; unitPriceMinor: string; quantity: string; cancellationClass: string };

const TIERS = ['good', 'better', 'best', 'single', 'custom'];
const CLASSES = ['requested_repair', 'necessary_replacement_parts', 'additional_goods_services'];

/**
 * Build one option (good, better or best) from the active price book. Prices come from the server's
 * quote, never from this screen: the lines carry only item codes, quantities and the cooling-off class.
 */
export function OptionBuilder({ versionId, expectedVersion, path, initial, create }: {
  versionId?: string; expectedVersion?: number; path: string;
  initial?: { optionId: string; tier: string; name: string; description: string; lines: Line[] };
  /** Start a new estimate on this job with this as its first option, then open it. */
  create?: { jobId: string; defaultTitle: string };
}) {
  const router = useRouter();
  const [tier, setTier] = React.useState(initial?.tier ?? 'good');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [lines, setLines] = React.useState<Line[]>(initial?.lines ?? []);
  const [title, setTitle] = React.useState(create?.defaultTitle ?? '');
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Hit[] | null>(null);
  const [error, setError] = React.useState('');
  const [pending, start] = React.useTransition();
  const key = React.useRef<{ key: string; body: string } | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    start(async () => {
      const r = await runQuery('searchPriceBook', { query, limit: 12 });
      if (!r.ok) { setError(r.error); return; }
      setHits(((r.data as { items: Hit[] }).items) ?? []);
    });
  }

  function add(h: Hit) {
    setLines(ls => ls.some(l => l.itemKey === h.itemKey) ? ls : [...ls, {
      itemKey: h.itemKey, name: h.name, uom: h.uom, unitPriceMinor: h.unitPriceMinor, quantity: '1',
      cancellationClass: h.kind === 'material' || h.kind === 'equipment' ? 'necessary_replacement_parts' : 'requested_repair',
    }]);
  }

  function save() {
    setError('');
    const option = {
      tier, name: name.trim() || label(tier), description: description.trim() || undefined,
      ...(initial?.optionId ? { optionId: initial.optionId } : {}),
      lines: lines.map(l => ({ itemKey: l.itemKey, quantity: l.quantity.trim(), cancellationClass: l.cancellationClass })),
    };
    const op = create ? 'openEstimate' : 'saveEstimateOption';
    const variables = create ? { jobId: create.jobId, title: title.trim(), options: [option] } : { versionId, expectedVersion, ...option };
    const body = JSON.stringify(variables);
    if (key.current?.body !== body) key.current = { key: `${op}:${crypto.randomUUID()}`, body };
    const idempotencyKey = key.current.key;
    start(async () => {
      const r = await runCommand(op, variables, idempotencyKey, [path, '/dashboard/platform/estimates']);
      if (!r.ok) { setError(r.error); return; }
      key.current = null;
      if (create) { router.push(`/dashboard/platform/estimates/${(r.data as { estimateId: string }).estimateId}`); return; }
      if (!initial) { setLines([]); setName(''); setDescription(''); setHits(null); setQuery(''); }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      {create ? (
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-96">Estimate title
          <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
        </label>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-36">Tier
          <select value={tier} onChange={e => setTier(e.target.value)} className={inputClass}>{TIERS.map(t => <option key={t} value={t}>{label(t)}</option>)}</select>
        </label>
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-56">Option name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Repair and protect" className={inputClass} />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-80">What the customer reads
          <input value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
        </label>
      </div>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-80">Find in the price book
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="capacitor, drain, 16 SEER…" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={cn(pillClass, 'border')}>Search</button>
      </form>
      {hits ? (
        <ul className="divide-y rounded-md border">
          {hits.length ? hits.map(h => (
            <li key={h.itemKey} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 break-words">{h.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums">{money(h.unitPriceMinor)}</span>
              <button type="button" onClick={() => add(h)} className={cn(pillClass, 'h-7 border px-2')}>Add</button>
            </li>
          )) : <li className="px-3 py-2 text-sm text-muted-foreground">Nothing matches.</li>}
        </ul>
      ) : null}
      {lines.length ? (
        <ul className="divide-y rounded-md border">
          {lines.map((l, i) => (
            <li key={l.itemKey} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 basis-48 break-words">{l.name}</span>
              <input aria-label="Quantity" value={l.quantity} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className={cn(inputClass, 'h-8 w-20')} inputMode="decimal" />
              <span className="text-xs text-muted-foreground">{l.uom} × {money(l.unitPriceMinor)}</span>
              <select aria-label="Cooling-off class" value={l.cancellationClass} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, cancellationClass: e.target.value } : x))} className={cn(inputClass, 'h-8 w-full sm:w-56')}>
                {CLASSES.map(c => <option key={c} value={c}>{label(c)}</option>)}
              </select>
              <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="h-8 px-2 text-sm text-muted-foreground hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Add lines from the price book. The total is priced by the server when you save.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || !lines.length || (create ? !title.trim() : false)} onClick={save} className={cn(pillClass, 'border')}>{pending ? 'Working' : create ? 'Start the estimate' : initial ? 'Save option' : 'Add option'}</button>
        {error ? <span role="alert" className="w-full break-words text-xs text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
