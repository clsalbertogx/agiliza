import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

const mockClientState = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    tenant: {
      findUnique: mockState.findUnique,
      findFirst: mockState.findFirst,
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
    client: {
      findFirst: mockClientState.findFirst,
      findMany: mockClientState.findMany,
      count: mockClientState.count,
    },
  })),
}));

import { createToken, verifyToken } from '@/infrastructure/auth';
import authPlugin from '@/infrastructure/plugins/auth.plugin';
import { clientRoutes } from '@/routes/client.routes';
import { tenantRoutes } from '@/routes/tenant.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_SECRET = 'test-jwt-secret';

process.env.JWT_SECRET = TEST_SECRET;
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const mockTenant = {
  id: TEST_TENANT_ID,
  name: 'Test Tenant',
  slug: 'test-tenant',
  email: 'tenant@example.com',
  phone: '5511999998888',
  document: '11222333000181',
  config: {},
  paymentProvider: 'asaas',
  paymentProviderConfig: {},
  decisionConfig: {
    defaultChannel: 'WHATSAPP',
    sendReminders: true,
    leadDays: 3,
    businessHoursStart: '08:00',
    businessHoursEnd: '20:00',
    weekendReminders: false,
    maxRemindersPerCycle: 3,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Tenant Signup API (POST /api/tenants)', () => {
  let app: ReturnType<typeof Fastify>;
  const validBearer = `Bearer ${createToken(
    { tenantId: TEST_TENANT_ID, userId: 'test-user', role: 'owner' },
    TEST_SECRET,
  )}`;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(tenantRoutes);
    await app.register(clientRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria tenant publicamente (sem header Authorization) retornando 201 com data.tenant', async () => {
    mockState.findUnique.mockResolvedValue(null); // slug disponível
    mockState.create.mockResolvedValue(mockTenant);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tenants',
      payload: { name: 'Test Tenant', slug: 'test-tenant', email: 'tenant@example.com' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.tenant).toBeDefined();
    expect(body.data.tenant.id).toBe(TEST_TENANT_ID);
    expect(body.data.tenant.name).toBe('Test Tenant');
    expect(body.data.tenant.slug).toBe('test-tenant');
    expect(body.data.tenant.email).toBe('tenant@example.com');
  });

  it('retorna um campo token (JWT válido) cujo tenantId corresponde ao tenant criado', async () => {
    mockState.findUnique.mockResolvedValue(null);
    mockState.create.mockResolvedValue(mockTenant);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tenants',
      payload: { name: 'Test Tenant', slug: 'test-tenant', email: 'tenant@example.com' },
    });

    const body = res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);

    const payload = verifyToken(body.token, TEST_SECRET);
    expect(payload?.tenantId).toBe(body.data.tenant.id);
  });

  it('retorna 409 ao tentar criar um tenant com slug duplicado', async () => {
    mockState.findUnique.mockResolvedValue(mockTenant); // slug já em uso

    const res = await app.inject({
      method: 'POST',
      url: '/api/tenants',
      headers: { authorization: validBearer },
      payload: { name: 'Another', slug: 'test-tenant', email: 'other@example.com' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('retorna 400 para corpo inválido (sem name)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tenants',
      headers: { authorization: validBearer },
      payload: { slug: 'test-tenant', email: 'tenant@example.com' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('não expõe lista de tenants (GET /api/tenants removida — sem rota, 404 mesmo autenticado)', async () => {
    // a1: a listagem sem escopo foi removida por segurança; a rota não existe mais.
    const res = await app.inject({
      method: 'GET',
      url: '/api/tenants',
      headers: { authorization: validBearer },
    });
    expect(res.statusCode).toBe(404);
  });

  it('o token retornado no signup acessa um endpoint protegido (GET /api/clients → 200)', async () => {
    mockState.findUnique.mockResolvedValue(null);
    mockState.create.mockResolvedValue(mockTenant);
    mockClientState.findMany.mockResolvedValue([]);
    mockClientState.count.mockResolvedValue(0);

    const signup = await app.inject({
      method: 'POST',
      url: '/api/tenants',
      payload: { name: 'Test Tenant', slug: 'test-tenant', email: 'tenant@example.com' },
    });
    const token = signup.json().token;

    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('usa o tenantId do JWT quando a querystring não traz tenantId (GET /api/clients → 200)', async () => {
    mockClientState.findMany.mockResolvedValue([]);
    mockClientState.count.mockResolvedValue(0);

    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: validBearer },
    });

    expect(res.statusCode).toBe(200);
    expect(mockClientState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
      }),
    );
  });

  it('o tenantId da querystring não sobrescreve o do JWT (JWT é autoritativo)', async () => {
    const otherTenant = '99999999-9999-9999-9999-999999999999';
    mockClientState.findMany.mockResolvedValue([]);
    mockClientState.count.mockResolvedValue(0);

    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: validBearer },
      query: { tenantId: otherTenant },
    });

    expect(res.statusCode).toBe(200);
    // A consulta deve filtrar pelo tenant do JWT, não pelo tenantId da query
    expect(mockClientState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
      }),
    );
  });
});
