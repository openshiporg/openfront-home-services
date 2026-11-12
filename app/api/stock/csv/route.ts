import { exportCsv, toCsv } from '@/features/keystone/lib/csvRoute'
import { stockSummary } from '@/features/keystone/services/inventory'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => exportCsv(request, '/api/stock/csv', ['canManageInventory'], 'stock.csv', async db => {
  const rows = await stockSummary(db)
  return toCsv([['Location', 'Kind', 'SKU', 'Item', 'On hand', 'Reserved', 'Negative since'], ...rows.map(r => [r.location?.name, r.location?.kind, r.item?.sku, r.item?.name, r.onHand, r.reserved, r.negativeSince?.toISOString().slice(0, 10)])])
})
