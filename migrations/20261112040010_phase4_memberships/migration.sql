-- CreateTable
CREATE TABLE "EntitlementEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "grant" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'debit',
    "quantity" INTEGER NOT NULL,
    "job" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "grantKey" TEXT NOT NULL DEFAULT '',
    "membership" TEXT,
    "term" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "windowStart" DATE,
    "windowEnd" DATE,
    "rolloverPolicy" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "publicCode" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "location" TEXT,
    "plan" TEXT,
    "planVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "startsOn" DATE,
    "paymentMethodRef" TEXT NOT NULL DEFAULT '',
    "paymentMethodLabel" TEXT NOT NULL DEFAULT '',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "autoRenewConsent" TEXT,
    "signupChannel" TEXT NOT NULL DEFAULT 'office',
    "soldBy" TEXT,
    "transferredTo" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelEffectiveOn" DATE,
    "refundOwedMinor" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipBillingAttempt" (
    "id" TEXT NOT NULL,
    "attemptKey" TEXT NOT NULL DEFAULT '',
    "membership" TEXT,
    "term" TEXT,
    "termNumber" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "dueOn" DATE,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "providerRef" TEXT NOT NULL DEFAULT '',
    "failureNote" TEXT NOT NULL DEFAULT '',
    "run" TEXT,
    "invoice" TEXT,
    "payment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipBillingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipBillingRun" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'running',
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "chargedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "remainingCount" INTEGER NOT NULL DEFAULT 0,
    "chargedMinor" BIGINT NOT NULL DEFAULT 0,
    "startedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipBillingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlanVersion" (
    "id" TEXT NOT NULL,
    "plan" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priceMinor" BIGINT NOT NULL DEFAULT 0,
    "billingFrequency" TEXT NOT NULL DEFAULT 'annual',
    "termMonths" INTEGER NOT NULL DEFAULT 12,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalNoticeDays" INTEGER NOT NULL DEFAULT 30,
    "entitlements" JSONB,
    "benefits" JSONB,
    "cancellationRefundMethod" TEXT NOT NULL DEFAULT 'none',
    "cancellationRefundDays" INTEGER NOT NULL DEFAULT 0,
    "autoRenewalPolicyVersion" TEXT NOT NULL DEFAULT '',
    "consentWordingVersion" TEXT NOT NULL DEFAULT '',
    "consentWording" TEXT NOT NULL DEFAULT '',
    "activatedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipTerm" (
    "id" TEXT NOT NULL,
    "termKey" TEXT NOT NULL DEFAULT '',
    "membership" TEXT,
    "termNumber" INTEGER NOT NULL,
    "planVersion" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "billingFrequency" TEXT NOT NULL DEFAULT 'annual',
    "priceMinor" BIGINT NOT NULL DEFAULT 0,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringServiceEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "membership" TEXT,
    "agreement" TEXT,
    "grant" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "dueFrom" DATE,
    "dueBy" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "job" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringServiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalNotice" (
    "id" TEXT NOT NULL,
    "noticeKey" TEXT NOT NULL DEFAULT '',
    "membership" TEXT,
    "term" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'renewal_coming',
    "dueOn" DATE,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "preparedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAgreement" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "location" TEXT,
    "payer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startsOn" DATE,
    "endsOn" DATE,
    "scope" TEXT NOT NULL DEFAULT '',
    "visitMonths" JSONB,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "nteMinor" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementEntry_key_key" ON "EntitlementEntry"("key");

-- CreateIndex
CREATE INDEX "EntitlementEntry_grant_idx" ON "EntitlementEntry"("grant");

-- CreateIndex
CREATE INDEX "EntitlementEntry_job_idx" ON "EntitlementEntry"("job");

-- CreateIndex
CREATE INDEX "EntitlementEntry_createdBy_idx" ON "EntitlementEntry"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementGrant_grantKey_key" ON "EntitlementGrant"("grantKey");

-- CreateIndex
CREATE INDEX "EntitlementGrant_membership_idx" ON "EntitlementGrant"("membership");

-- CreateIndex
CREATE INDEX "EntitlementGrant_term_idx" ON "EntitlementGrant"("term");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_ref_key" ON "Membership"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_publicCode_key" ON "Membership"("publicCode");

-- CreateIndex
CREATE INDEX "Membership_customer_idx" ON "Membership"("customer");

-- CreateIndex
CREATE INDEX "Membership_location_idx" ON "Membership"("location");

-- CreateIndex
CREATE INDEX "Membership_plan_idx" ON "Membership"("plan");

-- CreateIndex
CREATE INDEX "Membership_planVersion_idx" ON "Membership"("planVersion");

-- CreateIndex
CREATE INDEX "Membership_autoRenewConsent_idx" ON "Membership"("autoRenewConsent");

-- CreateIndex
CREATE INDEX "Membership_soldBy_idx" ON "Membership"("soldBy");

-- CreateIndex
CREATE INDEX "Membership_transferredTo_idx" ON "Membership"("transferredTo");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipBillingAttempt_attemptKey_key" ON "MembershipBillingAttempt"("attemptKey");

-- CreateIndex
CREATE INDEX "MembershipBillingAttempt_membership_idx" ON "MembershipBillingAttempt"("membership");

-- CreateIndex
CREATE INDEX "MembershipBillingAttempt_term_idx" ON "MembershipBillingAttempt"("term");

-- CreateIndex
CREATE INDEX "MembershipBillingAttempt_run_idx" ON "MembershipBillingAttempt"("run");

-- CreateIndex
CREATE INDEX "MembershipBillingAttempt_invoice_idx" ON "MembershipBillingAttempt"("invoice");

-- CreateIndex
CREATE INDEX "MembershipBillingAttempt_payment_idx" ON "MembershipBillingAttempt"("payment");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipBillingRun_ref_key" ON "MembershipBillingRun"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipBillingRun_idempotencyKey_key" ON "MembershipBillingRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MembershipBillingRun_startedBy_idx" ON "MembershipBillingRun"("startedBy");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_code_key" ON "MembershipPlan"("code");

-- CreateIndex
CREATE INDEX "MembershipPlanVersion_plan_idx" ON "MembershipPlanVersion"("plan");

-- CreateIndex
CREATE INDEX "MembershipPlanVersion_createdBy_idx" ON "MembershipPlanVersion"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTerm_termKey_key" ON "MembershipTerm"("termKey");

-- CreateIndex
CREATE INDEX "MembershipTerm_membership_idx" ON "MembershipTerm"("membership");

-- CreateIndex
CREATE INDEX "MembershipTerm_planVersion_idx" ON "MembershipTerm"("planVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringServiceEvent_eventKey_key" ON "RecurringServiceEvent"("eventKey");

-- CreateIndex
CREATE INDEX "RecurringServiceEvent_membership_idx" ON "RecurringServiceEvent"("membership");

-- CreateIndex
CREATE INDEX "RecurringServiceEvent_agreement_idx" ON "RecurringServiceEvent"("agreement");

-- CreateIndex
CREATE INDEX "RecurringServiceEvent_grant_idx" ON "RecurringServiceEvent"("grant");

-- CreateIndex
CREATE INDEX "RecurringServiceEvent_job_idx" ON "RecurringServiceEvent"("job");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalNotice_noticeKey_key" ON "RenewalNotice"("noticeKey");

-- CreateIndex
CREATE INDEX "RenewalNotice_membership_idx" ON "RenewalNotice"("membership");

-- CreateIndex
CREATE INDEX "RenewalNotice_term_idx" ON "RenewalNotice"("term");

-- CreateIndex
CREATE INDEX "RenewalNotice_preparedBy_idx" ON "RenewalNotice"("preparedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAgreement_ref_key" ON "ServiceAgreement"("ref");

-- CreateIndex
CREATE INDEX "ServiceAgreement_customer_idx" ON "ServiceAgreement"("customer");

-- CreateIndex
CREATE INDEX "ServiceAgreement_location_idx" ON "ServiceAgreement"("location");

-- CreateIndex
CREATE INDEX "ServiceAgreement_payer_idx" ON "ServiceAgreement"("payer");

-- AddForeignKey
ALTER TABLE "EntitlementEntry" ADD CONSTRAINT "EntitlementEntry_grant_fkey" FOREIGN KEY ("grant") REFERENCES "EntitlementGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementEntry" ADD CONSTRAINT "EntitlementEntry_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementEntry" ADD CONSTRAINT "EntitlementEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_term_fkey" FOREIGN KEY ("term") REFERENCES "MembershipTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_plan_fkey" FOREIGN KEY ("plan") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planVersion_fkey" FOREIGN KEY ("planVersion") REFERENCES "MembershipPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_autoRenewConsent_fkey" FOREIGN KEY ("autoRenewConsent") REFERENCES "ConsentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_soldBy_fkey" FOREIGN KEY ("soldBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_transferredTo_fkey" FOREIGN KEY ("transferredTo") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_term_fkey" FOREIGN KEY ("term") REFERENCES "MembershipTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_run_fkey" FOREIGN KEY ("run") REFERENCES "MembershipBillingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBillingRun" ADD CONSTRAINT "MembershipBillingRun_startedBy_fkey" FOREIGN KEY ("startedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlanVersion" ADD CONSTRAINT "MembershipPlanVersion_plan_fkey" FOREIGN KEY ("plan") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlanVersion" ADD CONSTRAINT "MembershipPlanVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_planVersion_fkey" FOREIGN KEY ("planVersion") REFERENCES "MembershipPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringServiceEvent" ADD CONSTRAINT "RecurringServiceEvent_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringServiceEvent" ADD CONSTRAINT "RecurringServiceEvent_agreement_fkey" FOREIGN KEY ("agreement") REFERENCES "ServiceAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringServiceEvent" ADD CONSTRAINT "RecurringServiceEvent_grant_fkey" FOREIGN KEY ("grant") REFERENCES "EntitlementGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringServiceEvent" ADD CONSTRAINT "RecurringServiceEvent_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalNotice" ADD CONSTRAINT "RenewalNotice_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalNotice" ADD CONSTRAINT "RenewalNotice_term_fkey" FOREIGN KEY ("term") REFERENCES "MembershipTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalNotice" ADD CONSTRAINT "RenewalNotice_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_location_fkey" FOREIGN KEY ("location") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_payer_fkey" FOREIGN KEY ("payer") REFERENCES "PayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Guards (Phase 4) ─────────────────────────────────────────────────────────────────────────────────────────────

-- Entitlement entries are append-only. Debits and expiries take away (negative), restores and rollovers give (positive).
ALTER TABLE "EntitlementEntry" ADD CONSTRAINT "EntitlementEntry_valid" CHECK ("grant" IS NOT NULL AND quantity <> 0 AND key <> ''
  AND kind IN ('debit', 'restore', 'expire', 'rollover') AND ((kind IN ('debit', 'expire') AND quantity < 0) OR (kind IN ('restore', 'rollover') AND quantity > 0)));
CREATE TRIGGER "EntitlementEntry_append_only" BEFORE UPDATE OR DELETE ON "EntitlementEntry" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "EntitlementEntry_no_truncate" BEFORE TRUNCATE ON "EntitlementEntry" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- A grant's balance never goes below zero or above what it was granted plus what came in. The grant row is locked first, so two
-- bookings at once take turns and the second sees the first (the application cannot get this wrong).
CREATE OR REPLACE FUNCTION hs_entitlement_floor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE granted integer; used integer; ext integer;
BEGIN
  SELECT quantity INTO granted FROM "EntitlementGrant" WHERE id = NEW."grant" FOR UPDATE;
  IF granted IS NULL THEN RAISE EXCEPTION 'Entitlement entry has no grant' USING ERRCODE = 'check_violation'; END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO used FROM "EntitlementEntry" WHERE "grant" = NEW."grant";
  IF granted + used + NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Entitlement balance cannot go below zero' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.kind = 'restore' THEN
    SELECT COALESCE(SUM(quantity), 0) INTO ext FROM "EntitlementEntry" WHERE "grant" = NEW."grant" AND kind IN ('debit', 'restore');
  END IF;
  IF NEW.kind = 'restore' AND ext + NEW.quantity > 0 THEN
    RAISE EXCEPTION 'Entitlement restore would exceed what was granted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EntitlementEntry_floor" BEFORE INSERT ON "EntitlementEntry" FOR EACH ROW EXECUTE FUNCTION hs_entitlement_floor();

ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_valid" CHECK (quantity >= 0 AND code <> '' AND "windowStart" IS NOT NULL AND "windowEnd" IS NOT NULL AND "windowStart" <= "windowEnd" AND "rolloverPolicy" IN ('none', 'one_term'));
CREATE OR REPLACE FUNCTION hs_membership_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% rows are never deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EntitlementGrant_frozen" BEFORE UPDATE OR DELETE ON "EntitlementGrant" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "EntitlementGrant_no_truncate" BEFORE TRUNCATE ON "EntitlementGrant" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- A plan version is editable only while it is a draft. Once active it never changes except to retire.
ALTER TABLE "MembershipPlanVersion" ADD CONSTRAINT "MembershipPlanVersion_valid" CHECK ("priceMinor" >= 0 AND "termMonths" BETWEEN 1 AND 60 AND "renewalNoticeDays" BETWEEN 0 AND 120
  AND "cancellationRefundDays" >= 0 AND status IN ('draft', 'active', 'retired') AND "billingFrequency" IN ('annual', 'monthly')
  AND "cancellationRefundMethod" IN ('none', 'prorata', 'full_within_days')
  AND (status = 'draft' OR "activatedAt" IS NOT NULL)
  AND (status = 'draft' OR NOT "autoRenew" OR ("autoRenewalPolicyVersion" <> '' AND "consentWordingVersion" <> '' AND "consentWording" <> '')));
CREATE OR REPLACE FUNCTION hs_plan_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'An active plan version is never deleted' USING ERRCODE = 'check_violation'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF OLD.status = 'retired' THEN RAISE EXCEPTION 'A retired plan version never changes' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.status NOT IN ('active', 'retired')
     OR (NEW.plan, NEW."versionNumber", NEW.label, NEW."priceMinor", NEW."billingFrequency", NEW."termMonths", NEW."autoRenew", NEW."renewalNoticeDays",
         NEW.entitlements, NEW.benefits, NEW."cancellationRefundMethod", NEW."cancellationRefundDays", NEW."autoRenewalPolicyVersion", NEW."consentWordingVersion", NEW."consentWording", NEW."activatedAt")
        IS DISTINCT FROM
        (OLD.plan, OLD."versionNumber", OLD.label, OLD."priceMinor", OLD."billingFrequency", OLD."termMonths", OLD."autoRenew", OLD."renewalNoticeDays",
         OLD.entitlements, OLD.benefits, OLD."cancellationRefundMethod", OLD."cancellationRefundDays", OLD."autoRenewalPolicyVersion", OLD."consentWordingVersion", OLD."consentWording", OLD."activatedAt") THEN
    RAISE EXCEPTION 'An active plan version is frozen; make a new version' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MembershipPlanVersion_guard" BEFORE UPDATE OR DELETE ON "MembershipPlanVersion" FOR EACH ROW EXECUTE FUNCTION hs_plan_version_guard();
CREATE UNIQUE INDEX "MembershipPlanVersion_plan_number_key" ON "MembershipPlanVersion"(plan, "versionNumber") WHERE plan IS NOT NULL;
CREATE UNIQUE INDEX "MembershipPlanVersion_one_draft_key" ON "MembershipPlanVersion"(plan) WHERE status = 'draft' AND plan IS NOT NULL;

ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_valid" CHECK (status IN ('active', 'retired') AND code ~ '^[a-z0-9][a-z0-9-]{1,39}$');
CREATE TRIGGER "MembershipPlan_no_delete" BEFORE DELETE ON "MembershipPlan" FOR EACH ROW EXECUTE FUNCTION hs_membership_frozen();

-- Memberships are never deleted; a cancelled, expired or transferred one stays as history.
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_valid" CHECK ("refundOwedMinor" >= 0
  AND status IN ('pending_payment', 'active', 'past_due', 'suspended', 'renewal_due', 'expired', 'cancelled', 'transferred')
  AND "signupChannel" IN ('office', 'field', 'phone', 'online')
  AND (status <> 'cancelled' OR "cancelledAt" IS NOT NULL)
  AND (NOT "autoRenew" OR "autoRenewConsent" IS NOT NULL));
CREATE OR REPLACE FUNCTION hs_membership_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Membership rows are never deleted' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status IN ('cancelled', 'transferred', 'expired') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'A % membership does not come back', OLD.status USING ERRCODE = 'check_violation'; END IF;
  IF OLD."autoRenewConsent" IS NOT NULL AND NEW."autoRenewConsent" IS NULL THEN RAISE EXCEPTION 'The auto-renew consent on file is never removed' USING ERRCODE = 'check_violation'; END IF;
  IF (OLD.customer, OLD."startsOn", OLD.plan, OLD."planVersion", OLD.ref) IS DISTINCT FROM (NEW.customer, NEW."startsOn", NEW.plan, NEW."planVersion", NEW.ref) THEN
    RAISE EXCEPTION 'A membership keeps its customer, plan and start' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Membership_guard" BEFORE UPDATE OR DELETE ON "Membership" FOR EACH ROW EXECUTE FUNCTION hs_membership_guard();

-- A term never changes after it is written, except to be cancelled.
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_valid" CHECK ("startsOn" IS NOT NULL AND "endsOn" IS NOT NULL AND "startsOn" <= "endsOn" AND "priceMinor" >= 0 AND slots >= 1 AND "termNumber" >= 1
  AND status IN ('active', 'cancelled') AND "billingFrequency" IN ('annual', 'monthly'));
CREATE UNIQUE INDEX "MembershipTerm_membership_number_key" ON "MembershipTerm"(membership, "termNumber") WHERE membership IS NOT NULL;
CREATE OR REPLACE FUNCTION hs_term_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Membership terms are never deleted' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status = 'cancelled' OR (OLD.membership, OLD."termNumber", OLD."planVersion", OLD."startsOn", OLD."endsOn", OLD."billingFrequency", OLD."priceMinor", OLD.slots, OLD."termKey")
       IS DISTINCT FROM (NEW.membership, NEW."termNumber", NEW."planVersion", NEW."startsOn", NEW."endsOn", NEW."billingFrequency", NEW."priceMinor", NEW.slots, NEW."termKey") THEN
    RAISE EXCEPTION 'A membership term is fixed once written' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MembershipTerm_guard" BEFORE UPDATE OR DELETE ON "MembershipTerm" FOR EACH ROW EXECUTE FUNCTION hs_term_guard();

-- One billing attempt per membership, term and payment slot, ever. A crash, a retry or a second click finds this row.
ALTER TABLE "MembershipBillingAttempt" ADD CONSTRAINT "MembershipBillingAttempt_valid" CHECK ("amountMinor" >= 0 AND (status = 'queued' OR "amountMinor" > 0) AND slot >= 0 AND "termNumber" >= 1 AND generation >= 1
  AND status IN ('queued', 'charging', 'succeeded', 'failed', 'unknown') AND (status <> 'succeeded' OR (payment IS NOT NULL AND invoice IS NOT NULL)));
CREATE UNIQUE INDEX "MembershipBillingAttempt_slot_key" ON "MembershipBillingAttempt"(membership, "termNumber", slot) WHERE membership IS NOT NULL;
CREATE UNIQUE INDEX "MembershipBillingAttempt_payment_key" ON "MembershipBillingAttempt"(payment) WHERE payment IS NOT NULL;
CREATE UNIQUE INDEX "MembershipBillingAttempt_invoice_key" ON "MembershipBillingAttempt"(invoice) WHERE invoice IS NOT NULL;
CREATE OR REPLACE FUNCTION hs_billing_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Billing attempts are never deleted' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status = 'succeeded' THEN RAISE EXCEPTION 'A charged attempt never changes' USING ERRCODE = 'check_violation'; END IF;
  IF (OLD.membership, OLD."termNumber", OLD.slot, OLD."attemptKey") IS DISTINCT FROM (NEW.membership, NEW."termNumber", NEW.slot, NEW."attemptKey") THEN
    RAISE EXCEPTION 'An attempt keeps its membership, term and slot' USING ERRCODE = 'check_violation';
  END IF;
  -- The amount is the invoice total, known once the invoice posts (tax). After that it is fixed.
  IF OLD."amountMinor" <> NEW."amountMinor" AND (OLD.invoice IS NOT NULL OR OLD.status <> 'queued') THEN
    RAISE EXCEPTION 'The amount of an attempt is fixed once its invoice is posted' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.generation < OLD.generation OR (NEW.generation > OLD.generation AND OLD.status <> 'failed') THEN
    RAISE EXCEPTION 'A new processor try needs a confirmed failure first' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MembershipBillingAttempt_guard" BEFORE UPDATE OR DELETE ON "MembershipBillingAttempt" FOR EACH ROW EXECUTE FUNCTION hs_billing_attempt_guard();

ALTER TABLE "MembershipBillingRun" ADD CONSTRAINT "MembershipBillingRun_valid" CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$' AND status IN ('running', 'completed') AND "chargedMinor" >= 0);
CREATE TRIGGER "MembershipBillingRun_no_delete" BEFORE DELETE ON "MembershipBillingRun" FOR EACH ROW EXECUTE FUNCTION hs_membership_frozen();

ALTER TABLE "RecurringServiceEvent" ADD CONSTRAINT "RecurringServiceEvent_valid" CHECK (status IN ('open', 'booked', 'skipped') AND "dueFrom" IS NOT NULL AND "dueBy" IS NOT NULL AND "dueFrom" <= "dueBy"
  AND ((membership IS NOT NULL) <> (agreement IS NOT NULL)));
CREATE TRIGGER "RecurringServiceEvent_no_delete" BEFORE DELETE ON "RecurringServiceEvent" FOR EACH ROW EXECUTE FUNCTION hs_membership_frozen();
ALTER TABLE "RenewalNotice" ADD CONSTRAINT "RenewalNotice_valid" CHECK (status IN ('drafted', 'contacted', 'dismissed') AND kind IN ('renewal_coming', 'auto_renew_reminder'));
CREATE TRIGGER "RenewalNotice_no_delete" BEFORE DELETE ON "RenewalNotice" FOR EACH ROW EXECUTE FUNCTION hs_membership_frozen();
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_valid" CHECK (status IN ('draft', 'active', 'ended') AND "nteMinor" >= 0 AND ("startsOn" IS NULL OR "endsOn" IS NULL OR "startsOn" <= "endsOn"));
CREATE TRIGGER "ServiceAgreement_no_delete" BEFORE DELETE ON "ServiceAgreement" FOR EACH ROW EXECUTE FUNCTION hs_membership_frozen();
