import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findByPhone: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: {
      findUnique: mockState.findById,
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        if (args.where.id) return mockState.findById(args.where);
        if (args.where.phone) return mockState.findByPhone(args.where);
        return null;
      }),
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
  })),
}));

/**
 * Mock the onboarding factory to capture auto-trigger calls.
 * The event bus handler (registered via registerEventHandlers) uses this factory.
 */
const mockStartOnboarding = vi.fn().mockResolvedValue(undefined);
const mockNeedsOnboarding = vi.fn().mockResolvedValue(true);
vi.mock('@/presentation/factories/create-onboarding.factory', () => ({
  createOnboardingService: vi.fn(() => ({
    startOnboarding: mockStartOnboarding,
    needsOnboarding: mockNeedsOnboarding,
  })),
}));

import { getEventBus, resetEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { registerEventHandlers } from '@/presentation/factories/register-event-handlers';
import { clientRoutes } from '@/routes/client.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_CLIENT_ID = '00000000-0000-0000-0000-000000000010';
const UNKNOWN_CLIENT_UUID = '99999999-9999-9999-9999-999999999999';
const VALID_TOKEN = 'test-valid-token';

describe('Client API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);

    // Auth hook that validates tokens properly
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

      // Invalid token
      reply.code(401).send({ error: 'Invalid or expired token' });
    });

    // Set up event bus wiring (mirrors index.ts)
    resetEventBus();
    registerEventHandlers(getEventBus());

    await app.register(clientRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedsOnboarding.mockResolvedValue(true);
    mockState.findByPhone.mockResolvedValue(null);
    mockState.findById.mockResolvedValue(null);
    mockState.create.mockResolvedValue(mockClient);
    mockState.update.mockResolvedValue(mockClient);
    mockState.findMany.mockResolvedValue([mockClient]);
    mockState.count.mockResolvedValue(1);
  });

  const mockClient = {
    id: TEST_CLIENT_ID,
    tenantId: TEST_TENANT_ID,
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    riskScore: 'GREEN',
    riskScoreReason: null,
    riskScoreUpdatedAt: null,
    preferredChannel: 'WHATSAPP',
    preferredTime: null,
    preferredLeadDays: 3,
    document: null,
    totalInvoices: 0,
    paidInvoices: 0,
    avgPaymentDelay: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('POST /api/clients — Create Client', () => {
    it('should create client with valid data and return 201', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue(mockClient);

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.name).toBe('John Doe');
    });

    it('should return 400 when name is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when phone has less than 10 digits', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'Test',
          phone: '11999',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when phone has non-numeric characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'Test',
          phone: '55(11)99999-8888',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 409 when phone already exists for the same tenant', async () => {
      mockState.findByPhone.mockResolvedValue(mockClient);

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('should accept same phone for different tenants', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue({ ...mockClient, tenantId: '00000000-0000-0000-0000-000000000099' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('should return 401 without auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        payload: {
          name: 'Test',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with expired auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: 'Bearer expired-token' },
        payload: {
          name: 'Test',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with malformed auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: 'Bearer eyJ.invalid.token' },
        payload: {
          name: 'Test',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should create client with default preferredChannel = whatsapp', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue(mockClient);

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.preferredChannel).toBe('WHATSAPP');
    });

    it('should create client with optional email', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue({ ...mockClient, email: 'john@example.com' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
          email: 'john@example.com',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.email).toBe('john@example.com');
    });

    it('should return 400 with invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'John Doe',
          phone: '5511999998888',
          email: 'invalid-email',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should auto-trigger onboarding when client created without preferences', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue(mockClient);
      mockStartOnboarding.mockClear();
      mockNeedsOnboarding.mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'New Client',
          phone: '5511999990000',
        },
      });

      expect(res.statusCode).toBe(201);
      // Auto-trigger should call startOnboarding for clients without preferences
      await new Promise((resolve) => setTimeout(resolve, 20)); // wait for microtask queue
      expect(mockStartOnboarding).toHaveBeenCalledWith(mockClient.id, TEST_TENANT_ID);
    });

    it('should NOT auto-trigger onboarding when both preferredChannel and preferredTime are provided', async () => {
      mockState.findById.mockResolvedValue(null);
      mockState.create.mockResolvedValue(mockClient);
      mockStartOnboarding.mockClear();
      mockNeedsOnboarding.mockResolvedValue(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { authorization: validToken },
        payload: {
          name: 'Pref Client',
          phone: '5511999991111',
          preferredChannel: 'EMAIL',
          preferredTime: '09:00',
        },
      });

      expect(res.statusCode).toBe(201);
      // Auto-trigger should NOT fire when both preferences are provided
      await new Promise((resolve) => setTimeout(resolve, 20)); // wait for microtask queue
      expect(mockStartOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/clients — List Clients', () => {
    it('should return paginated client list with meta', async () => {
      mockState.findMany.mockResolvedValue([mockClient]);
      mockState.count.mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
    });

    it('should filter clients by risk score', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, riskScore: 'red' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should search clients by name', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, search: 'Silva' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return empty array when no clients match', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, search: 'NonExistentName' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('should respect perPage max limit of 100', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, perPage: '200' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/clients/:id — Get Client', () => {
    it('should return client by ID', async () => {
      mockState.findById.mockResolvedValue(mockClient);

      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${TEST_CLIENT_ID}`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(TEST_CLIENT_ID);
    });

    it('should return 404 for non-existent client', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${UNKNOWN_CLIENT_UUID}`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when accessing other tenant client', async () => {
      // findById now filters by tenantId in the Prisma query,
      // so a cross-tenant lookup returns null (not found)
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${TEST_CLIENT_ID}`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/clients/:id — Update Client', () => {
    it('should update client name', async () => {
      mockState.findById.mockResolvedValue(mockClient);
      mockState.update.mockResolvedValue({ ...mockClient, name: 'Novo Nome' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/clients/${TEST_CLIENT_ID}`,
        headers: { authorization: validToken },
        payload: { name: 'Novo Nome' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should update client phone', async () => {
      mockState.findById.mockResolvedValue(mockClient);
      mockState.update.mockResolvedValue({ ...mockClient, phone: '5521999998888' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/clients/${TEST_CLIENT_ID}`,
        headers: { authorization: validToken },
        payload: { phone: '5521999998888' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent client', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/clients/${UNKNOWN_CLIENT_UUID}`,
        headers: { authorization: validToken },
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should allow partial update with only one field', async () => {
      mockState.findById.mockResolvedValue(mockClient);
      mockState.update.mockResolvedValue({ ...mockClient, preferredLeadDays: 10 });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/clients/${TEST_CLIENT_ID}`,
        headers: { authorization: validToken },
        payload: { preferredLeadDays: 10 },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/clients/:id/risk-score — Get Risk Score', () => {
    it('should return risk score with top features and reason', async () => {
      mockState.findById.mockResolvedValue({
        ...mockClient,
        riskScore: 'GREEN',
        riskScoreReason: { reasons: ['Pagamentos em dia'] },
        riskScoreUpdatedAt: new Date(),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${TEST_CLIENT_ID}/risk-score`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.riskScore).toBe('GREEN');
    });

    it('should return 404 for non-existent client', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${UNKNOWN_CLIENT_UUID}/risk-score`,
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
