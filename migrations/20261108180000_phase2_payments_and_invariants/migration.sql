-- Payments and refunds are real records, and the rules the review listed as app-only now live in the database too.
--
-- 1. Payment: money the customer handed over toward a sale (Authorization). Refund: money returned against one Payment.
--    Both are append-only. The database refuses refunds that add up to more than was paid.
-- 2. A notice can only be cancelled_by_buyer for exactly what was paid (less refunds already made) and can only be
--    marked refunded when its Refund rows add up to what was due.
-- 3. An approval cannot be granted by the person who asked for it.
-- 4. A discount needs a reason; one above every seller's limit cannot be presented without an approved request.
-- 5. A visit cannot start work while every planned line is held by an open cancellation notice.
-- 6. One open notice per sold estimate version (and per change order) and rule.
-- Not expressible here: hiding cost from roles without cost read (the quote hash binds the stored snapshot, so the API strips it),
--  the business-day calendar (cancel-by and refund-due dates) and the 10-business-day refund
-- deadline stay in the policy pack and the service; the stored evaluation records which calendar was used.

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "job" TEXT,
    "customer" TEXT,
    "authorization" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'deposit',
    "method" TEXT NOT NULL DEFAULT 'card',
    "amountMinor" BIGINT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "payment" TEXT,
    "notice" TEXT,
    "method" TEXT NOT NULL DEFAULT 'processor_refund',
    "amountMinor" BIGINT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "refundedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_ref_key" ON "Payment"("ref");

-- CreateIndex
CREATE INDEX "Payment_job_idx" ON "Payment"("job");

-- CreateIndex
CREATE INDEX "Payment_customer_idx" ON "Payment"("customer");

-- CreateIndex
CREATE INDEX "Payment_authorization_idx" ON "Payment"("authorization");

