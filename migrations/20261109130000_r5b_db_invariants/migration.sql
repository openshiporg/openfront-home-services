-- r5b addendum: four invariants the application kept but the database did not (review r5b, "App-only").
-- Live predicates were run first (read-only): no existing row violates any of them, so no legacy
-- cutoff is needed. Triggers only fire on UPDATE/DELETE, so existing rows are untouched.

-- 1. ApprovalRequest: a decision is final. Once status leaves 'pending' the status and the content that
--    was decided on never change; the only later write is consuming an approved request, once.
CREATE OR REPLACE FUNCTION hs_approval_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Approval request % was already %; a decision is final', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    IF (NEW.payload, NEW."payloadHash", NEW.action, NEW."targetList", NEW."targetId", NEW."requiredPermission", NEW."requestedBy", NEW."requestedByAgent")
       IS DISTINCT FROM (OLD.payload, OLD."payloadHash", OLD.action, OLD."targetList", OLD."targetId", OLD."requiredPermission", OLD."requestedBy", OLD."requestedByAgent") THEN
      RAISE EXCEPTION 'Approval request % is decided; its content is frozen', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."consumedAt" IS NOT NULL AND NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt" THEN
      RAISE EXCEPTION 'Approval request % was already used', OLD.id USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.status = 'pending' AND NEW."consumedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'A pending approval request cannot be used' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ApprovalRequest_guard" BEFORE UPDATE ON "ApprovalRequest" FOR EACH ROW EXECUTE FUNCTION hs_approval_request_guard();
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_consumed_only_if_approved" CHECK ("consumedAt" IS NULL OR status = 'approved');

-- 2. OAuthToken: a revoked token stays revoked.
CREATE OR REPLACE FUNCTION hs_oauth_token_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isRevoked" = 'true' AND NEW."isRevoked" IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A revoked token stays revoked; issue a new one' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OAuthToken_guard" BEFORE UPDATE ON "OAuthToken" FOR EACH ROW EXECUTE FUNCTION hs_oauth_token_guard();

-- 3. WorkLine: a line that came from a sold estimate or an approved change order keeps its quantity,
--    price and amount, and is never deleted. Amend by a change order (new rows); remove by status.
CREATE OR REPLACE FUNCTION hs_work_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source IN ('estimate_line', 'change_order') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Work line % came from a sale and is kept; remove it with a change order', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF (NEW.source, NEW.quantity, NEW."unitPriceMinor", NEW."amountMinor", NEW."estimateLine", NEW."changeOrder")
       IS DISTINCT FROM (OLD.source, OLD.quantity, OLD."unitPriceMinor", OLD."amountMinor", OLD."estimateLine", OLD."changeOrder") THEN
      RAISE EXCEPTION 'Work line % was sold and its amount is fixed; amend it with a change order', OLD.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "WorkLine_guard" BEFORE UPDATE OR DELETE ON "WorkLine" FOR EACH ROW EXECUTE FUNCTION hs_work_line_guard();

-- 4. PriceBookVersion: the label is frozen with the rest of a published, active or retired version.
CREATE OR REPLACE FUNCTION hs_pricebook_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Price book versions are kept; discard a draft instead' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status IN ('published', 'active', 'retired') THEN
    IF (NEW."priceBook", NEW."versionNumber", NEW."contentHash", NEW."effectiveAt", NEW."diffReport", NEW.approval, NEW."publishedBy", NEW."publishedAt", NEW."basedOn", NEW.label)
       IS DISTINCT FROM (OLD."priceBook", OLD."versionNumber", OLD."contentHash", OLD."effectiveAt", OLD."diffReport", OLD.approval, OLD."publishedBy", OLD."publishedAt", OLD."basedOn", OLD.label) THEN
      RAISE EXCEPTION 'Price book version % is % and immutable; create a new draft', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    IF NOT ((OLD.status = NEW.status) OR (OLD.status = 'published' AND NEW.status IN ('active', 'retired')) OR (OLD.status = 'active' AND NEW.status = 'retired')) THEN
      RAISE EXCEPTION 'Price book version % cannot move from % to %', OLD.id, OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF OLD.status = 'discarded' AND NEW.status <> 'discarded' THEN
    RAISE EXCEPTION 'A discarded price book version stays discarded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
