-- CreateTable
CREATE TABLE "EquipmentReading" (
    "id" TEXT NOT NULL,
    "equipment" TEXT,
    "visit" TEXT,
    "kind" TEXT NOT NULL DEFAULT '',
    "value" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeWarrantyDispatch" (
    "id" TEXT NOT NULL,
    "payer" TEXT,
    "externalDispatchNumber" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "serviceFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "authorizedMinor" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'dispatch_received',
    "authorization" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeWarrantyDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalledEquipment" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "model" TEXT,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "modelNumber" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "applianceClass" TEXT NOT NULL DEFAULT 'residential_ac',
    "tonnage" DECIMAL(18,4),
    "btuh" INTEGER,
    "refrigerantType" TEXT NOT NULL DEFAULT '',
    "refrigerantChargeLb" DECIMAL(18,4),
    "manufactureDate" DATE,
    "installDate" DATE,
    "installedBy" TEXT,
    "serializedUnit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "replacedBy" TEXT,
    "locationInHome" TEXT NOT NULL DEFAULT '',
    "nameplatePhoto" TEXT,
    "source" TEXT NOT NULL DEFAULT 'recorded_on_visit',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstalledEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "equipment" TEXT,
    "rule" TEXT,
    "claimant" TEXT NOT NULL DEFAULT 'manufacturer',
    "distributor" TEXT,
    "failedPart" TEXT NOT NULL DEFAULT '',
    "failureDate" DATE,
    "replacementItem" TEXT,
    "replacementSerial" TEXT NOT NULL DEFAULT '',
    "laborHours" DECIMAL(18,4),
    "claimedMinor" BIGINT NOT NULL DEFAULT 0,
    "recoveredMinor" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "externalClaimNumber" TEXT NOT NULL DEFAULT '',
    "rma" TEXT,
    "draftedBy" TEXT,
    "draftedByAgent" TEXT,
    "submittedBy" TEXT,
    "deadline" DATE,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyCoverage" (
    "id" TEXT NOT NULL,
    "equipment" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'manufacturer_parts',
    "startsOn" DATE,
    "endsOn" DATE,
    "provider" TEXT NOT NULL DEFAULT '',
    "contractNumber" TEXT NOT NULL DEFAULT '',
    "document" TEXT,
    "registration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyRegistration" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT,
    "rule" TEXT,
    "deadline" DATE,
    "status" TEXT NOT NULL DEFAULT 'due',
    "confirmationNumber" TEXT NOT NULL DEFAULT '',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "overdueSince" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyRule" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "registrationDeadlineDays" INTEGER NOT NULL DEFAULT 90,
    "partsYearsRegistered" INTEGER NOT NULL DEFAULT 10,
    "partsYearsUnregistered" INTEGER NOT NULL DEFAULT 5,
    "laborYears" INTEGER NOT NULL DEFAULT 1,
    "claimDeadlineDays" INTEGER NOT NULL DEFAULT 60,
    "submitMethod" TEXT NOT NULL DEFAULT 'manual_portal',
    "portalUrl" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCount" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "lines" JSONB,
    "varianceMinor" BIGINT NOT NULL DEFAULT 0,
    "approval" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'part',
    "trackSerial" BOOLEAN NOT NULL DEFAULT false,
    "trackLot" BOOLEAN NOT NULL DEFAULT false,
    "baseUom" TEXT,
    "defaultSupplier" TEXT,
    "standardCostMinor" BIGINT NOT NULL DEFAULT 0,
    "pricebookItemKeys" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemUomConversion" (
    "id" TEXT NOT NULL,
    "item" TEXT,
    "fromUom" TEXT,
    "toUom" TEXT,
    "factor" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemUomConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinMaxRule" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "item" TEXT,
    "min" DECIMAL(18,4) NOT NULL,
    "max" DECIMAL(18,4) NOT NULL,
    "reorderFrom" TEXT,
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinMaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "shipTo" TEXT,
    "job" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "approval" TEXT,
    "externalOrderNumber" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "po" TEXT,
    "item" TEXT,
    "supplierSku" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" TEXT,
    "unitCostMinor" BIGINT NOT NULL DEFAULT 0,
    "receivedQuantity" DECIMAL(18,4),
    "job" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "po" TEXT,
    "lines" JSONB,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "packingSlip" TEXT,
    "overReceiptApproval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "lines" JSONB,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "proposedBy" TEXT NOT NULL DEFAULT '',
    "purchaseOrder" TEXT,
    "transferGroup" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rma" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "warrantyClaim" TEXT,
    "lines" JSONB,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerializedUnit" (
    "id" TEXT NOT NULL,
    "item" TEXT,
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "location" TEXT,
    "installedEquipment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerializedUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "item" TEXT,
    "onHand" DECIMAL(18,4),
    "reserved" DECIMAL(18,4),
    "negativeSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'warehouse',
    "branch" TEXT,
    "employee" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'adjust',
    "item" TEXT,
    "location" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" TEXT,
    "baseQuantity" DECIMAL(18,4) NOT NULL,
    "unitCostMinor" BIGINT NOT NULL DEFAULT 0,
    "job" TEXT,
    "workLine" TEXT,
    "receipt" TEXT,
    "transferGroup" TEXT NOT NULL DEFAULT '',
    "serializedUnit" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "reverses" TEXT,
    "actor" TEXT,
    "occurredAt" TIMESTAMP(3),
    "clientRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "item" TEXT,
    "location" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "job" TEXT,
    "workLine" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'supply_house',
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "branchContact" TEXT NOT NULL DEFAULT '',
    "orderMethod" TEXT NOT NULL DEFAULT 'phone',
    "adapterKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierItem" (
    "id" TEXT NOT NULL,
    "supplier" TEXT,
    "item" TEXT,
    "supplierSku" TEXT NOT NULL DEFAULT '',
    "costMinor" BIGINT NOT NULL DEFAULT 0,
    "uom" TEXT,
    "effectiveOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "supplier" TEXT,
    "po" TEXT,
    "billNumber" TEXT NOT NULL DEFAULT '',
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchDetail" JSONB,
    "approval" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "permit" TEXT,
    "kind" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "scheduledFor" TIMESTAMP(3),
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "correctionsVisit" TEXT,
    "report" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeakRateEvaluation" (
    "id" TEXT NOT NULL,
    "equipment" TEXT,
    "chargeLb" DECIMAL(18,4),
    "addedLb" DECIMAL(18,4),
    "leakRatePct" DECIMAL(12,6),
    "threshold" DECIMAL(12,6),
    "status" TEXT NOT NULL DEFAULT 'open',
    "repairDueBy" DATE,
    "policyVersion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeakRateEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LienTrack" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "job" TEXT,
    "policyVersion" TEXT,
    "completionMonth" DATE,
    "noticeDueOn" DATE,
    "affidavitDueOn" DATE,
    "status" TEXT NOT NULL DEFAULT 'monitoring',
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LienTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "ahj" TEXT NOT NULL DEFAULT '',
    "permitType" TEXT NOT NULL DEFAULT '',
    "externalNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'needed',
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "appliedOn" DATE,
    "issuedOn" DATE,
    "expiresOn" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefrigerantCylinder" (
    "id" TEXT NOT NULL,
    "item" TEXT,
    "serialOrTag" TEXT NOT NULL DEFAULT '',
    "refrigerantType" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'virgin',
    "location" TEXT,
    "tareLb" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'in_service',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefrigerantCylinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefrigerantInstallCheck" (
    "id" TEXT NOT NULL,
    "workLine" TEXT,
    "equipmentModel" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'sold',
    "policyVersion" TEXT,
    "result" TEXT NOT NULL DEFAULT 'allowed',
    "findings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefrigerantInstallCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefrigerantLogEntry" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'charge',
    "equipment" TEXT,
    "job" TEXT,
    "cylinder" TEXT,
    "refrigerantType" TEXT NOT NULL DEFAULT '',
    "quantityLb" DECIMAL(18,4) NOT NULL,
    "technician" TEXT,
    "credential" TEXT,
    "occurredAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefrigerantLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LienTrack_documents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LienTrack_documents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Permit_documents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Permit_documents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_WarrantyClaim_evidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_WarrantyClaim_evidence_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "EquipmentReading_equipment_idx" ON "EquipmentReading"("equipment");

-- CreateIndex
CREATE INDEX "EquipmentReading_visit_idx" ON "EquipmentReading"("visit");

-- CreateIndex
CREATE INDEX "EquipmentReading_recordedBy_idx" ON "EquipmentReading"("recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "HomeWarrantyDispatch_externalDispatchNumber_key" ON "HomeWarrantyDispatch"("externalDispatchNumber");

-- CreateIndex
CREATE INDEX "HomeWarrantyDispatch_payer_idx" ON "HomeWarrantyDispatch"("payer");

-- CreateIndex
CREATE INDEX "HomeWarrantyDispatch_job_idx" ON "HomeWarrantyDispatch"("job");

-- CreateIndex
CREATE INDEX "HomeWarrantyDispatch_authorization_idx" ON "HomeWarrantyDispatch"("authorization");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledEquipment_ref_key" ON "InstalledEquipment"("ref");

-- CreateIndex
CREATE INDEX "InstalledEquipment_location_idx" ON "InstalledEquipment"("location");

-- CreateIndex
CREATE INDEX "InstalledEquipment_model_idx" ON "InstalledEquipment"("model");

-- CreateIndex
CREATE INDEX "InstalledEquipment_serialNumber_idx" ON "InstalledEquipment"("serialNumber");

-- CreateIndex
CREATE INDEX "InstalledEquipment_installedBy_idx" ON "InstalledEquipment"("installedBy");

-- CreateIndex
CREATE INDEX "InstalledEquipment_serializedUnit_idx" ON "InstalledEquipment"("serializedUnit");

-- CreateIndex
CREATE INDEX "InstalledEquipment_replacedBy_idx" ON "InstalledEquipment"("replacedBy");

-- CreateIndex
CREATE INDEX "InstalledEquipment_nameplatePhoto_idx" ON "InstalledEquipment"("nameplatePhoto");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_ref_key" ON "WarrantyClaim"("ref");

-- CreateIndex
CREATE INDEX "WarrantyClaim_job_idx" ON "WarrantyClaim"("job");

-- CreateIndex
CREATE INDEX "WarrantyClaim_equipment_idx" ON "WarrantyClaim"("equipment");

-- CreateIndex
CREATE INDEX "WarrantyClaim_rule_idx" ON "WarrantyClaim"("rule");

-- CreateIndex
CREATE INDEX "WarrantyClaim_distributor_idx" ON "WarrantyClaim"("distributor");

-- CreateIndex
CREATE INDEX "WarrantyClaim_replacementItem_idx" ON "WarrantyClaim"("replacementItem");

-- CreateIndex
CREATE INDEX "WarrantyClaim_rma_idx" ON "WarrantyClaim"("rma");

-- CreateIndex
CREATE INDEX "WarrantyClaim_draftedBy_idx" ON "WarrantyClaim"("draftedBy");

-- CreateIndex
CREATE INDEX "WarrantyClaim_draftedByAgent_idx" ON "WarrantyClaim"("draftedByAgent");

-- CreateIndex
CREATE INDEX "WarrantyClaim_submittedBy_idx" ON "WarrantyClaim"("submittedBy");

-- CreateIndex
CREATE INDEX "WarrantyCoverage_equipment_idx" ON "WarrantyCoverage"("equipment");

-- CreateIndex
CREATE INDEX "WarrantyCoverage_document_idx" ON "WarrantyCoverage"("document");

-- CreateIndex
CREATE INDEX "WarrantyCoverage_registration_idx" ON "WarrantyCoverage"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyRegistration_ref_key" ON "WarrantyRegistration"("ref");

-- CreateIndex
CREATE INDEX "WarrantyRegistration_equipment_idx" ON "WarrantyRegistration"("equipment");

-- CreateIndex
CREATE INDEX "WarrantyRegistration_rule_idx" ON "WarrantyRegistration"("rule");

-- CreateIndex
CREATE INDEX "WarrantyRegistration_submittedBy_idx" ON "WarrantyRegistration"("submittedBy");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyRule_manufacturer_key" ON "WarrantyRule"("manufacturer");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_ref_key" ON "CycleCount"("ref");

-- CreateIndex
CREATE INDEX "CycleCount_location_idx" ON "CycleCount"("location");

-- CreateIndex
CREATE INDEX "CycleCount_approval_idx" ON "CycleCount"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");

-- CreateIndex
CREATE INDEX "Item_baseUom_idx" ON "Item"("baseUom");

-- CreateIndex
CREATE INDEX "Item_defaultSupplier_idx" ON "Item"("defaultSupplier");

-- CreateIndex
CREATE INDEX "ItemUomConversion_item_idx" ON "ItemUomConversion"("item");

-- CreateIndex
CREATE INDEX "ItemUomConversion_fromUom_idx" ON "ItemUomConversion"("fromUom");

-- CreateIndex
CREATE INDEX "ItemUomConversion_toUom_idx" ON "ItemUomConversion"("toUom");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUomConversion_item_from_to_key" ON "ItemUomConversion"("item", "fromUom", "toUom");

-- CreateIndex
CREATE INDEX "MinMaxRule_location_idx" ON "MinMaxRule"("location");

-- CreateIndex
CREATE INDEX "MinMaxRule_item_idx" ON "MinMaxRule"("item");

-- CreateIndex
CREATE INDEX "MinMaxRule_reorderFrom_idx" ON "MinMaxRule"("reorderFrom");

-- CreateIndex
CREATE INDEX "MinMaxRule_supplier_idx" ON "MinMaxRule"("supplier");

-- CreateIndex
CREATE UNIQUE INDEX "MinMaxRule_location_item_key" ON "MinMaxRule"("location", "item");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_ref_key" ON "PurchaseOrder"("ref");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplier_idx" ON "PurchaseOrder"("supplier");

-- CreateIndex
CREATE INDEX "PurchaseOrder_shipTo_idx" ON "PurchaseOrder"("shipTo");

-- CreateIndex
CREATE INDEX "PurchaseOrder_job_idx" ON "PurchaseOrder"("job");

-- CreateIndex
CREATE INDEX "PurchaseOrder_approval_idx" ON "PurchaseOrder"("approval");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_po_idx" ON "PurchaseOrderLine"("po");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_item_idx" ON "PurchaseOrderLine"("item");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_uom_idx" ON "PurchaseOrderLine"("uom");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_job_idx" ON "PurchaseOrderLine"("job");

-- CreateIndex
CREATE INDEX "Receipt_po_idx" ON "Receipt"("po");

-- CreateIndex
CREATE INDEX "Receipt_receivedBy_idx" ON "Receipt"("receivedBy");

-- CreateIndex
CREATE INDEX "Receipt_packingSlip_idx" ON "Receipt"("packingSlip");

-- CreateIndex
CREATE INDEX "Receipt_overReceiptApproval_idx" ON "Receipt"("overReceiptApproval");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentRequest_ref_key" ON "ReplenishmentRequest"("ref");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_location_idx" ON "ReplenishmentRequest"("location");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_purchaseOrder_idx" ON "ReplenishmentRequest"("purchaseOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Rma_ref_key" ON "Rma"("ref");

-- CreateIndex
CREATE INDEX "Rma_supplier_idx" ON "Rma"("supplier");

-- CreateIndex
CREATE INDEX "Rma_warrantyClaim_idx" ON "Rma"("warrantyClaim");

-- CreateIndex
CREATE INDEX "SerializedUnit_item_idx" ON "SerializedUnit"("item");

-- CreateIndex
CREATE INDEX "SerializedUnit_location_idx" ON "SerializedUnit"("location");

-- CreateIndex
CREATE INDEX "SerializedUnit_installedEquipment_idx" ON "SerializedUnit"("installedEquipment");

-- CreateIndex
CREATE UNIQUE INDEX "SerializedUnit_item_serial_key" ON "SerializedUnit"("item", "serialNumber");

-- CreateIndex
CREATE INDEX "StockLevel_location_idx" ON "StockLevel"("location");

-- CreateIndex
CREATE INDEX "StockLevel_item_idx" ON "StockLevel"("item");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_location_item_key" ON "StockLevel"("location", "item");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_code_key" ON "StockLocation"("code");

-- CreateIndex
CREATE INDEX "StockLocation_branch_idx" ON "StockLocation"("branch");

-- CreateIndex
CREATE INDEX "StockLocation_employee_idx" ON "StockLocation"("employee");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockMovement_item_idx" ON "StockMovement"("item");

-- CreateIndex
CREATE INDEX "StockMovement_location_idx" ON "StockMovement"("location");

-- CreateIndex
CREATE INDEX "StockMovement_uom_idx" ON "StockMovement"("uom");

-- CreateIndex
CREATE INDEX "StockMovement_job_idx" ON "StockMovement"("job");

-- CreateIndex
CREATE INDEX "StockMovement_workLine_idx" ON "StockMovement"("workLine");

-- CreateIndex
CREATE INDEX "StockMovement_receipt_idx" ON "StockMovement"("receipt");

-- CreateIndex
CREATE INDEX "StockMovement_transferGroup_idx" ON "StockMovement"("transferGroup");

-- CreateIndex
CREATE INDEX "StockMovement_serializedUnit_idx" ON "StockMovement"("serializedUnit");

-- CreateIndex
CREATE INDEX "StockMovement_reverses_idx" ON "StockMovement"("reverses");

-- CreateIndex
CREATE INDEX "StockMovement_actor_idx" ON "StockMovement"("actor");

-- CreateIndex
CREATE INDEX "StockReservation_item_idx" ON "StockReservation"("item");

-- CreateIndex
CREATE INDEX "StockReservation_location_idx" ON "StockReservation"("location");

-- CreateIndex
CREATE INDEX "StockReservation_job_idx" ON "StockReservation"("job");

-- CreateIndex
CREATE INDEX "StockReservation_workLine_idx" ON "StockReservation"("workLine");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "SupplierItem_supplier_idx" ON "SupplierItem"("supplier");

-- CreateIndex
CREATE INDEX "SupplierItem_item_idx" ON "SupplierItem"("item");

-- CreateIndex
CREATE INDEX "SupplierItem_uom_idx" ON "SupplierItem"("uom");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierItem_supplier_sku_key" ON "SupplierItem"("supplier", "supplierSku");

-- CreateIndex
CREATE INDEX "VendorBill_supplier_idx" ON "VendorBill"("supplier");

-- CreateIndex
CREATE INDEX "VendorBill_po_idx" ON "VendorBill"("po");

-- CreateIndex
CREATE INDEX "VendorBill_approval_idx" ON "VendorBill"("approval");

-- CreateIndex
CREATE INDEX "Inspection_permit_idx" ON "Inspection"("permit");

-- CreateIndex
CREATE INDEX "Inspection_correctionsVisit_idx" ON "Inspection"("correctionsVisit");

-- CreateIndex
CREATE INDEX "Inspection_report_idx" ON "Inspection"("report");

-- CreateIndex
CREATE INDEX "LeakRateEvaluation_equipment_idx" ON "LeakRateEvaluation"("equipment");

-- CreateIndex
CREATE INDEX "LeakRateEvaluation_policyVersion_idx" ON "LeakRateEvaluation"("policyVersion");

-- CreateIndex
CREATE INDEX "LienTrack_invoice_idx" ON "LienTrack"("invoice");

-- CreateIndex
CREATE INDEX "LienTrack_job_idx" ON "LienTrack"("job");

-- CreateIndex
CREATE INDEX "LienTrack_policyVersion_idx" ON "LienTrack"("policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_ref_key" ON "Permit"("ref");

-- CreateIndex
CREATE INDEX "Permit_job_idx" ON "Permit"("job");

-- CreateIndex
CREATE UNIQUE INDEX "RefrigerantCylinder_serialOrTag_key" ON "RefrigerantCylinder"("serialOrTag");

-- CreateIndex
CREATE INDEX "RefrigerantCylinder_item_idx" ON "RefrigerantCylinder"("item");

-- CreateIndex
CREATE INDEX "RefrigerantCylinder_location_idx" ON "RefrigerantCylinder"("location");

-- CreateIndex
CREATE INDEX "RefrigerantInstallCheck_workLine_idx" ON "RefrigerantInstallCheck"("workLine");

-- CreateIndex
CREATE INDEX "RefrigerantInstallCheck_equipmentModel_idx" ON "RefrigerantInstallCheck"("equipmentModel");

-- CreateIndex
CREATE INDEX "RefrigerantInstallCheck_policyVersion_idx" ON "RefrigerantInstallCheck"("policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RefrigerantLogEntry_idempotencyKey_key" ON "RefrigerantLogEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RefrigerantLogEntry_equipment_idx" ON "RefrigerantLogEntry"("equipment");

-- CreateIndex
CREATE INDEX "RefrigerantLogEntry_job_idx" ON "RefrigerantLogEntry"("job");

-- CreateIndex
CREATE INDEX "RefrigerantLogEntry_cylinder_idx" ON "RefrigerantLogEntry"("cylinder");

-- CreateIndex
CREATE INDEX "RefrigerantLogEntry_technician_idx" ON "RefrigerantLogEntry"("technician");

-- CreateIndex
CREATE INDEX "RefrigerantLogEntry_credential_idx" ON "RefrigerantLogEntry"("credential");

-- CreateIndex
CREATE INDEX "_LienTrack_documents_B_index" ON "_LienTrack_documents"("B");

-- CreateIndex
CREATE INDEX "_Permit_documents_B_index" ON "_Permit_documents"("B");

-- CreateIndex
CREATE INDEX "_WarrantyClaim_evidence_B_index" ON "_WarrantyClaim_evidence"("B");

-- AddForeignKey
ALTER TABLE "EquipmentReading" ADD CONSTRAINT "EquipmentReading_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReading" ADD CONSTRAINT "EquipmentReading_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReading" ADD CONSTRAINT "EquipmentReading_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeWarrantyDispatch" ADD CONSTRAINT "HomeWarrantyDispatch_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeWarrantyDispatch" ADD CONSTRAINT "HomeWarrantyDispatch_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeWarrantyDispatch" ADD CONSTRAINT "HomeWarrantyDispatch_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "ThirdPartyAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_model_fkey" FOREIGN KEY ("model") REFERENCES "EquipmentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_installedBy_fkey" FOREIGN KEY ("installedBy") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_serializedUnit_fkey" FOREIGN KEY ("serializedUnit") REFERENCES "SerializedUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_replacedBy_fkey" FOREIGN KEY ("replacedBy") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_nameplatePhoto_fkey" FOREIGN KEY ("nameplatePhoto") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_rule_fkey" FOREIGN KEY ("rule") REFERENCES "WarrantyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_distributor_fkey" FOREIGN KEY ("distributor") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_replacementItem_fkey" FOREIGN KEY ("replacementItem") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_rma_fkey" FOREIGN KEY ("rma") REFERENCES "Rma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_draftedBy_fkey" FOREIGN KEY ("draftedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_draftedByAgent_fkey" FOREIGN KEY ("draftedByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCoverage" ADD CONSTRAINT "WarrantyCoverage_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCoverage" ADD CONSTRAINT "WarrantyCoverage_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCoverage" ADD CONSTRAINT "WarrantyCoverage_registration_fkey" FOREIGN KEY ("registration") REFERENCES "WarrantyRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_rule_fkey" FOREIGN KEY ("rule") REFERENCES "WarrantyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_baseUom_fkey" FOREIGN KEY ("baseUom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_defaultSupplier_fkey" FOREIGN KEY ("defaultSupplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUomConversion" ADD CONSTRAINT "ItemUomConversion_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUomConversion" ADD CONSTRAINT "ItemUomConversion_fromUom_fkey" FOREIGN KEY ("fromUom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUomConversion" ADD CONSTRAINT "ItemUomConversion_toUom_fkey" FOREIGN KEY ("toUom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinMaxRule" ADD CONSTRAINT "MinMaxRule_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinMaxRule" ADD CONSTRAINT "MinMaxRule_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinMaxRule" ADD CONSTRAINT "MinMaxRule_reorderFrom_fkey" FOREIGN KEY ("reorderFrom") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinMaxRule" ADD CONSTRAINT "MinMaxRule_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_shipTo_fkey" FOREIGN KEY ("shipTo") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_po_fkey" FOREIGN KEY ("po") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_uom_fkey" FOREIGN KEY ("uom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_po_fkey" FOREIGN KEY ("po") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_packingSlip_fkey" FOREIGN KEY ("packingSlip") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_overReceiptApproval_fkey" FOREIGN KEY ("overReceiptApproval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_warrantyClaim_fkey" FOREIGN KEY ("warrantyClaim") REFERENCES "WarrantyClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_installedEquipment_fkey" FOREIGN KEY ("installedEquipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_uom_fkey" FOREIGN KEY ("uom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workLine_fkey" FOREIGN KEY ("workLine") REFERENCES "WorkLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_receipt_fkey" FOREIGN KEY ("receipt") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serializedUnit_fkey" FOREIGN KEY ("serializedUnit") REFERENCES "SerializedUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reverses_fkey" FOREIGN KEY ("reverses") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_workLine_fkey" FOREIGN KEY ("workLine") REFERENCES "WorkLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_uom_fkey" FOREIGN KEY ("uom") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_po_fkey" FOREIGN KEY ("po") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_permit_fkey" FOREIGN KEY ("permit") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_correctionsVisit_fkey" FOREIGN KEY ("correctionsVisit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_report_fkey" FOREIGN KEY ("report") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakRateEvaluation" ADD CONSTRAINT "LeakRateEvaluation_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakRateEvaluation" ADD CONSTRAINT "LeakRateEvaluation_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienTrack" ADD CONSTRAINT "LienTrack_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienTrack" ADD CONSTRAINT "LienTrack_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienTrack" ADD CONSTRAINT "LienTrack_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantCylinder" ADD CONSTRAINT "RefrigerantCylinder_item_fkey" FOREIGN KEY ("item") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantCylinder" ADD CONSTRAINT "RefrigerantCylinder_location_fkey" FOREIGN KEY ("location") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantInstallCheck" ADD CONSTRAINT "RefrigerantInstallCheck_workLine_fkey" FOREIGN KEY ("workLine") REFERENCES "WorkLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantInstallCheck" ADD CONSTRAINT "RefrigerantInstallCheck_equipmentModel_fkey" FOREIGN KEY ("equipmentModel") REFERENCES "EquipmentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantInstallCheck" ADD CONSTRAINT "RefrigerantInstallCheck_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_equipment_fkey" FOREIGN KEY ("equipment") REFERENCES "InstalledEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_cylinder_fkey" FOREIGN KEY ("cylinder") REFERENCES "RefrigerantCylinder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_technician_fkey" FOREIGN KEY ("technician") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_credential_fkey" FOREIGN KEY ("credential") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LienTrack_documents" ADD CONSTRAINT "_LienTrack_documents_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LienTrack_documents" ADD CONSTRAINT "_LienTrack_documents_B_fkey" FOREIGN KEY ("B") REFERENCES "LienTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Permit_documents" ADD CONSTRAINT "_Permit_documents_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Permit_documents" ADD CONSTRAINT "_Permit_documents_B_fkey" FOREIGN KEY ("B") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WarrantyClaim_evidence" ADD CONSTRAINT "_WarrantyClaim_evidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WarrantyClaim_evidence" ADD CONSTRAINT "_WarrantyClaim_evidence_B_fkey" FOREIGN KEY ("B") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ Phase 5 guards ═════════════════════════════════════════════════════════════════════════════════════════════
-- Facts are never edited: readings, stock movements, receipts, refrigerant entries and install checks.
CREATE TRIGGER "EquipmentReading_append_only" BEFORE UPDATE OR DELETE ON "EquipmentReading" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "EquipmentReading_no_truncate" BEFORE TRUNCATE ON "EquipmentReading" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "StockMovement_append_only" BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "StockMovement_no_truncate" BEFORE TRUNCATE ON "StockMovement" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Receipt_append_only" BEFORE UPDATE OR DELETE ON "Receipt" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Receipt_no_truncate" BEFORE TRUNCATE ON "Receipt" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "RefrigerantLogEntry_append_only" BEFORE UPDATE OR DELETE ON "RefrigerantLogEntry" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "RefrigerantLogEntry_no_truncate" BEFORE TRUNCATE ON "RefrigerantLogEntry" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "RefrigerantInstallCheck_append_only" BEFORE UPDATE OR DELETE ON "RefrigerantInstallCheck" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "RefrigerantInstallCheck_no_truncate" BEFORE TRUNCATE ON "RefrigerantInstallCheck" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- Records that other records stand on are never deleted.
CREATE OR REPLACE FUNCTION hs_p5_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "InstalledEquipment_no_delete" BEFORE DELETE ON "InstalledEquipment" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "WarrantyRegistration_no_delete" BEFORE DELETE ON "WarrantyRegistration" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "WarrantyClaim_no_delete" BEFORE DELETE ON "WarrantyClaim" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "PurchaseOrder_no_delete" BEFORE DELETE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "Permit_no_delete" BEFORE DELETE ON "Permit" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "Inspection_no_delete" BEFORE DELETE ON "Inspection" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "LienTrack_no_delete" BEFORE DELETE ON "LienTrack" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "SerializedUnit_no_delete" BEFORE DELETE ON "SerializedUnit" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();
CREATE TRIGGER "RefrigerantCylinder_no_delete" BEFORE DELETE ON "RefrigerantCylinder" FOR EACH ROW EXECUTE FUNCTION hs_p5_no_delete();

-- An overdue registration never disappears (I-W1): it leaves the overdue state only by being submitted, then confirmed.
CREATE OR REPLACE FUNCTION hs_registration_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'overdue' AND NEW.status NOT IN ('overdue', 'submitted', 'confirmed') THEN
    RAISE EXCEPTION 'An overdue warranty registration is closed only by submitting it' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'A confirmed warranty registration does not go back' USING ERRCODE = 'check_violation';
  END IF;
  IF (OLD.equipment, OLD.ref) IS DISTINCT FROM (NEW.equipment, NEW.ref) THEN
    RAISE EXCEPTION 'A registration keeps its equipment' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "WarrantyRegistration_guard" BEFORE UPDATE ON "WarrantyRegistration" FOR EACH ROW EXECUTE FUNCTION hs_registration_guard();

-- I-W2: a claim never recovers more than it claimed, and neither is negative.
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_recovered_within_claimed" CHECK ("recoveredMinor" >= 0 AND "claimedMinor" >= 0 AND "recoveredMinor" <= "claimedMinor");

-- Quantities that mean something.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_nonzero" CHECK ("quantity" <> 0 AND "baseQuantity" <> 0 AND SIGN("quantity") = SIGN("baseQuantity"));
ALTER TABLE "RefrigerantLogEntry" ADD CONSTRAINT "RefrigerantLogEntry_quantity_positive" CHECK ("quantityLb" > 0);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_quantity_positive" CHECK ("quantity" > 0 AND COALESCE("receivedQuantity", 0) >= 0);
ALTER TABLE "MinMaxRule" ADD CONSTRAINT "MinMaxRule_min_max" CHECK ("min" >= 0 AND "max" >= "min");

-- Stock = sum of movements (I-S1). The cache row is maintained here, in the movement's own transaction, under the row lock the
-- upsert takes, so two consumers of one truck item take turns and the level can never drift from the ledger.
CREATE OR REPLACE FUNCTION hs_apply_stock_movement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE level numeric;
BEGIN
  IF NEW."location" IS NULL OR NEW."item" IS NULL THEN
    RAISE EXCEPTION 'A stock movement needs an item and a location' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO "StockLevel" ("id", "location", "item", "onHand", "reserved", "createdAt", "updatedAt")
  VALUES ('sl_' || md5(NEW."location" || ':' || NEW."item"), NEW."location", NEW."item", NEW."baseQuantity", 0, now(), now())
  ON CONFLICT ("location", "item") DO UPDATE SET "onHand" = "StockLevel"."onHand" + EXCLUDED."onHand", "updatedAt" = now();
  SELECT "onHand" INTO level FROM "StockLevel" WHERE "location" = NEW."location" AND "item" = NEW."item";
  UPDATE "StockLevel" SET "negativeSince" = CASE WHEN level < 0 THEN COALESCE("negativeSince", now()) ELSE NULL END
    WHERE "location" = NEW."location" AND "item" = NEW."item";
  -- A warehouse never goes negative; a truck may (company control allowNegativeTruckStock) and is flagged by negativeSince.
  IF level < 0 AND (SELECT "kind" FROM "StockLocation" WHERE "id" = NEW."location") NOT IN ('truck', 'job_site', 'in_transit') THEN
    RAISE EXCEPTION 'Stock at a warehouse cannot go below zero' USING ERRCODE = 'check_violation';
  END IF;
  IF level < 0 AND (SELECT "kind" FROM "StockLocation" WHERE "id" = NEW."location") = 'truck'
     AND EXISTS (SELECT 1 FROM "CompanySettings" WHERE "allowNegativeTruckStock" = false) THEN
    RAISE EXCEPTION 'This company does not allow a truck to go below zero' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "StockMovement_apply" AFTER INSERT ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION hs_apply_stock_movement();

-- A serial number is in exactly one place (I-S4): at a stock location, or installed in a piece of equipment, never both and never neither.
CREATE OR REPLACE FUNCTION hs_serialized_unit_place() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'installed' THEN
    IF NEW."installedEquipment" IS NULL OR NEW."location" IS NOT NULL THEN
      RAISE EXCEPTION 'An installed serialized unit belongs to equipment and to no stock location' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."status" IN ('in_stock', 'reserved', 'rma') THEN
    IF NEW."location" IS NULL OR NEW."installedEquipment" IS NOT NULL THEN
      RAISE EXCEPTION 'A serialized unit in stock is at exactly one stock location' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."status" = 'scrapped' THEN
    IF NEW."installedEquipment" IS NOT NULL THEN
      RAISE EXCEPTION 'A scrapped serialized unit is not installed' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'scrapped' AND NEW."status" <> 'scrapped' THEN
    RAISE EXCEPTION 'A scrapped serialized unit does not come back' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "SerializedUnit_place" BEFORE INSERT OR UPDATE ON "SerializedUnit" FOR EACH ROW EXECUTE FUNCTION hs_serialized_unit_place();

-- Refrigerant entries need a real EPA 608 credential (I-R1): the technician's own, verified, and not expired on the day.
CREATE OR REPLACE FUNCTION hs_refrigerant_credential() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c RECORD; day date;
BEGIN
  IF NEW."credential" IS NULL OR NEW."technician" IS NULL THEN
    RAISE EXCEPTION 'A refrigerant entry names a technician and an EPA 608 credential' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO c FROM "Credential" WHERE "id" = NEW."credential";
  day := COALESCE(NEW."occurredAt", now())::date;
  IF c IS NULL OR c."kind" <> 'epa_608' OR c."status" <> 'verified' OR c."epaType" = 'none' OR c."employee" IS DISTINCT FROM NEW."technician"
     OR (c."expiresOn" IS NOT NULL AND c."expiresOn" < day) THEN
    RAISE EXCEPTION 'The technician needs a verified, unexpired EPA 608 credential of their own' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "RefrigerantLogEntry_credential" BEFORE INSERT ON "RefrigerantLogEntry" FOR EACH ROW EXECUTE FUNCTION hs_refrigerant_credential();

-- A job with an open permit or an inspection that has not passed is never completed (SM §14): it waits in awaiting_inspection.
CREATE OR REPLACE FUNCTION hs_job_permit_gate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IN ('completed', 'closed') AND OLD."status" IS DISTINCT FROM NEW."status" AND NEW."status" = 'completed' THEN
    IF EXISTS (SELECT 1 FROM "Permit" WHERE "job" = NEW."id" AND "status" IN ('needed', 'applied', 'issued', 'rejected'))
       OR EXISTS (SELECT 1 FROM "Inspection" i JOIN "Permit" p ON p."id" = i."permit" WHERE p."job" = NEW."id" AND i."status" IN ('requested', 'scheduled', 'failed')) THEN
      RAISE EXCEPTION 'A job with an open permit or an inspection that has not passed is not completed' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Job_permit_gate" BEFORE UPDATE OF "status" ON "Job" FOR EACH ROW EXECUTE FUNCTION hs_job_permit_gate();
