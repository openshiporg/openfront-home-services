-- Remove the invented outbox. Live check: every row was delivered, none pending.
DROP TABLE "OutboxMessage";
