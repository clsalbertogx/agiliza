import { FastifyInstance } from 'fastify';
import { PerTenantHmacVerifier } from '../infrastructure/payment/per-tenant-hmac-verifier';
import { isFailure } from '../application/types/either';

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

const verifier = new PerTenantHmacVerifier();

export async function webhookRoutes(app: FastifyInstance) {
  // POST /api/webhooks/payment/:provider
  app.post('/api/webhooks/payment/:provider', async (request, reply) => {
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

    const rawBody = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body);

    // Extract tenantId from the webhook payload (SEC-02 per-tenant)
    let tenantId: string | undefined;
    try {
      const bodyObj = typeof request.body === 'string'
        ? JSON.parse(request.body)
        : request.body;

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

    const result = await verifier.verify(provider, rawBody, signature, tenantId);

    if (isFailure(result)) {
      // The verifier returned an ApplicationError (e.g., DB failure)
      reply.code(result.value.statusCode).send({ error: result.value.message });
      return;
    }

    if (!result.value) {
      reply.code(401).send({ error: 'Invalid webhook signature' });
      return;
    }

    // Process the webhook (MVP: log and acknowledge)
    console.log(`Webhook received from ${provider}: ${JSON.stringify(request.body)}`);

    reply.code(200).send({ received: true, provider });
  });

  // POST /api/webhooks/evolution
  app.post('/api/webhooks/evolution', async (request, reply) => {
    // Validate API key
    const apiKey = request.headers['x-api-key'] as string;
    const expectedKey = process.env.EVOLUTION_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      reply.code(401).send({ error: 'Invalid API key' });
      return;
    }

    reply.code(200).send({ received: true });
  });
}
