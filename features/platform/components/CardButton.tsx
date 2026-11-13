'use client';

import * as React from 'react';
import { startMembershipCard, startInvoiceCard, checkInvoiceCard } from '../actions/cards';
import { pillClass } from './ActionButton';

/** Opens Stripe's card page (the customer's card is typed there, never here), or checks a page that was left open. */
export function CardButton({ kind, id, children }: { kind: 'membership' | 'invoice' | 'check'; id: string; children: React.ReactNode }) {
  const [pending, start] = React.useTransition();
  const [note, setNote] = React.useState('');
  React.useEffect(() => { const e = new URLSearchParams(window.location.search).get('cardError'); if (e) setNote(e); }, []);
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button type="button" disabled={pending} className={pillClass} onClick={() => {
        setNote('');
        start(async () => {
          const r = await (kind === 'membership' ? startMembershipCard(id) : kind === 'invoice' ? startInvoiceCard(id) : checkInvoiceCard(id));
          if (!r.ok) setNote(r.error);
          else if (r.url) window.location.assign(r.url);
          else { setNote(r.message ?? ''); if (r.message === 'Payment recorded.') window.location.reload(); }
        });
      }}>{pending ? 'Working' : children}</button>
      {note ? <span role="alert" className="max-w-xs break-words text-xs text-muted-foreground">{note}</span> : null}
    </span>
  );
}
