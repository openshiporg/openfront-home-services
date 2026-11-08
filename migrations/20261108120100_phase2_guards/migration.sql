-- ── Phase 2 guards: price book, estimates and cancellation rights (SCHEMA §7, SM§5-6) ─────────
-- Hand-written, applied with `prisma migrate deploy` like the generated migrations. The commands
-- enforce every rule; these are the database's backstop, so no other path can rewrite a published
-- price, a presented estimate, a customer's authorization or a cancellation right.

-- I-E1: one active price-book version per price book; versions are frozen once submitted.
CREATE UNIQUE INDEX "PriceBookVersion_one_active" ON "PriceBookVersion"("priceBook") WHERE status = 'active';
CREATE UNIQUE INDEX "PriceBookVersion_one_open_draft" ON "PriceBookVersion"("priceBook") WHERE status IN ('draft', 'pending_approval');
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_status_valid" CHECK (status IN ('draft', 'pending_approval', 'published', 'active', 'retired', 'discarded'));
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_published_complete" CHECK (status NOT IN ('published', 'active', 'retired') OR ("contentHash" ~ '^[0-9a-f]{64}$' AND "effectiveAt" IS NOT NULL AND "publishedAt" IS NOT NULL));

CREATE OR REPLACE FUNCTION hs_pricebook_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Price book versions are kept; discard a draft instead' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status IN ('published', 'active', 'retired') THEN
    IF (NEW."priceBook", NEW."versionNumber", NEW."contentHash", NEW."effectiveAt", NEW."diffReport", NEW.approval, NEW."publishedBy", NEW."publishedAt", NEW."basedOn")
       IS DISTINCT FROM (OLD."priceBook", OLD."versionNumber", OLD."contentHash", OLD."effectiveAt", OLD."diffReport", OLD.approval, OLD."publishedBy", OLD."publishedAt", OLD."basedOn") THEN
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
CREATE TRIGGER "PriceBookVersion_guard" BEFORE UPDATE OR DELETE ON "PriceBookVersion" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_version_guard();

-- Rows belonging to a version (items, categories, markup tables, labour rates, member pricing) can
-- be written only while their version is a draft (SM§5.2).
CREATE OR REPLACE FUNCTION hs_pricebook_row_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_id text;
  v_status text;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."priceBookVersion" ELSE NEW."priceBookVersion" END;
  IF TG_OP = 'UPDATE' AND NEW."priceBookVersion" IS DISTINCT FROM OLD."priceBookVersion" THEN
    RAISE EXCEPTION '% rows cannot move between price book versions', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION '% rows must belong to a price book version', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_status FROM "PriceBookVersion" WHERE id = v_id;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Price book version % is %; its % rows are frozen', v_id, coalesce(v_status, 'missing'), TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "PriceBookItem_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "PriceBookItem" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_row_guard();
CREATE TRIGGER "PriceBookCategory_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "PriceBookCategory" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_row_guard();
CREATE TRIGGER "MarkupTable_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "MarkupTable" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_row_guard();
CREATE TRIGGER "LaborRate_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "LaborRate" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_row_guard();
CREATE TRIGGER "MemberPricingRule_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "MemberPricingRule" FOR EACH ROW EXECUTE FUNCTION hs_pricebook_row_guard();

ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_amounts" CHECK ("unitPriceMinor" >= 0 AND "costMinor" >= 0 AND ("memberUnitPriceMinor" IS NULL OR "memberUnitPriceMinor" >= 0) AND ("laborHours" IS NULL OR "laborHours" >= 0));
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_key_format" CHECK ("itemKey" ~ '^[A-Z0-9][A-Z0-9-]{1,47}$');
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_amounts" CHECK ("hourlyMinor" > 0 AND ("afterHoursMultiplier" IS NULL OR "afterHoursMultiplier" >= 1));
ALTER TABLE "MemberPricingRule" ADD CONSTRAINT "MemberPricingRule_bps" CHECK ("discountBps" BETWEEN 0 AND 10000);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_decimals" CHECK ("maxDecimals" BETWEEN 0 AND 4);

