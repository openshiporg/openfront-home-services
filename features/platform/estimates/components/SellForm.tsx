'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { runCommand } from '../../actions/commands';
import { inputClass } from '../../components/CommandForm';
import { pillClass } from '../../components/ActionButton';
import { label, money } from '../../lib/format';
import { centsFromDollars } from '../../lib/moneyInput';

const LOCATIONS = ['buyer_residence', 'other_non_merchant', 'merchant_place', 'remote'];
const METHODS = ['signature_on_device', 'written_paper', 'po_number', 'verbal_recorded'];
const ROLES = ['owner', 'tenant', 'property_manager', 'other'];

/**
 * Record the sale of one option. The cooling-off right is decided by the server from these facts
 * (where the sale happened, who started the contact, the lines' classes); this form only collects them.
 * An emergency waiver must be the buyer's own handwritten, signed and dated statement.
 */
export function SellForm({ versionId, expectedVersion, options, path, signer }: {
  versionId: string; expectedVersion: number; path: string; signer: string;
  options: { id: string; name: string; tier: string; totalMinor: string }[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState({
    optionId: options[0]?.id ?? '', saleLocation: 'buyer_residence', initiatedBy: 'customer_request', method: 'signature_on_device', signerName: signer, signerRole: 'owner',
    poNumber: '', callId: '', ownerApproval: '', deposit: '', signed: false, waiver: false, waiverStatement: '', waiverMedia: '', acrWarranty: false,
  });
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState('');
  const [pending, start] = React.useTransition();
  const key = React.useRef<{ key: string; body: string } | null>(null);
  const set = (patch: Partial<typeof v>) => setV(x => ({ ...x, ...patch }));

  function sell(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setDone('');
    if (v.method === 'signature_on_device' && !v.signed) { setError('Have the customer sign on the device first.'); return; }
    const variables = {
      versionId, expectedVersion, optionId: v.optionId, saleLocation: v.saleLocation, initiatedBy: v.initiatedBy,
      authorization: {
        method: v.method, signerName: v.signerName.trim(), signerRole: v.signerRole,
        ...(v.method === 'signature_on_device' ? { signature: { kind: 'drawn', capturedOn: 'staff-device' } } : {}),
        ...(v.poNumber ? { poNumber: v.poNumber } : {}), ...(v.callId ? { callId: v.callId } : {}), ...(v.ownerApproval ? { ownerApproval: v.ownerApproval } : {}),
      },
      ...(v.deposit ? { depositMinor: centsFromDollars(v.deposit) } : {}),
      ...(v.waiver ? { emergencyWaiver: { present: true, handwritten: true, signedAndDated: true, statement: v.waiverStatement, mediaRef: v.waiverMedia } } : {}),
      ...(v.acrWarranty ? { acrContext: ['breach_of_express_warranty'] } : {}),
    };
    const body = JSON.stringify(variables);
    if (key.current?.body !== body) key.current = { key: `sellEstimate:${crypto.randomUUID()}`, body };
    const idempotencyKey = key.current.key;
    start(async () => {
      const r = await runCommand('sellEstimate', variables, idempotencyKey, [path, '/dashboard/platform/estimates', '/dashboard/platform/cancellations']);
      if (!r.ok) { setError(r.error); return; }
      key.current = null;
      const c = (r.data as { cancellation?: { applies: boolean; waived?: boolean; ref?: string } | null })?.cancellation;
      setDone(c?.applies ? `Sold. The customer can cancel; deliver notice ${c.ref ?? ''} now and keep the signed copy.` : c?.waived ? `Sold. The customer waived the right to cancel; the waiver is filed on ${c.ref ?? 'the notice'}.` : 'Sold. No right to cancel applies to this sale.');
      router.refresh();
    });
  }

  const field = 'flex w-full flex-col gap-1 text-xs text-muted-foreground';
  return (
    <form onSubmit={sell} className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className={cn(field, 'sm:w-80')}>Option
          <select value={v.optionId} onChange={e => set({ optionId: e.target.value })} className={inputClass}>
            {options.map(o => <option key={o.id} value={o.id}>{o.tier && !['single', 'custom'].includes(o.tier) && !o.name.toLowerCase().startsWith(o.tier) ? `${label(o.tier)}: ` : ''}{o.name} · {money(o.totalMinor)}</option>)}
          </select>
        </label>
        <label className={cn(field, 'sm:w-56')}>Where the customer agreed
          <select value={v.saleLocation} onChange={e => set({ saleLocation: e.target.value })} className={inputClass}>{LOCATIONS.map(x => <option key={x} value={x}>{label(x)}</option>)}</select>
        </label>
        <label className={cn(field, 'sm:w-56')}>Who started the contact
          <select value={v.initiatedBy} onChange={e => set({ initiatedBy: e.target.value })} className={inputClass}>
            <option value="customer_request">The customer called us</option>
            <option value="solicited">We approached the customer</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className={cn(field, 'sm:w-56')}>Authorized by
          <input value={v.signerName} onChange={e => set({ signerName: e.target.value })} required className={inputClass} />
        </label>
        <label className={cn(field, 'sm:w-36')}>Their role
          <select value={v.signerRole} onChange={e => set({ signerRole: e.target.value })} className={inputClass}>{ROLES.map(x => <option key={x} value={x}>{label(x)}</option>)}</select>
        </label>
        <label className={cn(field, 'sm:w-56')}>How
          <select value={v.method} onChange={e => set({ method: e.target.value })} className={inputClass}>{METHODS.map(x => <option key={x} value={x}>{label(x)}</option>)}</select>
        </label>
        {v.method === 'po_number' ? <label className={cn(field, 'sm:w-36')}>PO number<input value={v.poNumber} onChange={e => set({ poNumber: e.target.value })} className={inputClass} /></label> : null}
        {v.method === 'verbal_recorded' ? <label className={cn(field, 'sm:w-56')}>Recorded call ID<input value={v.callId} onChange={e => set({ callId: e.target.value })} className={inputClass} /></label> : null}
        {v.signerRole === 'tenant' || v.signerRole === 'property_manager' ? <label className={cn(field, 'sm:w-80')}>How the owner approved<input value={v.ownerApproval} onChange={e => set({ ownerApproval: e.target.value })} className={inputClass} /></label> : null}
        <label className={cn(field, 'sm:w-36')}>Deposit ($)<input value={v.deposit} onChange={e => set({ deposit: e.target.value })} placeholder="0.00" className={inputClass} /></label>
      </div>
      {v.method === 'signature_on_device' ? (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.signed} onChange={e => set({ signed: e.target.checked })} /> The customer signed on this device next to the cancellation statement</label>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Emergency or warranty</summary>
        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.waiver} onChange={e => set({ waiver: e.target.checked })} /> The customer wrote, signed and dated their own statement that this is an emergency and waived the right to cancel</label>
          {v.waiver ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className={cn(field, 'sm:w-80')}>Their statement (transcribed)<input value={v.waiverStatement} onChange={e => set({ waiverStatement: e.target.value })} className={inputClass} /></label>
              <label className={cn(field, 'sm:w-56')}>Photo or scan reference<input value={v.waiverMedia} onChange={e => set({ waiverMedia: e.target.value })} className={inputClass} /></label>
            </div>
          ) : null}
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.acrWarranty} onChange={e => set({ acrWarranty: e.target.checked })} /> HVAC work under our express warranty</label>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !v.optionId} className={cn(pillClass, 'border')}>{pending ? 'Working' : 'Record the sale'}</button>
        {error ? <span role="alert" className="w-full break-words text-xs text-red-600">{error}</span> : null}
        {done && !error ? <span className="w-full text-xs text-emerald-600">{done}</span> : null}
      </div>
    </form>
  );
}
