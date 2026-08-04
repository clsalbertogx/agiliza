import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { decisionRoutes } from '@/routes/decision.routes';

/**
 * Mock the factory module so the route contract tests never touch a real
 * database. The route builds its use case via `createGetNextDecisionUseCase()`
 * from `@/presentation/factories`, which normally wires real Prisma
 * repositories — not available (and not wanted) in a unit test.
 *
 * The real-DB behavior is covered by the use case tests and the E2E suite.
 */
const mockExecute = vi.hoisted(() => vi.fn());

vi.mock('@/presentation/factories', () => ({
  createGetNextDecisionUseCase: vi.fn(() => ({
    execute: mockExecute,
  })),
}));

const VALID_TOKEN = 'test-valid-token';

describe('Decision Engine API Routes', () => {
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
      (request as any).tenantId = 'test-tenant-id';
    });

    await app.register(decisionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockExecute.mockReset();
  });

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('GET /api/decisions/next-action — Next Best Action', () => {
    it('should return next action with channel, template, and sendAt', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        value: {
          action: 'send_reminder',
          channel: 'WHATSAPP',
          templateName: 'friendly_reminder_d3',
          scheduledAt: '2026-08-20T09:00:00.000Z',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/decisions/next-action',
        headers: { authorization: validToken },
        query: {
          clientId: '00000000-0000-0000-0000-000000000001',
          invoiceId: '00000000-0000-0000-0000-000000000002',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.action).toBe('send_reminder');
      expect(body.data.channel).toBe('WHATSAPP');
      expect(body.data.templateName).toBe('friendly_reminder_d3');
      expect(body.data.scheduledAt).toBe('2026-08-20T09:00:00.000Z');

      // The route must forward tenantId from the request context
      expect(mockExecute).toHaveBeenCalledWith({
        clientId: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: 'test-tenant-id',
      });
    });

    it('should return 400 when clientId is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/decisions/next-action',
        headers: { authorization: validToken },
        query: { invoiceId: 'some-invoice' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'clientId and invoiceId are required' });
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
