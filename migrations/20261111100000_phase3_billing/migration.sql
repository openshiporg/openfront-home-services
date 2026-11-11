-- Phase 3: invoices, payments, credits, AR ledger, financing records and the accounting export.
--
-- Rules that live in the database as well as the service (I-M1..I-M9):
--  1. A posted invoice and its lines never change; an invoice is never deleted (I-M1). total = subtotal - discount + tax (I-M2).
--  2. Invoice.balanceMinor equals the sum of its AR entries and is never negative; checked at commit (I-M3).
--  3. A payment's allocations, net of reversals, plus its refunds never exceed its amount (I-M4, I-M6).
--  4. AR entries, allocations, customer-credit entries, funding records and export lines are append-only (I-M8).
--  5. A customer's credit balance never goes negative. An AR entry can't be posted into a closed AR period.
--  6. A reconciled or exported payment batch and a closed AR period are frozen (I-M9).
-- Not expressible here: the tax matrix, the approval threshold for refunds and write-offs, the unknown-outcome rule
-- for payment attempts and the third-party authorised-amount cap. The services enforce those and the tests prove them.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "feeMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "payer" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "approval" TEXT,
ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "AccountingExportBatch" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT 'csv',
    "periodFrom" DATE,
    "periodTo" DATE,
    "status" TEXT NOT NULL DEFAULT 'created',
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "debitMinor" BIGINT NOT NULL DEFAULT 0,
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "sha256" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingExportLine" (
    "id" TEXT NOT NULL,
    "batch" TEXT,
    "sourceKey" TEXT NOT NULL DEFAULT '',
    "entryDate" DATE,
    "account" TEXT NOT NULL DEFAULT '',
    "debitMinor" BIGINT NOT NULL DEFAULT 0,
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "memo" TEXT NOT NULL DEFAULT '',
    "docRef" TEXT NOT NULL DEFAULT '',
    "customerRef" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingExportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArEntry" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "customer" TEXT,
    "payer" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'invoice_posted',
    "amountMinor" BIGINT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "arPeriod" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArPeriod" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "approval" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditMemo" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "invoice" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "appliedToInvoiceMinor" BIGINT NOT NULL DEFAULT 0,
    "appliedToCreditMinor" BIGINT NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL DEFAULT 'invoice_balance',
    "approval" TEXT,
    "createdBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCreditEntry" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'issued',
    "amountMinor" BIGINT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "providerDisputeId" TEXT NOT NULL DEFAULT '',
    "amountMinor" BIGINT NOT NULL,
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'opened',
    "evidenceDueBy" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingApplication" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "job" TEXT,
    "estimateVersion" TEXT,
    "invoice" TEXT,
    "program" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "consentRecordedAt" TIMESTAMP(3),
    "partnerReference" TEXT NOT NULL DEFAULT '',
    "offers" JSONB,
    "selectedOffer" JSONB,
    "offerExpiresAt" TIMESTAMP(3),
    "declineNote" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingFunding" (
    "id" TEXT NOT NULL,
    "application" TEXT,
    "grossMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "fundedAt" TIMESTAMP(3) NOT NULL,
    "payment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingFunding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "partner" TEXT NOT NULL DEFAULT 'wisetack',
    "minMinor" BIGINT NOT NULL DEFAULT 50000,
    "maxMinor" BIGINT NOT NULL DEFAULT 2500000,
    "termsNote" TEXT NOT NULL DEFAULT '',
    "applyUrl" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "publicCode" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "customer" TEXT,
    "payer" TEXT,
    "payerKind" TEXT NOT NULL DEFAULT 'customer',
    "location" TEXT,
    "propertyClass" TEXT NOT NULL DEFAULT 'residential',
    "contractTaxMode" TEXT NOT NULL DEFAULT 'lump_sum',
    "taxResult" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "invoiceDate" DATE,
    "dueDate" DATE,
    "arPeriod" TEXT,
    "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "authorization" TEXT,
    "progressReason" TEXT NOT NULL DEFAULT '',
    "collectionsStatus" TEXT NOT NULL DEFAULT 'current',
    "snapshot" JSONB,
    "pdf" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "workLine" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT '',
    "unitPriceMinor" BIGINT NOT NULL DEFAULT 0,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxCategory" TEXT NOT NULL DEFAULT 'labor',
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxBaseMinor" BIGINT NOT NULL DEFAULT 0,
    "taxRate" TEXT NOT NULL DEFAULT '',
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "taxJurisdictions" JSONB,
    "costMinor" BIGINT NOT NULL DEFAULT 0,
    "revenueAccountCode" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'commercial',
    "terms" TEXT NOT NULL DEFAULT 'net_30',
    "poRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultNteMinor" BIGINT,
    "portalUrl" TEXT NOT NULL DEFAULT '',
    "billingContact" TEXT NOT NULL DEFAULT '',
    "accountingCustomerRef" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "invoice" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'apply',
    "reverses" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "intentKey" TEXT NOT NULL DEFAULT '',
    "invoice" TEXT,
    "customer" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'card',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureNote" TEXT NOT NULL DEFAULT '',
    "resolutionNote" TEXT NOT NULL DEFAULT '',
    "payment" TEXT,
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "businessDate" DATE,
    "tenderGroup" TEXT NOT NULL DEFAULT 'card',
    "status" TEXT NOT NULL DEFAULT 'open',
    "expectedMinor" BIGINT NOT NULL DEFAULT 0,
    "depositedMinor" BIGINT NOT NULL DEFAULT 0,
    "feesMinor" BIGINT NOT NULL DEFAULT 0,
    "varianceMinor" BIGINT NOT NULL DEFAULT 0,
    "depositReference" TEXT NOT NULL DEFAULT '',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyAuthorization" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "payer" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'po',
    "externalRef" TEXT NOT NULL DEFAULT '',
    "authorizedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "serviceFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "revisionOf" TEXT,
    "evidence" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThirdPartyAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingExportBatch_ref_key" ON "AccountingExportBatch"("ref");

