'use client';

import * as React from 'react';
import { CommandForm } from '../../components/CommandForm';
import { centsFromDollars } from '../../lib/moneyInput';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
const monthDay = (s: string) => (/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) ? s : '');

/** A new plan: price, how it is billed, and up to three things it includes. The plan is a draft until someone publishes it. */
export function PlanForm() {
  const item = (n: number) => [
    { name: `item${n}`, label: `Included ${n}`, width: 'md' as const, placeholder: n === 1 ? 'Spring air-conditioning tune-up' : n === 2 ? 'Fall heating tune-up' : '' },
    { name: `qty${n}`, label: 'Visits a term', width: 'sm' as const, defaultValue: n === 3 ? '' : '1' },
    { name: `from${n}`, label: 'Season starts (MM-DD)', width: 'sm' as const, placeholder: n === 1 ? '03-01' : n === 2 ? '10-01' : '' },
    { name: `to${n}`, label: 'Season ends (MM-DD)', width: 'sm' as const, placeholder: n === 1 ? '06-15' : n === 2 ? '12-15' : '' },
  ];
  return (
    <CommandForm
      op="openMembershipPlan" submit="Create plan draft" paths={['/dashboard/platform/membership-plans']}
      fields={[
        { name: 'name', label: 'Plan name', required: true, width: 'md', placeholder: 'Comfort Club' },
        { name: 'price', label: 'Price per payment ($)', required: true, width: 'sm' },
        { name: 'billingFrequency', label: 'Billed', kind: 'select', width: 'sm', options: [{ value: 'annual', label: 'Once a year' }, { value: 'monthly', label: 'Every month' }] },
        { name: 'termMonths', label: 'Term (months)', width: 'sm', defaultValue: '12' },
        { name: 'refund', label: 'If the member cancels', kind: 'select', width: 'md', options: [{ value: 'none', label: 'No refund' }, { value: 'prorata', label: 'Refund the unused days' }, { value: 'full_within_days', label: 'Full refund in the first days' }] },
        { name: 'refundDays', label: 'Full-refund days', width: 'sm', defaultValue: '30' },
        { name: 'wording', label: 'Auto-renew wording (leave empty for no auto-renew)', width: 'lg' },
        ...item(1), ...item(2), ...item(3),
      ]}
      shape={(v) => {
        const entitlements = [1, 2, 3].filter(n => v[`item${n}`]).map(n => {
          const from = monthDay(v[`from${n}`] ?? ''), to = monthDay(v[`to${n}`] ?? '');
          return { code: slug(v[`item${n}`]) || `item_${n}`, name: v[`item${n}`], quantity: Number(v[`qty${n}`] || 1), visit: true, rollover: 'none', ...(from && to ? { seasonStart: from, seasonEnd: to } : {}) };
        });
        return {
          name: v.name, code: slug(v.name).replace(/_/g, '-'),
          draft: {
            priceMinor: centsFromDollars(v.price), billingFrequency: v.billingFrequency, termMonths: Number(v.termMonths || 12), entitlements, cancellationRefundMethod: v.refund,
            cancellationRefundDays: v.refund === 'full_within_days' ? Number(v.refundDays || 30) : 0, ...(v.wording ? { autoRenew: true, consentWording: v.wording } : { autoRenew: false }),
          },
        };
      }}
    />
  );
}

export type SellOption = { value: string; label: string };
export type SellPlan = { id: string; name: string; autoRenew: boolean; consentWording: string };

/** Sell a membership to a customer at one of their addresses. If the plan renews by itself, staff confirm the customer agreed to the exact wording. */
export function SellForm({ places, plans }: { places: SellOption[]; plans: SellPlan[] }) {
  const wordings = Object.fromEntries(plans.map(p => [p.id, p]));
  return (
    <CommandForm
      op="sellMembership" submit="Sell membership" paths={['/dashboard/platform/memberships']}
      fields={[
        { name: 'place', label: 'Customer and address', kind: 'select', required: true, width: 'lg', options: places },
        { name: 'planId', label: 'Plan', kind: 'select', required: true, width: 'md', options: plans.map(p => ({ value: p.id, label: p.name + (p.autoRenew ? ' (renews automatically)' : '') })) },
        { name: 'cardLabel', label: 'Card on file (for example Visa ending 4242)', width: 'md' },
        { name: 'cardRef', label: 'Card reference from the processor', width: 'md', placeholder: 'pm_...' },
        { name: 'consentHow', label: 'Customer agreed to the renewal wording', kind: 'select', width: 'md', options: [{ value: '', label: 'Not asked / plan does not renew' }, { value: 'in_person', label: 'In person' }, { value: 'phone_recorded', label: 'On a recorded call' }, { value: 'signed_form', label: 'On a signed form' }] },
        { name: 'startsOn', label: 'Starts (date)', kind: 'date', width: 'sm' },
      ]}
      shape={(v) => {
        const [customerId, locationId] = v.place.split('|');
        const plan = wordings[v.planId];
        return {
          customerId, locationId, planId: v.planId, startsOn: v.startsOn || undefined, paymentMethodLabel: v.cardLabel || undefined, paymentMethodRef: v.cardRef || undefined,
          ...(plan?.autoRenew && v.consentHow ? { autoRenew: true, consent: { confirmed: true, wording: plan.consentWording, how: v.consentHow } } : { autoRenew: false }),
        };
      }}
    />
  );
}

export function BillingRunForm({ periods }: { periods: { value: string; label: string }[] }) {
  return (
    <CommandForm
      op="runMembershipBilling" submit="Run billing" paths={['/dashboard/platform/billing-runs']}
      fields={[{ name: 'period', label: 'Month to bill', kind: 'select', width: 'md', options: periods }]}
    />
  );
}

export function AgreementForm({ places }: { places: SellOption[] }) {
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  return (
    <CommandForm
      op="saveServiceAgreement" submit="Save agreement as draft" paths={['/dashboard/platform/agreements']}
      fields={[
        { name: 'name', label: 'Agreement name', required: true, width: 'md', placeholder: 'Quarterly rooftop unit service' },
        { name: 'place', label: 'Customer and address', kind: 'select', required: true, width: 'lg', options: places },
        { name: 'startsOn', label: 'Starts', kind: 'date', required: true, width: 'sm' },
        { name: 'endsOn', label: 'Ends', kind: 'date', required: true, width: 'sm' },
        { name: 'visitMonths', label: 'Visit months (numbers, comma apart)', required: true, width: 'md', placeholder: '3, 6, 9, 12' },
        { name: 'scope', label: 'What the visit covers', required: true, width: 'lg' },
        { name: 'poNumber', label: 'Purchase order number', width: 'md' },
        { name: 'nte', label: 'Not-to-exceed amount ($)', width: 'sm' },
      ]}
      shape={(v) => {
        const [customerId, locationId] = v.place.split('|');
        const picked = v.visitMonths.split(/[,\s]+/).map(x => x.trim().padStart(2, '0')).filter(x => months.includes(x));
        return { name: v.name, customerId, locationId, startsOn: v.startsOn, endsOn: v.endsOn, scope: v.scope, visitMonths: [...new Set(picked)], poNumber: v.poNumber || undefined, nteMinor: v.nte ? centsFromDollars(v.nte) : undefined };
      }}
    />
  );
}

/** Put the renewal message on the clipboard. Nothing is sent from here. */
export function CopyMessage({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm md:h-8"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { window.prompt('Copy this message', text); } }}
    >
      {done ? 'Copied' : 'Copy message'}
    </button>
  );
}
