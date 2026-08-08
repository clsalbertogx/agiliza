import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  clientFindMany: vi.fn(),
  clientCount: vi.fn(),
  clientFindFirst: vi.fn(),
  clientCreate: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceCount: vi.fn(),
  invoiceFindFirst: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: {
      findMany: mockState.clientFindMany,
      count: mockState.clientCount,
      findFirst: mockState.clientFindFirst,
      create: mockState.clientCreate,
    },
    invoice: {
      findMany: mockState.invoiceFindMany,
      count: mockState.invoiceCount,
      findFirst: mockState.invoiceFindFirst,
    },
  })),
}));

import { clientRoutes } from '@/routes/client.routes';
import { invoiceRoutes } from '@/routes/invoice.routes';

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';

/**
 * A6 — a client-supplied `tenantId` query param must never be trusted to
 * scope data. The JWT is the authoritative tenant source. These tests pin:
 *
 *   1. An authenticated request WITH `tenantId=other-uuid` in the query still
 *      resolves ONLY the JWT tenant's data.
 *   2. A request with NO tenant context in the token must NOT be rescued by a
 *      `tenantId` query param (fail-closed → 401), instead of silently
 *      returning another tenant's data.
 */
describe('A6 — client-supplied tenantId must never override the JWT tenant', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorateRequest('tenantId', undefined);

    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = request.headers.authorization;
      if (!auth) {
        reply.code(401).send({ error: 'Missing authorization header' });
        return;
      }
      if (auth === 'Bearer tenant-a') {
        (request as any).tenantId = TENANT_A;
        return;
      }
      if (auth === 'Bearer no-tenant') {
        // Simulates an authenticated request whose token carries no tenant
        // context (defense-in-depth: this must NOT be rescued by a query param).
        return;
      }
      reply.code(401).send({ error: 'Invalid or expired token' });
    });

    await app.register(clientRoutes);
    await app.register(invoiceRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.clientFindMany.mockResolvedValue([]);
    mockState.clientCount.mockResolvedValue(0);
    mockState.invoiceFindMany.mockResolvedValue([]);
    mockState.invoiceCount.mockResolvedValue(0);
  });

  it('GET /api/clients with tenantId=other in query still scopes to the JWT tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: 'Bearer tenant-a' },
      query: { tenantId: TENANT_B },
    });

    expect(res.statusCode).toBe(200);
    // The repo lookup must have been scoped to TENANT_A (the JWT tenant) —
    // TENANT_B must never appear in the where clause.
    expect(mockState.clientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
    expect(mockState.clientFindMany.mock.calls[0][0].where.tenantId).not.toBe(TENANT_B);
  });

  it('GET /api/invoices with tenantId=other in query still scopes to the JWT tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/invoices',
      headers: { authorization: 'Bearer tenant-a' },
      query: { tenantId: TENANT_B },
    });

    expect(res.statusCode).toBe(200);
    expect(mockState.invoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
    expect(mockState.invoiceFindMany.mock.calls[0][0].where.tenantId).not.toBe(TENANT_B);
  });

  it('GET /api/clients with NO tenant context + tenantId query param fails closed (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: 'Bearer no-tenant' },
      query: { tenantId: TENANT_B },
    });

    // A client-supplied tenantId must never authenticate the request.
    expect(res.statusCode).toBe(401);
    expect(mockState.clientFindMany).not.toHaveBeenCalled();
  });

  it('GET /api/invoices with NO tenant context + tenantId query param fails closed (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/invoices',
      headers: { authorization: 'Bearer no-tenant' },
      query: { tenantId: TENANT_B },
    });

    expect(res.statusCode).toBe(401);
    expect(mockState.invoiceFindMany).not.toHaveBeenCalled();
  });
});
