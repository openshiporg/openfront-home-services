import { exportCsv, toCsv } from '@/features/keystone/lib/csvRoute'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => exportCsv(request, '/api/refrigerant-log/csv', ['canManageRefrigerant'], 'refrigerant-log.csv', async db => {
  const rows = await db.refrigerantLogEntry.findMany({ orderBy: { occurredAt: 'desc' }, take: 5000, select: { kind: true, refrigerantType: true, quantityLb: true, occurredAt: true, technician: { select: { displayName: true } }, credential: { select: { number: true, epaType: true } }, equipment: { select: { ref: true } }, cylinder: { select: { serialOrTag: true } }, job: { select: { ref: true } } } })
  return toCsv([['Date', 'Kind', 'Refrigerant', 'Pounds', 'Technician', 'EPA 608 type', 'Job', 'Equipment', 'Cylinder'], ...rows.map((e: any) => [e.occurredAt.toISOString().slice(0, 10), e.kind, e.refrigerantType, String(e.quantityLb), e.technician?.displayName, e.credential?.epaType, e.job?.ref, e.equipment?.ref, e.cylinder?.serialOrTag])])
})
