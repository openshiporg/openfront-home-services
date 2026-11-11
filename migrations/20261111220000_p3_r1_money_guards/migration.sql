-- P3 r1 review fixes (findings 5 and 6).

-- ── Invoice status follows its balance (finding 6) ────────────────────────────────────────────────────────────────
-- paid ⇔ balance 0; partially_paid ⇔ 0 < balance < total; posted ⇔ balance = total. Checked whenever the status or the
-- balance changes, so neither the app nor raw SQL can mark an unpaid invoice paid (hiding it from AR aging).
CREATE OR REPLACE FUNCTION hs_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('draft') THEN
    IF (NEW.ref, NEW."publicCode", NEW.job, NEW.customer, NEW.payer, NEW."payerKind", NEW.location, NEW."propertyClass", NEW."contractTaxMode", NEW."taxResult",
        NEW."invoiceDate", NEW."dueDate", NEW."arPeriod", NEW."subtotalMinor", NEW."discountMinor", NEW."taxMinor", NEW."totalMinor", NEW."poNumber",
        NEW.authorization, NEW.snapshot, NEW."postedAt", NEW."postedBy")
       IS DISTINCT FROM
       (OLD.ref, OLD."publicCode", OLD.job, OLD.customer, OLD.payer, OLD."payerKind", OLD.location, OLD."propertyClass", OLD."contractTaxMode", OLD."taxResult",
        OLD."invoiceDate", OLD."dueDate", OLD."arPeriod", OLD."subtotalMinor", OLD."discountMinor", OLD."taxMinor", OLD."totalMinor", OLD."poNumber",
        OLD.authorization, OLD.snapshot, OLD."postedAt", OLD."postedBy") THEN
      RAISE EXCEPTION 'A posted invoice is never edited; correct it with a credit memo or a new invoice' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.pdf IS NOT NULL AND NEW.pdf IS DISTINCT FROM OLD.pdf THEN
      RAISE EXCEPTION 'The invoice document is fixed once rendered' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status IN ('posted', 'discarded'))
    OR (OLD.status IN ('posted', 'partially_paid', 'paid') AND NEW.status IN ('posted', 'partially_paid', 'paid'))
    OR (OLD.status IN ('posted', 'partially_paid') AND NEW.status IN ('written_off', 'voided'))) THEN
    RAISE EXCEPTION 'Invoice cannot move from % to %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW."balanceMinor" IS DISTINCT FROM OLD."balanceMinor") AND (
       (NEW.status = 'paid' AND NEW."balanceMinor" <> 0)
    OR (NEW.status = 'partially_paid' AND NOT (NEW."balanceMinor" > 0 AND NEW."balanceMinor" < NEW."totalMinor"))
    OR (NEW.status = 'posted' AND NEW."balanceMinor" <> NEW."totalMinor")) THEN
    RAISE EXCEPTION 'Invoice status % does not match its balance of % cents on % cents', NEW.status, NEW."balanceMinor", NEW."totalMinor" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ── No payment batch opens inside a closed AR month (finding 5) ────────────────────────────────────────────────────
-- Closing a month requires every batch in it to be closed; a batch created later for a back-dated day would undo that.
CREATE OR REPLACE FUNCTION hs_batch_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  IF NEW."businessDate" IS NOT NULL THEN
    SELECT status INTO v_status FROM "ArPeriod" WHERE month = date_trunc('month', NEW."businessDate")::date;
    IF v_status IS NOT NULL AND v_status <> 'open' THEN
      RAISE EXCEPTION 'The AR period for % is % and takes no new payment batch', to_char(NEW."businessDate", 'YYYY-MM'), v_status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentBatch_period" BEFORE INSERT ON "PaymentBatch" FOR EACH ROW EXECUTE FUNCTION hs_batch_period();
