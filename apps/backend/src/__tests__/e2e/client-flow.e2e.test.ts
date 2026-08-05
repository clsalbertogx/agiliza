import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: {
      findUnique: mockState.findById,
      findFirst: mockState.findById,
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
  })),
}));

const mockStartOnboarding = vi.fn().mockResolvedValue(undefined);
vi.mock('@/presentation/factories/create-onboarding.factory', () => ({
  createOnboardingService: vi.fn(() => ({
    startOnboarding: mockStartOnboarding,
  })),
}));

import { clientRoutes } from '@/routes/client.routes';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000010';
const VALID_TOKEN = 'e2e-valid-token';

const mockClient = {
  id: CLIENT_ID,
  tenantId: TENANT_ID,
  name: 'E2E Test Client',
  phone: '5511999990000',
  email: null,
  document: null,
  preferredChannel: 'WHATSAPP',
  preferredTime: null,
  preferredLeadDays: 3,
  riskScore: 'GREEN',
  riskScoreReason: null,
  riskScoreUpdatedAt: null,
  totalInvoices: 0,
  paidInvoices: 0,
  avgPaymentDelay: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Client Flow E2E', () => {
  let app: ReturnType<typeof Fastify>;
  let clientId: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);

    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        reply.code(401).send({ error: 'Missing authorization header' });
        return;
      }
      if (authHeader === `Bearer ${VALID_TOKEN}`) {
        (request as any).tenantId = TENANT_ID;
        (request as any).userId = TENANT_ID;
        return;
      }
      reply.code(401).send({ error: 'Invalid or expired token' });
    });

    await app.register(clientRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStartOnboarding.mockClear();
  });

  it('should create a client', async () => {
    mockState.findById.mockResolvedValue(null);
    mockState.create.mockResolvedValue(mockClient);

    const res = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      payload: { name: 'E2E Test Client', phone: '5511999990000' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { id: string; name: string } };
    expect(body.data.name).toBe('E2E Test Client');
    clientId = body.data.id;
  });

  it('should list clients', async () => {
    mockState.findMany.mockResolvedValue([mockClient]);
    mockState.count.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      query: { tenantId: TENANT_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should get client by ID', async () => {
    mockState.findById.mockResolvedValue(mockClient);

    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${CLIENT_ID}`,
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { id: string } };
    expect(body.data.id).toBe(clientId || CLIENT_ID);
  });
});
