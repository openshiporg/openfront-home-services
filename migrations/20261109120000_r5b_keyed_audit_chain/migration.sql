-- r5b m-new-1: audit chain hashes are now keyed (HMAC under the server secret) and carry a version
-- prefix ("v2:" + 64 hex), so a reader who sees a row but not the key cannot test guesses at hidden
-- values. The old check allowed only bare 64-hex hashes; it now allows either form, so the existing
-- rows stay valid until `npm run audit:rechain` rewrites the chain (it runs at every release start,
-- verifies the whole chain before and after, and records an audit event).
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_hash_format";
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_hash_format"
  CHECK (hash ~ '^(v[0-9]+:)?[0-9a-f]{64}$' AND "prevHash" ~ '^(v[0-9]+:)?[0-9a-f]{64}$');
