import { describe, expect, it } from 'vitest'
import { clawbackAmount, findOverlap, hourlyLines, poolRoles, proposeSegments, rulePool, ruleFor, shareAmount, sharesAddUp, workweekStart } from './pay'

const at = (s: string) => new Date(s)
const plan = { hourlyRates: { default: '2800', drive: '2000' }, overtime: { weeklyThresholdHours: '40', multiplier: '1.5' } }

describe('pay arithmetic', () => {
  it('the workweek starts on Monday', () => {
    expect(workweekStart('2026-10-05')).toBe('2026-10-05')
    expect(workweekStart('2026-10-11')).toBe('2026-10-05')
    expect(workweekStart('2026-10-12')).toBe('2026-10-12')
  })

  it('proposes drive then job time from status events, and not a segment still open', () => {
    const e = (id: string, toStatus: string, t: string) => ({ id, visitId: 'v1', toStatus, occurredAt: at(t) })
    const out = proposeSegments([e('3', 'working', '2026-10-05T14:00:00Z'), e('1', 'en_route', '2026-10-05T13:30:00Z'), e('2', 'on_site', '2026-10-05T13:50:00Z'), e('4', 'done', '2026-10-05T16:00:00Z'), e('5', 'en_route', '2026-10-05T16:10:00Z')])
    expect(out.map(s => [s.kind, s.sourceKey])).toEqual([['drive', 'evt:1:2'], ['job', 'evt:2:4']])
  })

  it('weekly overtime is the time past 40 hours, at 1.5 times', () => {
    const segs = [0, 1, 2, 3, 4].map(i => ({ id: `s${i}`, kind: 'job', startsAt: at(`2026-10-0${5 + i}T13:00:00Z`), hours: '9.0000', workweekStart: '2026-10-05', payable: true }))
    const lines = hourlyLines('e1', segs, plan)
    expect(lines.map(l => [l.kind, l.hours, l.amountMinor])).toEqual([['regular', '40.0000', 112_000n], ['overtime', '5.0000', 21_000n]])
  })

  it('the same inputs give the same lines, whatever order they arrive in', () => {
    const segs = [0, 1, 2, 3, 4, 5].map(i => ({ id: `s${i}`, kind: i === 5 ? 'drive' : 'job', startsAt: at(`2026-10-${String(5 + i).padStart(2, '0')}T13:00:00Z`), hours: '8.5000', workweekStart: '2026-10-05', payable: true }))
    expect(JSON.stringify(hourlyLines('e1', [...segs].reverse(), plan), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(JSON.stringify(hourlyLines('e1', segs, plan), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
  })

  it('late time sits on top of hours already paid, so it is overtime', () => {
    const paid = [0, 1, 2, 3, 4].map(i => ({ id: `s${i}`, kind: 'job', startsAt: at(`2026-10-0${5 + i}T13:00:00Z`), hours: '8.0000', workweekStart: '2026-10-05', payable: false }))
    const late = { id: 'late', kind: 'job', startsAt: at('2026-10-07T23:00:00Z'), hours: '3.0000', workweekStart: '2026-10-05', payable: true }
    const lines = hourlyLines('e1', [...paid, late], plan)
    expect(lines.map(l => [l.kind, l.hours])).toEqual([['overtime', '3.0000']])
  })

  it('overlapping time is found, standby may sit alongside work', () => {
    const a = { kind: 'job', startsAt: at('2026-10-05T13:00:00Z'), endsAt: at('2026-10-05T15:00:00Z') }
    expect(findOverlap([a, { kind: 'drive', startsAt: at('2026-10-05T14:00:00Z'), endsAt: at('2026-10-05T16:00:00Z') }])).not.toBeNull()
    expect(findOverlap([a, { kind: 'on_call_standby', startsAt: at('2026-10-05T14:00:00Z'), endsAt: at('2026-10-05T16:00:00Z') }])).toBeNull()
  })

  it('commission: a percent of the sale, or a fixed amount per task; shares split it and round half-up once', () => {
    const pct = { scope: 'all', kind: 'percent_of_sold' as const, value: '10' }
    expect(shareAmount(rulePool(pct, 100_001n), 100, '60')).toBe(6_000n)
    const fixed = { scope: 'all', kind: 'fixed_per_task' as const, value: '2500' }
    expect(shareAmount(rulePool(fixed, 0n, 1, '3'), 100, '100')).toBe(7_500n)
    expect(poolRoles('split:60').map(r => [r.role, r.pct.toFixed()])).toEqual([['sold_by', '60'], ['performed_by', '40']])
    expect(ruleFor([{ scope: 'all', kind: 'percent_of_sold', value: '5' }, { scope: 'INSTALL', kind: 'percent_of_sold', value: '8' }], { commissionCode: 'INSTALL', categoryKey: '' })?.value).toBe('8')
  })

  it('shares must add up to exactly 100', () => {
    expect(sharesAddUp(['60', '40'])).toBe(true)
    expect(sharesAddUp(['60', '30'])).toBe(false)
    expect(sharesAddUp(['100.000001'])).toBe(false)
    expect(sharesAddUp(['0', '100'])).toBe(false)
  })

  it('a clawback is negative, proportional, and never more than the original', () => {
    expect(clawbackAmount(6_000n, 50_000n, 100_000n)).toBe(-3_000n)
    expect(clawbackAmount(6_000n, 150_000n, 100_000n)).toBe(-6_000n)
  })
})
