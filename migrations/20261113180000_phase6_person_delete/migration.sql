-- Deleting a User or Employee sets the person on pay records to NULL (ON DELETE SET NULL). That is an UPDATE on the record,
-- so the Phase 6 guards must let a person be detached while still refusing every other change. Only functions made in the
-- previous migration are replaced; no table or data is touched.

CREATE OR REPLACE FUNCTION hs_earning_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE period_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Detaching the person (their record was deleted) changes nothing else about the line, in any period state.
    IF NEW."employee" IS NULL AND OLD."employee" IS NOT NULL
       AND (to_jsonb(NEW) - 'employee' - 'updatedAt') = (to_jsonb(OLD) - 'employee' - 'updatedAt') THEN
      RETURN NEW;
    END IF;
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

CREATE OR REPLACE FUNCTION hs_timesheet_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Detaching the employee or the approver (their record was deleted) changes nothing else, even on a locked sheet.
  IF ((NEW."employee" IS NULL AND OLD."employee" IS NOT NULL) OR (NEW."approvedBy" IS NULL AND OLD."approvedBy" IS NOT NULL))
     AND (NEW."employee" IS NULL OR NEW."employee" IS NOT DISTINCT FROM OLD."employee")
     AND (NEW."approvedBy" IS NULL OR NEW."approvedBy" IS NOT DISTINCT FROM OLD."approvedBy")
     AND (to_jsonb(NEW) - 'employee' - 'approvedBy' - 'updatedAt') = (to_jsonb(OLD) - 'employee' - 'approvedBy' - 'updatedAt') THEN
    RETURN NEW;
  END IF;
  IF OLD."status" = 'locked' THEN
    RAISE EXCEPTION 'A locked timesheet is final; late changes go in the next pay period' USING ERRCODE = 'check_violation';
  END IF;
  IF ROW(NEW."employee", NEW."workDate") IS DISTINCT FROM ROW(OLD."employee", OLD."workDate") THEN
    RAISE EXCEPTION 'A timesheet keeps its person and day' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
