-- CreateEnum
CREATE TYPE "UserKindType" AS ENUM ('staff', 'customer', 'payer_contact', 'agent_owner');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "role" TEXT,
    "kind" "UserKindType" DEFAULT 'staff',
    "title" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "mfaEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "accessExpiresAt" TIMESTAMP(3),
    "onboardingStatus" TEXT DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordResetToken" TEXT,
    "passwordResetIssuedAt" TIMESTAMP(3),
    "passwordResetRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "canSeeOtherPeople" BOOLEAN NOT NULL DEFAULT false,
    "canEditOtherPeople" BOOLEAN NOT NULL DEFAULT false,
    "canManagePeople" BOOLEAN NOT NULL DEFAULT false,
    "canManageRoles" BOOLEAN NOT NULL DEFAULT false,
    "canAccessDashboard" BOOLEAN NOT NULL DEFAULT false,
    "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
    "canIssueRefunds" BOOLEAN NOT NULL DEFAULT false,
    "canReadAudit" BOOLEAN NOT NULL DEFAULT false,
    "canManageCompany" BOOLEAN NOT NULL DEFAULT false,
    "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "canManagePolicies" BOOLEAN NOT NULL DEFAULT false,
    "canApprovePolicies" BOOLEAN NOT NULL DEFAULT false,
    "canManageCustomers" BOOLEAN NOT NULL DEFAULT false,
    "canMergeCustomers" BOOLEAN NOT NULL DEFAULT false,
    "canApproveMerges" BOOLEAN NOT NULL DEFAULT false,
    "canRevealAccessSecret" BOOLEAN NOT NULL DEFAULT false,
    "canReadCustomerPII" BOOLEAN NOT NULL DEFAULT false,
    "canManageLeads" BOOLEAN NOT NULL DEFAULT false,
    "canManageCampaigns" BOOLEAN NOT NULL DEFAULT false,
    "canBook" BOOLEAN NOT NULL DEFAULT false,
    "canOverbook" BOOLEAN NOT NULL DEFAULT false,
    "canApproveOverbook" BOOLEAN NOT NULL DEFAULT false,
    "canDispatch" BOOLEAN NOT NULL DEFAULT false,
    "canViewBoard" BOOLEAN NOT NULL DEFAULT false,
    "canWorkVisits" BOOLEAN NOT NULL DEFAULT false,
    "canPresentEstimates" BOOLEAN NOT NULL DEFAULT false,
    "canSellEstimates" BOOLEAN NOT NULL DEFAULT false,
    "canManagePriceBook" BOOLEAN NOT NULL DEFAULT false,
    "canApprovePriceBook" BOOLEAN NOT NULL DEFAULT false,
    "canApproveDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "canManageInvoices" BOOLEAN NOT NULL DEFAULT false,
    "canTakePayments" BOOLEAN NOT NULL DEFAULT false,
    "canPostInvoices" BOOLEAN NOT NULL DEFAULT false,
    "canApproveWriteOff" BOOLEAN NOT NULL DEFAULT false,
    "canApproveCredits" BOOLEAN NOT NULL DEFAULT false,
    "canApproveRefunds" BOOLEAN NOT NULL DEFAULT false,
    "canOfferFinancing" BOOLEAN NOT NULL DEFAULT false,
    "canManageMemberships" BOOLEAN NOT NULL DEFAULT false,
    "canSellMemberships" BOOLEAN NOT NULL DEFAULT false,
    "canManageEquipment" BOOLEAN NOT NULL DEFAULT false,
    "canSubmitWarrantyClaims" BOOLEAN NOT NULL DEFAULT false,
    "canApproveWarrantyWriteOff" BOOLEAN NOT NULL DEFAULT false,
    "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
    "canPurchase" BOOLEAN NOT NULL DEFAULT false,
    "canReceive" BOOLEAN NOT NULL DEFAULT false,
    "canApprovePurchases" BOOLEAN NOT NULL DEFAULT false,
    "canApproveStockVariance" BOOLEAN NOT NULL DEFAULT false,
    "canManagePermits" BOOLEAN NOT NULL DEFAULT false,
    "canManageRefrigerant" BOOLEAN NOT NULL DEFAULT false,
    "canApproveTimesheets" BOOLEAN NOT NULL DEFAULT false,
    "canManagePayPlans" BOOLEAN NOT NULL DEFAULT false,
    "canRunPayroll" BOOLEAN NOT NULL DEFAULT false,
    "canApprovePayPlans" BOOLEAN NOT NULL DEFAULT false,
    "canApprovePayPeriods" BOOLEAN NOT NULL DEFAULT false,
    "canReadPay" BOOLEAN NOT NULL DEFAULT false,
    "canManageAccounting" BOOLEAN NOT NULL DEFAULT false,
    "canCloseAr" BOOLEAN NOT NULL DEFAULT false,
    "canApproveArClose" BOOLEAN NOT NULL DEFAULT false,
    "canSendMessages" BOOLEAN NOT NULL DEFAULT false,
    "canManageTemplates" BOOLEAN NOT NULL DEFAULT false,
    "canRunCampaigns" BOOLEAN NOT NULL DEFAULT false,
    "canApproveCampaigns" BOOLEAN NOT NULL DEFAULT false,
    "canManageAgents" BOOLEAN NOT NULL DEFAULT false,
    "canApproveAgentGrants" BOOLEAN NOT NULL DEFAULT false,
    "canBreakGlass" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "tokenEndpointAuthMethod" TEXT DEFAULT 'client_secret_post',
    "redirectUris" JSONB DEFAULT '[]',
    "scopes" JSONB DEFAULT '["mcp:read","mcp:write"]',
    "webhookUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'active',
    "installUrl" TEXT NOT NULL DEFAULT '',
    "uninstallUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "developerEmail" TEXT NOT NULL DEFAULT '',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT '',
    "termsOfServiceUrl" TEXT NOT NULL DEFAULT '',
    "supportUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "scopes" JSONB DEFAULT '[]',
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "resource" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "isRevoked" TEXT DEFAULT 'false',
    "authorizationCode" TEXT NOT NULL DEFAULT '',
    "refreshToken" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "codeChallenge" TEXT NOT NULL DEFAULT '',
    "codeChallengeMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "timeZone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "line1" TEXT NOT NULL DEFAULT '',
    "line2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "calendar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "trade" TEXT NOT NULL DEFAULT 'hvac',
    "kind" TEXT NOT NULL DEFAULT 'service',
    "brand" TEXT,
    "branch" TEXT,
    "capacityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "revenueAccountCode" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'company',
    "legalName" TEXT NOT NULL DEFAULT 'Openfront Home Services',
    "displayName" TEXT NOT NULL DEFAULT 'Openfront Home Services',
    "homeTimeZone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "defaultCountry" TEXT NOT NULL DEFAULT 'US',
    "allowNegativeTruckStock" BOOLEAN NOT NULL DEFAULT true,
    "estimateValidityDays" INTEGER NOT NULL DEFAULT 30,
    "recallWindowDays" INTEGER NOT NULL DEFAULT 30,
    "discountApprovalThresholdBps" INTEGER NOT NULL DEFAULT 1000,
    "refundApprovalThresholdMinor" BIGINT NOT NULL DEFAULT 50000,
    "poApprovalThresholdMinor" BIGINT NOT NULL DEFAULT 250000,
    "arPeriodCloseDay" INTEGER NOT NULL DEFAULT 5,
    "features" JSONB DEFAULT '{"memberships":true,"inventory":true,"commercial":true,"permits":true,"financing":true,"homeWarranty":true,"payroll":true,"aiVoice":false,"dispatchRecommendations":true}',
    "onboardingStatus" TEXT NOT NULL DEFAULT 'not_started',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorLicense" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL DEFAULT 'hvac',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "issuer" TEXT NOT NULL DEFAULT '',
    "licenseNumber" TEXT NOT NULL DEFAULT '',
    "licenseClass" TEXT NOT NULL DEFAULT '',
    "endorsements" JSONB DEFAULT '[]',
    "responsibleName" TEXT NOT NULL DEFAULT '',
    "insuranceDocument" TEXT,
    "expiresOn" DATE,
    "displayOnDocuments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'payments',
    "providerKey" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "secretRef" TEXT NOT NULL DEFAULT '',
    "config" JSONB,
    "capabilityProfile" JSONB,
    "health" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleLimit" (
    "id" TEXT NOT NULL,
    "role" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'discount_bps',
    "limit" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "branch" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'zip_list',
    "zips" JSONB DEFAULT '[]',
    "polygon" JSONB,
    "travelZone" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "request" TEXT,
    "decidedBy" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "requiredPermission" TEXT NOT NULL DEFAULT '',
    "minApprovals" INTEGER DEFAULT 1,
    "thresholdMinor" BIGINT,
    "expiresAfterMinutes" INTEGER DEFAULT 1440,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "targetList" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "requiredPermission" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT,
    "requestedByAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "actorUser" TEXT,
    "actorAgent" TEXT,
    "approver" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "requestId" TEXT NOT NULL DEFAULT '',
    "prevHash" TEXT NOT NULL DEFAULT '',
    "hash" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCalendar" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'company_hours',
    "timeZone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "weekendDays" JSONB DEFAULT '[0]',
    "regularOpen" TEXT NOT NULL DEFAULT '08:00',
    "regularClose" TEXT NOT NULL DEFAULT '17:00',
    "coverageThrough" DATE,
    "source" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarException" (
    "id" TEXT NOT NULL,
    "calendar" TEXT,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'holiday',
    "openAt" TEXT NOT NULL DEFAULT '',
    "closeAt" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandReceipt" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "command" TEXT NOT NULL DEFAULT '',
    "principalKey" TEXT NOT NULL DEFAULT '',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "requestParams" JSONB,
    "responseCode" TEXT NOT NULL DEFAULT '',
    "responseBody" JSONB,
    "recoveryPoint" TEXT NOT NULL DEFAULT 'completed',
    "completedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "subjectType" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "retentionUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "document" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL DEFAULT '',
    "sha256" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalId" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "system" TEXT NOT NULL DEFAULT '',
    "externalId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "fencingToken" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "storageKey" TEXT NOT NULL DEFAULT '',
    "sha256" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "capturedAt" TIMESTAMP(3),
    "capturedBy" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "author" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipient" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "template" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "dedupeKey" TEXT NOT NULL DEFAULT '',
    "partitionKey" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT NOT NULL DEFAULT '',
    "leaseExpiresAt" TIMESTAMP(3),
    "fencingToken" INTEGER DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderObservation" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT '',
    "connection" TEXT,
    "externalId" TEXT NOT NULL DEFAULT '',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "correlation" JSONB,
    "receivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalSeconds" INTEGER,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretBox" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL DEFAULT '',
    "iv" TEXT NOT NULL DEFAULT '',
    "authTag" TEXT NOT NULL DEFAULT '',
    "keyVersion" INTEGER DEFAULT 1,
    "createdBy" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'slate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "subjectType" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "assignee" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dedupeKey" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyBinding" (
    "id" TEXT NOT NULL,
    "pack" TEXT,
    "scope" TEXT NOT NULL,
    "scopeValue" TEXT NOT NULL DEFAULT '',
    "branch" TEXT,
    "priority" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "pack" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "rules" JSONB,
    "sourceRefs" JSONB,
    "verifiedBy" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approval" TEXT,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "run" TEXT,
    "agent" TEXT,
    "tool" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "inputsHash" TEXT NOT NULL DEFAULT '',
    "inputsProvenance" JSONB,
    "output" JSONB,
    "reasoningSummary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "approval" TEXT,
    "appliedEffects" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentIdentity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'llm_agent',
    "provider" TEXT NOT NULL DEFAULT '',
    "modelRef" TEXT NOT NULL DEFAULT '',
    "owner" TEXT,
    "oauthApp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "limits" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agent" TEXT,
    "trigger" TEXT NOT NULL,
    "callRef" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'started',
    "tokenUsage" JSONB,
    "costMinor" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentScopeGrant" (
    "id" TEXT NOT NULL,
    "agent" TEXT,
    "tool" TEXT NOT NULL DEFAULT '',
    "autonomy" TEXT NOT NULL,
    "constraints" JSONB,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "grantedBy" TEXT,
    "approval" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentScopeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Brand_licenses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_BusinessUnit_serviceAreas" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_BusinessCalendar_composedOf" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApp_clientId_key" ON "OAuthApp"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_token_key" ON "OAuthToken"("token");