-- CreateIndex
CREATE INDEX "Payment_recordedBy_idx" ON "Payment"("recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_ref_key" ON "Refund"("ref");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_notice_idx" ON "Refund"("notice");

-- CreateIndex
CREATE INDEX "Refund_recordedBy_idx" ON "Refund"("recordedBy");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_authorization_fkey" FOREIGN KEY ("authorization") REFERENCES "Authorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_notice_fkey" FOREIGN KEY ("notice") REFERENCES "CancellationNotice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_valid" CHECK ("amountMinor" > 0 AND kind IN ('deposit', 'payment') AND method IN ('card', 'ach', 'cash', 'check', 'other'));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_valid" CHECK ("amountMinor" > 0 AND method IN ('processor_refund', 'check') AND payment IS NOT NULL);
CREATE TRIGGER "Payment_append_only" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Payment_no_truncate" BEFORE TRUNCATE ON "Payment" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Refund_append_only" BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "Refund_no_truncate" BEFORE TRUNCATE ON "Refund" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- Refunds against one payment can never add up to more than the payment.
CREATE OR REPLACE FUNCTION hs_refund_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_paid bigint;
  v_refunded bigint;
BEGIN
  SELECT "amountMinor" INTO v_paid FROM "Payment" WHERE id = NEW.payment FOR UPDATE;
  SELECT coalesce(sum("amountMinor"), 0) INTO v_refunded FROM "Refund" WHERE payment = NEW.payment;
  IF v_paid IS NULL OR v_refunded + NEW."amountMinor" > v_paid THEN
    RAISE EXCEPTION 'Refunds of % cents would exceed the % cents paid on this payment', v_refunded + NEW."amountMinor", coalesce(v_paid, 0) USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Refund_cap" BEFORE INSERT ON "Refund" FOR EACH ROW EXECUTE FUNCTION hs_refund_cap();

-- History: payments the sale recorded as deposits, then any amount a cancellation recorded that no payment covers
-- (typed by hand before payments were recorded), then the refunds that were already made.
DO $$
DECLARE
  n integer;
  m integer;
BEGIN
  INSERT INTO "Payment" (id, ref, job, customer, "authorization", kind, method, "amountMinor", reference, "receivedAt", "recordedBy")
  SELECT 'pay_' || a.id, 'PMT-2026-' || lpad(row_number() OVER (ORDER BY a."authorizedAt", a.id)::text, 6, '0'), a.job, j.customer, a.id, 'deposit', 'other', a."depositMinor", 'recorded at the sale', a."authorizedAt", a."recordedBy"
  FROM "Authorization" a LEFT JOIN "Job" j ON j.id = a.job WHERE a."depositMinor" > 0;
  SELECT count(*) INTO n FROM "Payment";

  INSERT INTO "Payment" (id, ref, job, customer, "authorization", kind, method, "amountMinor", reference, "receivedAt", "recordedBy")
  SELECT 'pay_gap_' || x.notice, 'PMT-2026-' || lpad((n + row_number() OVER (ORDER BY x."cancelledAt", x.notice))::text, 6, '0'), x.job, x.customer, x.auth, 'payment', 'other', x.gap, 'amount typed when the buyer cancelled, before payments were recorded', x."cancelledAt", NULL
  FROM (
    SELECT cn.id AS notice, cn.job, cn.customer, e."authorization" AS auth, cn."cancelledAt", cn."refundDueMinor" - coalesce((SELECT sum(p."amountMinor") FROM "Payment" p WHERE p."authorization" = e."authorization"), 0) AS gap
    FROM "CancellationNotice" cn JOIN "CancellationEvaluation" e ON e.id = cn.evaluation
    WHERE cn.status IN ('cancelled_by_buyer', 'refunded') AND e."authorization" IS NOT NULL
  ) x WHERE x.gap > 0;
  SELECT count(*) INTO m FROM "Payment";
  IF m > 0 THEN
    INSERT INTO "Sequence" (id, key, "nextValue") VALUES ('seq_pmt_2026', 'PMT-2026', m + 1) ON CONFLICT (key) DO UPDATE SET "nextValue" = EXCLUDED."nextValue";
  END IF;

  INSERT INTO "Refund" (id, ref, payment, notice, method, "amountMinor", reference, "refundedAt", "recordedBy")
  SELECT 'rfd_' || p.id, 'RFD-2026-' || lpad(row_number() OVER (ORDER BY (cn."refundEvidence"->>'at'), p.id)::text, 6, '0'), p.id, cn.id,
         CASE WHEN cn."refundEvidence"->>'method' = 'check' THEN 'check' ELSE 'processor_refund' END, p."amountMinor",
         coalesce(nullif(cn."refundEvidence"->>'reference', ''), 'recorded before refunds were tracked'), (cn."refundEvidence"->>'at')::timestamp, cn."refundEvidence"->>'recordedBy'
  FROM "CancellationNotice" cn
  JOIN "CancellationEvaluation" e ON e.id = cn.evaluation
  JOIN "Payment" p ON p."authorization" = e."authorization"
  WHERE cn.status = 'refunded' AND cn."refundDueMinor" > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO "Sequence" (id, key, "nextValue") VALUES ('seq_rfd_2026', 'RFD-2026', n + 1) ON CONFLICT (key) DO UPDATE SET "nextValue" = EXCLUDED."nextValue";
  END IF;
END $$;

-- A notice moves to cancelled_by_buyer for exactly what was paid (less refunds already made), and to refunded only when
-- its Refund rows add up to what was due. Rows that are already past those states are not re-checked.
CREATE OR REPLACE FUNCTION hs_cancellation_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_auth text;
  v_paid bigint;
  v_back bigint;
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
  IF OLD.status IN ('cancelled_by_buyer', 'refunded') AND NEW."refundDueMinor" IS DISTINCT FROM OLD."refundDueMinor" THEN
    RAISE EXCEPTION 'The refund due on notice % is fixed once the buyer has cancelled', OLD.ref USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> NEW.status AND NEW.status = 'cancelled_by_buyer' THEN
    SELECT "authorization" INTO v_auth FROM "CancellationEvaluation" WHERE id = NEW.evaluation;
    SELECT coalesce(sum("amountMinor"), 0) INTO v_paid FROM "Payment" WHERE "authorization" = v_auth;
    SELECT coalesce(sum(r."amountMinor"), 0) INTO v_back FROM "Refund" r JOIN "Payment" p ON p.id = r.payment WHERE p."authorization" = v_auth;
    IF NEW."refundDueMinor" <> v_paid - v_back THEN
      RAISE EXCEPTION 'Notice % must refund what was paid (% cents recorded, % already refunded), not % cents', OLD.ref, v_paid, v_back, NEW."refundDueMinor" USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF OLD.status <> NEW.status AND NEW.status = 'refunded' THEN
    SELECT coalesce(sum("amountMinor"), 0) INTO v_back FROM "Refund" WHERE notice = NEW.id;
    IF v_back <> NEW."refundDueMinor" THEN
      RAISE EXCEPTION 'Notice % is not refunded: % cents of refunds are recorded against % cents due', OLD.ref, v_back, NEW."refundDueMinor" USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- One open notice per sold estimate version (or change order) and rule.
CREATE UNIQUE INDEX "CancellationNotice_one_open_per_estimate_rule" ON "CancellationNotice"("estimateVersion", rule) WHERE "estimateVersion" IS NOT NULL AND status IN ('issued', 'delivered');
CREATE UNIQUE INDEX "CancellationNotice_one_open_per_change_order_rule" ON "CancellationNotice"("changeOrder", rule) WHERE "changeOrder" IS NOT NULL AND status IN ('issued', 'delivered');

-- Maker-checker: nobody grants an approval for a request they raised.
CREATE OR REPLACE FUNCTION hs_approval_not_self() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_requester text;
BEGIN
  IF NEW.decision = 'approve' THEN
    SELECT "requestedBy" INTO v_requester FROM "ApprovalRequest" WHERE id = NEW.request;
    IF v_requester IS NOT NULL AND v_requester = NEW."decidedBy" THEN
      RAISE EXCEPTION 'You cannot approve your own request' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ApprovalDecision_not_self" BEFORE INSERT ON "ApprovalDecision" FOR EACH ROW EXECUTE FUNCTION hs_approval_not_self();

-- A discount needs a reason; one above every seller's limit needs an approved request before the estimate is presented.
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_discount_reason" CHECK ("discountBps" = 0 OR length(btrim("discountReason")) > 0);
CREATE OR REPLACE FUNCTION hs_estimate_discount_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_limit bigint;
  v_status text;
BEGIN
  IF NEW.status = 'presented' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'presented') AND NEW."discountBps" > 0 THEN
    SELECT greatest(coalesce((SELECT "discountApprovalThresholdBps" FROM "CompanySettings" LIMIT 1), 0), coalesce((SELECT max("limit") FROM "RoleLimit" WHERE kind = 'discount_bps'), 0)) INTO v_limit;
    IF NEW."discountBps" > v_limit THEN
      SELECT status INTO v_status FROM "ApprovalRequest" WHERE id = NEW."discountApproval";
      IF v_status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'A discount of % basis points needs an approved request before the estimate is presented', NEW."discountBps" USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EstimateVersion_discount_gate" BEFORE INSERT OR UPDATE ON "EstimateVersion" FOR EACH ROW EXECUTE FUNCTION hs_estimate_discount_gate();

