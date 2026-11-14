import { exportCsv } from '@/features/keystone/lib/csvRoute'
import { buildExport } from '@/features/keystone/domain/payExport'

export const dynamic = 'force-dynamic'

/** The file that was exported, rebuilt from the locked lines. It is served only if it still matches the fingerprint stored at export. */
export const GET = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const target = new URL(request.url).searchParams.get('target') === 'gusto' ? 'gusto' : 'csv'
  return exportCsv(request, `/api/pay-periods/${id}/export`, ['canRunPayroll'], `payroll-${target}-${id.slice(-6)}.csv`, async db => {
    const batch = await db.payrollExportBatch.findUnique({ where: { payPeriodId_target: { payPeriodId: id, target } }, select: { sha256: true } })
    if (!batch) return null
    const file = await buildExport(db, id, target)
    if (file.sha256 !== batch.sha256) throw new Error('The stored export no longer matches its lines.')
    return file.text
  })
}