-- CreateIndex
CREATE INDEX "AccountingExportBatch_createdBy_idx" ON "AccountingExportBatch"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingExportLine_sourceKey_key" ON "AccountingExportLine"("sourceKey");

-- CreateIndex
CREATE INDEX "AccountingExportLine_batch_idx" ON "AccountingExportLine"("batch");

-- CreateIndex
CREATE INDEX "ArEntry_invoice_idx" ON "ArEntry"("invoice");

-- CreateIndex
CREATE INDEX "ArEntry_customer_idx" ON "ArEntry"("customer");

-- CreateIndex
CREATE INDEX "ArEntry_payer_idx" ON "ArEntry"("payer");

-- CreateIndex
CREATE INDEX "ArEntry_sourceId_idx" ON "ArEntry"("sourceId");

-- CreateIndex
CREATE INDEX "ArEntry_arPeriod_idx" ON "ArEntry"("arPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "ArPeriod_month_key" ON "ArPeriod"("month");

-- CreateIndex
CREATE INDEX "ArPeriod_closedBy_idx" ON "ArPeriod"("closedBy");

-- CreateIndex
CREATE INDEX "ArPeriod_approval_idx" ON "ArPeriod"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "CreditMemo_ref_key" ON "CreditMemo"("ref");

-- CreateIndex
CREATE INDEX "CreditMemo_invoice_idx" ON "CreditMemo"("invoice");

-- CreateIndex
CREATE INDEX "CreditMemo_approval_idx" ON "CreditMemo"("approval");

-- CreateIndex
CREATE INDEX "CreditMemo_createdBy_idx" ON "CreditMemo"("createdBy");

-- CreateIndex
CREATE INDEX "CustomerCreditEntry_customer_idx" ON "CustomerCreditEntry"("customer");

-- CreateIndex
CREATE INDEX "CustomerCreditEntry_sourceId_idx" ON "CustomerCreditEntry"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_providerDisputeId_key" ON "Dispute"("providerDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_payment_idx" ON "Dispute"("payment");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingApplication_ref_key" ON "FinancingApplication"("ref");

-- CreateIndex
CREATE INDEX "FinancingApplication_customer_idx" ON "FinancingApplication"("customer");

-- CreateIndex
CREATE INDEX "FinancingApplication_job_idx" ON "FinancingApplication"("job");

-- CreateIndex
CREATE INDEX "FinancingApplication_estimateVersion_idx" ON "FinancingApplication"("estimateVersion");

-- CreateIndex
CREATE INDEX "FinancingApplication_invoice_idx" ON "FinancingApplication"("invoice");

-- CreateIndex
CREATE INDEX "FinancingApplication_program_idx" ON "FinancingApplication"("program");

-- CreateIndex
CREATE INDEX "FinancingApplication_createdBy_idx" ON "FinancingApplication"("createdBy");

-- CreateIndex
CREATE INDEX "FinancingFunding_application_idx" ON "FinancingFunding"("application");

-- CreateIndex
CREATE INDEX "FinancingFunding_payment_idx" ON "FinancingFunding"("payment");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicCode_key" ON "Invoice"("publicCode");

-- CreateIndex
CREATE INDEX "Invoice_job_idx" ON "Invoice"("job");

-- CreateIndex
CREATE INDEX "Invoice_customer_idx" ON "Invoice"("customer");

-- CreateIndex
CREATE INDEX "Invoice_payer_idx" ON "Invoice"("payer");

-- CreateIndex
CREATE INDEX "Invoice_location_idx" ON "Invoice"("location");

-- CreateIndex
CREATE INDEX "Invoice_arPeriod_idx" ON "Invoice"("arPeriod");

-- CreateIndex
CREATE INDEX "Invoice_authorization_idx" ON "Invoice"("authorization");

-- CreateIndex
CREATE INDEX "Invoice_pdf_idx" ON "Invoice"("pdf");

-- CreateIndex
CREATE INDEX "Invoice_postedBy_idx" ON "Invoice"("postedBy");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_idx" ON "InvoiceLine"("invoice");

-- CreateIndex
CREATE INDEX "InvoiceLine_workLine_idx" ON "InvoiceLine"("workLine");

-- CreateIndex
CREATE INDEX "PaymentAllocation_payment_idx" ON "PaymentAllocation"("payment");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoice_idx" ON "PaymentAllocation"("invoice");

-- CreateIndex
CREATE INDEX "PaymentAllocation_reverses_idx" ON "PaymentAllocation"("reverses");

-- CreateIndex
CREATE INDEX "PaymentAllocation_createdBy_idx" ON "PaymentAllocation"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_intentKey_key" ON "PaymentAttempt"("intentKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoice_idx" ON "PaymentAttempt"("invoice");

-- CreateIndex
CREATE INDEX "PaymentAttempt_customer_idx" ON "PaymentAttempt"("customer");

-- CreateIndex
CREATE INDEX "PaymentAttempt_payment_idx" ON "PaymentAttempt"("payment");

-- CreateIndex
CREATE INDEX "PaymentAttempt_createdBy_idx" ON "PaymentAttempt"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_ref_key" ON "PaymentBatch"("ref");

-- CreateIndex
CREATE INDEX "PaymentBatch_closedBy_idx" ON "PaymentBatch"("closedBy");

-- CreateIndex
CREATE INDEX "ThirdPartyAuthorization_job_idx" ON "ThirdPartyAuthorization"("job");

-- CreateIndex
CREATE INDEX "ThirdPartyAuthorization_payer_idx" ON "ThirdPartyAuthorization"("payer");

-- CreateIndex
CREATE INDEX "ThirdPartyAuthorization_revisionOf_idx" ON "ThirdPartyAuthorization"("revisionOf");

-- CreateIndex
CREATE INDEX "ThirdPartyAuthorization_evidence_idx" ON "ThirdPartyAuthorization"("evidence");

-- CreateIndex
CREATE INDEX "Payment_payer_idx" ON "Payment"("payer");

-- CreateIndex
CREATE INDEX "Refund_approval_idx" ON "Refund"("approval");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingExportBatch" ADD CONSTRAINT "AccountingExportBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingExportLine" ADD CONSTRAINT "AccountingExportLine_batch_fkey" FOREIGN KEY ("batch") REFERENCES "AccountingExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArEntry" ADD CONSTRAINT "ArEntry_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArEntry" ADD CONSTRAINT "ArEntry_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArEntry" ADD CONSTRAINT "ArEntry_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArEntry" ADD CONSTRAINT "ArEntry_arPeriod_fkey" FOREIGN KEY ("arPeriod") REFERENCES "ArPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPeriod" ADD CONSTRAINT "ArPeriod_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPeriod" ADD CONSTRAINT "ArPeriod_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_estimateVersion_fkey" FOREIGN KEY ("estimateVersion") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_program_fkey" FOREIGN KEY ("program") REFERENCES "FinancingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingFunding" ADD CONSTRAINT "FinancingFunding_application_fkey" FOREIGN KEY ("application") REFERENCES "FinancingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingFunding" ADD CONSTRAINT "FinancingFunding_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_arPeriod_fkey" FOREIGN KEY ("arPeriod") REFERENCES "ArPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "ThirdPartyAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pdf_fkey" FOREIGN KEY ("pdf") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_workLine_fkey" FOREIGN KEY ("workLine") REFERENCES "WorkLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_reverses_fkey" FOREIGN KEY ("reverses") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyAuthorization" ADD CONSTRAINT "ThirdPartyAuthorization_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyAuthorization" ADD CONSTRAINT "ThirdPartyAuthorization_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyAuthorization" ADD CONSTRAINT "ThirdPartyAuthorization_revisionOf_fkey" FOREIGN KEY ("revisionOf") REFERENCES "ThirdPartyAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyAuthorization" ADD CONSTRAINT "ThirdPartyAuthorization_evidence_fkey" FOREIGN KEY ("evidence") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Constraints ──────────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_valid";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_valid" CHECK ("amountMinor" > 0 AND "feeMinor" >= 0 AND kind IN ('deposit', 'payment')
  AND method IN ('card', 'ach', 'cash', 'check', 'other', 'financing', 'third_party', 'customer_credit'));

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_valid" CHECK (
  status IN ('draft', 'posted', 'partially_paid', 'paid', 'written_off', 'voided', 'discarded')
  AND "subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "taxMinor" >= 0 AND "balanceMinor" >= 0
  AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  AND (status IN ('draft', 'discarded') OR ("invoiceDate" IS NOT NULL AND "dueDate" IS NOT NULL AND "arPeriod" IS NOT NULL AND "postedAt" IS NOT NULL)));
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_valid" CHECK ("amountMinor" >= 0 AND "discountMinor" >= 0 AND "discountMinor" <= "amountMinor" AND "taxMinor" >= 0 AND quantity > 0);
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_valid" CHECK ("totalMinor" >= 0 AND "appliedToInvoiceMinor" >= 0 AND "appliedToCreditMinor" >= 0
  AND "appliedToInvoiceMinor" + "appliedToCreditMinor" <= "totalMinor" AND status IN ('draft', 'pending_approval', 'posted', 'applied', 'rejected'));
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_valid" CHECK ("amountMinor" > 0 AND kind IN ('apply', 'reverse') AND (kind = 'apply' OR reverses IS NOT NULL));
ALTER TABLE "ArEntry" ADD CONSTRAINT "ArEntry_valid" CHECK ("amountMinor" <> 0 AND invoice IS NOT NULL
  AND kind IN ('invoice_posted', 'payment_applied', 'payment_reversed', 'credit_memo', 'write_off', 'write_off_reversal', 'refund_reopen', 'dispute_withdrawal', 'dispute_reinstatement'));