-- Work on a visit cannot start while every planned line on the job is held by an open cancellation notice
-- (the buyer can still cancel it) with no approved start-early request.
CREATE OR REPLACE FUNCTION hs_visit_start_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_planned integer;
  v_free integer;
BEGIN
  IF NEW.status = 'working' AND OLD.status IS DISTINCT FROM 'working' AND NEW.job IS NOT NULL THEN
    SELECT count(*) INTO v_planned FROM "WorkLine" WHERE job = NEW.job AND status = 'planned';
    SELECT count(*) INTO v_free FROM "WorkLine" w
     WHERE w.job = NEW.job AND w.status = 'planned'
       AND NOT EXISTS (
         SELECT 1 FROM "_CancellationNotice_coveredWorkLines" cw
           JOIN "CancellationNotice" n ON n.id = cw."A"
           LEFT JOIN "ApprovalRequest" a ON a.id = n."startOverride"
          WHERE cw."B" = w.id AND n.status IN ('issued', 'delivered') AND coalesce(a.status, '') <> 'approved');
    IF v_planned > 0 AND v_free = 0 THEN
      RAISE EXCEPTION 'Work cannot start: the buyer can still cancel every planned line on this job' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Visit_start_guard" BEFORE UPDATE ON "Visit" FOR EACH ROW EXECUTE FUNCTION hs_visit_start_guard();
