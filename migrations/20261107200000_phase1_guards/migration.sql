-- ── Phase 1 guards: CRM, demand, booking and dispatch (SCHEMA §2–§6, §21) ───────────────────
-- Hand-written, applied with `prisma migrate deploy` like the generated migrations. The schema
-- itself is unchanged; these rules are the database's backstop for what the commands enforce.

-- Append-only history. Consent, visit status, eligibility and secret reveals are evidence:
-- corrections are new rows, never edits.
CREATE TRIGGER "ConsentRecord_append_only" BEFORE UPDATE OR DELETE ON "ConsentRecord" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "ConsentRecord_no_truncate" BEFORE TRUNCATE ON "ConsentRecord" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "VisitStatusEvent_append_only" BEFORE UPDATE OR DELETE ON "VisitStatusEvent" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "VisitStatusEvent_no_truncate" BEFORE TRUNCATE ON "VisitStatusEvent" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "EligibilityEvaluation_append_only" BEFORE UPDATE OR DELETE ON "EligibilityEvaluation" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "EligibilityEvaluation_no_truncate" BEFORE TRUNCATE ON "EligibilityEvaluation" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "AccessSecretReveal_append_only" BEFORE UPDATE OR DELETE ON "AccessSecretReveal" FOR EACH ROW EXECUTE FUNCTION hs_forbid_change();
CREATE TRIGGER "AccessSecretReveal_no_truncate" BEFORE TRUNCATE ON "AccessSecretReveal" FOR EACH STATEMENT EXECUTE FUNCTION hs_forbid_change();

-- A dispatch recommendation is frozen once generated; only the decision (proposed → applied,
-- overridden or expired) can be recorded, exactly once.
CREATE OR REPLACE FUNCTION hs_recommendation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Dispatch recommendations are kept' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.visit IS DISTINCT FROM OLD.visit OR NEW."rankedCandidates" IS DISTINCT FROM OLD."rankedCandidates"
     OR NEW."inputsHash" IS DISTINCT FROM OLD."inputsHash" OR NEW.features IS DISTINCT FROM OLD.features
     OR NEW."modelRef" IS DISTINCT FROM OLD."modelRef" OR NEW."generatedBy" IS DISTINCT FROM OLD."generatedBy"
     OR NEW."requestedBy" IS DISTINCT FROM OLD."requestedBy" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'A dispatch recommendation cannot be edited; only its decision is recorded' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.decision <> 'proposed' AND NEW.decision IS DISTINCT FROM OLD.decision THEN
    RAISE EXCEPTION 'This recommendation was already decided' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DispatchRecommendation_guard" BEFORE UPDATE OR DELETE ON "DispatchRecommendation" FOR EACH ROW EXECUTE FUNCTION hs_recommendation_guard();

-- Capacity can never be oversold or go negative, whatever path writes the window.
ALTER TABLE "ArrivalWindow" ADD CONSTRAINT "ArrivalWindow_capacity" CHECK ("bookedHours" >= 0 AND "capacityHours" >= 0);
ALTER TABLE "ArrivalWindow" ADD CONSTRAINT "ArrivalWindow_times" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ArrivalWindowTemplate" ADD CONSTRAINT "ArrivalWindowTemplate_weekday" CHECK (weekday BETWEEN 0 AND 6);
ALTER TABLE "ArrivalWindowTemplate" ADD CONSTRAINT "ArrivalWindowTemplate_times" CHECK ("startLocal" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "endLocal" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "endLocal" > "startLocal");
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_weekday" CHECK (weekday BETWEEN 0 AND 6);
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_times" CHECK ("endsAt" > "startsAt");
ALTER TABLE "OnCallRotation" ADD CONSTRAINT "OnCallRotation_times" CHECK ("endsAt" > "startsAt" AND "escalationOrder" >= 1);
ALTER TABLE "CapacityUsage" ADD CONSTRAINT "CapacityUsage_hours" CHECK (hours > 0);
ALTER TABLE "CapacityUsage" ADD CONSTRAINT "CapacityUsage_subject" CHECK ((kind = 'hold' AND hold IS NOT NULL) OR (kind = 'visit' AND visit IS NOT NULL));
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_hours" CHECK (hours > 0);
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_holder" CHECK (num_nonnulls("heldByUser", "heldByAgent") <= 1);
ALTER TABLE "JobType" ADD CONSTRAINT "JobType_sizes" CHECK ("capacityHours" > 0 AND "defaultDurationMinutes" > 0 AND "crewSize" >= 1);
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_planned_duration" CHECK ("plannedDurationMinutes" IS NULL OR "plannedDurationMinutes" > 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_first_response" CHECK ("firstResponseSeconds" IS NULL OR "firstResponseSeconds" >= 0);

