import type { FastifyInstance } from 'fastify';
import { isFailure } from '@/application/types/either';
import { createProcessPaymentWebhookUseCase } from '@/presentation/factories';

/**
 * Map of provider → expected signature header name (lowercase).
 * SEC-02, A03: Provider is validated against this map before any DB lookup.
 */
const PROVIDER_SIGNATURE_HEADERS: Record<string, string> = {
  asaas: 'asaas-signature',
  mercadopago: 'x-signature',
  pagbank: 'x-pagbank-signature',
  polar: 'webhook-signature',
};

export async function webhookRoutes(app: FastifyInstance) {
  // Webhook endpoints — burst rate limit of 10 req/s per provider IP
  const webhookRateLimit = {
    max: 10,
    timeWindow: '1 second',
    keyGenerator: (req: { ip: string }) => req.ip,
  };

  // POST /api/webhooks/payment/:provider
  // Schema is intentionally minimal: no body schema (provider payloads are
  // arbitrary and must reach the handler intact) and provider is a plain
  // string so the route's own validation produces its stable error contract.
  app.post(
    '/api/webhooks/payment/:provider',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Process a payment provider webhook',
        description: 'Public endpoint. Verifies the provider signature and processes the event.',
        params: {
          type: 'object',
          required: ['provider'],
          properties: { provider: { type: 'string' } },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
      config: { rateLimit: webhookRateLimit },
    },
    async (request, reply) => {
      const { provider } = request.params as { provider: string };

      // Validate provider before using it (A03 — Injection prevention)
      const headerName = PROVIDER_SIGNATURE_HEADERS[provider];
      if (!headerName) {
        reply.code(400).send({ error: `Unknown payment provider: ${provider}` });
        return;
      }

      const signature = request.headers[headerName] as string;
      if (!signature) {
        reply.code(401).send({ error: 'Missing webhook signature' });
        return;
      }

      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

      // Extract tenantId from the webhook payload (SEC-02 per-tenant)
      let tenantId: string | undefined;
      try {
        const bodyObj = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

        // Try common fields where tenantId may appear
        tenantId = bodyObj?.tenantId ?? bodyObj?.account?.tenantId ?? bodyObj?.data?.tenantId;
      } catch {
        reply.code(400).send({ error: 'Invalid webhook payload — unable to parse body' });
        return;
      }

      if (!tenantId || typeof tenantId !== 'string') {
        reply.code(400).send({ error: 'Missing tenantId in webhook payload' });
        return;
      }

      // Process the webhook using the use case (handles signature verification internally)
      const useCase = createProcessPaymentWebhookUseCase();
      const result = await useCase.execute({
        provider,
        rawBody,
        signature,
        tenantId,
      });

      if (isFailure(result)) {
        reply.code(result.value.statusCode).send({ error: result.value.message });
        return;
      }

      reply.code(200).send(result.value);
    },
  );

  // POST /api/webhooks/evolution
  app.post(
    '/api/webhooks/evolution',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Receive a message provider (Evolution API) webhook',
      },
      config: { rateLimit: webhookRateLimit },
    },
    async (request, reply) => {
      // Validate API key
      const apiKey = request.headers['x-api-key'] as string;
      const expectedKey = process.env.EVOLUTION_API_KEY;

      if (expectedKey && apiKey !== expectedKey) {
        reply.code(401).send({ error: 'Invalid API key' });
        return;
      }

      reply.code(200).send({ received: true });
    },
  );
}
