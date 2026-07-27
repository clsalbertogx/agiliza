import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

import { decisionRoutes } from '../../routes/decision.routes';

const VALID_TOKEN = 'test-valid-token';

describe('Decision Engine API Routes', () => {
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
      (request as any).tenantId = 'test-tenant-id';
    });
    
    await app.register(decisionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const validToken = `Bearer ${VALID_TOKEN}`;

  describe('GET /api/decisions/next-action — Next Best Action', () => {
    it('should return next action with channel, template, and sendAt', async () => {
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
      expect(body.data.templateName).toBeDefined();
      expect(body.data.scheduledAt).toBeDefined();
    });

    it('should handle request without clientId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/decisions/next-action',
        headers: { authorization: validToken },
        query: { invoiceId: 'some-invoice' },
      });
      // The route handler doesn't validate missing params
      expect(res.statusCode).toBe(200);
    });
  });
});
