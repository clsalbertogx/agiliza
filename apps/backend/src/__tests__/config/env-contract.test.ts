import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envSchema } from '@/config/env';

/**
 * CONTRACT TEST (A4): pins the naming of environment variables forever.
 *
 * The backend zod schema (src/config/env.ts) and the repo-root `.env.example`
 * must stay in sync. Every key the schema declares MUST be documented in
 * `.env.example` under the same canonical name — so a rename like
 * `MERCADOPAGO_WEBHOOK_SECRET` → `MERCADO_PAGO_WEBHOOK_SECRET` can never
 * silently diverge again.
 */

function parseEnvExampleKeys(): string[] {
  const content = readFileSync(resolve(__dirname, '../../../../../.env.example'), 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split('=')[0]);
}

/**
 * Variables that live in `.env.example` but are read directly from
 * `process.env` by infra code (not validated by the env schema).
 */
const ALLOWED_EXTRAS = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_DEMO_MODE', 'REDIS_PASSWORD'];

describe('env contract — env.ts schema ↔ .env.example', () => {
  const schemaKeys = Object.keys(envSchema.shape) as string[];
  const exampleKeys = parseEnvExampleKeys();

  // Keys with no default in the zod schema are REQUIRED: a deployment without
  // them fails fast at startup. They must be documented as such in .env.example.
  const requiredResult = envSchema.safeParse({});
  const requiredKeys = requiredResult.success ? [] : requiredResult.error.issues.map((i) => i.path.join('.'));

  it('every env.ts schema key has a matching .env.example entry (canonical name)', () => {
    for (const key of schemaKeys) {
      expect(exampleKeys, `Missing .env.example entry for schema key "${key}"`).toContain(key);
    }
  });

  it('every REQUIRED schema key (no default) has a matching .env.example entry', () => {
    expect(requiredKeys).not.toHaveLength(0);
    for (const key of requiredKeys) {
      expect(exampleKeys, `Missing .env.example entry for REQUIRED schema key "${key}"`).toContain(key);
    }
  });

  it('.env.example has no stale keys (naming unification — A4)', () => {
    const known = new Set([...schemaKeys, ...ALLOWED_EXTRAS]);
    for (const key of exampleKeys) {
      expect(known, `Unknown/stale .env.example key "${key}" — not in env schema`).toContain(key);
    }
  });

  it('Mercado Pago webhook secret uses the canonical MERCADO_PAGO_WEBHOOK_SECRET name (A4)', () => {
    expect(schemaKeys).toContain('MERCADO_PAGO_WEBHOOK_SECRET');
    expect(exampleKeys).toContain('MERCADO_PAGO_WEBHOOK_SECRET');
    // The legacy misspelling must never come back.
    expect(exampleKeys).not.toContain('MERCADOPAGO_WEBHOOK_SECRET');
    expect(schemaKeys).not.toContain('MERCADOPAGO_WEBHOOK_SECRET');
  });
});
