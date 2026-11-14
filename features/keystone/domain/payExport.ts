import { createHash } from 'node:crypto'
import { dec, toScale, ZERO } from '../lib/decimal'
import { fromMinor } from '../lib/money'
import type { Tx } from '../lib/db'

/*
 * The payroll file, built from the lines of a pay period. The same lines always make the same file byte for byte, so the stored
 * hash proves a later download is what was exported. Nothing is sent: a person takes the file to payroll.
 */

export type ExportTarget = 'csv' | 'gusto'
const d2 = (m: bigint) => toScale(fromMinor(m), 2)
/** CSV cell: a leading = + - @ is made harmless so a spreadsheet never runs it as a formula. */
const cell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const row = (cells: unknown[]) => cells.map(cell).join(',')

export async function buildExport(tx: Tx, payPeriodId: string, target: ExportTarget) {
  const period = await tx.payPeriod.findUniqueOrThrow({ where: { id: payPeriodId }, select: { startsOn: true, endsOn: true, payDate: true } })
  const lines = await tx.earningLine.findMany({
    where: { payPeriodId },
    include: { employee: { select: { employeeNumber: true, displayName: true, email: true } }, reverses: { select: { lineKey: true } } },
    orderBy: [{ employeeId: 'asc' }, { workweekStart: 'asc' }, { lineKey: 'asc' }],
  })
  const total = lines.reduce((a, l) => a + l.amountMinor, 0n)
  const day = (x: Date) => x.toISOString().slice(0, 10)
  let text: string
  if (target === 'csv') {
    const head = ['Pay period start', 'Pay period end', 'Pay date', 'Employee number', 'Employee', 'Workweek', 'Earning', 'Code', 'Hours', 'Rate', 'Amount', 'Reverses', 'Review regular rate', 'Note']
    text = [row(head), ...lines.map(l => row([day(period.startsOn), day(period.endsOn), day(period.payDate), l.employee?.employeeNumber, l.employee?.displayName, day(l.workweekStart), l.kind, l.earningCode, l.hours === null ? '' : toScale(l.hours.toString(), 2), l.rateMinor ? d2(l.rateMinor) : '', d2(l.amountMinor), l.reverses?.lineKey ?? '', l.regularRateReview ? 'yes' : '', l.note]))].join('\n') + '\n'
  } else {
    // One row per person: the hours and one-off earnings Gusto takes on a regular payroll.
    const people = new Map<string, { number: string; name: string; email: string; reg: typeof ZERO; ot: typeof ZERO; pto: typeof ZERO; commission: bigint; bonus: bigint; other: bigint; review: boolean }>()
    for (const l of lines) {
      const key = l.employeeId ?? 'none'
      const p = people.get(key) ?? { number: l.employee?.employeeNumber ?? '', name: l.employee?.displayName ?? '', email: l.employee?.email ?? '', reg: ZERO, ot: ZERO, pto: ZERO, commission: 0n, bonus: 0n, other: 0n, review: false }
      const h = dec(l.hours?.toString() ?? '0')
      if (l.kind === 'regular') p.reg = p.reg.plus(h)
      else if (l.kind === 'overtime') p.ot = p.ot.plus(h)
      else if (l.kind === 'pto') p.pto = p.pto.plus(h)
      else if (l.kind === 'commission' || l.kind === 'clawback') p.commission += l.amountMinor
      else if (l.kind === 'spiff') p.bonus += l.amountMinor
      else p.other += l.amountMinor
      if (l.regularRateReview) p.review = true
      people.set(key, p)
    }
    const head = ['Employee number', 'Employee', 'Email', 'Pay period start', 'Pay period end', 'Check date', 'Regular hours', 'Overtime hours', 'PTO hours', 'Commission', 'Bonus', 'Other earnings', 'Regular rate review']
    text = [row(head), ...[...people.values()].sort((a, b) => (a.number < b.number ? -1 : 1)).map(p => row([p.number, p.name, p.email, day(period.startsOn), day(period.endsOn), day(period.payDate), toScale(p.reg, 2), toScale(p.ot, 2), toScale(p.pto, 2), d2(p.commission), d2(p.bonus), d2(p.other), p.review ? 'yes' : '']))].join('\n') + '\n'
  }
  return { text, sha256: createHash('sha256').update(text).digest('hex'), lineCount: lines.length, totalMinor: total }
}
