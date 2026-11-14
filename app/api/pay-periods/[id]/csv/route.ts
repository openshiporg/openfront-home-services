import { exportCsv, toCsv } from '@/features/keystone/lib/csvRoute'

export const dynamic = 'force-dynamic'

/** The lines of one pay period, as the signed-in payroll person sees them. */
export const GET = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  return exportCsv(request, `/api/pay-periods/${id}/csv`, ['canRunPayroll', 'canApprovePayPeriods', 'canReadPay'], `pay-period-${id.slice(-6)}.csv`, async db => {
    const period = await db.payPeriod.findUnique({ where: { id }, select: { id: true, startsOn: true, endsOn: true, status: true } })
    if (!period) return null
    const lines = await db.earningLine.findMany({ where: { payPeriodId: id }, orderBy: [{ employeeId: 'asc' }, { workweekStart: 'asc' }, { lineKey: 'asc' }], take: 20000, select: { kind: true, hours: true, rateMinor: true, amountMinor: true, earningCode: true, note: true, workweekStart: true, regularRateReview: true, employee: { select: { employeeNumber: true, displayName: true } }, reverses: { select: { lineKey: true } } } })
    const usd = (m: bigint) => `${m < 0n ? '-' : ''}${(m < 0n ? -m : m) / 100n}.${String((m < 0n ? -m : m) % 100n).padStart(2, '0')}`
    return toCsv([['Employee number', 'Employee', 'Workweek', 'Earning', 'Code', 'Hours', 'Rate', 'Amount', 'Reverses', 'Review regular rate', 'Note'], ...lines.map((l: any) => [l.employee?.employeeNumber, l.employee?.displayName, l.workweekStart.toISOString().slice(0, 10), l.kind, l.earningCode, l.hours === null ? '' : String(l.hours), l.rateMinor ? usd(l.rateMinor) : '', usd(l.amountMinor), l.reverses?.lineKey ?? '', l.regularRateReview ? 'yes' : '', l.note])])
  })
}
