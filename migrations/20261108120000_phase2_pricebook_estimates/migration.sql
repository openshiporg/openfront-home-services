-- AlterTable
ALTER TABLE "WorkLine" ADD COLUMN     "changeOrder" TEXT,
ADD COLUMN     "estimateLine" TEXT;

-- CreateTable
CREATE TABLE "Authorization" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'EstimateVersion',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "method" TEXT NOT NULL DEFAULT 'signature_on_device',
    "signerName" TEXT NOT NULL DEFAULT '',
    "signerContact" TEXT,
    "signerRole" TEXT NOT NULL DEFAULT 'owner',
    "signature" JSONB,
    "call" TEXT,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT 'buyer_residence',
    "initiatedBy" TEXT NOT NULL DEFAULT 'customer_request',
    "selectedLineIds" JSONB,
    "depositMinor" BIGINT NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationEvaluation" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "authorization" TEXT,
    "subjectType" TEXT NOT NULL DEFAULT 'EstimateVersion',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "policyVersion" TEXT,
    "inputs" JSONB,
    "results" JSONB,
    "rightApplies" BOOLEAN NOT NULL DEFAULT false,
    "governingRule" TEXT NOT NULL DEFAULT '',
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationNotice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "evaluation" TEXT,
    "job" TEXT,
    "customer" TEXT,
    "estimateVersion" TEXT,
    "changeOrder" TEXT,
    "rule" TEXT NOT NULL DEFAULT 'ftc_16cfr429',
    "rules" JSONB,
    "policyVersion" TEXT,
    "noticeTemplate" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '',
    "coveredAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "transactionAt" TIMESTAMP(3) NOT NULL,
    "cancelBy" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "snapshot" JSONB,
    "deliveryEvidence" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "noticeDocument" TEXT,
    "waiverDocument" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReceivedVia" TEXT NOT NULL DEFAULT '',
    "refundDueBy" TIMESTAMP(3),
    "refundDueMinor" BIGINT NOT NULL DEFAULT 0,
    "refundEvidence" JSONB,
    "startOverride" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "estimate" TEXT,
    "priceBookVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL DEFAULT '',
    "lines" JSONB,
    "deltaMinor" BIGINT NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "presentedAt" TIMESTAMP(3),
    "authorization" TEXT,
    "cancellationEvaluation" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentModel" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "modelNumber" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "tonnage" DECIMAL(18,4),
    "btuh" INTEGER,
    "efficiency" JSONB DEFAULT '{}',
    "refrigerantType" TEXT NOT NULL DEFAULT '',
    "ahriRef" TEXT NOT NULL DEFAULT '',
    "warrantySummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "publicCode" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "opportunity" TEXT,
    "customer" TEXT,
    "location" TEXT,
    "businessUnit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'staff',
    "currentVersion" TEXT,
    "soldVersion" TEXT,
    "presentedBy" TEXT,
    "createdBy" TEXT,
    "createdByAgent" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "id" TEXT NOT NULL,
    "option" TEXT,
    "pricebookItem" TEXT,
    "itemKey" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT '',
    "unitPriceMinor" BIGINT NOT NULL DEFAULT 0,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "memberPriced" BOOLEAN NOT NULL DEFAULT false,
    "costMinor" BIGINT NOT NULL DEFAULT 0,
    "taxCategory" TEXT NOT NULL DEFAULT 'labor',
    "trade" TEXT NOT NULL DEFAULT 'general',
    "cancellationClass" TEXT NOT NULL DEFAULT 'requested_repair',
    "isAddOn" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateOption" (
    "id" TEXT NOT NULL,
    "estimateVersion" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'single',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "estimatedTaxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "monthlyPaymentDisplay" JSONB,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateVersion" (
    "id" TEXT NOT NULL,
    "estimate" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priceBookVersion" TEXT,
    "supersedes" TEXT,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT NOT NULL DEFAULT '',
    "discountApproval" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "presentedAt" TIMESTAMP(3),
    "presentedBy" TEXT,
    "presentedVia" TEXT NOT NULL DEFAULT '',
    "validUntil" TIMESTAMP(3),
    "snapshot" JSONB,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "pdf" TEXT,
    "soldOption" TEXT,
    "authorization" TEXT,
    "soldAt" TIMESTAMP(3),
    "depositRequiredMinor" BIGINT NOT NULL DEFAULT 0,
    "declineReason" TEXT NOT NULL DEFAULT '',
    "declineNote" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "id" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "businessUnit" TEXT,
    "hourlyMinor" BIGINT NOT NULL,
    "afterHoursMultiplier" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkupTable" (
    "id" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "appliesTo" TEXT NOT NULL DEFAULT 'material',
    "tiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkupTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPricingRule" (
    "id" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "planCode" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT 'all',
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "waiveTripFee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "activeVersion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookCategory" (
    "id" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "categoryKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "trade" TEXT NOT NULL DEFAULT 'general',
    "parentKey" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBookCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookItem" (
    "id" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "itemKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'service_task',
    "categoryKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "customerDescription" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "trade" TEXT NOT NULL DEFAULT 'general',
    "businessUnit" TEXT,
    "pricingMethod" TEXT NOT NULL DEFAULT 'fixed',
    "unitPriceMinor" BIGINT NOT NULL DEFAULT 0,
    "memberUnitPriceMinor" BIGINT,
    "costMinor" BIGINT NOT NULL DEFAULT 0,
    "laborHours" DECIMAL(18,4),
    "uom" TEXT NOT NULL DEFAULT '',
    "taxCategory" TEXT NOT NULL DEFAULT 'labor',
    "warrantyText" TEXT NOT NULL DEFAULT '',
    "equipmentModel" TEXT,
    "materials" JSONB,
    "commissionCode" TEXT NOT NULL DEFAULT '',
    "spiffCode" TEXT NOT NULL DEFAULT '',
    "cancellationClassDefault" TEXT NOT NULL DEFAULT 'requested_repair',
    "ladderKey" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookVersion" (
    "id" TEXT NOT NULL,
    "priceBook" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "basedOn" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "effectiveAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL DEFAULT '',
    "diffReport" JSONB,
    "costChangeReport" JSONB,
    "approval" TEXT,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'count',
    "maxDecimals" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PriceBook_businessUnits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PriceBook_businessUnits_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CancellationNotice_coveredWorkLines" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CancellationNotice_coveredWorkLines_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "WorkLine_estimateLine_idx" ON "WorkLine"("estimateLine");

-- CreateIndex
CREATE INDEX "WorkLine_changeOrder_idx" ON "WorkLine"("changeOrder");

-- CreateIndex
CREATE INDEX "Authorization_subjectId_idx" ON "Authorization"("subjectId");

-- CreateIndex
CREATE INDEX "Authorization_job_idx" ON "Authorization"("job");

-- CreateIndex
CREATE INDEX "Authorization_signerContact_idx" ON "Authorization"("signerContact");

-- CreateIndex
CREATE INDEX "Authorization_call_idx" ON "Authorization"("call");

-- CreateIndex
CREATE INDEX "Authorization_recordedBy_idx" ON "Authorization"("recordedBy");

-- CreateIndex
CREATE INDEX "CancellationEvaluation_job_idx" ON "CancellationEvaluation"("job");

-- CreateIndex
CREATE INDEX "CancellationEvaluation_authorization_idx" ON "CancellationEvaluation"("authorization");

-- CreateIndex
CREATE INDEX "CancellationEvaluation_subjectId_idx" ON "CancellationEvaluation"("subjectId");

-- CreateIndex
CREATE INDEX "CancellationEvaluation_policyVersion_idx" ON "CancellationEvaluation"("policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationNotice_ref_key" ON "CancellationNotice"("ref");

-- CreateIndex
CREATE INDEX "CancellationNotice_evaluation_idx" ON "CancellationNotice"("evaluation");

-- CreateIndex
CREATE INDEX "CancellationNotice_job_idx" ON "CancellationNotice"("job");

-- CreateIndex
CREATE INDEX "CancellationNotice_customer_idx" ON "CancellationNotice"("customer");

-- CreateIndex
CREATE INDEX "CancellationNotice_estimateVersion_idx" ON "CancellationNotice"("estimateVersion");

-- CreateIndex
CREATE INDEX "CancellationNotice_changeOrder_idx" ON "CancellationNotice"("changeOrder");

-- CreateIndex
CREATE INDEX "CancellationNotice_policyVersion_idx" ON "CancellationNotice"("policyVersion");

-- CreateIndex
CREATE INDEX "CancellationNotice_noticeDocument_idx" ON "CancellationNotice"("noticeDocument");

-- CreateIndex
CREATE INDEX "CancellationNotice_waiverDocument_idx" ON "CancellationNotice"("waiverDocument");

-- CreateIndex
CREATE INDEX "CancellationNotice_startOverride_idx" ON "CancellationNotice"("startOverride");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_ref_key" ON "ChangeOrder"("ref");

-- CreateIndex
CREATE INDEX "ChangeOrder_job_idx" ON "ChangeOrder"("job");

-- CreateIndex
CREATE INDEX "ChangeOrder_estimate_idx" ON "ChangeOrder"("estimate");

-- CreateIndex
CREATE INDEX "ChangeOrder_priceBookVersion_idx" ON "ChangeOrder"("priceBookVersion");

-- CreateIndex
CREATE INDEX "ChangeOrder_authorization_idx" ON "ChangeOrder"("authorization");

-- CreateIndex
CREATE INDEX "ChangeOrder_cancellationEvaluation_idx" ON "ChangeOrder"("cancellationEvaluation");

-- CreateIndex
CREATE INDEX "ChangeOrder_createdBy_idx" ON "ChangeOrder"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentModel_modelNumber_key" ON "EquipmentModel"("modelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_ref_key" ON "Estimate"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_publicCode_key" ON "Estimate"("publicCode");

-- CreateIndex
CREATE INDEX "Estimate_job_idx" ON "Estimate"("job");

-- CreateIndex
CREATE INDEX "Estimate_opportunity_idx" ON "Estimate"("opportunity");

-- CreateIndex
CREATE INDEX "Estimate_customer_idx" ON "Estimate"("customer");

-- CreateIndex
CREATE INDEX "Estimate_location_idx" ON "Estimate"("location");

-- CreateIndex
CREATE INDEX "Estimate_businessUnit_idx" ON "Estimate"("businessUnit");

-- CreateIndex
CREATE INDEX "Estimate_currentVersion_idx" ON "Estimate"("currentVersion");

-- CreateIndex
CREATE INDEX "Estimate_soldVersion_idx" ON "Estimate"("soldVersion");

-- CreateIndex
CREATE INDEX "Estimate_presentedBy_idx" ON "Estimate"("presentedBy");

-- CreateIndex
CREATE INDEX "Estimate_createdBy_idx" ON "Estimate"("createdBy");

-- CreateIndex
CREATE INDEX "Estimate_createdByAgent_idx" ON "Estimate"("createdByAgent");

-- CreateIndex
CREATE INDEX "EstimateLine_option_idx" ON "EstimateLine"("option");

-- CreateIndex
CREATE INDEX "EstimateLine_pricebookItem_idx" ON "EstimateLine"("pricebookItem");

-- CreateIndex
CREATE INDEX "EstimateOption_estimateVersion_idx" ON "EstimateOption"("estimateVersion");

-- CreateIndex
CREATE INDEX "EstimateVersion_estimate_idx" ON "EstimateVersion"("estimate");

-- CreateIndex
CREATE INDEX "EstimateVersion_priceBookVersion_idx" ON "EstimateVersion"("priceBookVersion");

-- CreateIndex
CREATE INDEX "EstimateVersion_supersedes_idx" ON "EstimateVersion"("supersedes");

-- CreateIndex
CREATE INDEX "EstimateVersion_discountApproval_idx" ON "EstimateVersion"("discountApproval");

-- CreateIndex
CREATE INDEX "EstimateVersion_presentedBy_idx" ON "EstimateVersion"("presentedBy");

-- CreateIndex
CREATE INDEX "EstimateVersion_pdf_idx" ON "EstimateVersion"("pdf");

-- CreateIndex
CREATE INDEX "EstimateVersion_soldOption_idx" ON "EstimateVersion"("soldOption");

-- CreateIndex
CREATE INDEX "EstimateVersion_authorization_idx" ON "EstimateVersion"("authorization");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateVersion_estimate_number_key" ON "EstimateVersion"("estimate", "versionNumber");

-- CreateIndex
CREATE INDEX "LaborRate_priceBookVersion_idx" ON "LaborRate"("priceBookVersion");

-- CreateIndex
CREATE INDEX "LaborRate_businessUnit_idx" ON "LaborRate"("businessUnit");

-- CreateIndex
CREATE INDEX "MarkupTable_priceBookVersion_idx" ON "MarkupTable"("priceBookVersion");

-- CreateIndex
CREATE INDEX "MemberPricingRule_priceBookVersion_idx" ON "MemberPricingRule"("priceBookVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBook_code_key" ON "PriceBook"("code");

-- CreateIndex
CREATE INDEX "PriceBook_activeVersion_idx" ON "PriceBook"("activeVersion");

-- CreateIndex
CREATE INDEX "PriceBookCategory_priceBookVersion_idx" ON "PriceBookCategory"("priceBookVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookCategory_version_key_key" ON "PriceBookCategory"("priceBookVersion", "categoryKey");

-- CreateIndex
CREATE INDEX "PriceBookItem_priceBookVersion_idx" ON "PriceBookItem"("priceBookVersion");

-- CreateIndex
CREATE INDEX "PriceBookItem_itemKey_idx" ON "PriceBookItem"("itemKey");

-- CreateIndex
CREATE INDEX "PriceBookItem_businessUnit_idx" ON "PriceBookItem"("businessUnit");

-- CreateIndex
CREATE INDEX "PriceBookItem_equipmentModel_idx" ON "PriceBookItem"("equipmentModel");

-- CreateIndex
CREATE INDEX "PriceBookItem_ladderKey_idx" ON "PriceBookItem"("ladderKey");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookItem_version_key_key" ON "PriceBookItem"("priceBookVersion", "itemKey");

-- CreateIndex
CREATE INDEX "PriceBookVersion_priceBook_idx" ON "PriceBookVersion"("priceBook");

-- CreateIndex
CREATE INDEX "PriceBookVersion_basedOn_idx" ON "PriceBookVersion"("basedOn");

-- CreateIndex
CREATE INDEX "PriceBookVersion_approval_idx" ON "PriceBookVersion"("approval");

-- CreateIndex
CREATE INDEX "PriceBookVersion_submittedBy_idx" ON "PriceBookVersion"("submittedBy");

-- CreateIndex
CREATE INDEX "PriceBookVersion_publishedBy_idx" ON "PriceBookVersion"("publishedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookVersion_book_number_key" ON "PriceBookVersion"("priceBook", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE INDEX "_PriceBook_businessUnits_B_index" ON "_PriceBook_businessUnits"("B");

-- CreateIndex
CREATE INDEX "_CancellationNotice_coveredWorkLines_B_index" ON "_CancellationNotice_coveredWorkLines"("B");

-- AddForeignKey
ALTER TABLE "WorkLine" ADD CONSTRAINT "WorkLine_estimateLine_fkey" FOREIGN KEY ("estimateLine") REFERENCES "EstimateLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLine" ADD CONSTRAINT "WorkLine_changeOrder_fkey" FOREIGN KEY ("changeOrder") REFERENCES "ChangeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_signerContact_fkey" FOREIGN KEY ("signerContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_call_fkey" FOREIGN KEY ("call") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvaluation" ADD CONSTRAINT "CancellationEvaluation_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvaluation" ADD CONSTRAINT "CancellationEvaluation_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "Authorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvaluation" ADD CONSTRAINT "CancellationEvaluation_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_evaluation_fkey" FOREIGN KEY ("evaluation") REFERENCES "CancellationEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_estimateVersion_fkey" FOREIGN KEY ("estimateVersion") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_changeOrder_fkey" FOREIGN KEY ("changeOrder") REFERENCES "ChangeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_noticeDocument_fkey" FOREIGN KEY ("noticeDocument") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_waiverDocument_fkey" FOREIGN KEY ("waiverDocument") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_startOverride_fkey" FOREIGN KEY ("startOverride") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_estimate_fkey" FOREIGN KEY ("estimate") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "Authorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_cancellationEvaluation_fkey" FOREIGN KEY ("cancellationEvaluation") REFERENCES "CancellationEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_opportunity_fkey" FOREIGN KEY ("opportunity") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_currentVersion_fkey" FOREIGN KEY ("currentVersion") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_soldVersion_fkey" FOREIGN KEY ("soldVersion") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_presentedBy_fkey" FOREIGN KEY ("presentedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdByAgent_fkey" FOREIGN KEY ("createdByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_option_fkey" FOREIGN KEY ("option") REFERENCES "EstimateOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_pricebookItem_fkey" FOREIGN KEY ("pricebookItem") REFERENCES "PriceBookItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateOption" ADD CONSTRAINT "EstimateOption_estimateVersion_fkey" FOREIGN KEY ("estimateVersion") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_estimate_fkey" FOREIGN KEY ("estimate") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_discountApproval_fkey" FOREIGN KEY ("discountApproval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_presentedBy_fkey" FOREIGN KEY ("presentedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_pdf_fkey" FOREIGN KEY ("pdf") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_soldOption_fkey" FOREIGN KEY ("soldOption") REFERENCES "EstimateOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "Authorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkupTable" ADD CONSTRAINT "MarkupTable_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPricingRule" ADD CONSTRAINT "MemberPricingRule_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBook" ADD CONSTRAINT "PriceBook_activeVersion_fkey" FOREIGN KEY ("activeVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookCategory" ADD CONSTRAINT "PriceBookCategory_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_priceBookVersion_fkey" FOREIGN KEY ("priceBookVersion") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_equipmentModel_fkey" FOREIGN KEY ("equipmentModel") REFERENCES "EquipmentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_priceBook_fkey" FOREIGN KEY ("priceBook") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_basedOn_fkey" FOREIGN KEY ("basedOn") REFERENCES "PriceBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PriceBook_businessUnits" ADD CONSTRAINT "_PriceBook_businessUnits_A_fkey" FOREIGN KEY ("A") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PriceBook_businessUnits" ADD CONSTRAINT "_PriceBook_businessUnits_B_fkey" FOREIGN KEY ("B") REFERENCES "PriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CancellationNotice_coveredWorkLines" ADD CONSTRAINT "_CancellationNotice_coveredWorkLines_A_fkey" FOREIGN KEY ("A") REFERENCES "CancellationNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CancellationNotice_coveredWorkLines" ADD CONSTRAINT "_CancellationNotice_coveredWorkLines_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
