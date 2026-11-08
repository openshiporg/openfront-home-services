import { MARGIN, PdfDoc } from './pdf'

/*
 * Estimate and Notice-of-Cancellation PDFs, drawn only from frozen snapshots so the document always
 * matches what the customer was shown and signed. Money arrives as integer minor-unit strings and is
 * formatted with string arithmetic; nothing here computes a price.
 */

export type EstimateSnapshotLine = { description: string; quantity: string; uom: string; unitPriceMinor: string; amountMinor: string; discountMinor: string; memberPriced: boolean; warrantyText: string; isAddOn?: boolean }
export type EstimateSnapshotOption = { id: string; tier: string; name: string; description: string; lines: EstimateSnapshotLine[]; subtotalMinor: string; discountMinor: string; estimatedTaxMinor: string; totalMinor: string; monthlyPaymentDisplay: string; contentHash: string }
export type EstimateSnapshot = {
  ref: string; versionNumber: number; title: string; presentedAt: string; validUntil: string | null; timeZone: string
  company: { name: string; legalName: string; phone: string; email: string; address: string; licenses: { label: string; number: string }[] }
  customer: { name: string }
  location: { address: string } | null
  notes: string
  discount: { bps: number; reason: string } | null
  options: EstimateSnapshotOption[]
  disclosures: { taxNote: string; homesteadWarning: string | null; lienDisclosure: string[] | null; cancellationStatement: string | null }
  priceBookVersionId: string
  contentHash: string
}

