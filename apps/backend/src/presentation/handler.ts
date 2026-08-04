import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApplicationError } from '@/application/errors/application.error';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  // 1. Zod validation errors → 400
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 2. ApplicationError (from use cases) → use its statusCode
  if (error instanceof ApplicationError) {
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  // 3. Fastify built-in errors (rate-limit, 404, etc.)
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode) {
    reply.status(fastifyError.statusCode).send({
      error: {
        code: fastifyError.code || 'FASTIFY_ERROR',
        message: fastifyError.message,
      },
    });
    return;
  }

  // 4. Unknown errors → 500 (never leak stack traces in production)
  console.error('[Unhandled Error]', error);
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    },
  });
}