ALTER TABLE "CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_valid" CHECK ("amountMinor" <> 0 AND customer IS NOT NULL
  AND kind IN ('issued', 'applied', 'refunded', 'expired') AND (("amountMinor" > 0) = (kind = 'issued')));
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_valid" CHECK (status IN ('open', 'closed', 'reconciled', 'exported') AND (status IN ('open', 'closed') OR "varianceMinor" = "depositedMinor" - "expectedMinor" + "feesMinor"));
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_valid" CHECK ("amountMinor" > 0 AND status IN ('pending', 'succeeded', 'failed', 'unknown') AND (status <> 'succeeded' OR payment IS NOT NULL));
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_valid" CHECK ("amountMinor" > 0
  AND status IN ('started', 'submitted', 'approved', 'declined', 'needs_info', 'docs_signed', 'awaiting_funding', 'funded', 'cancelled', 'expired'));
ALTER TABLE "FinancingFunding" ADD CONSTRAINT "FinancingFunding_valid" CHECK ("grossMinor" > 0 AND "feeMinor" >= 0 AND "feeMinor" <= "grossMinor");
CREATE UNIQUE INDEX "FinancingFunding_application_reference_key" ON "FinancingFunding"(application, reference) WHERE application IS NOT NULL;
CREATE UNIQUE INDEX "PaymentBatch_businessDate_tenderGroup_key" ON "PaymentBatch"("businessDate", "tenderGroup") WHERE "businessDate" IS NOT NULL;
ALTER TABLE "ArPeriod" ADD CONSTRAINT "ArPeriod_valid" CHECK (status IN ('open', 'closing', 'closed') AND month = date_trunc('month', month)::date);

