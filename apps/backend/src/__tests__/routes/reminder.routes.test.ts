import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

// Mock ReminderService to avoid EvolutionMessageProvider dependency
vi.mock('../../application/services/reminder.service', () => {
  const mockReminderService = {
    sendReminderNow: vi.fn().mockResolvedValue({ externalId: 'msg-123' }),
    processPendingReminders: vi.fn().mockResolvedValue({ processed: 5, decisions: [] }),
  };
  return { ReminderService: vi.fn(() => mockReminderService) };
});

const mockState = vi.hoisted(() => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    invoice: { findUnique: mockState.findById, findMany: mockState.findMany },
    event: { findUnique: mockState.findById, findMany: mockState.findMany, create: mockState.create, count: mockState.count },
  })),
}));

import { reminderRoutes } from '../../routes/reminder.routes';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TOKEN = 'test-valid-token';

describe('Reminder API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    app.decorateRequest('tenantId', undefined);
    app.decorateRequest('userId', undefined);
    app.decorateRequest('authPayload', undefined);
    
    app.addHook('preHandler', async (request, reply) => {
      if (!request.headers.authorization) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      (request as any).tenantId = TEST_TENANT_ID;
    });
    
    await app.register(reminderRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('POST /api/reminders/schedule — Schedule Reminder', () => {
    it('should schedule reminder', async () => {
      mockState.findById.mockResolvedValue({
        id: 'inv-123',
        client: { id: 'client-1', name: 'John', phone: '5511999998888' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/reminders/schedule',
        headers: { authorization: validToken },
        payload: {
          invoiceId: '00000000-0000-0000-0000-000000000010',
          tenantId: TEST_TENANT_ID,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent invoice', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/reminders/schedule',
        headers: { authorization: validToken },
        payload: {
          invoiceId: '00000000-0000-0000-0000-000000009999',
          tenantId: TEST_TENANT_ID,
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for missing invoiceId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/reminders/schedule',
        headers: { authorization: validToken },
        payload: { tenantId: TEST_TENANT_ID },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/messages — List Messages', () => {
    it('should list messages with pagination', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toBeDefined();
      expect(res.json().meta).toBeDefined();
    });

    it('should filter messages by status', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages',
        headers: { authorization: validToken },
        query: { tenantId: TEST_TENANT_ID, status: 'read' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should filter messages by clientId', async () => {
      mockState.findMany.mockResolvedValue([]);
      mockState.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages',
        headers: { authorization: validToken },
        query: {
          tenantId: TEST_TENANT_ID,
          clientId: '00000000-0000-0000-0000-000000000020',
        },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/messages/:id/tracking — Message Tracking', () => {
    it('should return message timeline', async () => {
      mockState.findById.mockResolvedValue({
        id: 'msg-123',
        tenantId: TEST_TENANT_ID,
        clientId: 'client-id',
        eventType: 'MESSAGE_SENT',
      });
      mockState.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/msg-123/tracking',
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.originalEvent).toBeDefined();
      expect(res.json().data.timeline).toBeDefined();
    });

    it('should return 404 for non-existent message', async () => {
      mockState.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/non-existent-id/tracking',
        headers: { authorization: validToken },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
