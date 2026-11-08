/*
 * Statutory consumer texts, verbatim, keyed by the template a policy rule names (R§12.1, R§12.1a).
 * Templates are code, not policy data, because their wording is fixed by the regulation; the policy
 * pack decides WHICH template applies. A template that isn't here, or a language we have no
 * verified translation for, fails closed: the sale cannot complete without a lawful notice.
 *
 * Sources (each re-checked word for word against the statute text, 2026-11-08):
 *   16 CFR 429.1(a)-(c)  www.law.cornell.edu/cfr/text/16/429.1
 *   Tex. Bus. & Com. Code §601.052, §601.053  texas.public.law
 *   Tex. Prop. Code §41.007(a)(3)  texas.public.law
 *   Tex. Prop. Code §53.255(b)  texas.public.law
 */

export class NoticeTextError extends Error {
  constructor(readonly code: 'POLICY_INVALID', message: string) {
    super(message)
  }
}

export type NoticeFill = { sellerName: string; sellerAddress: string; transactionDate: string; cancelByDate: string }

export type NoticeText = {
  template: string
  citation: string
  /** The statement printed on the contract or receipt next to the buyer's signature (10-pt bold). */
  receiptStatement: string
  /** The caption of the cancellation form (attached in duplicate). */
  caption: string
  /** The form body, filled in with the seller, the transaction date and the cancel-by date. */
  formParagraphs: string[]
  /** Signature block at the end of the form. */
  signatureLines: string[]
  /** Whether the form must be in capitals (Texas writes it that way). */
  upperCase: boolean
}

const FTC_429 = (f: NoticeFill): NoticeText => ({
  template: 'ftc_429_notice_of_cancellation',
  citation: '16 CFR 429.1(a)-(b)',
  receiptStatement: 'You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.',
  caption: 'NOTICE OF CANCELLATION',
  formParagraphs: [
    `${f.transactionDate}`,
    'You may CANCEL this transaction, without any Penalty or Obligation, within THREE BUSINESS DAYS from the above date.',
    'If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within TEN BUSINESS DAYS following receipt by the seller of your cancellation notice, and any security interest arising out of the transaction will be cancelled.',
    'If you cancel, you must make available to the seller at your residence, in substantially as good condition as when received, any goods delivered to you under this contract or sale, or you may, if you wish, comply with the instructions of the seller regarding the return shipment of the goods at the seller\'s expense and risk.',
    'If you do make the goods available to the seller and the seller does not pick them up within 20 days of the date of your Notice of Cancellation, you may retain or dispose of the goods without any further obligation. If you fail to make the goods available to the seller, or if you agree to return the goods to the seller and fail to do so, then you remain liable for performance of all obligations under the contract.',
    `To cancel this transaction, mail or deliver a signed and dated copy of this Cancellation Notice or any other written notice, or send a telegram, to ${f.sellerName}, at ${f.sellerAddress} NOT LATER THAN MIDNIGHT OF ${f.cancelByDate}.`,
    'I HEREBY CANCEL THIS TRANSACTION.',
  ],
  signatureLines: ['(Date)', '(Buyer\'s signature)'],
  upperCase: false,
})

const TX_601 = (f: NoticeFill): NoticeText => ({
  template: 'tx_601_notice_of_cancellation',
  citation: 'Tex. Bus. & Com. Code §601.052-.053',
  receiptStatement: 'YOU, THE BUYER, MAY CANCEL THIS TRANSACTION AT ANY TIME PRIOR TO MIDNIGHT OF THE THIRD BUSINESS DAY AFTER THE DATE OF THIS TRANSACTION. SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.',
  caption: 'NOTICE OF CANCELLATION',
  formParagraphs: [
    `${f.transactionDate}`,
    'YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.',
    'IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE MERCHANT OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.',
    'IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE MERCHANT AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE; OR YOU MAY IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE MERCHANT REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE MERCHANT\'S EXPENSE AND RISK.',
    'IF YOU DO NOT AGREE TO RETURN THE GOODS TO THE MERCHANT OR IF THE MERCHANT DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION.',
    `TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE OR ANY OTHER WRITTEN NOTICE, OR SEND A TELEGRAM, TO ${f.sellerName.toUpperCase()}, AT ${f.sellerAddress.toUpperCase()} NOT LATER THAN MIDNIGHT OF ${f.cancelByDate.toUpperCase()}.`,
    'I HEREBY CANCEL THIS TRANSACTION.',
  ],
  signatureLines: ['(DATE)', '(BUYER\'S SIGNATURE)'],
  upperCase: true,
})

