import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken } from '../auth';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
  }
}

async function authPlugin(app: FastifyInstance) {
  // Decorate request with tenantId and userId
  app.decorateRequest('tenantId', '');
  app.decorateRequest('userId', '');

  // Global preHandler: authenticate all routes except health and webhooks
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public routes
    const publicPaths = ['/health', '/api/webhooks/'];
    if (publicPaths.some(path => request.url.startsWith(path))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Missing authorization header' });
      return;
    }

    // Support both Bearer JWT and ApiKey
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
    } else if (authHeader.startsWith('ApiKey ')) {
      const apiKey = authHeader.slice(7);
      // In MVP, validate against first tenant's key from env
      const validKey = process.env.MASTER_API_KEY || 'agiliza-dev-api-key';
      if (apiKey !== validKey) {
        reply.code(401).send({ error: 'Invalid API key' });
        return;
      }
      request.tenantId = '00000000-0000-0000-0000-000000000000'; // Will be resolved from DB
    } else {
      reply.code(401).send({ error: 'Invalid authorization format. Use Bearer or ApiKey' });
    }
  });
}

export default fp(authPlugin);
