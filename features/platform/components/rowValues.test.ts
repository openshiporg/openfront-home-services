import { describe, expect, it } from 'vitest'
import { rowValues } from './CommandForm'

describe('rowValues (purchase-order lines and count entries from a server screen form)', () => {
  it('keeps filled rows in order, drops rows missing the required field and blank values', () => {
    const v = { 'lines.0.itemId': 'a', 'lines.0.quantity': '2', 'lines.0.unitCostMinor': '', 'lines.1.itemId': '', 'lines.1.quantity': '5', 'lines.2.itemId': 'c', 'lines.2.quantity': '1', 'lines.2.unitCostMinor': '900' }
    expect(rowValues({ lines: { count: 3, fields: ['itemId', 'quantity', 'unitCostMinor'], requires: 'itemId' } }, v)).toEqual({
      lines: [{ itemId: 'a', quantity: '2' }, { itemId: 'c', quantity: '1', unitCostMinor: '900' }],
    })
  })
  it('a count row without a counted value is left out (not counted as zero)', () => {
    const v = { 'counted.0.itemId': 'a', 'counted.0.counted': '0', 'counted.1.itemId': 'b', 'counted.1.counted': '' }
    expect(rowValues({ counted: { count: 2, fields: ['itemId', 'counted'], requires: 'counted' } }, v)).toEqual({ counted: [{ itemId: 'a', counted: '0' }] })
  })
})
