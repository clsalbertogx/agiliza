import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';

const mockState = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  clientFindMany: vi.fn(),
  invoiceCount: vi.fn(),
  clientCount: vi.fn(),
  invoiceFindUnique: vi.fn(),
}));

vi.mock('../../infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    invoice: { findMany: mockState.invoiceFindMany, count: mockState.invoiceCount, findUnique: mockState.invoiceFindUnique },
    client: { findMany: mockState.clientFindMany, count: mockState.clientCount },
  })),
}));

import { reportRoutes } from '../../routes/report.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TOKEN = 'test-valid-token';

describe('Report API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);
    
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.headers.authorization) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      (request as any).tenantId = TEST_TENANT_ID;
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

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('GET /api/reports/cash-flow — Cash Flow Forecast', () => {
    it('should return cash flow forecast', async () => {
      // CashFlowService.generateForecast uses:
      //   invoiceRepo.findMany() -> prisma.invoice.findMany()
      //   clientRepo.findMany()  -> prisma.client.findMany()
      mockState.invoiceFindMany.mockResolvedValue([]);
      mockState.clientFindMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/cash-flow',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, months: '3' },
      });
      expect(res.statusCode).toBe(200);
      // Route returns { data: { forecast, summary } }
      const body = res.json();
      expect(body.data.forecast).toBeDefined();
      expect(body.data.summary).toBeDefined();
      expect(body.data.forecast.length).toBe(3);
    });

    it('should handle months parameter', async () => {
      mockState.invoiceFindMany.mockResolvedValue([]);
      mockState.clientFindMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/cash-flow',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, months: '6' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.forecast.length).toBe(6);
    });

    it('should use historical data for projections', async () => {
      // Provide some paid invoices to establish baseline payment rate
      const now = new Date();
      mockState.invoiceFindMany.mockResolvedValue([
        { id: '1', tenantId: TEST_TENANT_ID, status: 'PAID', amount: 100, dueDate: new Date('2026-06-01'), clientId: 'c1', createdAt: now, updatedAt: now },
        { id: '2', tenantId: TEST_TENANT_ID, status: 'PAID', amount: 200, dueDate: new Date('2026-06-15'), clientId: 'c1', createdAt: now, updatedAt: now },
        { id: '3', tenantId: TEST_TENANT_ID, status: 'PAID', amount: 150, dueDate: new Date('2026-07-01'), clientId: 'c2', createdAt: now, updatedAt: now },
      ]);
      mockState.clientFindMany.mockResolvedValue([
        { id: 'c1', tenantId: TEST_TENANT_ID, name: 'Client A', phone: '5511999998888' },
        { id: 'c2', tenantId: TEST_TENANT_ID, name: 'Client B', phone: '5511999998889' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/cash-flow',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, months: '1' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      // 2 clients * avg 150 revenue = 300 expectedRevenue (with tiny growth)
      expect(body.data.forecast[0].expectedRevenue).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/risk-distribution — Risk Distribution', () => {
    it('should return distribution per risk segment', async () => {
      // The route uses invoiceRepo.findMany to get all invoices
      mockState.invoiceFindMany.mockResolvedValue([
        { id: '1', tenantId: TEST_TENANT_ID, status: 'PAID', amount: '100.00', clientId: 'c1' },
        { id: '2', tenantId: TEST_TENANT_ID, status: 'PENDING', amount: '200.00', clientId: 'c2' },
        { id: '3', tenantId: TEST_TENANT_ID, status: 'OVERDUE', amount: '300.00', clientId: 'c3' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/risk-distribution',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.green).toBeDefined();
      expect(body.data.yellow).toBeDefined();
      expect(body.data.red).toBeDefined();
    });
  });

  describe('GET /api/reports/collection-efficiency — Collection Efficiency', () => {
    it('should return collection efficiency metrics', async () => {
      mockState.invoiceFindMany.mockResolvedValue([
        { id: '1', tenantId: TEST_TENANT_ID, status: 'PAID', amount: '100.00', dueDate: new Date('2026-06-01') },
        { id: '2', tenantId: TEST_TENANT_ID, status: 'OVERDUE', amount: '200.00', dueDate: new Date('2026-05-01') },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/collection-efficiency',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.total).toBe(2);
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/collection-efficiency',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