const TEMPLATES: Record<string, (f: NoticeFill) => NoticeText> = {
  ftc_429_notice_of_cancellation: FTC_429,
  tx_601_notice_of_cancellation: TX_601,
}

/** Verified languages per template. A sale in another language needs a verified translation first (16 CFR 429.1(a)). */
const LANGUAGES: Record<string, string[]> = { ftc_429_notice_of_cancellation: ['en'], tx_601_notice_of_cancellation: ['en'] }

export function noticeText(template: string, language: string, fill: NoticeFill): NoticeText {
  const make = TEMPLATES[template]
  if (!make) throw new NoticeTextError('POLICY_INVALID', `Notice template ${template} is not available.`)
  if (!(LANGUAGES[template] ?? []).includes(language)) throw new NoticeTextError('POLICY_INVALID', `There is no verified ${language} text for ${template}; the sale must be in a language we can give notice in.`)
  for (const [k, v] of Object.entries(fill)) if (!String(v).trim()) throw new NoticeTextError('POLICY_INVALID', `The notice needs the ${k}.`)
  return make(fill)
}

/** Tex. Prop. Code §41.007(a)(3): the homestead warning, 10-point bold, on a contract to improve a residence. */
export const TX_HOMESTEAD_WARNING = 'IMPORTANT NOTICE: You and your contractor are responsible for meeting the terms and conditions of this contract. If you sign this contract and you fail to meet the terms and conditions of this contract, you may lose your legal ownership rights in your home. KNOW YOUR RIGHTS AND DUTIES UNDER THE LAW.'

