-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'state_trade_license',
    "trade" TEXT NOT NULL DEFAULT 'general',
    "jurisdictionCode" TEXT NOT NULL DEFAULT 'US-TX',
    "issuer" TEXT NOT NULL DEFAULT '',
    "number" TEXT NOT NULL DEFAULT '',
    "licenseClass" TEXT NOT NULL DEFAULT '',
    "epaType" TEXT NOT NULL DEFAULT 'none',
    "endorsements" JSONB DEFAULT '[]',
    "issuedOn" DATE,
    "expiresOn" DATE,
    "evidence" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "lead" TEXT,
    "businessUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityEvaluation" (
    "id" TEXT NOT NULL,
    "visit" TEXT,
    "employee" TEXT,
    "policyVersion" TEXT,
    "result" TEXT NOT NULL,
    "findings" JSONB,
    "evaluatedAt" TIMESTAMP(3),
    "overrideApproval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',
    "employeeNumber" TEXT NOT NULL DEFAULT '',
    "homeBranch" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'technician',
    "employmentType" TEXT NOT NULL DEFAULT 'w2_hourly',
    "hireDate" DATE,
    "terminationDate" DATE,
    "phoneE164" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "dispatchable" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTypeRequirement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "licensingTags" JSONB DEFAULT '[]',
    "requiredCredentialKinds" JSONB DEFAULT '[]',
    "requiresSupervisorOnJob" BOOLEAN NOT NULL DEFAULT false,
    "maxCoolingTons" DECIMAL(18,4),
    "maxHeatingBtuh" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTypeRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallRotation" (
    "id" TEXT NOT NULL,
    "businessUnit" TEXT,
    "employee" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "phoneE164" TEXT NOT NULL DEFAULT '',
    "escalationOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnCallRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "weekday" INTEGER NOT NULL,
    "startLocal" TEXT NOT NULL DEFAULT '',
    "endLocal" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "trade" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessSecret" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "secretRef" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessSecretReveal" (
    "id" TEXT NOT NULL,
    "secret" TEXT,
    "revealedTo" TEXT,
    "visit" TEXT,
    "revealedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessSecretReveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "contactPoint" TEXT,
    "purpose" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "evidence" JSONB,
    "wordingVersion" TEXT NOT NULL DEFAULT '',
    "policyVersion" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'owner',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" TEXT NOT NULL,
    "contact" TEXT,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "valueHash" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "carrierLineType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'residential',
    "displayName" TEXT NOT NULL DEFAULT '',
    "organizationName" TEXT NOT NULL DEFAULT '',
    "primaryContact" TEXT,
    "billingLine1" TEXT NOT NULL DEFAULT '',
    "billingLine2" TEXT NOT NULL DEFAULT '',
    "billingCity" TEXT NOT NULL DEFAULT '',
    "billingRegion" TEXT NOT NULL DEFAULT '',
    "billingPostalCode" TEXT NOT NULL DEFAULT '',
    "taxExemptCertificate" TEXT,
    "doNotService" BOOLEAN NOT NULL DEFAULT false,
    "doNotServiceReason" TEXT NOT NULL DEFAULT '',
    "mergedInto" TEXT,
    "source" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DncEntry" (
    "id" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DncEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationContact" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "contact" TEXT,
    "role" TEXT NOT NULL,
    "canAuthorizeWork" BOOLEAN NOT NULL DEFAULT true,
    "nteMinor" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationOwnership" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "customer" TEXT,
    "from" DATE,
    "to" DATE,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLocation" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "address1" TEXT NOT NULL DEFAULT '',
    "address2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'TX',
    "county" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "geocodeQuality" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT '',
    "serviceArea" TEXT,
    "propertyClass" TEXT NOT NULL DEFAULT 'residential',
    "propertyType" TEXT NOT NULL DEFAULT 'single_family',
    "yearBuilt" INTEGER,
    "squareFeet" INTEGER,
    "mergedInto" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "conversation" TEXT,
    "direction" TEXT NOT NULL,
    "providerCallId" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "from" TEXT NOT NULL DEFAULT '',
    "fromMasked" TEXT NOT NULL DEFAULT '',
    "to" TEXT NOT NULL DEFAULT '',
    "trackingNumber" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "answeredBy" TEXT NOT NULL,
    "agentRun" TEXT,
    "recording" TEXT,
    "transcript" JSONB,
    "recordingDisclosurePlayed" BOOLEAN NOT NULL DEFAULT false,
    "emergency" JSONB,
    "summary" TEXT NOT NULL DEFAULT '',
    "disposition" TEXT NOT NULL DEFAULT '',
    "bookable" BOOLEAN NOT NULL DEFAULT false,
    "lead" TEXT,
    "job" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT 'other',
    "monthlyCostMinor" BIGINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "contactPoint" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "lead" TEXT,
    "job" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "campaign" TEXT,
    "trackingNumber" TEXT,
    "externalId" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "location" TEXT,
    "contactName" TEXT NOT NULL DEFAULT '',
    "phoneE164" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "requestedJobType" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "lostReason" TEXT NOT NULL DEFAULT '',
    "firstResponseSeconds" INTEGER,
    "respondDueAt" TIMESTAMP(3),
    "job" TEXT,
    "mergedInto" TEXT,
    "assignedTo" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversation" TEXT,
    "contactPoint" TEXT,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consentPurpose" TEXT NOT NULL DEFAULT '',
    "template" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "blockedReason" TEXT NOT NULL DEFAULT '',
    "guardFindings" JSONB,
    "providerMessageId" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "visit" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "location" TEXT,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "generatedBy" TEXT,
    "estimatedValueMinor" BIGINT,
    "reasons" JSONB,
    "stage" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "lead" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingNumber" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "forwardTo" TEXT NOT NULL DEFAULT '',
    "businessUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivalWindow" (
    "id" TEXT NOT NULL,
    "businessUnit" TEXT,
    "template" TEXT,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "capacityHours" DECIMAL(18,4) NOT NULL,
    "bookedHours" DECIMAL(18,4) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArrivalWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivalWindowTemplate" (
    "id" TEXT NOT NULL,
    "businessUnit" TEXT,
    "weekday" INTEGER NOT NULL,
    "startLocal" TEXT NOT NULL DEFAULT '',
    "endLocal" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "capacityHours" DECIMAL(18,4) NOT NULL,
    "capacityFactor" DECIMAL(12,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArrivalWindowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingHold" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL DEFAULT '',
    "window" TEXT,
    "jobType" TEXT,
    "hours" DECIMAL(18,4) NOT NULL,
    "source" TEXT NOT NULL,
    "heldByUser" TEXT,
    "heldByAgent" TEXT,
    "customerDraft" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "job" TEXT,
    "visit" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityOverride" (
    "id" TEXT NOT NULL,
    "window" TEXT,
    "addHours" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT,
    "approval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityPlan" (
    "id" TEXT NOT NULL,
    "businessUnit" TEXT,
    "date" DATE NOT NULL,
    "techHoursAvailable" DECIMAL(18,4) NOT NULL,
    "reservedEmergencyHours" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityUsage" (
    "id" TEXT NOT NULL,
    "window" TEXT,
    "kind" TEXT NOT NULL,
    "hold" TEXT,
    "visit" TEXT,
    "hours" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "businessUnit" TEXT,
    "trade" TEXT NOT NULL DEFAULT 'hvac',
    "priority" TEXT NOT NULL DEFAULT 'standard',
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 90,
    "capacityHours" DECIMAL(18,4) NOT NULL,
    "crewSize" INTEGER NOT NULL DEFAULT 1,
    "requirements" TEXT,
    "keywords" JSONB DEFAULT '[]',
    "bookableOnline" BOOLEAN NOT NULL DEFAULT false,
    "bookableByAi" BOOLEAN NOT NULL DEFAULT false,
    "emergencyPolicy" JSONB,
    "checklistTemplate" TEXT,
    "refrigerantWork" BOOLEAN NOT NULL DEFAULT false,
    "permitLikely" BOOLEAN NOT NULL DEFAULT false,
    "bookingQuestions" JSONB DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistResponse" (
    "id" TEXT NOT NULL,
    "visit" TEXT,
    "template" TEXT,
    "templateVersion" INTEGER,
    "answers" JSONB,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "items" JSONB DEFAULT '[]',
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchRecommendation" (
    "id" TEXT NOT NULL,
    "visit" TEXT,
    "rankedCandidates" JSONB,
    "inputsHash" TEXT NOT NULL DEFAULT '',
    "features" JSONB,
    "modelRef" TEXT NOT NULL DEFAULT '',
    "generatedBy" TEXT,
    "requestedBy" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'proposed',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "publicCode" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "location" TEXT,
    "businessUnit" TEXT,
    "jobType" TEXT,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "statusBeforeHold" TEXT NOT NULL DEFAULT '',
    "holdReason" TEXT NOT NULL DEFAULT '',
    "holdFollowUpOn" DATE,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "lead" TEXT,
    "recallOf" TEXT,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "nteMinor" BIGINT,
    "bookedBy" TEXT,
    "bookedByAgent" TEXT,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPayer" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "payerKind" TEXT NOT NULL,
    "payerCustomer" TEXT,
    "authorizationRef" TEXT NOT NULL DEFAULT '',
    "sharePolicy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "window" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedDurationMinutes" INTEGER,
    "capacityHours" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "actualArrivalAt" TIMESTAMP(3),
    "actualDoneAt" TIMESTAMP(3),
    "etaMinutes" INTEGER,
    "customerSummaryDraft" TEXT NOT NULL DEFAULT '',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAssignment" (
    "id" TEXT NOT NULL,
    "visit" TEXT,
    "employee" TEXT,
    "role" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "assignedByAgent" TEXT,
    "recommendation" TEXT,
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "eligibility" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitStatusEvent" (
    "id" TEXT NOT NULL,
    "visit" TEXT,
    "employee" TEXT,
    "actorUser" TEXT,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "clientRecordedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "deviceId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLine" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT '',
    "unitPriceMinor" BIGINT NOT NULL DEFAULT 0,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxCategory" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "cancellationClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Employee_businessUnits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Crew_members" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Employee_skills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_JobTypeRequirement_skills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Customer_tags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Job_tags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Credential_employee_idx" ON "Credential"("employee");

-- CreateIndex
CREATE INDEX "Credential_evidence_idx" ON "Credential"("evidence");

-- CreateIndex
CREATE INDEX "Credential_verifiedBy_idx" ON "Credential"("verifiedBy");

-- CreateIndex
CREATE INDEX "Crew_lead_idx" ON "Crew"("lead");

-- CreateIndex
CREATE INDEX "Crew_businessUnit_idx" ON "Crew"("businessUnit");

-- CreateIndex
CREATE INDEX "EligibilityEvaluation_visit_idx" ON "EligibilityEvaluation"("visit");

-- CreateIndex
CREATE INDEX "EligibilityEvaluation_employee_idx" ON "EligibilityEvaluation"("employee");

-- CreateIndex
CREATE INDEX "EligibilityEvaluation_policyVersion_idx" ON "EligibilityEvaluation"("policyVersion");

-- CreateIndex
CREATE INDEX "EligibilityEvaluation_overrideApproval_idx" ON "EligibilityEvaluation"("overrideApproval");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_user_idx" ON "Employee"("user");

-- CreateIndex
CREATE INDEX "Employee_homeBranch_idx" ON "Employee"("homeBranch");

-- CreateIndex
CREATE INDEX "OnCallRotation_businessUnit_idx" ON "OnCallRotation"("businessUnit");

-- CreateIndex
CREATE INDEX "OnCallRotation_employee_idx" ON "OnCallRotation"("employee");

-- CreateIndex
CREATE INDEX "Shift_employee_idx" ON "Shift"("employee");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_employee_date_kind_key" ON "Shift"("employee", "date", "kind");

-- CreateIndex
CREATE INDEX "ShiftTemplate_employee_idx" ON "ShiftTemplate"("employee");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTemplate_employee_day_key" ON "ShiftTemplate"("employee", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "AccessSecret_location_idx" ON "AccessSecret"("location");

-- CreateIndex
CREATE INDEX "AccessSecretReveal_secret_idx" ON "AccessSecretReveal"("secret");

-- CreateIndex
CREATE INDEX "AccessSecretReveal_revealedTo_idx" ON "AccessSecretReveal"("revealedTo");

-- CreateIndex
CREATE INDEX "AccessSecretReveal_visit_idx" ON "AccessSecretReveal"("visit");

-- CreateIndex
CREATE INDEX "ConsentRecord_contactPoint_idx" ON "ConsentRecord"("contactPoint");

-- CreateIndex
CREATE INDEX "ConsentRecord_policyVersion_idx" ON "ConsentRecord"("policyVersion");

-- CreateIndex
CREATE INDEX "Contact_customer_idx" ON "Contact"("customer");

-- CreateIndex
CREATE INDEX "ContactPoint_contact_idx" ON "ContactPoint"("contact");

-- CreateIndex
CREATE INDEX "ContactPoint_valueHash_idx" ON "ContactPoint"("valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_contact_kind_value_key" ON "ContactPoint"("contact", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_ref_key" ON "Customer"("ref");

-- CreateIndex
CREATE INDEX "Customer_primaryContact_idx" ON "Customer"("primaryContact");

-- CreateIndex
CREATE INDEX "Customer_taxExemptCertificate_idx" ON "Customer"("taxExemptCertificate");

-- CreateIndex
CREATE INDEX "Customer_mergedInto_idx" ON "Customer"("mergedInto");

-- CreateIndex
CREATE INDEX "Customer_source_idx" ON "Customer"("source");

-- CreateIndex
CREATE INDEX "DncEntry_valueHash_idx" ON "DncEntry"("valueHash");

-- CreateIndex
CREATE INDEX "LocationContact_location_idx" ON "LocationContact"("location");

-- CreateIndex
CREATE INDEX "LocationContact_contact_idx" ON "LocationContact"("contact");

-- CreateIndex
CREATE INDEX "LocationOwnership_location_idx" ON "LocationOwnership"("location");

-- CreateIndex
CREATE INDEX "LocationOwnership_customer_idx" ON "LocationOwnership"("customer");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLocation_ref_key" ON "ServiceLocation"("ref");

-- CreateIndex
CREATE INDEX "ServiceLocation_customer_idx" ON "ServiceLocation"("customer");

-- CreateIndex
CREATE INDEX "ServiceLocation_serviceArea_idx" ON "ServiceLocation"("serviceArea");

-- CreateIndex
CREATE INDEX "ServiceLocation_mergedInto_idx" ON "ServiceLocation"("mergedInto");

-- CreateIndex
CREATE UNIQUE INDEX "Call_providerCallId_key" ON "Call"("providerCallId");

-- CreateIndex
CREATE INDEX "Call_conversation_idx" ON "Call"("conversation");

-- CreateIndex
CREATE INDEX "Call_trackingNumber_idx" ON "Call"("trackingNumber");

-- CreateIndex
CREATE INDEX "Call_agentRun_idx" ON "Call"("agentRun");

-- CreateIndex
CREATE INDEX "Call_recording_idx" ON "Call"("recording");

-- CreateIndex
CREATE INDEX "Call_lead_idx" ON "Call"("lead");

-- CreateIndex
CREATE INDEX "Call_job_idx" ON "Call"("job");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_name_key" ON "Campaign"("name");

-- CreateIndex
CREATE INDEX "Conversation_customer_idx" ON "Conversation"("customer");

-- CreateIndex
CREATE INDEX "Conversation_contactPoint_idx" ON "Conversation"("contactPoint");

-- CreateIndex
CREATE INDEX "Conversation_assignedTo_idx" ON "Conversation"("assignedTo");

-- CreateIndex
CREATE INDEX "Conversation_lead_idx" ON "Conversation"("lead");

-- CreateIndex
CREATE INDEX "Conversation_job_idx" ON "Conversation"("job");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_ref_key" ON "Lead"("ref");

-- CreateIndex
CREATE INDEX "Lead_campaign_idx" ON "Lead"("campaign");

-- CreateIndex
CREATE INDEX "Lead_trackingNumber_idx" ON "Lead"("trackingNumber");

-- CreateIndex
CREATE INDEX "Lead_customer_idx" ON "Lead"("customer");

-- CreateIndex
CREATE INDEX "Lead_location_idx" ON "Lead"("location");

-- CreateIndex
CREATE INDEX "Lead_requestedJobType_idx" ON "Lead"("requestedJobType");

-- CreateIndex
CREATE INDEX "Lead_job_idx" ON "Lead"("job");

-- CreateIndex
CREATE INDEX "Lead_mergedInto_idx" ON "Lead"("mergedInto");

-- CreateIndex
CREATE INDEX "Lead_assignedTo_idx" ON "Lead"("assignedTo");

-- CreateIndex
CREATE INDEX "Message_conversation_idx" ON "Message"("conversation");

-- CreateIndex
CREATE INDEX "Message_contactPoint_idx" ON "Message"("contactPoint");

-- CreateIndex
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");

-- CreateIndex
CREATE INDEX "Message_job_idx" ON "Message"("job");

-- CreateIndex
CREATE INDEX "Message_visit_idx" ON "Message"("visit");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_ref_key" ON "Opportunity"("ref");

-- CreateIndex
CREATE INDEX "Opportunity_customer_idx" ON "Opportunity"("customer");

-- CreateIndex
CREATE INDEX "Opportunity_location_idx" ON "Opportunity"("location");

-- CreateIndex
CREATE INDEX "Opportunity_generatedBy_idx" ON "Opportunity"("generatedBy");

-- CreateIndex
CREATE INDEX "Opportunity_assignedTo_idx" ON "Opportunity"("assignedTo");

-- CreateIndex
CREATE INDEX "Opportunity_lead_idx" ON "Opportunity"("lead");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingNumber_phoneE164_key" ON "TrackingNumber"("phoneE164");

-- CreateIndex
CREATE INDEX "TrackingNumber_campaign_idx" ON "TrackingNumber"("campaign");

-- CreateIndex
CREATE INDEX "TrackingNumber_businessUnit_idx" ON "TrackingNumber"("businessUnit");

-- CreateIndex
CREATE INDEX "ArrivalWindow_businessUnit_idx" ON "ArrivalWindow"("businessUnit");

-- CreateIndex
CREATE INDEX "ArrivalWindow_template_idx" ON "ArrivalWindow"("template");

-- CreateIndex
CREATE UNIQUE INDEX "ArrivalWindow_bu_date_start_key" ON "ArrivalWindow"("businessUnit", "date", "startsAt");

-- CreateIndex
CREATE INDEX "ArrivalWindowTemplate_businessUnit_idx" ON "ArrivalWindowTemplate"("businessUnit");

-- CreateIndex
CREATE UNIQUE INDEX "ArrivalWindowTemplate_bu_day_start_key" ON "ArrivalWindowTemplate"("businessUnit", "weekday", "startLocal");

-- CreateIndex
CREATE UNIQUE INDEX "BookingHold_publicCode_key" ON "BookingHold"("publicCode");

-- CreateIndex
CREATE INDEX "BookingHold_window_idx" ON "BookingHold"("window");

-- CreateIndex
CREATE INDEX "BookingHold_jobType_idx" ON "BookingHold"("jobType");

-- CreateIndex
CREATE INDEX "BookingHold_heldByUser_idx" ON "BookingHold"("heldByUser");

-- CreateIndex
CREATE INDEX "BookingHold_heldByAgent_idx" ON "BookingHold"("heldByAgent");

-- CreateIndex
CREATE INDEX "BookingHold_job_idx" ON "BookingHold"("job");

-- CreateIndex
CREATE INDEX "BookingHold_visit_idx" ON "BookingHold"("visit");

-- CreateIndex
CREATE INDEX "CapacityOverride_window_idx" ON "CapacityOverride"("window");

-- CreateIndex
CREATE INDEX "CapacityOverride_requestedBy_idx" ON "CapacityOverride"("requestedBy");

-- CreateIndex
CREATE INDEX "CapacityOverride_approval_idx" ON "CapacityOverride"("approval");

-- CreateIndex
CREATE INDEX "CapacityPlan_businessUnit_idx" ON "CapacityPlan"("businessUnit");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityPlan_bu_date_key" ON "CapacityPlan"("businessUnit", "date");

-- CreateIndex
CREATE INDEX "CapacityUsage_window_idx" ON "CapacityUsage"("window");

-- CreateIndex
CREATE INDEX "CapacityUsage_hold_idx" ON "CapacityUsage"("hold");

-- CreateIndex
CREATE INDEX "CapacityUsage_visit_idx" ON "CapacityUsage"("visit");

-- CreateIndex
CREATE UNIQUE INDEX "JobType_code_key" ON "JobType"("code");

-- CreateIndex
CREATE INDEX "JobType_businessUnit_idx" ON "JobType"("businessUnit");

-- CreateIndex
CREATE INDEX "JobType_requirements_idx" ON "JobType"("requirements");

-- CreateIndex
CREATE INDEX "JobType_checklistTemplate_idx" ON "JobType"("checklistTemplate");

-- CreateIndex
CREATE INDEX "ChecklistResponse_visit_idx" ON "ChecklistResponse"("visit");

-- CreateIndex
CREATE INDEX "ChecklistResponse_template_idx" ON "ChecklistResponse"("template");

-- CreateIndex
CREATE INDEX "ChecklistResponse_completedBy_idx" ON "ChecklistResponse"("completedBy");

-- CreateIndex
CREATE INDEX "DispatchRecommendation_visit_idx" ON "DispatchRecommendation"("visit");

-- CreateIndex
CREATE INDEX "DispatchRecommendation_generatedBy_idx" ON "DispatchRecommendation"("generatedBy");

-- CreateIndex
CREATE INDEX "DispatchRecommendation_requestedBy_idx" ON "DispatchRecommendation"("requestedBy");

-- CreateIndex
CREATE INDEX "DispatchRecommendation_decidedBy_idx" ON "DispatchRecommendation"("decidedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Job_ref_key" ON "Job"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Job_publicCode_key" ON "Job"("publicCode");

-- CreateIndex
CREATE INDEX "Job_customer_idx" ON "Job"("customer");

-- CreateIndex
CREATE INDEX "Job_location_idx" ON "Job"("location");

-- CreateIndex
CREATE INDEX "Job_businessUnit_idx" ON "Job"("businessUnit");

-- CreateIndex
CREATE INDEX "Job_jobType_idx" ON "Job"("jobType");

-- CreateIndex
CREATE INDEX "Job_lead_idx" ON "Job"("lead");

-- CreateIndex
CREATE INDEX "Job_recallOf_idx" ON "Job"("recallOf");

-- CreateIndex
CREATE INDEX "Job_bookedBy_idx" ON "Job"("bookedBy");

-- CreateIndex
CREATE INDEX "Job_bookedByAgent_idx" ON "Job"("bookedByAgent");

-- CreateIndex
CREATE INDEX "JobPayer_job_idx" ON "JobPayer"("job");

-- CreateIndex
CREATE INDEX "JobPayer_payerCustomer_idx" ON "JobPayer"("payerCustomer");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_ref_key" ON "Visit"("ref");

-- CreateIndex
CREATE INDEX "Visit_job_idx" ON "Visit"("job");

-- CreateIndex
CREATE INDEX "Visit_window_idx" ON "Visit"("window");

-- CreateIndex
CREATE INDEX "Visit_status_planned_idx" ON "Visit"("status", "plannedStart");

-- CreateIndex
CREATE INDEX "VisitAssignment_visit_idx" ON "VisitAssignment"("visit");

-- CreateIndex
CREATE INDEX "VisitAssignment_employee_idx" ON "VisitAssignment"("employee");

-- CreateIndex
CREATE INDEX "VisitAssignment_assignedBy_idx" ON "VisitAssignment"("assignedBy");

-- CreateIndex
CREATE INDEX "VisitAssignment_assignedByAgent_idx" ON "VisitAssignment"("assignedByAgent");

-- CreateIndex
CREATE INDEX "VisitAssignment_recommendation_idx" ON "VisitAssignment"("recommendation");

-- CreateIndex
CREATE INDEX "VisitAssignment_eligibility_idx" ON "VisitAssignment"("eligibility");

-- CreateIndex
CREATE UNIQUE INDEX "VisitStatusEvent_idempotencyKey_key" ON "VisitStatusEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VisitStatusEvent_visit_idx" ON "VisitStatusEvent"("visit");

-- CreateIndex
CREATE INDEX "VisitStatusEvent_employee_idx" ON "VisitStatusEvent"("employee");

-- CreateIndex
CREATE INDEX "VisitStatusEvent_actorUser_idx" ON "VisitStatusEvent"("actorUser");

-- CreateIndex
CREATE INDEX "WorkLine_job_idx" ON "WorkLine"("job");

-- CreateIndex
CREATE UNIQUE INDEX "_Employee_businessUnits_AB_unique" ON "_Employee_businessUnits"("A", "B");

-- CreateIndex
CREATE INDEX "_Employee_businessUnits_B_index" ON "_Employee_businessUnits"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Crew_members_AB_unique" ON "_Crew_members"("A", "B");

-- CreateIndex
CREATE INDEX "_Crew_members_B_index" ON "_Crew_members"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Employee_skills_AB_unique" ON "_Employee_skills"("A", "B");

-- CreateIndex
CREATE INDEX "_Employee_skills_B_index" ON "_Employee_skills"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_JobTypeRequirement_skills_AB_unique" ON "_JobTypeRequirement_skills"("A", "B");

-- CreateIndex
CREATE INDEX "_JobTypeRequirement_skills_B_index" ON "_JobTypeRequirement_skills"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Customer_tags_AB_unique" ON "_Customer_tags"("A", "B");

-- CreateIndex
CREATE INDEX "_Customer_tags_B_index" ON "_Customer_tags"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Job_tags_AB_unique" ON "_Job_tags"("A", "B");

-- CreateIndex
CREATE INDEX "_Job_tags_B_index" ON "_Job_tags"("B");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_evidence_fkey" FOREIGN KEY ("evidence") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crew" ADD CONSTRAINT "Crew_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crew" ADD CONSTRAINT "Crew_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvaluation" ADD CONSTRAINT "EligibilityEvaluation_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvaluation" ADD CONSTRAINT "EligibilityEvaluation_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvaluation" ADD CONSTRAINT "EligibilityEvaluation_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvaluation" ADD CONSTRAINT "EligibilityEvaluation_overrideApproval_fkey" FOREIGN KEY ("overrideApproval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_homeBranch_fkey" FOREIGN KEY ("homeBranch") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRotation" ADD CONSTRAINT "OnCallRotation_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRotation" ADD CONSTRAINT "OnCallRotation_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessSecret" ADD CONSTRAINT "AccessSecret_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessSecretReveal" ADD CONSTRAINT "AccessSecretReveal_secret_fkey" FOREIGN KEY ("secret") REFERENCES "AccessSecret"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessSecretReveal" ADD CONSTRAINT "AccessSecretReveal_revealedTo_fkey" FOREIGN KEY ("revealedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessSecretReveal" ADD CONSTRAINT "AccessSecretReveal_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_contactPoint_fkey" FOREIGN KEY ("contactPoint") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_primaryContact_fkey" FOREIGN KEY ("primaryContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_taxExemptCertificate_fkey" FOREIGN KEY ("taxExemptCertificate") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedInto_fkey" FOREIGN KEY ("mergedInto") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_source_fkey" FOREIGN KEY ("source") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationContact" ADD CONSTRAINT "LocationContact_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationContact" ADD CONSTRAINT "LocationContact_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationOwnership" ADD CONSTRAINT "LocationOwnership_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationOwnership" ADD CONSTRAINT "LocationOwnership_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocation" ADD CONSTRAINT "ServiceLocation_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocation" ADD CONSTRAINT "ServiceLocation_serviceArea_fkey" FOREIGN KEY ("serviceArea") REFERENCES "ServiceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocation" ADD CONSTRAINT "ServiceLocation_mergedInto_fkey" FOREIGN KEY ("mergedInto") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_conversation_fkey" FOREIGN KEY ("conversation") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_trackingNumber_fkey" FOREIGN KEY ("trackingNumber") REFERENCES "TrackingNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_agentRun_fkey" FOREIGN KEY ("agentRun") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_recording_fkey" FOREIGN KEY ("recording") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactPoint_fkey" FOREIGN KEY ("contactPoint") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_trackingNumber_fkey" FOREIGN KEY ("trackingNumber") REFERENCES "TrackingNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_requestedJobType_fkey" FOREIGN KEY ("requestedJobType") REFERENCES "JobType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_mergedInto_fkey" FOREIGN KEY ("mergedInto") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_fkey" FOREIGN KEY ("conversation") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactPoint_fkey" FOREIGN KEY ("contactPoint") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingNumber" ADD CONSTRAINT "TrackingNumber_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingNumber" ADD CONSTRAINT "TrackingNumber_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalWindow" ADD CONSTRAINT "ArrivalWindow_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalWindow" ADD CONSTRAINT "ArrivalWindow_template_fkey" FOREIGN KEY ("template") REFERENCES "ArrivalWindowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalWindowTemplate" ADD CONSTRAINT "ArrivalWindowTemplate_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_window_fkey" FOREIGN KEY ("window") REFERENCES "ArrivalWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_jobType_fkey" FOREIGN KEY ("jobType") REFERENCES "JobType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_heldByUser_fkey" FOREIGN KEY ("heldByUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_heldByAgent_fkey" FOREIGN KEY ("heldByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityOverride" ADD CONSTRAINT "CapacityOverride_window_fkey" FOREIGN KEY ("window") REFERENCES "ArrivalWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityOverride" ADD CONSTRAINT "CapacityOverride_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityOverride" ADD CONSTRAINT "CapacityOverride_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityPlan" ADD CONSTRAINT "CapacityPlan_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityUsage" ADD CONSTRAINT "CapacityUsage_window_fkey" FOREIGN KEY ("window") REFERENCES "ArrivalWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityUsage" ADD CONSTRAINT "CapacityUsage_hold_fkey" FOREIGN KEY ("hold") REFERENCES "BookingHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityUsage" ADD CONSTRAINT "CapacityUsage_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobType" ADD CONSTRAINT "JobType_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobType" ADD CONSTRAINT "JobType_requirements_fkey" FOREIGN KEY ("requirements") REFERENCES "JobTypeRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobType" ADD CONSTRAINT "JobType_checklistTemplate_fkey" FOREIGN KEY ("checklistTemplate") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_template_fkey" FOREIGN KEY ("template") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecommendation" ADD CONSTRAINT "DispatchRecommendation_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecommendation" ADD CONSTRAINT "DispatchRecommendation_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecommendation" ADD CONSTRAINT "DispatchRecommendation_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecommendation" ADD CONSTRAINT "DispatchRecommendation_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessUnit_fkey" FOREIGN KEY ("businessUnit") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_jobType_fkey" FOREIGN KEY ("jobType") REFERENCES "JobType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_recallOf_fkey" FOREIGN KEY ("recallOf") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_bookedBy_fkey" FOREIGN KEY ("bookedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_bookedByAgent_fkey" FOREIGN KEY ("bookedByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPayer" ADD CONSTRAINT "JobPayer_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPayer" ADD CONSTRAINT "JobPayer_payerCustomer_fkey" FOREIGN KEY ("payerCustomer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_window_fkey" FOREIGN KEY ("window") REFERENCES "ArrivalWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_assignedByAgent_fkey" FOREIGN KEY ("assignedByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_recommendation_fkey" FOREIGN KEY ("recommendation") REFERENCES "DispatchRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_eligibility_fkey" FOREIGN KEY ("eligibility") REFERENCES "EligibilityEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitStatusEvent" ADD CONSTRAINT "VisitStatusEvent_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitStatusEvent" ADD CONSTRAINT "VisitStatusEvent_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitStatusEvent" ADD CONSTRAINT "VisitStatusEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLine" ADD CONSTRAINT "WorkLine_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_businessUnits" ADD CONSTRAINT "_Employee_businessUnits_A_fkey" FOREIGN KEY ("A") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_businessUnits" ADD CONSTRAINT "_Employee_businessUnits_B_fkey" FOREIGN KEY ("B") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Crew_members" ADD CONSTRAINT "_Crew_members_A_fkey" FOREIGN KEY ("A") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Crew_members" ADD CONSTRAINT "_Crew_members_B_fkey" FOREIGN KEY ("B") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_skills" ADD CONSTRAINT "_Employee_skills_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_skills" ADD CONSTRAINT "_Employee_skills_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobTypeRequirement_skills" ADD CONSTRAINT "_JobTypeRequirement_skills_A_fkey" FOREIGN KEY ("A") REFERENCES "JobTypeRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobTypeRequirement_skills" ADD CONSTRAINT "_JobTypeRequirement_skills_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Customer_tags" ADD CONSTRAINT "_Customer_tags_A_fkey" FOREIGN KEY ("A") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Customer_tags" ADD CONSTRAINT "_Customer_tags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Job_tags" ADD CONSTRAINT "_Job_tags_A_fkey" FOREIGN KEY ("A") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Job_tags" ADD CONSTRAINT "_Job_tags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