export function usd(minor: string | number | bigint | null | undefined) {
  const s = String(minor ?? '0')
  if (!/^-?\d+$/.test(s)) return ''
  const neg = s.startsWith('-')
  const abs = s.replace('-', '').padStart(3, '0')
  const whole = abs.slice(0, -2).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}$${whole}.${abs.slice(-2)}`
}

const TIER: Record<string, string> = { good: 'Good', better: 'Better', best: 'Best', single: '', custom: '' }

/** The subtitle on a presented estimate ("Presented Nov 9, 2026 · good through 2026-12-09"). */
export const presentedLabel = (s: Pick<EstimateSnapshot, 'timeZone' | 'presentedAt' | 'validUntil'>) =>
  `Presented ${new Intl.DateTimeFormat('en-US', { timeZone: s.timeZone, dateStyle: 'medium' }).format(new Date(s.presentedAt))}${s.validUntil ? ` · good through ${s.validUntil}` : ''}`

export function renderEstimatePdf(s: EstimateSnapshot, subtitle: string) {
  const pdf = new PdfDoc()
  const right = MARGIN + pdf.width
  const col = { qty: right - 200, each: right - 110, amount: right }
  pdf.footer = (p, n) => `${s.ref} v${s.versionNumber} · ${s.company.name} · page ${p} of ${n}`

  pdf.text(s.company.legalName || s.company.name, MARGIN, 16, 'bold')
  pdf.text('ESTIMATE', right, 16, 'bold', 'right')
  pdf.y += 22
  pdf.text([s.company.address, s.company.phone].filter(Boolean).join(' · '), MARGIN, 9, 'regular', 'left', 0.35)
  pdf.text(`${s.ref} · version ${s.versionNumber}`, right, 9, 'regular', 'right', 0.35)
  pdf.y += 13
  if (s.company.licenses.length) { pdf.text(s.company.licenses.map(l => `${l.label} ${l.number}`).join(' · '), MARGIN, 8.5, 'regular', 'left', 0.35) }
  pdf.text(subtitle, right, 9, 'regular', 'right', 0.35)
  pdf.y += 22
  pdf.text(s.customer.name, MARGIN, 11, 'bold')
  pdf.y += 15
  if (s.location) { pdf.text(s.location.address, MARGIN, 10); pdf.y += 15 }
  pdf.text(s.title, MARGIN, 10, 'regular', 'left', 0.3)
  pdf.y += 16
  if (s.notes) { pdf.paragraph(s.notes, 9, 'regular', 0.25); pdf.y += 4 }
  pdf.rule(0.2, 1)
  pdf.y += 10

  const many = s.options.length > 1
  for (const [i, o] of s.options.entries()) {
    pdf.need(80)
    const label = [many ? `Option ${i + 1}` : '', TIER[o.tier] ?? '', o.name].filter(Boolean).join(' · ')
    pdf.text(label, MARGIN, 11.5, 'bold')
    pdf.text(usd(o.totalMinor), right, 11.5, 'bold', 'right')
    pdf.y += 16
    if (o.description) pdf.paragraph(o.description, 9, 'regular', 0.3)
    pdf.y += 2
    pdf.text('Qty', col.qty, 8, 'regular', 'right', 0.45)
    pdf.text('Each', col.each, 8, 'regular', 'right', 0.45)
    pdf.text('Amount', col.amount, 8, 'regular', 'right', 0.45)
    pdf.y += 12
    for (const l of o.lines) {
      pdf.need(26)
      pdf.text(l.description, MARGIN + 10, 9.5)
      pdf.text(`${l.quantity} ${l.uom}`, col.qty, 9.5, 'regular', 'right')
      pdf.text(usd(l.unitPriceMinor), col.each, 9.5, 'regular', 'right')
      pdf.text(usd(l.amountMinor), col.amount, 9.5, 'regular', 'right')
      pdf.y += 12
      const detail = [l.memberPriced ? 'member price' : '', l.isAddOn ? 'additional work' : '', l.warrantyText].filter(Boolean).join(' · ')
      if (detail) { pdf.paragraph(detail, 8, 'regular', 0.45, MARGIN + 10, col.qty - MARGIN - 60) }
    }
    pdf.y += 2
    const parts = [`Subtotal ${usd(o.subtotalMinor)}`, o.discountMinor !== '0' ? `Discount -${usd(o.discountMinor)}` : '', `Estimated tax ${usd(o.estimatedTaxMinor)}`].filter(Boolean)
    pdf.text(parts.join(' · '), right, 8.5, 'regular', 'right', 0.35)
    pdf.y += 12
    if (o.monthlyPaymentDisplay) { pdf.text(o.monthlyPaymentDisplay, right, 8.5, 'regular', 'right', 0.35); pdf.y += 12 }
    pdf.rule()
    pdf.y += 10
  }

  pdf.need(40)
  if (s.discount) { pdf.paragraph(`Discount applied: ${s.discount.reason}`, 8.5, 'regular', 0.25); pdf.y += 2 }
  pdf.paragraph(s.disclosures.taxNote, 8.5, 'regular', 0.25)
  if (s.validUntil) pdf.paragraph(`Prices are good through ${s.validUntil}.`, 8.5, 'regular', 0.25)
  pdf.y += 6
  if (s.disclosures.cancellationStatement) { pdf.need(40); pdf.paragraph(s.disclosures.cancellationStatement, 10, 'bold'); pdf.y += 6 }
  if (s.disclosures.homesteadWarning) { pdf.need(50); pdf.paragraph(s.disclosures.homesteadWarning, 10, 'bold'); pdf.y += 6 }
  if (s.disclosures.lienDisclosure?.length) {
    pdf.newPage()
    for (const para of s.disclosures.lienDisclosure) { pdf.paragraph(para, 8.5); pdf.y += 4 }
  }
  return pdf.toBytes({ title: `Estimate ${s.ref}`, author: s.company.name })
}

export type NoticeSnapshot = {
  ref: string; transactionDate: string; cancelByDate: string; cancelBy: string; timeZone: string; language: string
  seller: { name: string; address: string }
  buyer: { name: string; address: string }
  notices: { template: string; citation: string; receiptStatement: string; caption: string; formParagraphs: string[]; signatureLines: string[]; upperCase: boolean }[]
  coveredLines: { description: string; amountMinor: string }[]
  coveredAmountMinor: string
}

/** The receipt statement plus each required cancellation form, in duplicate (16 CFR 429.1(b); Tex. §601.053(a)). */
export function renderNoticePdf(s: NoticeSnapshot) {
  const pdf = new PdfDoc()
  const right = MARGIN + pdf.width
  pdf.footer = (p, n) => `${s.ref} · ${s.seller.name} · page ${p} of ${n}`
  pdf.text(s.seller.name, MARGIN, 14, 'bold')
  pdf.text(s.ref, right, 10, 'regular', 'right', 0.35)
  pdf.y += 18
  pdf.text(s.seller.address, MARGIN, 9, 'regular', 'left', 0.35)
  pdf.y += 18
  pdf.text(`Buyer: ${s.buyer.name}`, MARGIN, 10)
  pdf.y += 13
  pdf.text(s.buyer.address, MARGIN, 10)
  pdf.y += 13
  pdf.text(`Date of transaction: ${s.transactionDate}`, MARGIN, 10)
  pdf.y += 18
  pdf.text('Work covered by this right to cancel', MARGIN, 9, 'bold')
  pdf.y += 13
  for (const l of s.coveredLines) { pdf.need(14); pdf.text(l.description, MARGIN + 10, 9); pdf.text(usd(l.amountMinor), right, 9, 'regular', 'right'); pdf.y += 12 }
  pdf.text(`Total ${usd(s.coveredAmountMinor)}`, right, 9, 'bold', 'right')
  pdf.y += 18
  for (const n of s.notices) { pdf.need(50); pdf.paragraph(n.receiptStatement, 10, 'bold'); pdf.y += 8 }
  for (const n of s.notices) {
    for (const copy of ['Copy for the buyer to keep', 'Copy for the buyer to send']) {
      pdf.newPage()
      pdf.text(copy, right, 8, 'regular', 'right', 0.45)
      pdf.text(n.citation, MARGIN, 8, 'regular', 'left', 0.45)
      pdf.y += 18
      pdf.text(n.caption, MARGIN, 12, 'bold')
      pdf.y += 20
      for (const p of n.formParagraphs) { pdf.paragraph(p, 10, 'bold'); pdf.y += 6 }
      pdf.y += 24
      for (const sig of n.signatureLines) { pdf.rule(0.3, 0.5); pdf.y += 4; pdf.text(sig, MARGIN, 9, 'bold'); pdf.y += 30 }
    }
  }
  return pdf.toBytes({ title: `Notice of cancellation ${s.ref}`, author: s.seller.name })
}
