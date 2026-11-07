'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand, runQuery } from '../../actions/commands';
import { pillClass } from '../../components/ActionButton';
import { inputClass } from '../../components/CommandForm';

type Tech = { id: string; name: string };
type Candidate = { employeeId: string; name: string; rank: number; eligible: boolean; score: number; explanation: string[] };
type Recommendation = { recommendationId: string; candidates: Candidate[] };

function useKey(op: string) {
  const ref = React.useRef<{ key: string; body: string } | null>(null);
  return {
    key: (vars: unknown) => {
      const body = JSON.stringify(vars);
      if (ref.current?.body !== body) ref.current = { key: `${op}:${crypto.randomUUID()}`, body };
      return ref.current.key;
    },
    clear: () => { ref.current = null; },
  };
}

/**
 * Assign a visit: pick a tech, or ask for a ranked recommendation (eligibility first, then drive time,
 * skills, history here and load) and take one. Eligibility, overlaps and stale versions are refused on
 * the server; a double-book needs a written reason.
 */
export function AssignControl({ visitId, version, techs, path }: { visitId: string; version: number; techs: Tech[]; path: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState('');
  const [problems, setProblems] = React.useState<string[]>([]);
  const [rec, setRec] = React.useState<Recommendation | null>(null);
  const [tech, setTech] = React.useState('');
  const assignKey = useKey('assignVisit');
  const recKey = useKey('recommendDispatch');

  const assign = (employeeId: string, recommendationId?: string, overrideReason?: string) => {
    const vars: Record<string, unknown> = { visitId, expectedVersion: version, employeeIds: [employeeId], leadEmployeeId: employeeId, recommendationId, overrideReason };
    setError(''); setProblems([]);
    start(async () => {
      const r = await runCommand('assignVisit', vars, assignKey.key(vars), [path]);
      if (r.ok) { assignKey.clear(); setRec(null); router.refresh(); return; }
      if (/in this window/.test(r.error) && !overrideReason) {
        const reason = window.prompt(`${r.error}\n\nWhy double-book?`);
        if (reason?.trim()) assign(employeeId, recommendationId, reason.trim());
        return;
      }
      setError(r.error);
      if (/Not eligible/.test(r.error)) {
        const check = await runQuery('checkEligibility', { visitId, employeeIds: [employeeId] });
        if (check.ok) {
          const d = check.data as { crewFindings: { message: string }[]; perEmployee: Record<string, { findings: { message: string }[] }> };
          setProblems([...d.crewFindings, ...Object.values(d.perEmployee).flatMap(e => e.findings)].map(f => f.message));
        }
      }
    });
  };
  const recommend = () => {
    const vars = { visitId };
    setError('');
    start(async () => {
      const r = await runCommand('recommendDispatch', vars, recKey.key(vars), [path]);
      if (!r.ok) { setError(r.error); return; }
      recKey.clear(); setRec(r.data as Recommendation);
    });
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Technician" className={cn(inputClass, 'h-8 w-auto max-w-[12rem]')} value={tech} onChange={e => setTech(e.target.value)}>
          <option value="">Technician…</option>
          {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" disabled={pending || !tech} className={pillClass} onClick={() => assign(tech)}>Assign</button>
        <button type="button" disabled={pending} className={pillClass} onClick={recommend}>{pending ? 'Working' : 'Recommend'}</button>
      </div>
      {rec ? (
        <ol className="space-y-1 rounded-md border p-2 text-xs">
          {rec.candidates.slice(0, 5).map(c => (
            <li key={c.employeeId} className={cn('flex flex-wrap items-start justify-between gap-2', !c.eligible && 'opacity-60')}>
              <span className="min-w-0 flex-1"><span className="font-medium">{c.rank}. {c.name}</span> <span className="font-mono">{c.score}</span><br /><span className="text-muted-foreground">{c.explanation.join(' · ')}</span></span>
              {c.eligible ? <button type="button" disabled={pending} className={cn(pillClass, 'h-7 px-2 text-xs')} onClick={() => assign(c.employeeId, rec.recommendationId)}>Take</button> : <span className="text-red-600">not eligible</span>}
            </li>
          ))}
        </ol>
      ) : null}
      {error ? <p role="alert" className="break-words text-xs text-red-600">{error}</p> : null}
      {problems.length ? <ul className="list-disc pl-4 text-xs text-red-600">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
    </div>
  );
}
