-- P3 r2 review fixes (findings A and B).

-- ── A certificate can expire (finding A) ──────────────────────────────────────────────────────────────────────────
-- A tax-exemption certificate exempts only invoices dated before Document.expiresAt (null = no expiry); read when tax is computed.
ALTER TABLE "Document" ADD COLUMN "expiresAt" DATE;

-- ── Money rows are never dated in a non-open AR month (finding B) ─────────────────────────────────────────────────
-- Same rule as the PaymentBatch and ArEntry guards, at the row itself: a Payment (receivedAt), Refund (refundedAt) or
-- FinancingFunding (fundedAt) whose accounting day, in the company's home time zone, falls in a closing or closed AR
-- month is refused, whoever writes it. A month with no ArPeriod row yet is open (the service creates it on first use).
CREATE OR REPLACE FUNCTION hs_money_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_at timestamp; v_tz text; v_day date; v_status text;
BEGIN
  -- Separate statements: each table's NEW has only its own date column.
  IF TG_TABLE_NAME = 'Payment' THEN v_at := NEW."receivedAt";
  ELSIF TG_TABLE_NAME = 'Refund' THEN v_at := NEW."refundedAt";
  ELSE v_at := NEW."fundedAt";
  END IF;
  IF v_at IS NULL THEN RETURN NEW; END IF;
  SELECT "homeTimeZone" INTO v_tz FROM "CompanySettings" LIMIT 1;
  v_day := ((v_at AT TIME ZONE 'UTC') AT TIME ZONE coalesce(nullif(v_tz, ''), 'America/Chicago'))::date;
  SELECT status INTO v_status FROM "ArPeriod" WHERE month = date_trunc('month', v_day)::date;
  IF v_status IS NOT NULL AND v_status <> 'open' THEN
    RAISE EXCEPTION 'The AR period for % is % and takes no % dated in it', to_char(v_day, 'YYYY-MM'), v_status, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Payment_period" BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION hs_money_period();
CREATE TRIGGER "Refund_period" BEFORE INSERT OR UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION hs_money_period();
CREATE TRIGGER "FinancingFunding_period" BEFORE INSERT OR UPDATE ON "FinancingFunding" FOR EACH ROW EXECUTE FUNCTION hs_money_period();