-- CreateIndex
CREATE INDEX "OAuthToken_clientId_idx" ON "OAuthToken"("clientId");

-- CreateIndex
CREATE INDEX "OAuthToken_user_idx" ON "OAuthToken"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_calendar_idx" ON "Branch"("calendar");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_logo_idx" ON "Brand"("logo");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

-- CreateIndex
CREATE INDEX "BusinessUnit_brand_idx" ON "BusinessUnit"("brand");

-- CreateIndex
CREATE INDEX "BusinessUnit_branch_idx" ON "BusinessUnit"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_singletonKey_key" ON "CompanySettings"("singletonKey");

-- CreateIndex
CREATE INDEX "ContractorLicense_insuranceDocument_idx" ON "ContractorLicense"("insuranceDocument");

-- CreateIndex
CREATE INDEX "RoleLimit_role_idx" ON "RoleLimit"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleLimit_role_kind_key" ON "RoleLimit"("role", "kind");

-- CreateIndex
CREATE INDEX "ServiceArea_branch_idx" ON "ServiceArea"("branch");

-- CreateIndex
CREATE INDEX "ApprovalDecision_request_idx" ON "ApprovalDecision"("request");

-- CreateIndex
CREATE INDEX "ApprovalDecision_decidedBy_idx" ON "ApprovalDecision"("decidedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_action_key" ON "ApprovalPolicy"("action");

-- CreateIndex
CREATE INDEX "ApprovalRequest_action_idx" ON "ApprovalRequest"("action");

-- CreateIndex
CREATE INDEX "ApprovalRequest_targetId_idx" ON "ApprovalRequest"("targetId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedBy_idx" ON "ApprovalRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedByAgent_idx" ON "ApprovalRequest"("requestedByAgent");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_seq_key" ON "AuditEvent"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventKey_key" ON "AuditEvent"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_hash_key" ON "AuditEvent"("hash");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_idx" ON "AuditEvent"("entityType");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_idx" ON "AuditEvent"("entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUser_idx" ON "AuditEvent"("actorUser");

-- CreateIndex
CREATE INDEX "AuditEvent_actorAgent_idx" ON "AuditEvent"("actorAgent");

-- CreateIndex
CREATE INDEX "AuditEvent_approver_idx" ON "AuditEvent"("approver");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCalendar_code_key" ON "BusinessCalendar"("code");

-- CreateIndex
CREATE INDEX "CalendarException_calendar_idx" ON "CalendarException"("calendar");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarException_calendar_date_key" ON "CalendarException"("calendar", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CommandReceipt_idempotencyKey_key" ON "CommandReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Document_subjectId_idx" ON "Document"("subjectId");

-- CreateIndex
CREATE INDEX "DocumentVersion_document_idx" ON "DocumentVersion"("document");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdBy_idx" ON "DocumentVersion"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_document_number_key" ON "DocumentVersion"("document", "versionNumber");

-- CreateIndex
CREATE INDEX "ExternalId_subjectId_idx" ON "ExternalId"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalId_system_subject_external_key" ON "ExternalId"("system", "subjectType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_key_key" ON "Lease"("key");

-- CreateIndex
CREATE INDEX "Media_subjectId_idx" ON "Media"("subjectId");

-- CreateIndex
CREATE INDEX "Media_capturedBy_idx" ON "Media"("capturedBy");

-- CreateIndex
CREATE INDEX "Note_subjectId_idx" ON "Note"("subjectId");

-- CreateIndex
CREATE INDEX "Note_author_idx" ON "Note"("author");

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_dedupeKey_key" ON "OutboxMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_topic_idx" ON "OutboxMessage"("topic");

-- CreateIndex
CREATE INDEX "OutboxMessage_aggregateId_idx" ON "OutboxMessage"("aggregateId");

-- CreateIndex
CREATE INDEX "OutboxMessage_partitionKey_idx" ON "OutboxMessage"("partitionKey");

-- CreateIndex
CREATE INDEX "ProviderObservation_source_idx" ON "ProviderObservation"("source");

-- CreateIndex
CREATE INDEX "ProviderObservation_connection_idx" ON "ProviderObservation"("connection");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderObservation_source_external_key" ON "ProviderObservation"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderObservation_source_hash_key" ON "ProviderObservation"("source", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_key_key" ON "ScheduledJob"("key");

-- CreateIndex
CREATE INDEX "ScheduledJob_kind_idx" ON "ScheduledJob"("kind");

-- CreateIndex
CREATE INDEX "SecretBox_createdBy_idx" ON "SecretBox"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_key_key" ON "Sequence"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Task_dedupeKey_key" ON "Task"("dedupeKey");

-- CreateIndex
CREATE INDEX "Task_kind_idx" ON "Task"("kind");

-- CreateIndex
CREATE INDEX "Task_subjectId_idx" ON "Task"("subjectId");

-- CreateIndex
CREATE INDEX "Task_assignee_idx" ON "Task"("assignee");

-- CreateIndex
CREATE INDEX "Task_role_idx" ON "Task"("role");

-- CreateIndex
CREATE INDEX "Task_closedBy_idx" ON "Task"("closedBy");

-- CreateIndex
CREATE INDEX "PolicyBinding_pack_idx" ON "PolicyBinding"("pack");

-- CreateIndex
CREATE INDEX "PolicyBinding_branch_idx" ON "PolicyBinding"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyBinding_pack_scope_key" ON "PolicyBinding"("pack", "scope", "scopeValue");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyPack_code_key" ON "PolicyPack"("code");

-- CreateIndex
CREATE INDEX "PolicyVersion_pack_idx" ON "PolicyVersion"("pack");

-- CreateIndex
CREATE INDEX "PolicyVersion_approval_idx" ON "PolicyVersion"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_pack_number_key" ON "PolicyVersion"("pack", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAction_idempotencyKey_key" ON "AgentAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentAction_run_idx" ON "AgentAction"("run");

-- CreateIndex
CREATE INDEX "AgentAction_agent_idx" ON "AgentAction"("agent");

-- CreateIndex
CREATE INDEX "AgentAction_tool_idx" ON "AgentAction"("tool");

-- CreateIndex
CREATE INDEX "AgentAction_approval_idx" ON "AgentAction"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "AgentIdentity_name_key" ON "AgentIdentity"("name");

-- CreateIndex
CREATE INDEX "AgentIdentity_owner_idx" ON "AgentIdentity"("owner");

-- CreateIndex
CREATE INDEX "AgentIdentity_oauthApp_idx" ON "AgentIdentity"("oauthApp");

-- CreateIndex
CREATE INDEX "AgentRun_agent_idx" ON "AgentRun"("agent");

-- CreateIndex
CREATE INDEX "AgentRun_callRef_idx" ON "AgentRun"("callRef");

-- CreateIndex
CREATE INDEX "AgentScopeGrant_agent_idx" ON "AgentScopeGrant"("agent");

-- CreateIndex
CREATE INDEX "AgentScopeGrant_tool_idx" ON "AgentScopeGrant"("tool");

-- CreateIndex
CREATE INDEX "AgentScopeGrant_grantedBy_idx" ON "AgentScopeGrant"("grantedBy");

-- CreateIndex
CREATE INDEX "AgentScopeGrant_approval_idx" ON "AgentScopeGrant"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "_Brand_licenses_AB_unique" ON "_Brand_licenses"("A", "B");

-- CreateIndex
CREATE INDEX "_Brand_licenses_B_index" ON "_Brand_licenses"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BusinessUnit_serviceAreas_AB_unique" ON "_BusinessUnit_serviceAreas"("A", "B");

-- CreateIndex
CREATE INDEX "_BusinessUnit_serviceAreas_B_index" ON "_BusinessUnit_serviceAreas"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BusinessCalendar_composedOf_AB_unique" ON "_BusinessCalendar_composedOf"("A", "B");

-- CreateIndex
CREATE INDEX "_BusinessCalendar_composedOf_B_index" ON "_BusinessCalendar_composedOf"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_calendar_fkey" FOREIGN KEY ("calendar") REFERENCES "BusinessCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_logo_fkey" FOREIGN KEY ("logo") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_brand_fkey" FOREIGN KEY ("brand") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorLicense" ADD CONSTRAINT "ContractorLicense_insuranceDocument_fkey" FOREIGN KEY ("insuranceDocument") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleLimit" ADD CONSTRAINT "RoleLimit_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_request_fkey" FOREIGN KEY ("request") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedByAgent_fkey" FOREIGN KEY ("requestedByAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorAgent_fkey" FOREIGN KEY ("actorAgent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_approver_fkey" FOREIGN KEY ("approver") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarException" ADD CONSTRAINT "CalendarException_calendar_fkey" FOREIGN KEY ("calendar") REFERENCES "BusinessCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_capturedBy_fkey" FOREIGN KEY ("capturedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_fkey" FOREIGN KEY ("recipient") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderObservation" ADD CONSTRAINT "ProviderObservation_connection_fkey" FOREIGN KEY ("connection") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretBox" ADD CONSTRAINT "SecretBox_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignee_fkey" FOREIGN KEY ("assignee") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyBinding" ADD CONSTRAINT "PolicyBinding_pack_fkey" FOREIGN KEY ("pack") REFERENCES "PolicyPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyBinding" ADD CONSTRAINT "PolicyBinding_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_pack_fkey" FOREIGN KEY ("pack") REFERENCES "PolicyPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_run_fkey" FOREIGN KEY ("run") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_agent_fkey" FOREIGN KEY ("agent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentIdentity" ADD CONSTRAINT "AgentIdentity_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentIdentity" ADD CONSTRAINT "AgentIdentity_oauthApp_fkey" FOREIGN KEY ("oauthApp") REFERENCES "OAuthApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agent_fkey" FOREIGN KEY ("agent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentScopeGrant" ADD CONSTRAINT "AgentScopeGrant_agent_fkey" FOREIGN KEY ("agent") REFERENCES "AgentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentScopeGrant" ADD CONSTRAINT "AgentScopeGrant_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentScopeGrant" ADD CONSTRAINT "AgentScopeGrant_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Brand_licenses" ADD CONSTRAINT "_Brand_licenses_A_fkey" FOREIGN KEY ("A") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Brand_licenses" ADD CONSTRAINT "_Brand_licenses_B_fkey" FOREIGN KEY ("B") REFERENCES "ContractorLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessUnit_serviceAreas" ADD CONSTRAINT "_BusinessUnit_serviceAreas_A_fkey" FOREIGN KEY ("A") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessUnit_serviceAreas" ADD CONSTRAINT "_BusinessUnit_serviceAreas_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessCalendar_composedOf" ADD CONSTRAINT "_BusinessCalendar_composedOf_A_fkey" FOREIGN KEY ("A") REFERENCES "BusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessCalendar_composedOf" ADD CONSTRAINT "_BusinessCalendar_composedOf_B_fkey" FOREIGN KEY ("B") REFERENCES "BusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Home services guards (SCHEMA G8, §14, §21) ─────────────────────────────────────
-- Immutable history: audit events, approval decisions and document versions can never be
-- updated or deleted, whatever the application does. Corrections are new rows.
CREATE OR REPLACE FUNCTION hs_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "AuditEvent_no_truncate" BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "ApprovalDecision_append_only" BEFORE UPDATE OR DELETE ON "ApprovalDecision" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "ApprovalDecision_no_truncate" BEFORE TRUNCATE ON "ApprovalDecision" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "DocumentVersion_append_only" BEFORE UPDATE OR DELETE ON "DocumentVersion" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "DocumentVersion_no_truncate" BEFORE TRUNCATE ON "DocumentVersion" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- Provider observations are evidence: the received content never changes; only appliedAt is set later.
CREATE OR REPLACE FUNCTION hs_observation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ProviderObservation rows are kept as evidence' USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.source, NEW.kind, NEW."externalId", NEW."contentHash", NEW."signatureVerified", NEW.payload, NEW."receivedAt", NEW.connection)
     IS DISTINCT FROM (OLD.source, OLD.kind, OLD."externalId", OLD."contentHash", OLD."signatureVerified", OLD.payload, OLD."receivedAt", OLD.connection) THEN
    RAISE EXCEPTION 'ProviderObservation content is immutable; only appliedAt may change' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."appliedAt" IS NOT NULL AND NEW."appliedAt" IS DISTINCT FROM OLD."appliedAt" THEN
    RAISE EXCEPTION 'ProviderObservation was already applied' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ProviderObservation_guard" BEFORE UPDATE OR DELETE ON "ProviderObservation" FOR EACH ROW EXECUTE FUNCTION hs_observation_guard();

-- A policy version is frozen once active: its rules, sources and dates can't change. It may only be
-- retired (status active → retired, with effectiveTo). A new version is a new row.
CREATE OR REPLACE FUNCTION hs_policy_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'retired') THEN
      RAISE EXCEPTION 'An active or retired PolicyVersion cannot be deleted' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('active', 'retired') THEN
    IF (NEW.pack, NEW."versionNumber", NEW."effectiveFrom", NEW.rules, NEW."sourceRefs", NEW."contentHash")
       IS DISTINCT FROM (OLD.pack, OLD."versionNumber", OLD."effectiveFrom", OLD.rules, OLD."sourceRefs", OLD."contentHash") THEN
      RAISE EXCEPTION 'PolicyVersion % is % and immutable; publish a new version', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
      RAISE EXCEPTION 'A retired PolicyVersion cannot be reactivated' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PolicyVersion_guard" BEFORE UPDATE OR DELETE ON "PolicyVersion" FOR EACH ROW EXECUTE FUNCTION hs_policy_version_guard();

-- An agent grant names one agent and one tool for its whole life; revoking is a status change.
CREATE OR REPLACE FUNCTION hs_agent_grant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AgentScopeGrant rows are kept; revoke instead' USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.agent, NEW.tool, NEW."grantedBy", NEW.approval) IS DISTINCT FROM (OLD.agent, OLD.tool, OLD."grantedBy", OLD.approval) THEN
    RAISE EXCEPTION 'AgentScopeGrant agent, tool and approver are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'A revoked grant stays revoked; grant again' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "AgentScopeGrant_guard" BEFORE UPDATE OR DELETE ON "AgentScopeGrant" FOR EACH ROW EXECUTE FUNCTION hs_agent_grant_guard();

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_seq_positive" CHECK (seq > 0);
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_hash_format" CHECK (hash ~ '^[0-9a-f]{64}$' AND "prevHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_attempts_nonnegative" CHECK (attempts >= 0);
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_fencing_positive" CHECK ("fencingToken" > 0);
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_next_positive" CHECK ("nextValue" > 0);
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_min_approvals" CHECK ("minApprovals" >= 1);
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_threshold_nonnegative" CHECK ("thresholdMinor" IS NULL OR "thresholdMinor" >= 0);
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_thresholds" CHECK ("discountApprovalThresholdBps" BETWEEN 0 AND 10000 AND "refundApprovalThresholdMinor" >= 0 AND "poApprovalThresholdMinor" >= 0);
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_dates" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_hash_format" CHECK ("contentHash" ~ '^[0-9a-f]{64}$' OR status = 'draft');

-- Status values are closed sets (lifecycle fields are server-written; this is the database backstop).
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_status_valid" CHECK ("onboardingStatus" IN ('not_started', 'in_progress', 'completed', 'dismissed'));
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_status_valid" CHECK (status IN ('pending', 'leased', 'delivered', 'failed', 'dead'));
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_status_valid" CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled'));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_status_valid" CHECK (status IN ('pending', 'sent', 'failed'));
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_status_valid" CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'));
ALTER TABLE "Task" ADD CONSTRAINT "Task_status_valid" CHECK (status IN ('open', 'in_progress', 'done', 'cancelled'));
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_status_valid" CHECK (status IN ('draft', 'pending_approval', 'active', 'retired'));
ALTER TABLE "PolicyBinding" ADD CONSTRAINT "PolicyBinding_status_valid" CHECK (status IN ('active', 'retired'));
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_status_valid" CHECK (status IN ('disconnected', 'connected', 'degraded', 'disabled'));
ALTER TABLE "AgentIdentity" ADD CONSTRAINT "AgentIdentity_status_valid" CHECK (status IN ('active', 'paused', 'revoked'));
ALTER TABLE "AgentScopeGrant" ADD CONSTRAINT "AgentScopeGrant_status_valid" CHECK (status IN ('requested', 'active', 'revoked'));
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_status_valid" CHECK (status IN ('started', 'completed', 'failed', 'aborted'));
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_status_valid" CHECK (status IN ('proposed', 'awaiting_approval', 'approved', 'rejected', 'applied', 'failed', 'expired'));

ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "Task_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "PolicyBinding" ADD CONSTRAINT "PolicyBinding_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "AgentIdentity" ADD CONSTRAINT "AgentIdentity_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "AgentScopeGrant" ADD CONSTRAINT "AgentScopeGrant_version_nonnegative" CHECK (version >= 0);

-- Partial unique: one active grant per agent and tool.
CREATE UNIQUE INDEX "AgentScopeGrant_one_active" ON "AgentScopeGrant" (agent, tool) WHERE status = 'active';

-- Due-work indexes for the workers (§21).
CREATE INDEX "OutboxMessage_due_idx" ON "OutboxMessage" ("nextAttemptAt", "createdAt") WHERE status IN ('pending', 'failed');
CREATE INDEX "OutboxMessage_leased_idx" ON "OutboxMessage" ("leaseExpiresAt") WHERE status = 'leased';
CREATE INDEX "ScheduledJob_due_idx" ON "ScheduledJob" ("dueAt") WHERE status = 'pending';
