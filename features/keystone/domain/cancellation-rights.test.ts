import { describe, expect, it } from 'vitest'
import golden from '../../../tests/golden/cancellation-rights.json'
import { US_FEDERAL } from '../lib/calendar'
import { POLICY_PACKS } from '../seed/policyPacks'
import { CancellationRightsError, evaluateCancellationRights, type HomeSolicitationRules, type SaleFacts } from './cancellation-rights'
import { homeSolicitationRules } from './policySchemas'

const federalPack = POLICY_PACKS.find(p => p.id === 'seed_pack_us_home_solicitation')!
const texasPack = POLICY_PACKS.find(p => p.id === 'seed_pack_tx_home_solicitation')!
const PACKS: Record<string, HomeSolicitationRules> = {
  federal: homeSolicitationRules.parse(federalPack.version.rules),
  tx: homeSolicitationRules.parse(texasPack.later![0].rules),
}
const CALENDARS = { 'US-FEDERAL': US_FEDERAL }

type Scenario = (typeof golden.scenarios)[number]
const factsOf = (s: Scenario): SaleFacts => ({
  ...(s.facts as unknown as Omit<SaleFacts, 'lines' | 'transactionAt'>),
  transactionAt: new Date(s.facts.transactionAt),
  lines: s.facts.lines.map(line => ({ ...line, amountMinor: BigInt(line.amountMinor) })) as SaleFacts['lines'],
})

describe('cancellation rights: golden scenarios (federal 16 CFR 429 + Texas ch. 601)', () => {
  it('has at least the twelve scenarios the exit gate asks for', () => {
    expect(golden.scenarios.length).toBeGreaterThanOrEqual(12)
  })

  for (const s of golden.scenarios) {
    it(s.name, () => {
      const result = evaluateCancellationRights(PACKS[s.pack], factsOf(s), CALENDARS)
      const e = s.expect as Record<string, any>
      expect(result.applies).toBe(e.applies)
      if ('governing' in e) expect(result.governing?.rule ?? null).toBe(e.governing)
      if ('coveredLineIds' in e) expect(result.coveredLineIds).toEqual(e.coveredLineIds)
      if ('coveredAmountMinor' in e) expect(result.coveredAmountMinor).toBe(e.coveredAmountMinor)
      if ('transactionDate' in e) expect(result.governing?.transactionDate).toBe(e.transactionDate)
      if ('lastDay' in e) expect(result.governing?.lastDay).toBe(e.lastDay)
      if ('cancelBy' in e) expect(result.governing?.cancelBy).toBe(e.cancelBy)
      for (const [code, want] of Object.entries((e.rules ?? {}) as Record<string, Record<string, unknown>>)) {
        const got = result.results.find(r => r.rule === code)
        expect(got, code).toBeDefined()
        expect(got).toMatchObject(want)
      }
    })
  }
})

describe('cancellation rights: fails closed', () => {
  const sale: SaleFacts = {
    location: 'buyer_residence', initiatedBy: 'customer_request', transactionAt: new Date('2026-11-09T16:00:00Z'), timeZone: 'America/Chicago',
    lines: [{ id: 'l1', amountMinor: 60000n, trade: 'electrical', cancellationClass: 'additional_goods_services' }],
  }

  it('refuses a rule whose calendar is not loaded', () => {
    expect(() => evaluateCancellationRights(PACKS.tx, sale, {})).toThrow(CancellationRightsError)
  })

  it('refuses an unknown exclusion code instead of ignoring it', () => {
    expect(() => evaluateCancellationRights(PACKS.tx, { ...sale, exclusions: ['made_up'] }, CALENDARS)).toThrow(/Unknown exclusion/)
  })

  it('refuses a sale with no lines or a negative line', () => {
    expect(() => evaluateCancellationRights(PACKS.tx, { ...sale, lines: [] }, CALENDARS)).toThrow(CancellationRightsError)
    expect(() => evaluateCancellationRights(PACKS.tx, { ...sale, lines: [{ ...sale.lines[0], amountMinor: -1n }] }, CALENDARS)).toThrow(CancellationRightsError)
  })

  it('refuses dates past the verified holiday schedule', () => {
    expect(() => evaluateCancellationRights(PACKS.tx, { ...sale, transactionAt: new Date('2029-01-02T16:00:00Z') }, CALENDARS)).toThrow(/no verified schedule/)
  })

  it('a whole-sale exclusion (TILA rescission) removes the federal right but not Texas', () => {
    const r = evaluateCancellationRights(PACKS.tx, { ...sale, exclusions: ['tila_rescission'] }, CALENDARS)
    expect(r.results.find(x => x.rule === 'ftc_cooling_off')).toMatchObject({ applies: false, reasons: ['excluded_tila_rescission'] })
    expect(r.governing?.rule).toBe('tx_601')
  })

  it('a phone-only sale is outside the Texas personal-solicitation scope', () => {
    const r = evaluateCancellationRights(PACKS.tx, { ...sale, location: 'remote' }, CALENDARS)
    expect(r.applies).toBe(false)
  })

  it('Texas v1 (before personal-solicitation scope) still parses, defaulting to door_to_door', () => {
    const v1 = homeSolicitationRules.parse(texasPack.version.rules)
    expect(v1.rules.map(r => [r.code, r.scope, r.refundBusinessDays])).toEqual([['ftc_cooling_off', 'door_to_door', 10], ['tx_601', 'door_to_door', 10]])
  })
})
