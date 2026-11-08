'use client';

import * as React from 'react';
import { CommandForm } from '../../components/CommandForm';
import { bpsFromPercent } from '../../lib/moneyInput';

/** A discount typed as a percent ("7.5") and sent as basis points. Above the company threshold it goes to a manager. */
export function DiscountForm({ versionId, expectedVersion, path }: { versionId: string; expectedVersion: number; path: string }) {
  return (
    <CommandForm
      op="setEstimateDiscount"
      submit="Set discount"
      paths={[path]}
      className="pt-2"
      fields={[
        { name: 'percent', label: 'Discount (%)', required: true, placeholder: '5', width: 'sm' },
        { name: 'reason', label: 'Why', width: 'lg' },
      ]}
      shape={(v) => ({ versionId, expectedVersion, discountBps: bpsFromPercent(v.percent) ?? v.percent, reason: v.reason || undefined })}
    />
  );
}
