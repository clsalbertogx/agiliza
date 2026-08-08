-- DATA-12: missing indexes flagged by index audit.
-- 1. invoices(subscriptionId)  — most-queried join column (FK exists, but Postgres does not auto-index FKs)
-- 2. subscriptions(nextBilling) — worker query picks subscriptions by nextBilling due
-- 3. tenants(email) — auth/signup lookup by email (column is NOT unique, so no implicit index)
-- Idempotent-safe: CREATE INDEX IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

CREATE INDEX IF NOT EXISTS "subscriptions_nextBilling_idx" ON "subscriptions"("nextBilling");

CREATE INDEX IF NOT EXISTS "tenants_email_idx" ON "tenants"("email");