import { exportCsv, toCsv } from '@/features/keystone/lib/csvRoute'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => exportCsv(request, '/api/warranty-claims/csv', ['canSubmitWarrantyClaims', 'canManageEquipment'], 'warranty-claims.csv', async db => {
  const rows = await db.warrantyClaim.findMany({ orderBy: { createdAt: 'desc' }, take: 2000, select: { ref: true, status: true, claimedMinor: true, recoveredMinor: true, externalClaimNumber: true, failedPart: true, deadline: true, equipment: { select: { manufacturer: true, modelNumber: true, serialNumber: true } } } })
  return toCsv([['Claim', 'Status', 'Maker', 'Model', 'Serial', 'Failed part', 'Claimed (cents)', 'Recovered (cents)', 'Maker claim number', 'File by'], ...rows.map((c: any) => [c.ref, c.status, c.equipment?.manufacturer, c.equipment?.modelNumber, c.equipment?.serialNumber, c.failedPart, String(c.claimedMinor), String(c.recoveredMinor), c.externalClaimNumber, c.deadline?.toISOString().slice(0, 10)])])
})
