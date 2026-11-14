CREATE TABLE "CommissionAttribution" (
    "id" TEXT NOT NULL,
    "workLine" TEXT,
    "membership" TEXT,
    "financingApplication" TEXT,
    "employee" TEXT,
    "role" TEXT NOT NULL,
    "sharePct" DECIMAL(12,6) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningLine" (
    "id" TEXT NOT NULL,
    "payPeriod" TEXT,
    "employee" TEXT,
    "workweekStart" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "hours" DECIMAL(18,4),
    "rateMinor" BIGINT NOT NULL DEFAULT 0,
    "amountMinor" BIGINT NOT NULL,
    "basisType" TEXT NOT NULL DEFAULT '',
    "basisId" TEXT NOT NULL DEFAULT '',
    "basisVersion" INTEGER DEFAULT 0,
    "payPlanVersion" TEXT,
    "earningCode" TEXT NOT NULL DEFAULT '',
    "regularRateReview" BOOLEAN NOT NULL DEFAULT false,
    "reverses" TEXT,
    "lineKey" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPeriod" (
    "id" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "payDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "approval" TEXT,
    "inputsHash" TEXT NOT NULL DEFAULT '',
    "summary" JSONB,
    "calculatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPlanAssignment" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "planVersion" TEXT,
    "from" DATE NOT NULL,
    "to" DATE,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPlanVersion" (
    "id" TEXT NOT NULL,
    "plan" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "hourlyRates" JSONB,
    "overtime" JSONB,
    "commission" JSONB,
    "spiffs" JSONB,
    "clawbacks" JSONB,
    "laterEngine" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "approval" TEXT,
    "activatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollExportBatch" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "payPeriod" TEXT,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "lineCount" INTEGER DEFAULT 0,
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "sha256" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSegment" (
    "id" TEXT NOT NULL,
    "timesheet" TEXT,
    "kind" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(18,4),
    "visit" TEXT,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL DEFAULT '',
    "adjusts" TEXT,
    "approval" TEXT,
    "payPeriod" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "workDate" DATE NOT NULL,
    "workweekStart" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "submittedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "totalHours" DECIMAL(18,4),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionAttribution_workLine_idx" ON "CommissionAttribution"("workLine");

-- CreateIndex
CREATE INDEX "CommissionAttribution_membership_idx" ON "CommissionAttribution"("membership");

-- CreateIndex
CREATE INDEX "CommissionAttribution_financingApplication_idx" ON "CommissionAttribution"("financingApplication");

-- CreateIndex
CREATE INDEX "CommissionAttribution_employee_idx" ON "CommissionAttribution"("employee");

-- CreateIndex
CREATE INDEX "CommissionAttribution_createdBy_idx" ON "CommissionAttribution"("createdBy");

-- CreateIndex
CREATE INDEX "EarningLine_payPeriod_idx" ON "EarningLine"("payPeriod");

-- CreateIndex
CREATE INDEX "EarningLine_employee_idx" ON "EarningLine"("employee");

-- CreateIndex
CREATE INDEX "EarningLine_basisId_idx" ON "EarningLine"("basisId");

-- CreateIndex
CREATE INDEX "EarningLine_payPlanVersion_idx" ON "EarningLine"("payPlanVersion");

-- CreateIndex
CREATE INDEX "EarningLine_reverses_idx" ON "EarningLine"("reverses");

-- CreateIndex
CREATE INDEX "EarningLine_lineKey_idx" ON "EarningLine"("lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "EarningLine_period_line_key" ON "EarningLine"("payPeriod", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayPeriod_startsOn_key" ON "PayPeriod"("startsOn");

-- CreateIndex
CREATE INDEX "PayPeriod_approval_idx" ON "PayPeriod"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "PayPlan_name_key" ON "PayPlan"("name");

-- CreateIndex
CREATE INDEX "PayPlanAssignment_employee_idx" ON "PayPlanAssignment"("employee");

-- CreateIndex
CREATE INDEX "PayPlanAssignment_planVersion_idx" ON "PayPlanAssignment"("planVersion");

-- CreateIndex
CREATE INDEX "PayPlanAssignment_createdBy_idx" ON "PayPlanAssignment"("createdBy");

-- CreateIndex
CREATE INDEX "PayPlanVersion_plan_idx" ON "PayPlanVersion"("plan");

-- CreateIndex
CREATE INDEX "PayPlanVersion_approval_idx" ON "PayPlanVersion"("approval");

-- CreateIndex
CREATE UNIQUE INDEX "PayPlanVersion_plan_number_key" ON "PayPlanVersion"("plan", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollExportBatch_ref_key" ON "PayrollExportBatch"("ref");

-- CreateIndex
CREATE INDEX "PayrollExportBatch_payPeriod_idx" ON "PayrollExportBatch"("payPeriod");

-- CreateIndex
CREATE INDEX "PayrollExportBatch_createdBy_idx" ON "PayrollExportBatch"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollExportBatch_period_target_key" ON "PayrollExportBatch"("payPeriod", "target");

-- CreateIndex
CREATE INDEX "TimeSegment_timesheet_idx" ON "TimeSegment"("timesheet");

-- CreateIndex
CREATE INDEX "TimeSegment_visit_idx" ON "TimeSegment"("visit");

-- CreateIndex
CREATE INDEX "TimeSegment_sourceKey_idx" ON "TimeSegment"("sourceKey");

-- CreateIndex
CREATE INDEX "TimeSegment_adjusts_idx" ON "TimeSegment"("adjusts");

-- CreateIndex
CREATE INDEX "TimeSegment_approval_idx" ON "TimeSegment"("approval");

-- CreateIndex
CREATE INDEX "TimeSegment_payPeriod_idx" ON "TimeSegment"("payPeriod");

-- CreateIndex
CREATE INDEX "TimeSegment_createdBy_idx" ON "TimeSegment"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSegment_sheet_source_key" ON "TimeSegment"("timesheet", "sourceKey");

-- CreateIndex
CREATE INDEX "Timesheet_employee_idx" ON "Timesheet"("employee");

-- CreateIndex
CREATE INDEX "Timesheet_approvedBy_idx" ON "Timesheet"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_employee_date_key" ON "Timesheet"("employee", "workDate");

-- AddForeignKey
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_workLine_fkey" FOREIGN KEY ("workLine") REFERENCES "WorkLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_financingApplication_fkey" FOREIGN KEY ("financingApplication") REFERENCES "FinancingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningLine" ADD CONSTRAINT "EarningLine_payPeriod_fkey" FOREIGN KEY ("payPeriod") REFERENCES "PayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningLine" ADD CONSTRAINT "EarningLine_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningLine" ADD CONSTRAINT "EarningLine_payPlanVersion_fkey" FOREIGN KEY ("payPlanVersion") REFERENCES "PayPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningLine" ADD CONSTRAINT "EarningLine_reverses_fkey" FOREIGN KEY ("reverses") REFERENCES "EarningLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPeriod" ADD CONSTRAINT "PayPeriod_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPlanAssignment" ADD CONSTRAINT "PayPlanAssignment_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPlanAssignment" ADD CONSTRAINT "PayPlanAssignment_planVersion_fkey" FOREIGN KEY ("planVersion") REFERENCES "PayPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPlanAssignment" ADD CONSTRAINT "PayPlanAssignment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPlanVersion" ADD CONSTRAINT "PayPlanVersion_plan_fkey" FOREIGN KEY ("plan") REFERENCES "PayPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPlanVersion" ADD CONSTRAINT "PayPlanVersion_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportBatch" ADD CONSTRAINT "PayrollExportBatch_payPeriod_fkey" FOREIGN KEY ("payPeriod") REFERENCES "PayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportBatch" ADD CONSTRAINT "PayrollExportBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_timesheet_fkey" FOREIGN KEY ("timesheet") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_adjusts_fkey" FOREIGN KEY ("adjusts") REFERENCES "TimeSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_payPeriod_fkey" FOREIGN KEY ("payPeriod") REFERENCES "PayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Guards the application cannot be trusted to keep alone (SCHEMA §14, STATE-MACHINES §16) ──

ALTER TABLE "TimeSegment" ADD CONSTRAINT "TimeSegment_ends_after_starts" CHECK ("endsAt" > "startsAt");
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_share_range" CHECK ("sharePct" > 0 AND "sharePct" <= 100);
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_one_subject" CHECK (num_nonnulls("workLine", "membership", "financingApplication") = 1);
ALTER TABLE "PayPeriod" ADD CONSTRAINT "PayPeriod_dates" CHECK ("endsOn" >= "startsOn");

-- Records pay stands on are never deleted.
CREATE OR REPLACE FUNCTION hs_p6_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "Timesheet_no_delete" BEFORE DELETE ON "Timesheet" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();
CREATE TRIGGER "PayPlan_no_delete" BEFORE DELETE ON "PayPlan" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();
CREATE TRIGGER "PayPlanVersion_no_delete" BEFORE DELETE ON "PayPlanVersion" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();
CREATE TRIGGER "PayPlanAssignment_no_delete" BEFORE DELETE ON "PayPlanAssignment" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();
CREATE TRIGGER "PayPeriod_no_delete" BEFORE DELETE ON "PayPeriod" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();
CREATE TRIGGER "PayrollExportBatch_no_delete" BEFORE DELETE ON "PayrollExportBatch" FOR EACH ROW EXECUTE FUNCTION hs_p6_no_delete();

-- Earning lines (I-L2): never updated; deleted only while their period is still being worked on (a recalculation replaces them).
CREATE OR REPLACE FUNCTION hs_earning_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE period_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only the review flag may be set, and only while the period is still being worked on (it is decided after the lines are all in).
    SELECT "status" INTO period_status FROM "PayPeriod" WHERE "id" = OLD."payPeriod";
    IF period_status IN ('open', 'calculating', 'review')
       AND ROW(NEW."payPeriod", NEW."employee", NEW."workweekStart", NEW."kind", NEW."hours", NEW."rateMinor", NEW."amountMinor", NEW."basisType", NEW."basisId", NEW."lineKey", NEW."reverses")
         IS NOT DISTINCT FROM ROW(OLD."payPeriod", OLD."employee", OLD."workweekStart", OLD."kind", OLD."hours", OLD."rateMinor", OLD."amountMinor", OLD."basisType", OLD."basisId", OLD."lineKey", OLD."reverses") THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'An earning line is never changed; add an adjustment line instead' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO period_status FROM "PayPeriod" WHERE "id" = OLD."payPeriod";
    IF period_status IS NOT NULL AND period_status NOT IN ('open', 'calculating', 'review') THEN
      RAISE EXCEPTION 'The lines of an approved or exported pay period are never deleted' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  SELECT "status" INTO period_status FROM "PayPeriod" WHERE "id" = NEW."payPeriod";
  IF period_status IN ('approved', 'exported', 'closed') THEN
    RAISE EXCEPTION 'A pay period that is approved takes no new lines; late facts go to the next period' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EarningLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "EarningLine" FOR EACH ROW EXECUTE FUNCTION hs_earning_line_guard();

-- A pay period never moves backwards once approved, and an exported one is final (I-L5).
CREATE OR REPLACE FUNCTION hs_pay_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('approved', 'exported', 'closed') AND ROW(NEW."startsOn", NEW."endsOn", NEW."payDate", NEW."inputsHash") IS DISTINCT FROM ROW(OLD."startsOn", OLD."endsOn", OLD."payDate", OLD."inputsHash") THEN
    RAISE EXCEPTION 'An approved pay period keeps its dates and inputs' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'exported' AND NEW."status" NOT IN ('exported', 'closed') THEN
    RAISE EXCEPTION 'An exported pay period does not reopen' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'closed' AND NEW."status" <> 'closed' THEN
    RAISE EXCEPTION 'A closed pay period does not reopen' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'approved' AND NEW."status" NOT IN ('approved', 'exported', 'review') THEN
    RAISE EXCEPTION 'An approved pay period is exported or sent back to review' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayPeriod_guard" BEFORE UPDATE ON "PayPeriod" FOR EACH ROW EXECUTE FUNCTION hs_pay_period_guard();

-- A pay plan version's terms are fixed once it is active (the draft is the only editable state).
CREATE OR REPLACE FUNCTION hs_pay_plan_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('active', 'retired') THEN
    IF ROW(NEW."plan", NEW."versionNumber", NEW."hourlyRates", NEW."overtime", NEW."commission", NEW."spiffs", NEW."clawbacks", NEW."laterEngine", NEW."contentHash")
       IS DISTINCT FROM ROW(OLD."plan", OLD."versionNumber", OLD."hourlyRates", OLD."overtime", OLD."commission", OLD."spiffs", OLD."clawbacks", OLD."laterEngine", OLD."contentHash") THEN
      RAISE EXCEPTION 'An active pay plan version cannot be edited; publish a new version' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."status" = 'retired' AND NEW."status" <> 'retired' THEN
      RAISE EXCEPTION 'A retired pay plan version does not come back' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."status" = 'active' AND NEW."status" NOT IN ('active', 'retired') THEN
      RAISE EXCEPTION 'An active pay plan version is retired, never reopened' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayPlanVersion_guard" BEFORE UPDATE ON "PayPlanVersion" FOR EACH ROW EXECUTE FUNCTION hs_pay_plan_version_guard();

-- A locked timesheet is final. Time on a sheet changes only while it is open; an approved sheet takes a new adjustment segment.
CREATE OR REPLACE FUNCTION hs_timesheet_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'locked' THEN
    RAISE EXCEPTION 'A locked timesheet is final; late changes go in the next pay period' USING ERRCODE = 'check_violation';
  END IF;
  IF ROW(NEW."employee", NEW."workDate") IS DISTINCT FROM ROW(OLD."employee", OLD."workDate") THEN
    RAISE EXCEPTION 'A timesheet keeps its person and day' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Timesheet_guard" BEFORE UPDATE ON "Timesheet" FOR EACH ROW EXECUTE FUNCTION hs_timesheet_guard();

CREATE OR REPLACE FUNCTION hs_time_segment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sheet_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO sheet_status FROM "Timesheet" WHERE "id" = OLD."timesheet";
    IF sheet_status IS NOT NULL AND sheet_status <> 'open' THEN
      RAISE EXCEPTION 'Time on a % timesheet is not removed; add an adjustment', sheet_status USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  SELECT "status" INTO sheet_status FROM "Timesheet" WHERE "id" = NEW."timesheet";
  IF TG_OP = 'INSERT' THEN
    IF sheet_status = 'open' OR sheet_status IS NULL THEN RETURN NEW; END IF;
    IF sheet_status = 'approved' AND NEW."source" = 'adjustment' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'A % timesheet takes no new time except an approved adjustment', sheet_status USING ERRCODE = 'check_violation';
  END IF;
  -- Update: an open sheet's segments are editable; on a closed sheet only the pay period that paid the time may be stamped.
  IF sheet_status IS NOT NULL AND sheet_status <> 'open' THEN
    IF ROW(NEW."timesheet", NEW."kind", NEW."startsAt", NEW."endsAt", NEW."hours", NEW."visit", NEW."source", NEW."sourceKey", NEW."adjusts") IS DISTINCT FROM
       ROW(OLD."timesheet", OLD."kind", OLD."startsAt", OLD."endsAt", OLD."hours", OLD."visit", OLD."source", OLD."sourceKey", OLD."adjusts") THEN
      RAISE EXCEPTION 'Time on a % timesheet is not changed; add an adjustment', sheet_status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "TimeSegment_guard" BEFORE INSERT OR UPDATE OR DELETE ON "TimeSegment" FOR EACH ROW EXECUTE FUNCTION hs_time_segment_guard();

-- An export batch records what was handed over: only its delivery status moves.
CREATE OR REPLACE FUNCTION hs_export_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."payPeriod", NEW."target", NEW."lineCount", NEW."totalMinor", NEW."sha256", NEW."ref") IS DISTINCT FROM ROW(OLD."payPeriod", OLD."target", OLD."lineCount", OLD."totalMinor", OLD."sha256", OLD."ref") THEN
    RAISE EXCEPTION 'A payroll export keeps what it exported' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollExportBatch_guard" BEFORE UPDATE ON "PayrollExportBatch" FOR EACH ROW EXECUTE FUNCTION hs_export_batch_guard();

-- Commission shares for one sale and role add up to exactly 100 (I-L3), checked when the transaction commits.
CREATE OR REPLACE FUNCTION hs_attribution_sum_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total NUMERIC; n INT; wl TEXT; mb TEXT; fa TEXT; rl TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN wl := OLD."workLine"; mb := OLD."membership"; fa := OLD."financingApplication"; rl := OLD."role";
  ELSE wl := NEW."workLine"; mb := NEW."membership"; fa := NEW."financingApplication"; rl := NEW."role"; END IF;
  SELECT COALESCE(SUM("sharePct"), 0), COUNT(*) INTO total, n FROM "CommissionAttribution"
    WHERE "role" = rl AND "workLine" IS NOT DISTINCT FROM wl AND "membership" IS NOT DISTINCT FROM mb AND "financingApplication" IS NOT DISTINCT FROM fa;
  IF n > 0 AND total <> 100 THEN
    RAISE EXCEPTION 'Commission shares for % must add up to 100 (they add up to %)', rl, total USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "CommissionAttribution_sum_check" AFTER INSERT OR UPDATE OR DELETE ON "CommissionAttribution" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hs_attribution_sum_check();
