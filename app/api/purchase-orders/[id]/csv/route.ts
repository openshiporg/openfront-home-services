import { exportCsv } from '@/features/keystone/lib/csvRoute'
import { purchaseOrderCsv } from '@/features/keystone/services/purchasing'

export const dynamic = 'force-dynamic'

/** The order sheet to send to the supplier by hand (email or their portal). Nothing is sent from here. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return exportCsv(request, `/api/purchase-orders/${id}/csv`, ['canPurchase', 'canApprovePurchases'], 'purchase-order.csv', db => purchaseOrderCsv(db, id))
}
