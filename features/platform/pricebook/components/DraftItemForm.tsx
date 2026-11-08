'use client';

import * as React from 'react';
import { CommandForm } from '../../components/CommandForm';
import { label } from '../../lib/format';
import { centsFromDollars as cents } from '../../lib/moneyInput';

const KINDS = ['service_task', 'material', 'equipment', 'fee'];
const TAX = ['labor', 'material', 'equipment', 'fee', 'disposal', 'permit_passthrough', 'maintenance'];
const CLASSES = ['requested_repair', 'necessary_replacement_parts', 'additional_goods_services'];
const TRADES = ['hvac', 'plumbing', 'electrical', 'general'];

/** Add or change one item on a draft (upsert by item key). Prices go in as dollars and are sent as whole cents. */
export function DraftItemForm({ versionId, expectedVersion, path }: { versionId: string; expectedVersion: number; path: string }) {
  const opt = (values: string[]) => values.map(v => ({ value: v, label: label(v) }));
  return (
    <CommandForm
      op="saveDraftItems"
      submit="Save item"
      paths={[path]}
      fields={[
        { name: 'itemKey', label: 'Code', required: true, placeholder: 'HVAC-CAP-45', width: 'sm' },
        { name: 'name', label: 'Name', required: true, width: 'lg' },
        { name: 'kind', label: 'Kind', kind: 'select', options: opt(KINDS), width: 'sm' },
        { name: 'trade', label: 'Trade', kind: 'select', options: opt(TRADES), width: 'sm' },
        { name: 'unitPrice', label: 'Price ($)', required: true, placeholder: '189.00', width: 'sm' },
        { name: 'cost', label: 'Cost ($)', placeholder: '42.00', width: 'sm' },
        { name: 'uom', label: 'Unit', required: true, defaultValue: 'each', width: 'sm' },
        { name: 'taxCategory', label: 'Tax', kind: 'select', options: opt(TAX), width: 'sm' },
        { name: 'cancellationClassDefault', label: 'Cooling-off class', kind: 'select', options: opt(CLASSES), width: 'md' },
        { name: 'customerDescription', label: 'What the customer reads', width: 'lg' },
      ]}
      shape={(v) => ({
        versionId, expectedVersion,
        items: [{
          itemKey: v.itemKey, name: v.name, kind: v.kind, trade: v.trade, uom: v.uom, taxCategory: v.taxCategory,
          unitPriceMinor: cents(v.unitPrice), costMinor: v.cost ? cents(v.cost) : '0', cancellationClassDefault: v.cancellationClassDefault,
          customerDescription: v.customerDescription || null,
        }],
      })}
    />
  );
}
