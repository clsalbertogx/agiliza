import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { type AuthPayload, validateApiKey, verifyToken } from '@/infrastructure/auth';

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
    // /docs (Swagger UI) is public in dev/test — the plugin is only
    // registered there (see src/index.ts). In production it does not exist.
    // Public routes: POST /api/tenants (public signup) is public by exact
    // method+path; everything else matches by prefix. All other methods
    // (including GET /api/tenants, which no longer exists as a route) stay
    // protected.
    const publicPaths = ['/api/health', '/api/ready', '/api/webhooks/', '/metrics', '/docs'];
    const isPublicPostTenants = request.method === 'POST' && request.url === '/api/tenants';
    if (isPublicPostTenants || publicPaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Missing authorization header' });
      return;
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // JWT_SECRET must come from the environment (validated in config/env.ts).
      // No hardcoded fallback: a misconfigured deployment must fail closed.
      const secret = process.env.JWT_SECRET ?? '';
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
      // E1: an ApiKey must actually match the configured master key — accepting
      // any non-empty string would let anyone impersonate the null tenant.
      const masterApiKey = process.env.MASTER_API_KEY ?? '';
      if (!apiKey || !validateApiKey(apiKey, masterApiKey)) {
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
