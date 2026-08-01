import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';

const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findByTenantId: vi.fn(),
  findByClientId: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    subscription: {
      findFirst: mockState.findById,
      findMany: mockState.findByTenantId,
      create: mockState.create,
      update: mockState.cancel,
    },
    client: {
      findFirst: vi.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000001',
        name: 'John Doe',
        phone: '5511999998888',
        riskScore: 'LOW',
        preferredChannel: 'WHATSAPP',
        preferredLeadDays: 3,
        totalInvoices: 0,
        paidInvoices: 0,
        avgPaymentDelay: null,
      }),
    },
  })),
}));

import { subscriptionRoutes } from '@/routes/subscription.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const TEST_SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000003';
const VALID_TOKEN = 'test-valid-token';

describe('Subscription API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);

    // Auth hook
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        reply.code(401).send({ error: 'Missing authorization header' });
        return;
      }

      if (authHeader === `Bearer ${VALID_TOKEN}`) {
        (request as any).tenantId = TEST_TENANT_ID;
        (request as any).userId = TEST_TENANT_ID;
        return;
      }

      reply.code(401).send({ error: 'Invalid or expired token' });
    });

    await app.register(subscriptionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSubscription = {
    id: TEST_SUBSCRIPTION_ID,
    tenantId: TEST_TENANT_ID,
    clientId: TEST_CLIENT_ID,
    plan: 'Premium Plan',
    amount: 99.90,
    billingCycle: 'MONTHLY',
    status: 'ACTIVE',
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    endDate: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('POST /api/subscriptions — Create Subscription', () => {
    it('should create subscription with valid data and return 201', async () => {
      mockState.create.mockResolvedValue(mockSubscription);

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          plan: 'Premium Plan',
          amount: 99.90,
          billingCycle: 'MONTHLY',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.plan).toBe('Premium Plan');
    });

    it('should return 400 when plan is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          amount: 99.90,
          billingCycle: 'MONTHLY',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when amount is negative', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          plan: 'Premium',
          amount: -10,
          billingCycle: 'MONTHLY',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when billingCycle is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          plan: 'Premium',
          amount: 99.90,
          billingCycle: 'INVALID',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          plan: 'Premium Plan',
          amount: 99.90,
          billingCycle: 'MONTHLY',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/subscriptions — List Subscriptions', () => {
    it('should return all subscriptions for tenant', async () => {
      mockState.findByTenantId.mockResolvedValue([mockSubscription]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should filter subscriptions by clientId', async () => {
      mockState.findByClientId.mockResolvedValue([mockSubscription]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, clientId: TEST_CLIENT_ID },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return empty array when no subscriptions', async () => {
      mockState.findByTenantId.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/subscriptions',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });
  });

  describe('GET /api/subscriptions/:id — Get Subscription by ID', () => {
    it('should return subscription by ID', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);

      const res = await app.inject({
        method: 'GET',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}`,
        headers: { authorization: validToken },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(TEST_SUBSCRIPTION_ID);
    });

    it('should return 404 for non-existent subscription', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/subscriptions/non-existent-id',
        headers: { authorization: validToken },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/subscriptions/:id — Cancel Subscription', () => {
    it('should cancel an active subscription', async () => {
      const cancelledMock = {
        ...mockSubscription,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      };
      mockState.findById.mockResolvedValue(mockSubscription);
      mockState.cancel.mockResolvedValue(cancelledMock);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}`,
        headers: { authorization: validToken },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('CANCELLED');
    });

    it('should return 404 for non-existent subscription', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/subscriptions/non-existent-id',
        headers: { authorization: validToken },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/subscriptions/:id/trial — Start Trial', () => {
    it('should start a trial on an active subscription', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);
      const trialMock = {
        ...mockSubscription,
        status: 'TRIAL',
        trialDays: 14,
        trialEndsAt: new Date('2026-08-15'),
      };
      mockState.cancel.mockResolvedValue(trialMock);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/trial`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          trialDays: 14,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('TRIAL');
      expect(res.json().data.trialDays).toBe(14);
    });

    it('should return 400 for invalid trialDays', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/trial`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          trialDays: 0,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent subscription', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/subscriptions/non-existent-id/trial',
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          trialDays: 7,
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/subscriptions/:id/grace-period — Set Grace Period', () => {
    it('should set grace period on a subscription', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);
      const graceMock = {
        ...mockSubscription,
        status: 'GRACE_PERIOD',
        gracePeriodDays: 7,
        gracePeriodEndsAt: new Date('2026-08-22'),
      };
      mockState.cancel.mockResolvedValue(graceMock);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/grace-period`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          days: 7,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('GRACE_PERIOD');
      expect(res.json().data.gracePeriodDays).toBe(7);
    });

    it('should return 400 for invalid days', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/grace-period`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          days: 0,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/subscriptions/:id/auto-renew — Toggle Auto-Renew', () => {
    it('should disable auto-renew on a subscription', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);
      const autoRenewMock = {
        ...mockSubscription,
        autoRenew: false,
      };
      mockState.cancel.mockResolvedValue(autoRenewMock);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/auto-renew`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
          autoRenew: false,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.autoRenew).toBe(false);
    });

    it('should return 400 for missing autoRenew field', async () => {
      mockState.findById.mockResolvedValue(mockSubscription);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/subscriptions/${TEST_SUBSCRIPTION_ID}/auto-renew`,
        headers: { authorization: validToken },
        payload: {
          tenantId: TEST_TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
