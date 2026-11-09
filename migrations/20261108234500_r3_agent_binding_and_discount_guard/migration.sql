-- r3 fixes: an OAuth app is bound to at most one agent; agents have their own least-privilege role;
-- a discount approval is tied to the discount amount and voided when the priced content changes.

-- One app, one agent: the app's tokens act as that agent, so the binding must be unambiguous.
CREATE UNIQUE INDEX "AgentIdentity_oauthApp_one_agent" ON "AgentIdentity"("oauthApp") WHERE "oauthApp" IS NOT NULL;

-- The agents' own role: no permission at all. What an agent may do comes only from its tool grants;
-- it never reads cost or margin, never approves, and never inherits the person who connected it.
INSERT INTO "Role" (id, name, description)
VALUES ('seed_role_ai_agent', 'AI Agent', 'Least privilege for AI agents. Holds no permission: an agent acts only through its tool grants, and never sees cost or margin.')
ON CONFLICT (id) DO NOTHING;

-- A presented discount above every seller's limit needs an approval for THIS version, THIS percentage
-- and THIS amount (the largest option discount in money). The application also binds the priced
-- content with a hash; the amount is what the database can verify on its own.
CREATE OR REPLACE FUNCTION hs_estimate_discount_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_limit bigint;
  v_status text;
  v_payload jsonb;
  v_amount bigint;
BEGIN
  IF NEW.status = 'presented' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'presented') AND NEW."discountBps" > 0 THEN
    SELECT greatest(coalesce((SELECT "discountApprovalThresholdBps" FROM "CompanySettings" LIMIT 1), 0), coalesce((SELECT max("limit") FROM "RoleLimit" WHERE kind = 'discount_bps'), 0)) INTO v_limit;
    IF NEW."discountBps" > v_limit THEN
      SELECT status, payload INTO v_status, v_payload FROM "ApprovalRequest" WHERE id = NEW."discountApproval";
      IF v_status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'A discount of % basis points needs an approved request before the estimate is presented', NEW."discountBps" USING ERRCODE = 'check_violation';
      END IF;
      SELECT coalesce(max("discountMinor"), 0) INTO v_amount FROM "EstimateOption" WHERE "estimateVersion" = NEW.id;
      IF v_payload ->> 'versionId' IS DISTINCT FROM NEW.id
         OR (v_payload ->> 'discountBps') IS DISTINCT FROM NEW."discountBps"::text
         OR (v_payload ->> 'discountMinor') IS DISTINCT FROM v_amount::text THEN
        RAISE EXCEPTION 'The discount approval does not cover this discount (% basis points, % cents); request approval again', NEW."discountBps", v_amount USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Any change to the priced content of a draft detaches its discount approval.
CREATE OR REPLACE FUNCTION hs_void_discount_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_version text;
  v_changed boolean;
BEGIN
  IF TG_TABLE_NAME = 'EstimateOption' THEN
    v_version := CASE WHEN TG_OP = 'DELETE' THEN OLD."estimateVersion" ELSE NEW."estimateVersion" END;
    v_changed := TG_OP <> 'UPDATE' OR (NEW."subtotalMinor", NEW."discountMinor", NEW.tier, NEW.name) IS DISTINCT FROM (OLD."subtotalMinor", OLD."discountMinor", OLD.tier, OLD.name);
  ELSE
    SELECT "estimateVersion" INTO v_version FROM "EstimateOption" WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.option ELSE NEW.option END;
    v_changed := TG_OP <> 'UPDATE' OR (NEW.quantity, NEW."unitPriceMinor", NEW."amountMinor", NEW."discountMinor", NEW."itemKey") IS DISTINCT FROM (OLD.quantity, OLD."unitPriceMinor", OLD."amountMinor", OLD."discountMinor", OLD."itemKey");
  END IF;
  IF v_changed AND v_version IS NOT NULL THEN
    UPDATE "EstimateVersion" SET "discountApproval" = NULL WHERE id = v_version AND status = 'draft' AND "discountApproval" IS NOT NULL;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "EstimateOption_void_discount_approval" AFTER INSERT OR UPDATE OR DELETE ON "EstimateOption" FOR EACH ROW EXECUTE FUNCTION hs_void_discount_approval();
CREATE TRIGGER "EstimateLine_void_discount_approval" AFTER INSERT OR UPDATE OR DELETE ON "EstimateLine" FOR EACH ROW EXECUTE FUNCTION hs_void_discount_approval();