-- ── Append-only rows ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER "ArEntry_append_only" BEFORE UPDATE OR DELETE ON "ArEntry" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "ArEntry_no_truncate" BEFORE TRUNCATE ON "ArEntry" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "PaymentAllocation_append_only" BEFORE UPDATE OR DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "PaymentAllocation_no_truncate" BEFORE TRUNCATE ON "PaymentAllocation" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "CustomerCreditEntry_append_only" BEFORE UPDATE OR DELETE ON "CustomerCreditEntry" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "CustomerCreditEntry_no_truncate" BEFORE TRUNCATE ON "CustomerCreditEntry" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "FinancingFunding_append_only" BEFORE UPDATE OR DELETE ON "FinancingFunding" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "FinancingFunding_no_truncate" BEFORE TRUNCATE ON "FinancingFunding" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "AccountingExportLine_append_only" BEFORE UPDATE OR DELETE ON "AccountingExportLine" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "AccountingExportLine_no_truncate" BEFORE TRUNCATE ON "AccountingExportLine" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- ── Things that are never deleted ────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hs_billing_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are kept, never deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "Invoice_no_delete" BEFORE DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "CreditMemo_no_delete" BEFORE DELETE ON "CreditMemo" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "PaymentBatch_no_delete" BEFORE DELETE ON "PaymentBatch" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "PaymentAttempt_no_delete" BEFORE DELETE ON "PaymentAttempt" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "ArPeriod_no_delete" BEFORE DELETE ON "ArPeriod" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "AccountingExportBatch_no_delete" BEFORE DELETE ON "AccountingExportBatch" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();
CREATE TRIGGER "FinancingApplication_no_delete" BEFORE DELETE ON "FinancingApplication" FOR EACH ROW EXECUTE FUNCTION hs_billing_no_delete();

