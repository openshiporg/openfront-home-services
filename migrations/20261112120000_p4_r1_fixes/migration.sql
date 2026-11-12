-- P4 r1 fixes. Guards only: no table is dropped or rewritten.

-- A billing run finishes in its own request: completed (nothing left) or partial (something waits on a person or the processor).
ALTER TABLE "MembershipBillingRun" DROP CONSTRAINT "MembershipBillingRun_valid";
ALTER TABLE "MembershipBillingRun" ADD CONSTRAINT "MembershipBillingRun_valid" CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$' AND status IN ('running', 'completed', 'partial') AND "chargedMinor" >= 0);
UPDATE "MembershipBillingRun" SET status = CASE WHEN "remainingCount" = 0 THEN 'completed' ELSE 'partial' END, "completedAt" = COALESCE("completedAt", "startedAt") WHERE status = 'running';

-- Technicians do not sell or cancel memberships (they read their own customers' memberships through their jobs).
UPDATE "Role" SET "canSellMemberships" = false WHERE id = 'seed_role_technician';

-- The auto-renew consent on file is never removed or swapped for another record.
CREATE OR REPLACE FUNCTION hs_membership_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Membership rows are never deleted' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status IN ('cancelled', 'transferred', 'expired') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'A % membership does not come back', OLD.status USING ERRCODE = 'check_violation'; END IF;
  IF OLD."autoRenewConsent" IS NOT NULL AND NEW."autoRenewConsent" IS DISTINCT FROM OLD."autoRenewConsent" THEN RAISE EXCEPTION 'The auto-renew consent on file is never removed or replaced' USING ERRCODE = 'check_violation'; END IF;
  IF (OLD.customer, OLD."startsOn", OLD.plan, OLD."planVersion", OLD.ref) IS DISTINCT FROM (NEW.customer, NEW."startsOn", NEW.plan, NEW."planVersion", NEW.ref) THEN
    RAISE EXCEPTION 'A membership keeps its customer, plan and start' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- A rollover gives at most what the same entitlement granted in the term before, once per grant.
CREATE OR REPLACE FUNCTION hs_entitlement_floor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE granted integer; used integer; ext integer; prev integer; v_code text; v_member text; v_term integer;
BEGIN
  SELECT quantity INTO granted FROM "EntitlementGrant" WHERE id = NEW."grant" FOR UPDATE;
  IF granted IS NULL THEN RAISE EXCEPTION 'Entitlement entry has no grant' USING ERRCODE = 'check_violation'; END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO used FROM "EntitlementEntry" WHERE "grant" = NEW."grant";
  IF granted + used + NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Entitlement balance cannot go below zero' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.kind = 'restore' THEN
    SELECT COALESCE(SUM(quantity), 0) INTO ext FROM "EntitlementEntry" WHERE "grant" = NEW."grant" AND kind IN ('debit', 'restore');
    IF ext + NEW.quantity > 0 THEN
      RAISE EXCEPTION 'Entitlement restore would exceed what was granted' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.kind = 'rollover' THEN
    IF EXISTS (SELECT 1 FROM "EntitlementEntry" WHERE "grant" = NEW."grant" AND kind = 'rollover') THEN
      RAISE EXCEPTION 'A grant takes one rollover' USING ERRCODE = 'check_violation';
    END IF;
    SELECT g.code, g.membership, t."termNumber" INTO v_code, v_member, v_term FROM "EntitlementGrant" g JOIN "MembershipTerm" t ON t.id = g.term WHERE g.id = NEW."grant";
    SELECT COALESCE(MAX(g.quantity), 0) INTO prev FROM "EntitlementGrant" g JOIN "MembershipTerm" t ON t.id = g.term
      WHERE g.membership = v_member AND g.code = v_code AND t."termNumber" = v_term - 1 AND g."rolloverPolicy" = 'one_term';
    IF NEW.quantity > prev THEN
      RAISE EXCEPTION 'A rollover is at most what the term before granted' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
