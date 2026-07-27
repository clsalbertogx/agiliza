import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

const mockState = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  findBySlug: vi.fn(),
}));

vi.mock('../../infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    tenant: {
      findUnique: mockState.findUnique,
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
  })),
}));

import { tenantRoutes } from '../../routes/tenant.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TOKEN = 'test-valid-token';

describe('Tenant API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);
    
    app.addHook('preHandler', async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      (request as any).tenantId = TEST_TENANT_ID;
    });
    
    await app.register(tenantRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTenant = {
    id: TEST_TENANT_ID,
    name: 'Test Tenant',
    slug: 'test-tenant',
    email: 'tenant@example.com',
    phone: '5511999998888',
    document: '11222333000181',
    config: {},
    paymentProvider: 'asaas',
    paymentProviderConfig: { apiKey: 'asaas_test_key', environment: 'sandbox' },
    decisionConfig: {
      defaultChannel: 'WHATSAPP',
      sendReminders: true,
      leadDays: 3,
      businessHoursStart: '08:00',
      businessHoursEnd: '20:00',
      weekendReminders: false,
      maxRemindersPerCycle: 3,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('GET /api/tenants/:id/config — Get Tenant Config', () => {
    it('should return tenant configuration', async () => {
      mockState.findUnique.mockResolvedValue(mockTenant);

      const res = await app.inject({
        method: 'GET',
        url: `/api/tenants/${TEST_TENANT_ID}/config`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toBeDefined();
    });

    it('should return 404 for non-existent tenant', async () => {
      mockState.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/tenants/non-existent-id/config',
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/tenants/:id/config — Update Tenant Config', () => {
    it('should update tenant config', async () => {
      mockState.findUnique.mockResolvedValue(mockTenant);
      // updateConfig calls prisma.tenant.update
      mockState.update.mockResolvedValue(mockTenant);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tenants/${TEST_TENANT_ID}/config`,
        headers: { authorization: validToken },
        payload: { name: 'Updated Tenant' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Payment Provider Configuration', () => {
    it('should configure payment provider with valid API key', async () => {
      mockState.findUnique.mockResolvedValue(mockTenant);
      // updatePaymentProvider calls prisma.tenant.update
      mockState.update.mockResolvedValue(mockTenant);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/tenants/${TEST_TENANT_ID}/payment-provider`,
        headers: { authorization: validToken },
        payload: {
          provider: 'asaas',
          apiKey: 'asaas_valid_key',
          environment: 'sandbox',
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 400 for empty API key', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/tenants/${TEST_TENANT_ID}/payment-provider`,
        headers: { authorization: validToken },
        payload: {
          provider: 'asaas',
          apiKey: '',
          environment: 'sandbox',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should never return API key in response (always masked)', async () => {
      mockState.findUnique.mockResolvedValue(mockTenant);

      const res = await app.inject({
        method: 'GET',
        url: `/api/tenants/${TEST_TENANT_ID}/payment-provider`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.hasApiKey).toBe(true);
      expect(body.data.apiKey).toBeUndefined();
    });
  });
});