-- I-E3/I-E4: an estimate version is frozen once it leaves draft; one sold version per estimate.
CREATE UNIQUE INDEX "EstimateVersion_one_sold" ON "EstimateVersion"(estimate) WHERE status = 'sold';
CREATE UNIQUE INDEX "EstimateVersion_one_open" ON "EstimateVersion"(estimate) WHERE status IN ('draft', 'pending_approval', 'presented');
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_status_valid" CHECK (status IN ('draft', 'pending_approval', 'presented', 'sold', 'declined', 'expired', 'superseded', 'cancelled', 'discarded'));
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_discount_bps" CHECK ("discountBps" BETWEEN 0 AND 10000 AND "depositRequiredMinor" >= 0);
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_presented_complete" CHECK (status IN ('draft', 'pending_approval', 'discarded') OR ("contentHash" ~ '^[0-9a-f]{64}$' AND "presentedAt" IS NOT NULL AND snapshot IS NOT NULL AND "priceBookVersion" IS NOT NULL));
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_sold_complete" CHECK (status NOT IN ('sold', 'cancelled') OR ("soldOption" IS NOT NULL AND "authorization" IS NOT NULL AND "soldAt" IS NOT NULL));
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_status_valid" CHECK (status IN ('open', 'sold', 'declined', 'expired', 'cancelled', 'discarded'));

CREATE OR REPLACE FUNCTION hs_estimate_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Estimate versions are kept; discard a draft instead' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status NOT IN ('draft', 'pending_approval') THEN
    IF (NEW.estimate, NEW."versionNumber", NEW."priceBookVersion", NEW."discountBps", NEW."discountApproval", NEW.snapshot, NEW."contentHash", NEW."presentedAt", NEW."presentedBy", NEW."validUntil", NEW.supersedes)
       IS DISTINCT FROM (OLD.estimate, OLD."versionNumber", OLD."priceBookVersion", OLD."discountBps", OLD."discountApproval", OLD.snapshot, OLD."contentHash", OLD."presentedAt", OLD."presentedBy", OLD."validUntil", OLD.supersedes) THEN
      RAISE EXCEPTION 'Estimate version % was presented and is immutable; re-quote instead', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status IN ('sold', 'cancelled') AND (NEW."soldOption", NEW."authorization", NEW."soldAt") IS DISTINCT FROM (OLD."soldOption", OLD."authorization", OLD."soldAt") THEN
      RAISE EXCEPTION 'The sale on estimate version % is recorded and immutable', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NOT ((OLD.status = NEW.status) OR (OLD.status = 'presented' AND NEW.status IN ('sold', 'declined', 'expired', 'superseded')) OR (OLD.status = 'sold' AND NEW.status = 'cancelled')) THEN
      RAISE EXCEPTION 'Estimate version % cannot move from % to %', OLD.id, OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EstimateVersion_guard" BEFORE UPDATE OR DELETE ON "EstimateVersion" FOR EACH ROW EXECUTE FUNCTION hs_estimate_version_guard();

-- Options and lines can be written only while their version is a draft.
CREATE OR REPLACE FUNCTION hs_estimate_option_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."estimateVersion" IS DISTINCT FROM OLD."estimateVersion" THEN
    RAISE EXCEPTION 'Options cannot move between estimate versions' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_status FROM "EstimateVersion" WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."estimateVersion" ELSE NEW."estimateVersion" END;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This estimate version is %; its options are frozen', coalesce(v_status, 'missing') USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "EstimateOption_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "EstimateOption" FOR EACH ROW EXECUTE FUNCTION hs_estimate_option_guard();

