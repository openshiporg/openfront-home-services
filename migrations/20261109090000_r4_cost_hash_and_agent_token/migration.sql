-- r4 fixes: a token remembers which agent it was issued to, so unbinding can never turn it into the
-- approver's session. Existing tokens carry no agent; the application refuses any token whose app is
-- bound to an agent unless the token names that agent, so old tokens on bound apps stop working.
ALTER TABLE "OAuthToken" ADD COLUMN "agentId" TEXT NOT NULL DEFAULT '';

-- Anything issued before this change to an app that is bound to an agent is ended now.
UPDATE "OAuthToken" t SET "isRevoked" = 'true'
WHERE t."isRevoked" = 'false' AND t."agentId" = ''
  AND EXISTS (SELECT 1 FROM "OAuthApp" a JOIN "AgentIdentity" g ON g."oauthApp" = a.id WHERE a."clientId" = t."clientId");
