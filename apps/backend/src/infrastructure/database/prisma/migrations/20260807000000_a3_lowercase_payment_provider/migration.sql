-- A3: single canonical PaymentProvider wire format (lowercase: 'asaas', 'mercadopago', 'stripe', 'pagbank', 'polar').
-- payments.provider and tenants.paymentProvider are TEXT columns (not native Postgres enums),
-- so a plain lower() UPDATE is safe and idempotent for legacy UPPERCASE rows.
UPDATE "payments"
SET "provider" = lower("provider")
WHERE "provider" <> lower("provider");

UPDATE "tenants"
SET "paymentProvider" = lower("paymentProvider")
WHERE "paymentProvider" <> lower("paymentProvider");