/** Tex. Prop. Code §53.255(b): delivered before a residential construction contract is executed. */
export const TX_LIEN_DISCLOSURE: string[] = [
  'KNOW YOUR RIGHTS AND RESPONSIBILITIES UNDER THE LAW. You are about to enter into a transaction to build a new home or remodel existing residential property. Texas law requires your contractor to provide you with this brief overview of some of your rights, responsibilities, and risks in this transaction.',
  'CONVEYANCE TO CONTRACTOR NOT REQUIRED. Your contractor may not require you to convey your real property to your contractor as a condition to the agreement for the construction of improvements on your property.',
  'KNOW YOUR CONTRACTOR. Before you enter into your agreement for the construction of improvements to your real property, make sure that you have investigated your contractor. Obtain and verify references from other people who have used the contractor for the type and size of construction project on your property.',
  'GET IT IN WRITING. Make sure that you have a written agreement with your contractor that includes: (1) a description of the work the contractor is to perform; (2) the required or estimated time for completion of the work; (3) the cost of the work or how the cost will be determined; and (4) the procedure and method of payment, including provisions for statutory reservation of funds and conditions for final payment. If your contractor made a promise, warranty, or representation to you concerning the work the contractor is to perform, make sure that promise, warranty, or representation is specified in the written agreement. An oral promise that is not included in the written agreement may not be enforceable under Texas law.',
  'READ BEFORE YOU SIGN. Do not sign any document before you have read and understood it. NEVER SIGN A DOCUMENT THAT INCLUDES AN UNTRUE STATEMENT. Take your time in reviewing documents. If you borrow money from a lender to pay for the improvements, you are entitled to have the loan closing documents furnished to you for review at least one business day before the closing. Do not waive this requirement unless a bona fide emergency or another good cause exists, and make sure you understand the documents before you sign them. If you fail to comply with the terms of the documents, you could lose your property. You are entitled to have your own attorney review any documents. If you have any question about the meaning of a document, consult an attorney.',
  'GET A LIST OF SUBCONTRACTORS AND SUPPLIERS. Before construction commences, your contractor is required to provide you with a list of the subcontractors and suppliers the contractor intends to use on your project. Your contractor is required to supply updated information on any subcontractors and suppliers added after the list is provided. Your contractor is not required to supply this information if you sign a written waiver of your rights to receive this information.',
  'MONITOR THE WORK. Lenders and governmental authorities may inspect the work in progress from time to time for their own purposes. These inspections are not intended as quality control inspections. Quality control is a matter for you and your contractor. To ensure that your home is being constructed in accordance with your wishes and specifications, you should inspect the work yourself or have your own independent inspector review the work in progress.',
  'MONITOR PAYMENTS. If you use a lender, your lender is required to provide you with a periodic statement showing the money disbursed by the lender from the proceeds of your loan. Each time your contractor requests payment from you or your lender for work performed, your contractor is also required to furnish you with a disbursement statement that lists the name and address of each subcontractor or supplier that the contractor intends to pay from the requested funds. Review these statements and make sure that the money is being properly disbursed.',
  'CLAIMS BY SUBCONTRACTORS AND SUPPLIERS. Under Texas law, if a subcontractor or supplier who furnishes labor or materials for the construction of improvements on your property is not paid, you may become liable and your property may be subject to a lien for the unpaid amount, even if you have not contracted directly with the subcontractor or supplier. To avoid liability, you should take the following actions: (1) If you receive a written notice from a subcontractor or supplier, you should withhold payment from your contractor for the amount of the claim stated in the notice until the dispute between your contractor and the subcontractor or supplier is resolved. If your lender is disbursing money directly to your contractor, you should immediately provide a copy of the notice to your lender and instruct the lender to withhold payment in the amount of the claim stated in the notice. If you continue to pay the contractor after receiving the written notice without withholding the amount of the claim, you may be liable and your property may be subject to a lien for the amount you failed to withhold. (2) During construction and for 30 days after final completion, termination, or abandonment of the contract by the contractor, you should reserve or cause your lender to reserve 10 percent of the amount of payments made for the work performed by your contractor. If you choose not to reserve the 10 percent for at least 30 days after final completion, termination, or abandonment of the contract by the contractor and if a valid claim is timely made by a claimant and your contractor fails to pay the claim, you may be personally liable and your property may be subject to a lien up to the amount that you failed to reserve.',
  'If a claim is not paid within a certain time period, the claimant is required to file a mechanic\'s lien affidavit in the real property records in the county where the property is located. A mechanic\'s lien affidavit is not a lien on your property, but the filing of the affidavit could result in a court imposing a lien on your property if the claimant is successful in litigation to enforce the lien claim.',
  'SOME CLAIMS MAY NOT BE VALID. When you receive a written notice of a claim or when a mechanic\'s lien affidavit is filed on your property, you should know your legal rights and responsibilities regarding the claim. Not all claims are valid. A notice of a claim by a subcontractor or supplier is required to be sent, and the mechanic\'s lien affidavit is required to be filed, within strict time periods. The notice and the affidavit must contain certain information. All claimants may not fully comply with the legal requirements to collect on a claim. If you have paid the contractor in full before receiving a notice of a claim and have withheld the 10 percent of the contract price or value of work, you may not be liable for that claim. Accordingly, you should consult your attorney when you receive a written notice of a claim to determine the true extent of your liability or potential liability for that claim.',
  'OBTAIN A LIEN RELEASE AND A BILLS-PAID AFFIDAVIT. When you receive a notice of claim, do not release withheld funds without obtaining a signed and notarized release of lien and claim from the claimant. You can also reduce the risk of having a claim filed by a subcontractor or supplier by requiring as a condition of each payment made by you or your lender that your contractor furnish you with an affidavit stating that all bills have been paid. Under Texas law, on final completion of the work and before final payment, the contractor is required to furnish you with an affidavit stating that all bills have been paid. If the contractor discloses any unpaid bill in the affidavit, you should withhold payment in the amount of the unpaid bill until you receive a waiver of lien or release from that subcontractor or supplier.',
  'OBTAIN TITLE INSURANCE PROTECTION. You may be able to obtain a title insurance policy to insure that the title to your property and the existing improvements on your property are free from liens claimed by subcontractors and suppliers. If your policy is issued before the improvements are completed and covers the value of the improvements to be completed, you should obtain, on the completion of the improvements and as a condition of your final payment, a \'completion of improvements\' policy endorsement. This endorsement will protect your property from liens claimed by subcontractors and suppliers that may arise from the date the original title policy is issued to the date of the endorsement.',
]

/** Long-form date for a notice ("November 12, 2026"), from an ISO calendar date. */
export function noticeDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-')
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`
}
