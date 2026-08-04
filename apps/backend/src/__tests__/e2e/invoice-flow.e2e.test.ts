import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';

const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  getInvoiceWithClient: vi.fn().mockResolvedValue(null),
  getStats: vi.fn(),
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
    invoice: {
      findUnique: mockState.findById,
      findFirst: mockState.findById,
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
    payment: {
      findMany: mockState.findMany,
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
import { invoiceRoutes } from '@/routes/invoice.routes';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000010';
const INVOICE_ID = '00000000-0000-0000-0000-000000000020';
const VALID_TOKEN = 'e2e-valid-token';

const mockClient = {
  id: CLIENT_ID,
  tenantId: TENANT_ID,
  name: 'Invoice E2E',
  phone: '5511999990001',
  email: null,
  document: null,
  preferredChannel: 'WHATSAPP',
  preferredTime: null,
  preferredLeadDays: 3,
  riskScore: 'LOW',
  riskScoreReason: null,
  riskScoreUpdatedAt: null,
  totalInvoices: 0,
  paidInvoices: 0,
  avgPaymentDelay: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvoice = {
  id: INVOICE_ID,
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  amount: 150.0,
  dueDate: new Date(Date.now() + 30 * 86400000),
  description: 'Invoice E2E',
  status: 'PENDING',
  paymentMethod: null,
  pixQRCode: null,
  pixCopyPaste: null,
  pixExpiresAt: null,
  externalPaymentId: null,
  paidAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: mockClient,
};

describe('Invoice Flow E2E', () => {
  let app: ReturnType<typeof Fastify>;
  let clientId: string;
  let invoiceId: string;

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
    await app.register(invoiceRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStartOnboarding.mockClear();
  });

  it('should create a client first', async () => {
    mockState.findById.mockResolvedValue(null);
    mockState.create.mockResolvedValue(mockClient);

    const res = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      payload: { tenantId: TENANT_ID, name: 'Invoice E2E', phone: '5511999990001' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { id: string } };
    clientId = body.data.id;
    expect(clientId).toBeTruthy();
  });

  it('should create an invoice', async () => {
    mockState.findById.mockResolvedValue(mockClient);
    mockState.create.mockResolvedValue(mockInvoice);

    const res = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      payload: {
        tenantId: TENANT_ID,
        clientId,
        amount: 150.0,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { id: string; amount: number } };
    expect(body.data.amount).toBe(150);
    invoiceId = body.data.id;
  });

  it('should list invoices', async () => {
    mockState.findMany.mockResolvedValue([mockInvoice]);
    mockState.count.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/api/invoices',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      query: { tenantId: TENANT_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(invoiceId).toBeTruthy();
  });
});
