import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';

const mockCashFlowService = vi.hoisted(() => ({
  generateForecast: vi.fn(),
  getCollectionEfficiency: vi.fn(),
  getRiskDistribution: vi.fn(),
}));

vi.mock('@/presentation/factories/create-cash-flow.factory', () => ({
  createCashFlowService: vi.fn(() => mockCashFlowService),
}));

import { reportRoutes } from '@/routes/report.routes';

// The reports querystring schema requires tenantId as a valid UUID (format: uuid).
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TOKEN = 'e2e-valid-token';

describe('Reports E2E', () => {
  let app: ReturnType<typeof Fastify>;

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

    await app.register(reportRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cash flow forecast', async () => {
    mockCashFlowService.generateForecast.mockResolvedValue({
      forecast: [{ month: 'março de 2026', expectedRevenue: 100 }],
      summary: { totalExpectedRevenue: 100 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/cash-flow',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      query: { tenantId: TENANT_ID, months: '3' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { forecast: unknown; summary: unknown } };
    expect(body.data.forecast).toBeDefined();
    expect(body.data.summary).toBeDefined();
  });

  it('should return collection efficiency', async () => {
    mockCashFlowService.getCollectionEfficiency.mockResolvedValue({ total: 10, paid: 8 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/collection-efficiency',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      query: { tenantId: TENANT_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown };
    expect(body.data).toBeDefined();
  });

  it('should return risk distribution', async () => {
    mockCashFlowService.getRiskDistribution.mockResolvedValue({
      green: { count: 1, percentage: 33 },
      yellow: { count: 1, percentage: 33 },
      red: { count: 1, percentage: 34 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/risk-distribution',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      query: { tenantId: TENANT_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { green: unknown; yellow: unknown; red: unknown } };
    expect(body.data.green).toBeDefined();
    expect(body.data.yellow).toBeDefined();
    expect(body.data.red).toBeDefined();
  });
});