CREATE OR REPLACE FUNCTION hs_estimate_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.option IS DISTINCT FROM OLD.option THEN
    RAISE EXCEPTION 'Lines cannot move between options' USING ERRCODE = 'check_violation';
  END IF;
  SELECT v.status INTO v_status FROM "EstimateOption" o JOIN "EstimateVersion" v ON v.id = o."estimateVersion" WHERE o.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.option ELSE NEW.option END;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This estimate version is %; its lines are frozen', coalesce(v_status, 'missing') USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "EstimateLine_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "EstimateLine" FOR EACH ROW EXECUTE FUNCTION hs_estimate_line_guard();

ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_amounts" CHECK (quantity > 0 AND "unitPriceMinor" >= 0 AND "amountMinor" >= 0 AND "discountMinor" >= 0 AND "discountMinor" <= "amountMinor" AND "costMinor" >= 0);
ALTER TABLE "EstimateOption" ADD CONSTRAINT "EstimateOption_totals" CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "discountMinor" <= "subtotalMinor" AND "estimatedTaxMinor" >= 0 AND "totalMinor" = "subtotalMinor" - "discountMinor" + "estimatedTaxMinor");

-- Customer agreement and the cancellation-rights evaluation are evidence: never edited or deleted.
CREATE TRIGGER "Authorization_append_only" BEFORE UPDATE OR DELETE ON "Authorization" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Authorization_no_truncate" BEFORE TRUNCATE ON "Authorization" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "CancellationEvaluation_append_only" BEFORE UPDATE OR DELETE ON "CancellationEvaluation" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "CancellationEvaluation_no_truncate" BEFORE TRUNCATE ON "CancellationEvaluation" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_hash_format" CHECK ("contentHash" ~ '^[0-9a-f]{64}$' AND "depositMinor" >= 0);

-- I-E6: a cancellation notice's right (rule, window, covered amount) is fixed when it is issued.
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_status_valid" CHECK (status IN ('issued', 'delivered', 'waived', 'cancelled_by_buyer', 'expired_uncancelled', 'refunded'));
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_window" CHECK ("cancelBy" > "transactionAt" AND "coveredAmountMinor" >= 0 AND "refundDueMinor" >= 0);
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_waiver" CHECK (status <> 'waived' OR "waiverDocument" IS NOT NULL);
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_cancelled" CHECK (status NOT IN ('cancelled_by_buyer', 'refunded') OR ("cancelledAt" IS NOT NULL AND "cancelledAt" < "cancelBy" AND "refundDueBy" IS NOT NULL));

CREATE OR REPLACE FUNCTION hs_cancellation_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cancellation notices are kept' USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.evaluation, NEW.job, NEW.rule, NEW.rules, NEW."policyVersion", NEW."noticeTemplate", NEW.language, NEW."coveredAmountMinor", NEW."transactionAt", NEW."cancelBy", NEW."timeZone", NEW.snapshot, NEW."estimateVersion", NEW."changeOrder")
     IS DISTINCT FROM (OLD.evaluation, OLD.job, OLD.rule, OLD.rules, OLD."policyVersion", OLD."noticeTemplate", OLD.language, OLD."coveredAmountMinor", OLD."transactionAt", OLD."cancelBy", OLD."timeZone", OLD.snapshot, OLD."estimateVersion", OLD."changeOrder") THEN
    RAISE EXCEPTION 'The cancellation right on notice % is fixed when issued', OLD.ref USING ERRCODE = 'check_violation';
  END IF;
  IF NOT ((OLD.status = NEW.status)
      OR (OLD.status = 'issued' AND NEW.status IN ('delivered', 'waived', 'cancelled_by_buyer'))
      OR (OLD.status = 'delivered' AND NEW.status IN ('cancelled_by_buyer', 'expired_uncancelled', 'waived'))
      OR (OLD.status = 'cancelled_by_buyer' AND NEW.status = 'refunded')) THEN
    RAISE EXCEPTION 'Cancellation notice % cannot move from % to %', OLD.ref, OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CancellationNotice_guard" BEFORE UPDATE OR DELETE ON "CancellationNotice" FOR EACH ROW EXECUTE FUNCTION hs_cancellation_notice_guard();

ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_status_valid" CHECK (status IN ('draft', 'presented', 'approved', 'declined'));
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_approved_complete" CHECK (status <> 'approved' OR ("authorization" IS NOT NULL AND "contentHash" ~ '^[0-9a-f]{64}$'));
