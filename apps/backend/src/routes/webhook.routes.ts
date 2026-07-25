import { FastifyInstance } from 'fastify';
import { verifyWebhookSignature, getSignatureHeader } from '../infrastructure/payment/hmac-verifier';

export async function webhookRoutes(app: FastifyInstance) {
  // POST /api/webhooks/payment/:provider
  app.post('/api/webhooks/payment/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const signatureHeader = getSignatureHeader(provider);
    const signature = request.headers[signatureHeader.toLowerCase()] as string;

    if (!signature) {
      reply.code(401).send({ error: 'Missing webhook signature' });
      return;
    }

    const payload = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body);

    const isValid = verifyWebhookSignature(provider, payload, signature);
    if (!isValid) {
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