-- ── Invoice: frozen once posted (I-M1), forward-only status ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hs_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('draft') THEN
    IF (NEW.ref, NEW."publicCode", NEW.job, NEW.customer, NEW.payer, NEW."payerKind", NEW.location, NEW."propertyClass", NEW."contractTaxMode", NEW."taxResult",
        NEW."invoiceDate", NEW."dueDate", NEW."arPeriod", NEW."subtotalMinor", NEW."discountMinor", NEW."taxMinor", NEW."totalMinor", NEW."poNumber",
        NEW.authorization, NEW.snapshot, NEW."postedAt", NEW."postedBy")
       IS DISTINCT FROM
       (OLD.ref, OLD."publicCode", OLD.job, OLD.customer, OLD.payer, OLD."payerKind", OLD.location, OLD."propertyClass", OLD."contractTaxMode", OLD."taxResult",
        OLD."invoiceDate", OLD."dueDate", OLD."arPeriod", OLD."subtotalMinor", OLD."discountMinor", OLD."taxMinor", OLD."totalMinor", OLD."poNumber",
        OLD.authorization, OLD.snapshot, OLD."postedAt", OLD."postedBy") THEN
      RAISE EXCEPTION 'A posted invoice is never edited; correct it with a credit memo or a new invoice' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.pdf IS NOT NULL AND NEW.pdf IS DISTINCT FROM OLD.pdf THEN
      RAISE EXCEPTION 'The invoice document is fixed once rendered' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status IN ('posted', 'discarded'))
    OR (OLD.status IN ('posted', 'partially_paid', 'paid') AND NEW.status IN ('posted', 'partially_paid', 'paid'))
    OR (OLD.status IN ('posted', 'partially_paid') AND NEW.status IN ('written_off', 'voided'))) THEN
    RAISE EXCEPTION 'Invoice cannot move from % to %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Invoice_guard" BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION hs_invoice_guard();