-- Status values (the commands own every move; these stop anything else writing a stray status).
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_status_valid" CHECK (status IN ('new', 'contacted', 'qualified', 'booked', 'converted', 'lost', 'spam', 'merged'));
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_status_valid" CHECK (status IN ('open', 'waiting_customer', 'waiting_staff', 'closed'));
ALTER TABLE "Call" ADD CONSTRAINT "Call_status_valid" CHECK (status IN ('ringing', 'ai_answering', 'human_answering', 'handoff_requested', 'completed'));
ALTER TABLE "Message" ADD CONSTRAINT "Message_status_valid" CHECK (status IN ('queued', 'sending', 'blocked', 'sent', 'manual', 'delivered', 'failed', 'undeliverable', 'received'));
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stage_valid" CHECK (stage IN ('open', 'appointment_set', 'estimate_presented', 'won', 'lost'));
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_status_valid" CHECK (status IN ('held', 'converted', 'released', 'expired'));
ALTER TABLE "Job" ADD CONSTRAINT "Job_status_valid" CHECK (status IN ('draft', 'booked', 'scheduled', 'in_progress', 'on_hold', 'work_complete', 'awaiting_inspection', 'completed', 'closed', 'cancelled'));
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_status_valid" CHECK (status IN ('unassigned', 'scheduled', 'dispatched', 'en_route', 'on_site', 'working', 'paused', 'done', 'cancelled', 'no_access'));
ALTER TABLE "DispatchRecommendation" ADD CONSTRAINT "DispatchRecommendation_decision_valid" CHECK (decision IN ('proposed', 'applied', 'overridden', 'expired'));
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_status_valid" CHECK (status IN ('pending_verification', 'verified', 'expired', 'revoked'));
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_verified_has_verifier" CHECK (status <> 'verified' OR ("verifiedBy" IS NOT NULL AND "verifiedAt" IS NOT NULL));
ALTER TABLE "AccessSecret" ADD CONSTRAINT "AccessSecret_status_valid" CHECK (status IN ('active', 'retired'));
ALTER TABLE "WorkLine" ADD CONSTRAINT "WorkLine_status_valid" CHECK (status IN ('planned', 'completed', 'removed', 'cancelled_by_buyer'));
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_action_valid" CHECK (action IN ('grant', 'revoke'));
ALTER TABLE "EligibilityEvaluation" ADD CONSTRAINT "EligibilityEvaluation_result_valid" CHECK (result IN ('eligible', 'ineligible', 'override'));

ALTER TABLE "Credential" ADD CONSTRAINT "Credential_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "ServiceLocation" ADD CONSTRAINT "ServiceLocation_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Call" ADD CONSTRAINT "Call_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Message" ADD CONSTRAINT "Message_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "ArrivalWindow" ADD CONSTRAINT "ArrivalWindow_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_version_nonnegative" CHECK (version >= 0);
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_version_nonnegative" CHECK (version >= 0);

-- Partial uniques.
-- One live assignment per technician per visit.
CREATE UNIQUE INDEX "VisitAssignment_one_active" ON "VisitAssignment" (visit, employee) WHERE active;
-- One lead technician per visit.
CREATE UNIQUE INDEX "VisitAssignment_one_lead" ON "VisitAssignment" (visit) WHERE active AND role = 'lead';
-- A provider's lead id arrives once per source (webhook retries dedupe here).
CREATE UNIQUE INDEX "Lead_source_external" ON "Lead" (source, "externalId") WHERE "externalId" <> '';
-- An inbound/outbound provider message id is recorded once.
CREATE UNIQUE INDEX "Message_provider_id" ON "Message" ("providerMessageId") WHERE "providerMessageId" <> '';
-- One live STOP entry per number.
CREATE UNIQUE INDEX "DncEntry_value_source" ON "DncEntry" ("valueHash", source);
-- A hold converts into at most one visit; a visit carries one capacity usage.
CREATE UNIQUE INDEX "BookingHold_visit_once" ON "BookingHold" (visit) WHERE visit IS NOT NULL;
CREATE UNIQUE INDEX "CapacityUsage_visit_once" ON "CapacityUsage" (visit) WHERE visit IS NOT NULL AND kind = 'visit';
