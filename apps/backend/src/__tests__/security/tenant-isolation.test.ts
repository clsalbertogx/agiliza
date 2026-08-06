import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantFindMany: vi.fn(),
  tenantCount: vi.fn(),
  tenantCreate: vi.fn(),
  tenantUpdate: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceCount: vi.fn(),
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventCount: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock('@/application/services/reminder.service', () => {
  const mock = {
    sendReminderNow: vi.fn().mockResolvedValue({ externalId: 'msg-123' }),
    processPendingReminders: vi.fn().mockResolvedValue({ processed: 0, decisions: [] }),
  };
  return { ReminderService: vi.fn(() => mock) };
});

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    tenant: {
      findUnique: mockState.tenantFindUnique,
      findFirst: mockState.tenantFindUnique,
      findMany: mockState.tenantFindMany,
      create: mockState.tenantCreate,
      update: mockState.tenantUpdate,
      count: mockState.tenantCount,
    },
    paymentProviderConfig: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findUnique: vi.fn(),
    },
    invoice: {
      findUnique: mockState.invoiceFindFirst,
      findFirst: mockState.invoiceFindFirst,
      findMany: mockState.invoiceFindMany,
      count: mockState.invoiceCount,
      create: vi.fn(),
    },
    event: {
      findUnique: mockState.eventFindFirst,
      findFirst: mockState.eventFindFirst,
      findMany: mockState.eventFindMany,
      count: mockState.eventCount,
      create: mockState.eventCreate,
    },
  })),
}));

import { createToken } from '@/infrastructure/auth';
import authPlugin from '@/infrastructure/plugins/auth.plugin';
import { reminderRoutes } from '@/routes/reminder.routes';
import { tenantRoutes } from '@/routes/tenant.routes';

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';
const INVOICE_B = '00000000-0000-0000-0000-0000000000bb';
const EVENT_B = '00000000-0000-0000-0000-0000000000cc';
const TEST_SECRET = 'test-secret-isolation';

process.env.JWT_SECRET = TEST_SECRET;
process.env.MASTER_API_KEY = 'test-master-api-key';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function tokenFor(tenantId: string, role: 'owner' | 'user' = 'owner'): string {
  return createToken({ tenantId, userId: 'u1', role }, TEST_SECRET);
}

const mockTenantA = {
  id: TENANT_A,
  name: 'Tenant A',
  slug: 'tenant-a',
  email: 'a@example.com',
  phone: '5511999998888',
  document: '11222333000181',
  config: {},
  paymentProvider: 'asaas',
  paymentProviderConfig: {},
  decisionConfig: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('a1/E3 — Tenant routes act only on the authenticated tenant', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(tenantRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.tenantFindUnique.mockResolvedValue(null);
  });

  it('returns 403 when tenant A PATCHes tenant B config', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tenants/${TENANT_B}/config`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
      payload: { some: 'value' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when tenant A GETs tenant B payment-provider config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/tenants/${TENANT_B}/payment-provider`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when tenant A GETs tenant B decision-config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/tenants/${TENANT_B}/decision-config`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('does not expose an unscoped tenant list (GET /api/tenants removed)', async () => {
    mockState.tenantFindMany.mockResolvedValue([mockTenantA]);
    mockState.tenantCount.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/api/tenants',
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 for a non-owner role trying to PATCH own tenant config (E3)', async () => {
    mockState.tenantFindUnique.mockResolvedValue(mockTenantA);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tenants/${TENANT_A}/config`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A, 'user')}` },
      payload: { some: 'value' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows owner to GET own payment-provider config (regression)', async () => {
    mockState.tenantFindUnique.mockResolvedValue(mockTenantA);
    const res = await app.inject({
      method: 'GET',
      url: `/api/tenants/${TENANT_A}/payment-provider`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('allows owner to PATCH own config (regression)', async () => {
    mockState.tenantFindUnique.mockResolvedValue(mockTenantA);
    mockState.tenantUpdate.mockResolvedValue(mockTenantA);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tenants/${TENANT_A}/config`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
      payload: { some: 'value' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('a2/a3 — Message tracking and reminders are tenant-scoped', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(reminderRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate real DB filtering: a row only matches when its tenantId equals
    // the tenantId present in the where clause.
    mockState.eventFindFirst.mockImplementation((args: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      if (where.tenantId && where.tenantId !== TENANT_B) return null;
      return { id: EVENT_B, tenantId: TENANT_B, clientId: 'client-b', eventType: 'MESSAGE_SENT' };
    });
    mockState.invoiceFindFirst.mockImplementation((args: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      if (where.tenantId && where.tenantId !== TENANT_B) return null;
      return { id: INVOICE_B, tenantId: TENANT_B, client: { id: 'client-b', name: 'B', phone: '5511999998888' } };
    });
  });

  it('returns 404 when tenant A requests tracking for tenant B event (a2)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/messages/${EVENT_B}/tracking`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 for tracking of own tenant event (regression)', async () => {
    mockState.eventFindMany.mockResolvedValue([]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/messages/${EVENT_B}/tracking`,
      headers: { authorization: `Bearer ${tokenFor(TENANT_B)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 when tenant A schedules a reminder for tenant B invoice (a3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/schedule',
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
      payload: { invoiceId: INVOICE_B },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when tenant A sends a reminder now for tenant B invoice (a3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/send-now',
      headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
      payload: { invoiceId: INVOICE_B },
    });
    expect(res.statusCode).toBe(404);
  });

  it('allows tenant B to schedule a reminder for own invoice (regression)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/schedule',
      headers: { authorization: `Bearer ${tokenFor(TENANT_B)}` },
      payload: { invoiceId: INVOICE_B },
    });
    expect(res.statusCode).toBe(200);
  });
});
