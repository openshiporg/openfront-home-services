'use client';
import { CommandForm } from '../../components/CommandForm';

/** The pay plan forms. They live in a client file because the form turns its flat values into plan terms in the browser. */
const TERMS_FIELDS = [
  { name: 'rate', label: 'Hourly rate (cents)', required: true, width: 'sm' as const, defaultValue: '2800' },
  { name: 'threshold', label: 'Overtime after (hours a week)', width: 'sm' as const, defaultValue: '40' },
  { name: 'multiplier', label: 'Overtime multiplier', width: 'sm' as const, defaultValue: '1.5' },
  { name: 'basis', label: 'Commission paid on', kind: 'select' as const, options: [{ value: 'invoice_posted', label: 'Invoice posted' }, { value: 'payment_received', label: 'Payment received' }], width: 'md' as const },
  { name: 'commissionKind', label: 'Commission is', kind: 'select' as const, options: [{ value: 'percent_of_sold', label: 'A percent of the sale' }, { value: 'fixed_per_task', label: 'A fixed amount per task' }, { value: 'none', label: 'None' }], width: 'md' as const },
  { name: 'commissionValue', label: 'Percent, or cents per task', width: 'sm' as const, defaultValue: '5' },
  { name: 'tgl', label: 'Lead spiff (cents)', width: 'sm' as const }, { name: 'membership', label: 'Membership spiff (cents)', width: 'sm' as const }, { name: 'financing', label: 'Financing spiff (cents)', width: 'sm' as const },
  { name: 'recallPercent', label: 'Recall clawback (percent)', width: 'sm' as const, defaultValue: '0' },
  { name: 'windowDays', label: 'Clawback window (days)', width: 'sm' as const, defaultValue: '90' },
];
/** The form's flat values become the plan terms. Server-side validation is the real check. */
const termsFrom = (v: Record<string, string>) => ({
  hourlyRates: { default: v.rate },
  overtime: { weeklyThresholdHours: v.threshold || '40', multiplier: v.multiplier || '1.5' },
  commission: { basis: v.basis || 'invoice_posted', rules: v.commissionKind && v.commissionKind !== 'none' ? [{ scope: 'all', kind: v.commissionKind, value: v.commissionValue || '0', splitBasis: 'sold_by' }] : [] },
  spiffs: Object.fromEntries(['tgl', 'membership', 'financing'].filter(k => v[k]).map(k => [k, v[k]])),
  clawbacks: { windowDays: Number(v.windowDays || '90'), recallPercent: v.recallPercent || '0', refund: true, chargeback: true, membershipCancel: true },
});


export function NewPayPlanForm() {
  return <CommandForm op="definePayPlan" submit="Create draft" paths={['/dashboard/platform/pay-plans']} shape={v => ({ name: v.name, terms: termsFrom(v) })} fields={[{ name: 'name', label: 'Name', required: true, width: 'md' }, ...TERMS_FIELDS]} />;
}

export function EditPayPlanDraftForm({ planId }: { planId: string }) {
  return <CommandForm op="savePayPlanDraft" submit="Save draft version" fixed={{ planId }} paths={['/dashboard/platform/pay-plans']} shape={v => ({ terms: termsFrom(v) })} fields={TERMS_FIELDS} />;
}
