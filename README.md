# Openfront Home Services

The open-source alternative to ServiceTitan.

Openfront Home Services runs a plumbing, HVAC or electrical business on one system: calls, leads and online booking, the dispatch board, technicians and their trucks, flat-rate price books, good/better/best estimates, jobs and visits with checklists and photos, invoices, financing and payments, service agreements and memberships, parts and purchasing, manufacturer warranty claims, permits, commissions and payroll export, and the customer portal. AI agents can answer calls, book and dispatch work, and handle back-office tasks through MCP tools.

Built on Next.js and KeystoneJS 6 with PostgreSQL.

## Status

Phase 0 (the platform spine) is in place: company setup for a Texas plumbing and HVAC company, roles and permissions, maker-checker approvals, a hash-chained audit log, an outbox for every external effect, leases with fencing tokens, business calendars, and jurisdiction policy packs (FTC Cooling-Off Rule, Texas home solicitation, calling hours, call recording, sales tax, licensing, liens and wage-hour) that resolve by place and date and fail closed.

Phase 1 (calls, booking and dispatch) is in place: customers with contacts, consent and sealed gate codes; leads from every channel; arrival-window capacity that never overbooks; office and online booking; an AI receptionist that answers recorded calls, books windows, hands off to a person or pages on-call through MCP tools with scoped grants; a dispatch board with eligibility checks and ranked recommendations; and a field view for technicians. Price books, estimates and the Cooling-Off cancellation flow come next.

## Running it

```bash
cp .env.example .env   # set DATABASE_URL and SESSION_SECRET
npm ci
npm run migrate
npm run dev
```

Open `/dashboard`, create the first owner account, then load the company from the setup cards. Or, after creating the owner, run `npm run seed` to load Summit Plumbing & Air with a first working day: leads, office and AI-booked jobs, a recorded call, a hand-off to the office and the dispatcher's assignments. The seed is idempotent.

## Checks

```bash
npm run verify                                         # typecheck, lint, unit and node tests
HS_TEST_DATABASE_URL='postgresql://…?schema=vitest' npm test   # adds the database tests
```

## License

MIT. See [LICENSE](./LICENSE).