CREATE OR REPLACE FUNCTION hs_invoice_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_id text;
BEGIN
  v_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.invoice ELSE OLD.invoice END;
  SELECT status INTO v_status FROM "Invoice" WHERE id = v_id;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Lines of a posted invoice are frozen' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "InvoiceLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION hs_invoice_line_guard();

-- balance = sum of AR entries, never negative; checked when the transaction commits so the ledger row and the
-- invoice update may be written in either order.
CREATE OR REPLACE FUNCTION hs_invoice_balance_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id text; v_balance bigint; v_sum bigint;
BEGIN
  v_id := CASE WHEN TG_TABLE_NAME = 'ArEntry' THEN NEW.invoice ELSE NEW.id END;
  SELECT "balanceMinor" INTO v_balance FROM "Invoice" WHERE id = v_id;
  IF v_balance IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(sum("amountMinor"), 0) INTO v_sum FROM "ArEntry" WHERE invoice = v_id;
  IF v_sum <> v_balance OR v_balance < 0 THEN
    RAISE EXCEPTION 'Invoice balance % does not match its receivable entries (%) or is negative', v_balance, v_sum USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Invoice_balance_check" AFTER INSERT OR UPDATE OF "balanceMinor" ON "Invoice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hs_invoice_balance_check();
CREATE CONSTRAINT TRIGGER "ArEntry_balance_check" AFTER INSERT ON "ArEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hs_invoice_balance_check();

-- Nothing posts into a closed AR period.
CREATE OR REPLACE FUNCTION hs_ar_entry_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  IF NEW."arPeriod" IS NULL THEN
    RAISE EXCEPTION 'A receivable entry needs an AR period' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_status FROM "ArPeriod" WHERE id = NEW."arPeriod";
  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'The AR period is % and takes no new entries', coalesce(v_status, 'missing') USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ArEntry_period" BEFORE INSERT ON "ArEntry" FOR EACH ROW EXECUTE FUNCTION hs_ar_entry_period();

CREATE OR REPLACE FUNCTION hs_ar_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'A closed AR period is final' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.month <> OLD.month THEN
    RAISE EXCEPTION 'An AR period keeps its month' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ArPeriod_guard" BEFORE UPDATE ON "ArPeriod" FOR EACH ROW EXECUTE FUNCTION hs_ar_period_guard();

-- ── Allocations never exceed the payment (I-M4); refunds count against the same money (I-M6) ─────────────────────

CREATE OR REPLACE FUNCTION hs_allocation_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_paid bigint; v_applied bigint; v_refunded bigint; v_orig bigint; v_reversed bigint; v_orig_payment text;
BEGIN
  SELECT "amountMinor" INTO v_paid FROM "Payment" WHERE id = NEW.payment FOR UPDATE;
  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'Allocation needs a payment' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.kind = 'reverse' THEN
    SELECT "amountMinor", payment INTO v_orig, v_orig_payment FROM "PaymentAllocation" WHERE id = NEW.reverses AND kind = 'apply';
    IF v_orig IS NULL OR v_orig_payment <> NEW.payment THEN
      RAISE EXCEPTION 'A reversal names an allocation of the same payment' USING ERRCODE = 'check_violation';
    END IF;
    SELECT coalesce(sum("amountMinor"), 0) INTO v_reversed FROM "PaymentAllocation" WHERE reverses = NEW.reverses;
    IF v_reversed + NEW."amountMinor" > v_orig THEN
      RAISE EXCEPTION 'Reversals of % cents exceed the % cents allocated', v_reversed + NEW."amountMinor", v_orig USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    SELECT coalesce(sum(CASE WHEN kind = 'apply' THEN "amountMinor" ELSE -"amountMinor" END), 0) INTO v_applied FROM "PaymentAllocation" WHERE payment = NEW.payment;
    SELECT coalesce(sum("amountMinor"), 0) INTO v_refunded FROM "Refund" WHERE payment = NEW.payment;
    IF v_applied + v_refunded + NEW."amountMinor" > v_paid THEN
      RAISE EXCEPTION 'Allocations of % cents (and % refunded) exceed the % cents paid', v_applied + NEW."amountMinor", v_refunded, v_paid USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentAllocation_cap" BEFORE INSERT ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION hs_allocation_cap();

