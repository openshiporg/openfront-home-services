'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { pillClass } from './ActionButton';

/** The photos on a claim, and a picker that uploads one (a phone offers its camera). A claim needs at least one before it is ready. */
export function ClaimPhotos({ claimId, photos, canAdd }: { claimId: string; photos: { id: string; name: string }[]; canAdd: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const input = React.useRef<HTMLInputElement>(null);
  async function send(file: File) {
    setBusy(true); setError('');
    const body = new FormData(); body.set('file', file);
    try {
      const r = await fetch(`/api/warranty-claims/${claimId}/photo`, { method: 'POST', body });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || 'The photo could not be attached.'); else router.refresh();
    } catch { setError('The photo could not be sent. Check the connection and try again.'); }
    setBusy(false);
    if (input.current) input.current.value = '';
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Photos · {photos.length}{photos.length ? '' : ' (at least one is needed before the claim is ready)'}</p>
      {photos.length ? <div className="flex flex-wrap gap-2">{photos.map(p => <a key={p.id} href={`/api/warranty-claims/${claimId}/photo?media=${p.id}`} target="_blank" rel="noreferrer" className="text-xs underline">{p.name}</a>)}</div> : null}
      {canAdd ? (
        <span className="inline-flex flex-col items-start gap-1">
          <label className={`${pillClass} cursor-pointer ${busy ? 'opacity-50' : ''}`}>
            {busy ? 'Sending' : 'Add photo'}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" disabled={busy} className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) void send(f); }} />
          </label>
          {error ? <span role="alert" className="max-w-xs break-words text-xs text-red-600">{error}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
