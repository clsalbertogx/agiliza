import type { FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { envSchema } from '@/config/env';
import { createToken } from '@/infrastructure/auth';
import authPlugin from '@/infrastructure/plugins/auth.plugin';

const NULL_TENANT = '00000000-0000-0000-0000-000000000000';
const MASTER_KEY = 'test-master-api-key';

describe('E1 — ApiKey must be validated (not any non-empty string)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    process.env.MASTER_API_KEY = MASTER_KEY;
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    app.get('/api/ping', async (request: FastifyRequest) => ({ ok: true, tenantId: request.tenantId ?? null }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a garbage ApiKey with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: 'ApiKey garbage' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an ApiKey that does not match MASTER_API_KEY with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: 'ApiKey wrong-key-123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid ApiKey and sets the null tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: `ApiKey ${MASTER_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenantId).toBe(NULL_TENANT);
  });
});

describe('E2 — JWT secret must come from the environment (no hardcoded fallback)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    // Simulate a deployment where JWT_SECRET was NOT provided: only the code
    // fallback could possibly sign tokens. The fix must NOT have one.
    delete process.env.JWT_SECRET;
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    app.get('/api/ping', async (request: FastifyRequest) => ({ ok: true, tenantId: request.tenantId ?? null }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a token signed with the public fallback secret when JWT_SECRET is not set', async () => {
    const forgedToken = createToken({ tenantId: 't1', userId: 'u1', role: 'owner' }, 'agiliza-dev-secret');
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: `Bearer ${forgedToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a token signed with the configured JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'test-configured-secret';
    const token = createToken({ tenantId: 't1', userId: 'u1', role: 'owner' }, 'test-configured-secret');
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenantId).toBe('t1');
  });

  it('env schema has no default for JWT_SECRET (missing value is a validation error)', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'JWT_SECRET')).toBe(true);
    }
  });
});