CREATE OR REPLACE FUNCTION hs_refund_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_paid bigint;
  v_refunded bigint;
  v_applied bigint;
BEGIN
  SELECT "amountMinor" INTO v_paid FROM "Payment" WHERE id = NEW.payment FOR UPDATE;
  SELECT coalesce(sum("amountMinor"), 0) INTO v_refunded FROM "Refund" WHERE payment = NEW.payment;
  SELECT coalesce(sum(CASE WHEN kind = 'apply' THEN "amountMinor" ELSE -"amountMinor" END), 0) INTO v_applied FROM "PaymentAllocation" WHERE payment = NEW.payment;
  IF v_paid IS NULL OR v_refunded + v_applied + NEW."amountMinor" > v_paid THEN
    RAISE EXCEPTION 'Refunds of % cents plus % cents still applied would exceed the % cents paid on this payment', v_refunded + NEW."amountMinor", v_applied, coalesce(v_paid, 0) USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ── Customer credit never goes negative ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hs_credit_floor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_balance bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('credit:' || NEW.customer, 0));
  SELECT coalesce(sum("amountMinor"), 0) INTO v_balance FROM "CustomerCreditEntry" WHERE customer = NEW.customer;
  IF v_balance + NEW."amountMinor" < 0 THEN
    RAISE EXCEPTION 'Customer credit cannot go below zero (balance % cents, change % cents)', v_balance, NEW."amountMinor" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CustomerCreditEntry_floor" BEFORE INSERT ON "CustomerCreditEntry" FOR EACH ROW EXECUTE FUNCTION hs_credit_floor();

-- ── Credit memos, payment batches ────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hs_credit_memo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('posted', 'applied') AND (NEW.invoice, NEW."totalMinor", NEW.reason, NEW."appliesTo", NEW.ref) IS DISTINCT FROM (OLD.invoice, OLD."totalMinor", OLD.reason, OLD."appliesTo", OLD.ref) THEN
    RAISE EXCEPTION 'A posted credit memo is never edited' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status IN ('pending_approval', 'posted', 'rejected'))
    OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft', 'posted', 'rejected'))
    OR (OLD.status = 'posted' AND NEW.status = 'applied')) THEN
    RAISE EXCEPTION 'Credit memo cannot move from % to %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CreditMemo_guard" BEFORE UPDATE ON "CreditMemo" FOR EACH ROW EXECUTE FUNCTION hs_credit_memo_guard();

CREATE OR REPLACE FUNCTION hs_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('reconciled', 'exported') AND (NEW."expectedMinor", NEW."depositedMinor", NEW."feesMinor", NEW."varianceMinor", NEW."businessDate", NEW."tenderGroup", NEW."depositReference")
     IS DISTINCT FROM (OLD."expectedMinor", OLD."depositedMinor", OLD."feesMinor", OLD."varianceMinor", OLD."businessDate", OLD."tenderGroup", OLD."depositReference") THEN
    RAISE EXCEPTION 'A reconciled payment batch is final' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'open' AND NEW.status = 'closed') OR (OLD.status = 'closed' AND NEW.status IN ('reconciled')) OR (OLD.status = 'reconciled' AND NEW.status = 'exported')) THEN
    RAISE EXCEPTION 'Payment batch cannot move from % to %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentBatch_guard" BEFORE UPDATE ON "PaymentBatch" FOR EACH ROW EXECUTE FUNCTION hs_batch_guard();
