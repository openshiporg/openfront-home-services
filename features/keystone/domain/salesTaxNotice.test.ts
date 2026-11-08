import { describe, expect, it } from 'vitest'
import { estimateSalesTax, type SalesTaxRulesLike } from './pricing'
import { noticeDate, noticeText, NoticeTextError, TX_HOMESTEAD_WARNING, TX_LIEN_DISCLOSURE } from './noticeTexts'
import { POLICY_PACKS } from '../seed/policyPacks'

/*
 * Estimated sales tax on the estimate (R§12.4, I§tax) against the seeded Texas pack, and the statutory
 * notice texts (16 CFR 429.1; Tex. Bus. & Com. Code §601.052-.053) the notice of cancellation prints.
 */

const TX = POLICY_PACKS.find(p => p.code === 'us-tx-sales-tax')!.version.rules as unknown as SalesTaxRulesLike
const lines = [
  { taxCategory: 'labor', netMinor: 45000n, costMinor: 0n },
  { taxCategory: 'material', netMinor: 12000n, costMinor: 4800n },
  { taxCategory: 'equipment', netMinor: 500000n, costMinor: 520000n },
]

describe('estimated sales tax (Texas pack)', () => {
  it('residential lump-sum contract: nothing taxed (the contractor paid tax on materials)', () => {
    const r = estimateSalesTax(lines, { propertyClass: 'residential', contractTaxMode: 'lump_sum', cityCode: 'US-TX-AUSTIN', rules: TX })
    expect(r.taxMinor).toBe(0n)
    expect(r.rows.every(row => !row.taxable)).toBe(true)
  })

  it('residential separated contract: materials and equipment at the greater of price and cost; labour never', () => {
    const r = estimateSalesTax(lines, { propertyClass: 'residential', contractTaxMode: 'separated', cityCode: 'US-TX-AUSTIN', rules: TX })
    expect(r.rate).toBe('0.0825')
    expect(r.rows.map(row => row.baseMinor)).toEqual([0n, 12000n, 520000n])
    // (12000 + 520000) × 0.0825 = 43890.
    expect(r.taxMinor).toBe(43890n)
  })

  it('nonresidential: every line at price; an unknown city uses the maximum local rate so tax is never understated', () => {
    const known = estimateSalesTax(lines, { propertyClass: 'nonresidential', contractTaxMode: 'lump_sum', cityCode: 'US-TX-AUSTIN', rules: TX })
    expect(known.taxMinor).toBe(45953n) // 557000 × 0.0825 = 45952.5, half-up
    const unknown = estimateSalesTax(lines, { propertyClass: 'nonresidential', contractTaxMode: 'lump_sum', cityCode: 'US-TX-NOWHERE', rules: TX })
    expect(unknown.localRateCode).toBeNull()
    expect(unknown.taxMinor).toBe(known.taxMinor)
  })

  it('fails closed when no matrix row covers a line', () => {
    expect(() => estimateSalesTax(lines, { propertyClass: 'agricultural', contractTaxMode: 'lump_sum', cityCode: null, rules: TX })).toThrow(/No sales-tax rule/)
  })
})

describe('notice of cancellation texts', () => {
  const fill = { sellerName: 'Summit Plumbing & Air LLC', sellerAddress: '4100 Industrial Blvd, Austin, TX 78744', transactionDate: noticeDate('2026-11-09'), cancelByDate: noticeDate('2026-11-12') }

  it('federal form: the 16 CFR 429.1(b) text, filled in', () => {
    const t = noticeText('ftc_429_notice_of_cancellation', 'en', fill)
    expect(t.caption).toBe('NOTICE OF CANCELLATION')
    expect(t.formParagraphs[0]).toBe('November 9, 2026')
    expect(t.formParagraphs[1]).toBe('You may CANCEL this transaction, without any Penalty or Obligation, within THREE BUSINESS DAYS from the above date.')
    expect(t.formParagraphs.at(-2)).toContain('to Summit Plumbing & Air LLC, at 4100 Industrial Blvd, Austin, TX 78744 NOT LATER THAN MIDNIGHT OF November 12, 2026.')
    expect(t.formParagraphs.at(-1)).toBe('I HEREBY CANCEL THIS TRANSACTION.')
    expect(t.receiptStatement).toMatch(/^You, the buyer, may cancel this transaction at any time prior to midnight of the third business day/)
  })

  it('Texas form: capitals, "merchant", 10 business days for the refund', () => {
    const t = noticeText('tx_601_notice_of_cancellation', 'en', fill)
    expect(t.upperCase).toBe(true)
    expect(t.formParagraphs.slice(1).every(p => p === p.toUpperCase())).toBe(true)
    expect(t.formParagraphs[2]).toContain('WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE MERCHANT')
    expect(t.formParagraphs.at(-2)).toContain('TO SUMMIT PLUMBING & AIR LLC, AT 4100 INDUSTRIAL BLVD, AUSTIN, TX 78744 NOT LATER THAN MIDNIGHT OF NOVEMBER 12, 2026.')
  })

  it('fails closed on an unknown template, an unverified language or a missing fill', () => {
    expect(() => noticeText('xx_unknown', 'en', fill)).toThrow(NoticeTextError)
    expect(() => noticeText('ftc_429_notice_of_cancellation', 'es', fill)).toThrow(/no verified es text/)
    expect(() => noticeText('ftc_429_notice_of_cancellation', 'en', { ...fill, sellerAddress: ' ' })).toThrow(/sellerAddress/)
  })

  it('the Texas home-improvement disclosures are present', () => {
    expect(TX_HOMESTEAD_WARNING).toMatch(/^IMPORTANT NOTICE: You and your contractor are responsible/)
    expect(TX_LIEN_DISCLOSURE[0]).toMatch(/^KNOW YOUR RIGHTS AND RESPONSIBILITIES UNDER THE LAW\./)
    expect(TX_LIEN_DISCLOSURE.length).toBeGreaterThanOrEqual(12)
  })
})
