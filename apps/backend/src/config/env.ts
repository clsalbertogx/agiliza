import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().default('postgresql://dev:dev@localhost:5432/agiliza'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  // Optional: comma-separated source-IP allowlist for /api/webhooks/evolution.
  // Empty = no allowlist (any IP may call, subject to the API key check).
  EVOLUTION_ALLOWED_IPS: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  // Security: JWT_SECRET MUST come from the environment (.env / CI secret).
  // No default — a deployment without it must fail fast instead of silently
  // signing tokens with a public constant (JWT forgery).
  JWT_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().default(''),
  // Security (S1): MASTER_API_KEY MUST come from the environment. No default —
  // a deployment without it must fail fast instead of accepting the publicly
  // known dev key (which would let anyone impersonate the null tenant).
  MASTER_API_KEY: z.string().min(1),
  PAYMENT_PROVIDER: z.enum(['asaas', 'mercadopago', 'stripe', 'pagbank', 'polar']).default('asaas'),
  // CODE-19: ASAAS_API_KEY MUST come from the environment. No default — a
  // deployment without it must fail fast instead of silently charging against
  // a sandbox credential that exists in public source control.
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  ASAAS_WEBHOOK_SECRET: z.string().default(''),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADO_PAGO_PUBLIC_KEY: z.string().default(''),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  PAGBANK_ACCESS_TOKEN: z.string().default(''),
  PAGBANK_PUBLIC_KEY: z.string().default(''),
  PAGBANK_WEBHOOK_SECRET: z.string().default(''),
  POLAR_ACCESS_TOKEN: z.string().default(''),
  POLAR_WEBHOOK_SECRET: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  OUTBOUND_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  OUTBOUND_WEBHOOK_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
