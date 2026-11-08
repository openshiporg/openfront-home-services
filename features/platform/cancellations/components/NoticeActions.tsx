'use client';

import * as React from 'react';
import { CommandForm } from '../../components/CommandForm';
import { centsFromDollars } from '../../lib/moneyInput';

const PATHS = (id: string) => [`/dashboard/platform/cancellations/${id}`, '/dashboard/platform/cancellations'];

/** Delivery of an issued notice: the buyer's own acknowledgement, never assumed. */
export function DeliverForm({ noticeId, expectedVersion, buyer }: { noticeId: string; expectedVersion: number; buyer: string }) {
  return (
    <CommandForm
      op="deliverCancellationNotice"
      submit="Record delivery"
      paths={PATHS(noticeId)}
      fields={[
        { name: 'method', label: 'How the buyer got it', kind: 'select', width: 'md', options: [
          { value: 'signed_on_device', label: 'Signed on the device' },
          { value: 'printed_acknowledged', label: 'Printed copy, buyer signed receipt' },
          { value: 'handed_paper_copy', label: 'Paper copy handed over' },
        ] },
        { name: 'acknowledgedBy', label: 'Received by', required: true, defaultValue: buyer, width: 'md' },
      ]}
      shape={(v) => ({ noticeId, expectedVersion, method: v.method, acknowledgedBy: v.acknowledgedBy, ...(v.method === 'signed_on_device' ? { signature: { kind: 'drawn', capturedOn: 'staff-device' } } : {}) })}
    />
  );
}

/** The buyer cancelled inside the window. The send time is when they mailed, emailed or handed in the cancellation. */
export function BuyerCancelForm({ noticeId, expectedVersion, paidMinor = '0' }: { noticeId: string; expectedVersion: number; paidMinor?: string }) {
  const recorded = /^\d+$/.test(paidMinor) ? (Number(paidMinor) / 100).toFixed(2) : '0.00';
  return (
    <CommandForm
      op="recordBuyerCancellation"
      submit="Record the cancellation"
      paths={PATHS(noticeId)}
      fields={[
        { name: 'via', label: 'Received as', kind: 'select', width: 'md', options: [
          { value: 'signed_form', label: 'Signed cancellation form' }, { value: 'mail', label: 'Letter' }, { value: 'email', label: 'Email' }, { value: 'in_person', label: 'In person' },
        ] },
        { name: 'sentAt', label: 'Sent (postmark or send time, your clock)', kind: 'datetime-local', required: true, width: 'md' },
        { name: 'paid', label: 'Amount the buyer paid ($, from the payments recorded at the sale)', placeholder: '0.00', defaultValue: recorded, width: 'sm' },
        { name: 'note', label: 'Note', width: 'lg' },
      ]}
      shape={(v) => ({ noticeId, expectedVersion, via: v.via, sentAt: v.sentAt ? new Date(v.sentAt).toISOString() : '', amountPaidMinor: v.paid ? centsFromDollars(v.paid) : undefined, note: v.note || undefined })}
    />
  );
}

/** The refund went back in full; the amount must match what the buyer paid. */
export function RefundForm({ noticeId, expectedVersion, dueMinor, dueText }: { noticeId: string; expectedVersion: number; dueMinor: string; dueText: string }) {
  const nothing = dueMinor === '0';
  return (
    <CommandForm
      op="markCancellationRefunded"
      submit={nothing ? 'Confirm nothing was paid' : `Record refund of ${dueText}`}
      paths={PATHS(noticeId)}
      fields={nothing ? [] : [
        { name: 'method', label: 'Refunded by', kind: 'select', width: 'md', options: [{ value: 'processor_refund', label: 'Card refund' }, { value: 'check', label: 'Check' }] },
        { name: 'reference', label: 'Refund or check number', required: true, width: 'md' },
      ]}
      shape={(v) => ({ noticeId, expectedVersion, evidence: nothing ? { method: 'nothing_paid', amountMinor: '0' } : { method: v.method, reference: v.reference, amountMinor: dueMinor } })}
    />
  );
}
