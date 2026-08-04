import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApplicationError } from '@/application/errors/application.error';
import { errorHandler } from '@/presentation/handler';

describe('Global Error Handler — SEC-04 / Issue #22', () => {
  describe('Zod validation errors', () => {
    let app: ReturnType<typeof Fastify>;
    const emailSchema = z.string().email();
    const ageSchema = z.number().min(18);

    beforeAll(async () => {
      app = Fastify();
      app.setErrorHandler(errorHandler);

      // Route that validates using Zod and throws ZodError on failure
      app.post('/api/test/zod', async (req: FastifyRequest, reply: FastifyReply) => {
        const body = req.body as Record<string, unknown>;

        const emailResult = emailSchema.safeParse(body.email);
        const ageResult = ageSchema.safeParse(body.age);

        if (!emailResult.success || !ageResult.success) {
          const issues = [
            ...(emailResult.success ? [] : emailResult.error.issues),
            ...(ageResult.success ? [] : ageResult.error.issues),
          ];
          throw new z.ZodError(issues);
        }

        return reply.status(200).send({ ok: true });
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 400 with VALIDATION_ERROR code for invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/zod',
        payload: { email: 'not-an-email', age: 15 },
      });

      expect(res.statusCode).toBe(400);

      const body = res.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Input validation failed');
    });

    it('should include field-level error details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/zod',
        payload: { email: 'bad', age: 'not-a-number' },
      });

      const body = res.json();
      expect(body.error.details).toBeInstanceOf(Array);
      expect(body.error.details.length).toBeGreaterThan(0);

      for (const detail of body.error.details) {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
      }
    });
  });

  describe('ApplicationError handling', () => {
    let app: ReturnType<typeof Fastify>;

    beforeAll(async () => {
      app = Fastify();
      app.setErrorHandler(errorHandler);

      app.get('/api/test/not-found', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw ApplicationError.notFound('User', 'user-123');
      });

      app.get('/api/test/conflict', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw ApplicationError.conflict('Email already in use');
      });

      app.get('/api/test/unauthorized', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw ApplicationError.unauthorized();
      });

      app.get('/api/test/forbidden', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw ApplicationError.forbidden();
      });

      app.get('/api/test/validation', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw ApplicationError.validation('Invalid field value');
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 404 for NOT_FOUND ApplicationError', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/not-found' });

      expect(res.statusCode).toBe(404);

      const body = res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('User');
      expect(body.error.message).toContain('not found');
    });

    it('should return 409 for CONFLICT ApplicationError', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/conflict' });

      expect(res.statusCode).toBe(409);

      const body = res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('Email already in use');
    });

    it('should return 401 for UNAUTHORIZED ApplicationError', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/unauthorized' });

      expect(res.statusCode).toBe(401);

      const body = res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for FORBIDDEN ApplicationError', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/forbidden' });

      expect(res.statusCode).toBe(403);

      const body = res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should return 400 for VALIDATION ApplicationError', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/validation' });

      expect(res.statusCode).toBe(400);

      const body = res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Unknown errors', () => {
    let app: ReturnType<typeof Fastify>;

    beforeAll(async () => {
      app = Fastify();
      app.setErrorHandler(errorHandler);

      app.get('/api/test/unknown-error', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw new Error('Something went terribly wrong');
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 500 for unknown errors', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/unknown-error' });

      expect(res.statusCode).toBe(500);

      const body = res.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should not leak stack trace in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodApp = Fastify();
      prodApp.setErrorHandler(errorHandler);

      prodApp.get('/api/test/prod-error', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw new Error('Secret internal detail');
      });

      await prodApp.ready();

      const res = await prodApp.inject({ method: 'GET', url: '/api/test/prod-error' });

      expect(res.statusCode).toBe(500);

      const body = res.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.message).not.toContain('Secret internal detail');

      await prodApp.close();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should include error message in non-production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devApp = Fastify();
      devApp.setErrorHandler(errorHandler);

      devApp.get('/api/test/dev-error', async (_req: FastifyRequest, _reply: FastifyReply) => {
        throw new Error('Debug info for developers');
      });

      await devApp.ready();

      const res = await devApp.inject({ method: 'GET', url: '/api/test/dev-error' });

      expect(res.statusCode).toBe(500);

      const body = res.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Debug info for developers');

      await devApp.close();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Fastify built-in errors', () => {
    let app: ReturnType<typeof Fastify>;

    beforeAll(async () => {
      app = Fastify();
      app.setErrorHandler(errorHandler);

      // Route that throws an error with statusCode (simulating Fastify built-in errors)
      app.get('/api/test/rate-limited', async (_req: FastifyRequest, _reply: FastifyReply) => {
        const err = new Error('Rate limit exceeded') as any;
        err.statusCode = 429;
        err.code = 'FST_ERR_RATE_LIMIT';
        throw err;
      });

      app.get('/api/test/ok', async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ ok: true });
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should handle errors with statusCode property', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/rate-limited' });

      expect(res.statusCode).toBe(429);

      const body = res.json();
      expect(body.error.code).toBe('FST_ERR_RATE_LIMIT');
      expect(body.error.message).toContain('Rate limit exceeded');
    });

    it('should return 404 for non-existent routes via Fastify default handler', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/non-existent-route' });

      // Fastify default 404 — setErrorHandler does NOT catch route-not-found
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.message).toContain('not found');
    });
  });
});
