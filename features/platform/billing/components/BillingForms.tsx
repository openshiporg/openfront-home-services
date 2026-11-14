'use client';

import * as React from 'react';
import { CommandForm } from '../../components/CommandForm';
import { centsFromDollars } from '../../lib/moneyInput';

const METHODS = [
  { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Card' }, { value: 'ach', label: 'ACH' },
  { value: 'financing', label: 'Financing payout' }, { value: 'third_party', label: 'Third-party payer' }, { value: 'other', label: 'Other' },
];
const MEMO_REASONS = ['pricing_error', 'goodwill', 'cancellation_right', 'warranty', 'recall', 'duplicate', 'other'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }));
const invPaths = (id: string) => [`/dashboard/platform/invoices/${id}`, '/dashboard/platform/invoices'];

export function PaymentForm({ invoiceId, balanceMinor }: { invoiceId: string; balanceMinor: string }) {
  return (
    <CommandForm
      op="recordInvoicePayment" submit="Record payment" paths={invPaths(invoiceId)}
      fields={[
        { name: 'amount', label: 'Amount ($)', required: true, width: 'sm', defaultValue: (Number(balanceMinor) / 100).toFixed(2) },
        { name: 'method', label: 'Paid by', kind: 'select', width: 'md', options: METHODS },
        { name: 'checkNumber', label: 'Check number', width: 'sm' },
        { name: 'reference', label: 'Reference', width: 'md' },
      ]}
      shape={(v) => ({ invoiceId, amountMinor: centsFromDollars(v.amount), method: v.method, checkNumber: v.checkNumber || undefined, reference: v.reference || undefined })}
    />
  );
}

export function CreditMemoForm({ invoiceId }: { invoiceId: string }) {
  return (
    <CommandForm
      op="issueCreditMemo" submit="Issue credit memo" paths={invPaths(invoiceId)}
      fields={[
        { name: 'amount', label: 'Credit ($)', required: true, width: 'sm' },
        { name: 'reason', label: 'Reason', kind: 'select', width: 'md', options: MEMO_REASONS },
        { name: 'note', label: 'Note', required: true, width: 'lg' },
        { name: 'appliesTo', label: 'Apply to', kind: 'select', width: 'md', options: [{ value: 'invoice_balance', label: 'Invoice balance' }, { value: 'customer_credit', label: 'Customer credit' }] },
      ]}
      shape={(v) => ({ invoiceId, amountMinor: centsFromDollars(v.amount), reason: v.reason, note: v.note, appliesTo: v.appliesTo })}
    />
  );
}

export function RefundRequestForm({ invoiceId, paymentId, max }: { invoiceId: string; paymentId: string; max: string }) {
  return (
    <CommandForm
      op="requestRefund" submit="Refund" paths={invPaths(invoiceId)}
      fields={[
        { name: 'amount', label: 'Refund ($)', required: true, width: 'sm', defaultValue: (Number(max) / 100).toFixed(2) },
        { name: 'method', label: 'Refunded by', kind: 'select', width: 'md', options: [{ value: 'check', label: 'Check' }, { value: 'processor_refund', label: 'Card refund' }, { value: 'cash', label: 'Cash' }] },
        { name: 'reference', label: 'Check number (leave empty for a card paid through Stripe: the card is refunded there)', width: 'md' },
        { name: 'reason', label: 'Why', required: true, width: 'lg' },
      ]}
      shape={(v) => ({ paymentId, amountMinor: centsFromDollars(v.amount), method: v.method, reference: v.reference ?? '', reason: v.reason })}
    />
  );
}

export function ProgramForm() {
  return (
    <CommandForm
      op="saveFinancingProgram" submit="Add program" paths={['/dashboard/platform/financing']}
      fields={[
        { name: 'name', label: 'Program name', required: true, width: 'md' }, { name: 'partner', label: 'Partner', width: 'md' },
        { name: 'min', label: 'Min amount ($)', required: true, width: 'sm' }, { name: 'max', label: 'Max amount ($)', required: true, width: 'sm' },
        { name: 'applyUrl', label: "Partner's apply link", width: 'lg' }, { name: 'termsNote', label: 'Terms as the partner states them', width: 'lg' },
      ]}
      shape={(v) => ({ name: v.name, partner: v.partner || undefined, minMinor: centsFromDollars(v.min), maxMinor: centsFromDollars(v.max), applyUrl: v.applyUrl || undefined, termsNote: v.termsNote || undefined, active: true })}
    />
  );
}

export function FundingForm({ applicationId, expectedVersion, amountMinor }: { applicationId: string; expectedVersion: number; amountMinor: string }) {
  return (
    <CommandForm
      op="recordFinancingFunding" submit="Record payout" paths={['/dashboard/platform/financing']}
      fields={[
        { name: 'gross', label: 'Paid out ($)', required: true, width: 'sm', defaultValue: (Number(amountMinor) / 100).toFixed(2) },
        { name: 'fee', label: 'Partner fee ($)', width: 'sm' },
        { name: 'reference', label: 'Payout reference', required: true, width: 'md' },
      ]}
      shape={(v) => ({ applicationId, expectedVersion, grossMinor: centsFromDollars(v.gross), feeMinor: v.fee ? centsFromDollars(v.fee) : undefined, reference: v.reference })}
    />
  );
}

export function DepositForm({ batchId, expectedVersion, expected }: { batchId: string; expectedVersion: number; expected: string }) {
  return (
    <CommandForm
      op="reconcilePaymentBatch" submit="Reconcile" paths={['/dashboard/platform/payments']}
      fields={[
        { name: 'deposited', label: 'Deposited ($)', required: true, width: 'sm', defaultValue: (Number(expected) / 100).toFixed(2) },
        { name: 'ref', label: 'Deposit or payout reference', required: true, width: 'md' },
      ]}
      shape={(v) => ({ batchId, expectedVersion, depositedMinor: centsFromDollars(v.deposited), depositReference: v.ref })}
    />
  );
}

export function ExportForm({ today }: { today: string }) {
  return (
    <CommandForm
      op="createExportBatch" submit="Build export" paths={['/dashboard/platform/accounting']}
      fields={[
        { name: 'from', label: 'From', kind: 'date', required: true, width: 'sm', defaultValue: `${today.slice(0, 8)}01` },
        { name: 'to', label: 'To', kind: 'date', required: true, width: 'sm', defaultValue: today },
      ]}
      shape={(v) => ({ from: v.from, to: v.to })}
    />
  );
}
