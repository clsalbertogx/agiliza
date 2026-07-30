import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, AuthPayload } from '@/infrastructure/auth';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    authPayload?: AuthPayload;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('tenantId', undefined);
  app.decorateRequest('userId', undefined);
  app.decorateRequest('authPayload', undefined);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const publicPaths = ['/health', '/api/webhooks/'];
    if (publicPaths.some(path => request.url.startsWith(path))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Missing authorization header' });
      return;
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const secret = process.env.JWT_SECRET || 'agiliza-dev-secret';
      const payload = verifyToken(token, secret);
      if (!payload) {
        reply.code(401).send({ error: 'Invalid or expired token' });
        return;
      }
      request.tenantId = payload.tenantId;
      request.userId = payload.userId;
      request.authPayload = payload;
    } else if (authHeader.startsWith('ApiKey ')) {
      const apiKey = authHeader.slice(7);
      if (!apiKey) {
        reply.code(401).send({ error: 'Invalid API key' });
        return;
      }
      request.tenantId = '00000000-0000-0000-0000-000000000000';
    } else {
      reply.code(401).send({ error: 'Invalid authorization format. Use Bearer or ApiKey' });
    }
  });
}

export default fp(authPlugin);
