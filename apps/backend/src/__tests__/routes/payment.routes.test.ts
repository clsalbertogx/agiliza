import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerify = vi.hoisted(() => vi.fn());

vi.mock('@/infrastructure/payment/per-tenant-hmac-verifier', () => ({
  PerTenantHmacVerifier: vi.fn().mockImplementation(() => ({
    verify: (...args: any[]) => mockVerify(...args),
  })),
}));

import { webhookRoutes } from '@/routes/webhook.routes';

describe('Payment API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(webhookRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/webhooks/payment/:provider — Payment Webhooks', () => {
    it('should process Asaas payment webhook and return 200', async () => {
      mockVerify.mockResolvedValue({ success: true, value: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        headers: { 'asaas-signature': 'valid-signature' },
        payload: {
          tenantId: TENANT_ID,
          event: 'PAYMENT_CONFIRMED',
          payment: { id: 'pay_123', value: 150.0 },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);
    });

    it('should process Mercado Pago webhook with signature verification', async () => {
      mockVerify.mockResolvedValue({ success: true, value: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/mercadopago',
        headers: { 'x-signature': 'valid-signature' },
        payload: {
          tenantId: TENANT_ID,
          action: 'payment.created',
          data: { id: 'pay_456' },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);
    });

    it('should process PagBank webhook', async () => {
      mockVerify.mockResolvedValue({ success: true, value: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/pagbank',
        headers: { 'x-pagbank-signature': 'valid-signature' },
        payload: {
          tenantId: TENANT_ID,
          id: 'pay_789',
          status: 'PAID',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);
    });

    it('should process Polar webhook', async () => {
      mockVerify.mockResolvedValue({ success: true, value: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/polar',
        headers: { 'webhook-signature': 'valid-signature' },
        payload: {
          tenantId: TENANT_ID,
          type: 'payment.succeeded',
          data: { id: 'pay_012' },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);
    });

    it('should return 400 for missing tenantId in payload', async () => {
      mockVerify.mockResolvedValue({ success: true, value: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        headers: { 'asaas-signature': 'some-signature' },
        payload: {
          event: 'PAYMENT_CONFIRMED',
          // no tenantId
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('tenantId');
    });

    it('should return 401 for missing signature', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        headers: {},
        payload: { tenantId: TENANT_ID, event: 'PAYMENT_CONFIRMED' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 for invalid signature', async () => {
      mockVerify.mockResolvedValue({ success: true, value: false });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        headers: { 'asaas-signature': 'invalid-signature' },
        payload: { tenantId: TENANT_ID, event: 'PAYMENT_CONFIRMED' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for unknown payment provider', async () => {
      // The route now validates provider against a known map before calling the verifier
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/unknown',
        headers: { 'x-webhook-signature': 'some-signature' },
        payload: { tenantId: TENANT_ID, event: 'test' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Unknown');
    });
  });
});
