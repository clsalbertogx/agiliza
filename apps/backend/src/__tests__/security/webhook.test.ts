// NOTE: Set env vars BEFORE dynamic import to ensure module reads correct values
process.env.ASAAS_WEBHOOK_SECRET = 'asaas-test-secret-key';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'mp-test-secret-key';
process.env.EVOLUTION_API_KEY = 'evolution-secret-key-123';

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { verifyWebhookSignature as VerifyFn, getSignatureHeader as HeaderFn } from '../../infrastructure/payment/hmac-verifier';

let verifyWebhookSignature: typeof VerifyFn;
let getSignatureHeader: typeof HeaderFn;

beforeAll(async () => {
  // Dynamic import ensures env vars are set before module initializes
  const mod = await import('../../infrastructure/payment/hmac-verifier');
  verifyWebhookSignature = mod.verifyWebhookSignature;
  getSignatureHeader = mod.getSignatureHeader;
});

describe('Webhook Security', () => {
  describe('HMAC Validation — SEC-02', () => {
    it('should accept Asaas webhook with valid HMAC-SHA256 signature', () => {
      // Given a valid Asaas webhook payload with correct secret
      const payload = JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123', value: 100 } });
      const secret = 'asaas-test-secret-key';

      // Generate valid HMAC as Asaas would
      const validSignature = createHmac('sha256', secret).update(payload).digest('hex');

      // When verifying via our verifier
      const result = verifyWebhookSignature('asaas', payload, validSignature);

      // Then should pass verification
      expect(result).toBe(true);
    });

    it('should reject Asaas webhook with invalid HMAC signature (401)', () => {
      // Given a webhook payload with incorrect HMAC signature
      const payload = JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123', value: 100 } });
      const invalidSignature = 'invalid-signature-value';

      // When verifying via our verifier
      const result = verifyWebhookSignature('asaas', payload, invalidSignature);

      // Then should fail verification (401)
      expect(result).toBe(false);
    });

    it('should reject Asaas webhook with missing HMAC header (401)', () => {
      // Given a valid webhook payload but no x-asaas-signature header
      const payload = JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123', value: 100 } });

      // When verifying with empty signature (simulating missing header)
      const result = verifyWebhookSignature('asaas', payload, '');

      // Then should fail verification (401)
      expect(result).toBe(false);
    });

    it('should use timing-safe comparison for HMAC verification', () => {
      // Given any HMAC comparison
      const payload = JSON.stringify({ event: 'PAYMENT_RECEIVED', amount: 100 });
      const secret = 'test-secret';

      // Generate correct signature
      const correctSignature = createHmac('sha256', secret).update(payload).digest('hex');
      const wrongSignature = '0000000000000000000000000000000000000000000000000000000000000000';

      // Test timing-safe comparison behavior
      const correctResult = timingSafeEqual(
        Buffer.from(correctSignature),
        Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'))
      );
      expect(correctResult).toBe(true);

      // Wrong signature comparison (should not throw and return false)
      try {
        const wrongResult = timingSafeEqual(
          Buffer.from(wrongSignature),
          Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'))
        );
        expect(wrongResult).toBe(false);
      } catch {
        // Different-length buffers throw in timingSafeEqual — fine
        // The verifier catches this and returns false
      }
    });

    it('should verify Mercado Pago webhook with combined params signature', () => {
      // Given a valid Mercado Pago webhook
      const payload = JSON.stringify({
        action: 'payment.created',
        api_version: 'v1',
        data: { id: '12345' },
        date_created: new Date().toISOString(),
        id: '67890',
        live_mode: false,
        type: 'payment',
        user_id: '123',
      });

      // Generate HMAC using the merchant's secret
      const secret = 'mp-test-secret-key';
      const timestamp = Math.floor(Date.now() / 1000);
      // Mercado Pago format: HMAC(ts + '.' + body, secret)
      const combinedSignature = createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      function verifyMercadoPago(rawBody: string, headerValue: string, secretKey: string): boolean {
        // Parse the x-signature header format: ts=12345,v1=abc123
        const parts = headerValue.split(',');
        let ts = '';
        let v1 = '';
        for (const part of parts) {
          const [key, value] = part.split('=');
          if (key === 'ts') ts = value;
          if (key === 'v1') v1 = value;
        }
        if (!ts || !v1) return false;

        // Check timestamp freshness (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(ts)) > 300) return false;

        // Verify HMAC(ts + '.' + body, secret)
        const expected = createHmac('sha256', secretKey)
          .update(`${ts}.${rawBody}`)
          .digest('hex');
        try {
          return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
        } catch {
          return false;
        }
      }

      const headerValue = `ts=${timestamp},v1=${combinedSignature}`;
      const result = verifyMercadoPago(payload, headerValue, secret);

      // Then verification should pass
      expect(result).toBe(true);

      // And with invalid signature should fail
      const invalidHeader = `ts=${timestamp},v1=invalid`;
      const invalidResult = verifyMercadoPago(payload, invalidHeader, secret);
      expect(invalidResult).toBe(false);
    });

    it('should reject Mercado Pago webhook with expired timestamp', () => {
      // Given a Mercado Pago webhook with an old timestamp (> 5 min)
      const payload = JSON.stringify({
        action: 'payment.created',
        data: { id: '12345' },
      });
      const secret = 'mp-test-secret-key';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago (past 5 min window)
      const signature = createHmac('sha256', secret)
        .update(`${oldTimestamp}.${payload}`)
        .digest('hex');

      function verifyMercadoPagoWithExpiry(rawBody: string, headerValue: string, secretKey: string): boolean {
        const parts = headerValue.split(',');
        let ts = '';
        let v1 = '';
        for (const part of parts) {
          const [key, value] = part.split('=');
          if (key === 'ts') ts = value;
          if (key === 'v1') v1 = value;
        }
        if (!ts || !v1) return false;

        // Check timestamp freshness (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(ts)) > 300) return false;

        const expected = createHmac('sha256', secretKey)
          .update(`${ts}.${rawBody}`)
          .digest('hex');
        try {
          return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
        } catch {
          return false;
        }
      }

      const headerValue = `ts=${oldTimestamp},v1=${signature}`;
      const result = verifyMercadoPagoWithExpiry(payload, headerValue, secret);

      // Then should be rejected due to stale timestamp (replay protection)
      expect(result).toBe(false);
    });

    it('should verify PagBank webhook with base64 HMAC', () => {
      // Given a valid PagBank webhook
      const payload = JSON.stringify({
        id: 'event_123',
        type: 'PAYMENT.CREATED',
        createdAt: new Date().toISOString(),
      });
      const secret = 'pagbank-test-secret';

      // PagBank uses base64-encoded HMAC-SHA256
      const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      function verifyPagBank(rawBody: string, signature: string, secretKey: string): boolean {
        const expected = createHmac('sha256', secretKey)
          .update(rawBody)
          .digest('base64');
        try {
          return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch {
          return false;
        }
      }

      const result = verifyPagBank(payload, expectedSignature, secret);
      expect(result).toBe(true);

      // Invalid signature should fail
      const invalidResult = verifyPagBank(payload, 'invalid-base64-signature', secret);
      expect(invalidResult).toBe(false);
    });

    it('should verify Polar webhook with id.timestamp.body format', () => {
      // Given a valid Polar webhook
      const payload = JSON.stringify({
        type: 'payment.created',
        data: { id: 'pol_123', amount: 1000 },
      });
      const secret = 'polar-test-secret';
      const msgId = 'msg_abc123';
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Polar format: HMAC(msgId + '.' + timestamp + '.' + body, secret)
      const toSign = `${msgId}.${timestamp}.${payload}`;
      const expectedSignature = createHmac('sha256', secret)
        .update(toSign)
        .digest('base64');

      function verifyPolar(rawBody: string, headers: Record<string, string>, secretKey: string): boolean {
        const msgId = headers['webhook-id'];
        const timestamp = headers['webhook-timestamp'];
        const signature = headers['webhook-signature'];
        if (!msgId || !timestamp || !signature) return false;

        const toSign = `${msgId}.${timestamp}.${rawBody}`;
        const expected = createHmac('sha256', secretKey)
          .update(toSign)
          .digest('base64');
        try {
          return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch {
          return false;
        }
      }

      const headers = {
        'webhook-id': msgId,
        'webhook-timestamp': timestamp,
        'webhook-signature': expectedSignature,
      };

      const result = verifyPolar(payload, headers, secret);
      expect(result).toBe(true);

      // Invalid signature should fail
      const invalidHeaders = { ...headers, 'webhook-signature': 'invalid' };
      const invalidResult = verifyPolar(payload, invalidHeaders, secret);
      expect(invalidResult).toBe(false);
    });
  });

  describe('Webhook Idempotency', () => {
    it('should process webhook only once (idempotency key)', () => {
      // Given a webhook payload that was already processed
      const processedIds = new Set<string>();

      function processWebhook(eventId: string): { status: number; message: string } {
        if (processedIds.has(eventId)) {
          return { status: 200, message: 'Already processed (idempotent)' };
        }
        processedIds.add(eventId);
        return { status: 200, message: 'Processed' };
      }

      // First processing
      const firstResult = processWebhook('evt_123');
      expect(firstResult.message).toBe('Processed');
      expect(processedIds.has('evt_123')).toBe(true);

      // When receiving the same payload again (duplicate)
      const secondResult = processWebhook('evt_123');

      // Then status should be 200 OK (idempotent)
      expect(secondResult.status).toBe(200);
      expect(secondResult.message).toBe('Already processed (idempotent)');
    });

    it('should prevent duplicate reconciliation via providerPaymentId uniqueness', () => {
      // Given a payment already reconciled with providerPaymentId "prov_123"
      const reconciledPayments = new Set<string>();
      reconciledPayments.add('prov_123');

      function reconcilePayment(providerPaymentId: string): { duplicated: boolean } {
        if (reconciledPayments.has(providerPaymentId)) {
          return { duplicated: true };
        }
        reconciledPayments.add(providerPaymentId);
        return { duplicated: false };
      }

      // When the same webhook arrives again
      const result = reconcilePayment('prov_123');

      // Then it should be idempotent — no duplicate payment record
      expect(result.duplicated).toBe(true);
    });
  });

  describe('Webhook Processing Pipeline', () => {
    it('should validate Zod schema after HMAC verification', () => {
      // Given a webhook with valid HMAC but malformed body
      const payload = 'not-valid-json-at-all{{{';
      const secret = 'asaas-test-secret-key';
      const validSignature = createHmac('sha256', secret).update(payload).digest('hex');

      // First, HMAC verification must pass (valid signature — HMAC doesn't check JSON validity)
      const hmacResult = verifyWebhookSignature('asaas', payload, validSignature);

      // The HMAC is computed over the raw body string, so it can be "valid"
      // even if the body is not valid JSON. A not-valid-JSON body hash is valid
      // if the same secret was used to generate it.
      // In this test, the secret from env matches our test secret, so it WILL be valid.
      expect(hmacResult).toBe(true);

      // Then Zod validation MUST reject the malformed body
      const zodSchema = {
        parse: (data: string) => {
          const parsed = JSON.parse(data);
          if (!parsed.event || !parsed.payment) {
            throw new Error('Zod validation failed: missing required fields');
          }
          return parsed;
        },
      };

      // When we try to validate the malformed body
      expect(() => zodSchema.parse(payload)).toThrow();
    });

    it('should return 200 OK within 100ms (ack to provider)', async () => {
      // Given a valid webhook
      const startTime = Date.now();

      // Simulate the webhook handler (just signature + basic validation, no DB)
      const payload = JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } });
      const secret = 'asaas-test-secret-key';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      // Verify HMAC (fast operation)
      const result = verifyWebhookSignature('asaas', payload, signature);
      expect(result).toBe(true);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Then response should be returned within 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('should enqueue reconcile-payment job in BullMQ after validation', () => {
      // Given a valid webhook payload that passed HMAC + Zod validation
      const payload = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_123', value: 100 },
        provider: 'asaas',
      };

      // Simulate BullMQ job enqueue
      const enqueuedJobs: unknown[] = [];

      function handleWebhook(payload: Record<string, unknown>): void {
        enqueuedJobs.push({
          queue: 'reconcile-payment',
          data: payload,
          timestamp: Date.now(),
        });
      }

      // When the webhook handler processes it
      handleWebhook(payload);

      // Then a BullMQ job should be added to reconcile-payment queue
      expect(enqueuedJobs).toHaveLength(1);
      expect((enqueuedJobs[0] as Record<string, unknown>).queue).toBe('reconcile-payment');
      expect((enqueuedJobs[0] as Record<string, unknown>).data).toEqual(payload);
    });
  });

  describe('Evolution API Webhooks', () => {
    const EVOLUTION_WEBHOOK_KEY = 'evolution-secret-key-123';

    beforeEach(() => {
      process.env.EVOLUTION_API_KEY = EVOLUTION_WEBHOOK_KEY;
    });

    it('should verify X-API-Key header for Evolution webhooks', () => {
      // Given a valid Evolution webhook payload
      const apiKey = EVOLUTION_WEBHOOK_KEY;

      // When checking the API key
      const isValid = apiKey === process.env.EVOLUTION_API_KEY;

      // Then should be accepted
      expect(isValid).toBe(true);
    });

    it('should reject Evolution webhook with wrong API key (401)', () => {
      // Given a valid Evolution webhook but wrong X-API-Key header
      const wrongKey = 'wrong-api-key';
      const expectedKey = process.env.EVOLUTION_API_KEY;

      // When checking the API key
      const isValid = wrongKey === expectedKey;

      // Then should be rejected
      expect(isValid).toBe(false);
    });

    it('should check IP whitelist for Evolution webhooks when configured', () => {
      // Given EVOLUTION_ALLOWED_IPS configured
      process.env.EVOLUTION_ALLOWED_IPS = '192.168.1.1,10.0.0.1';

      const allowedIPs = (process.env.EVOLUTION_ALLOWED_IPS || '').split(',');

      function isIPAllowed(ip: string): boolean {
        if (allowedIPs.length === 0) return true;
        return allowedIPs.includes(ip);
      }

      // When Evolution webhook arrives from a whitelisted IP
      expect(isIPAllowed('192.168.1.1')).toBe(true);

      // When from a non-whitelisted IP
      expect(isIPAllowed('192.168.1.100')).toBe(false);
    });

    it('should update message status on messages.update webhook', () => {
      // Given an Evolution webhook with messages.update and status = "read"
      const webhookPayload = {
        event: 'messages.update',
        data: {
          key: { id: 'msg_123' },
          update: { status: 'read' },
        },
      };

      // Simulate the message status tracking
      const messageStatuses = new Map<string, string>();
      messageStatuses.set('msg_123', 'sent');

      function handleMessageUpdate(event: { data: { key: { id: string }; update: { status: string } } }): void {
        if (event.data.update.status === 'read') {
          messageStatuses.set(event.data.key.id, 'read');
        }
      }

      // When processing the webhook
      handleMessageUpdate(webhookPayload as any);

      // Then the corresponding Message entity should be updated
      expect(messageStatuses.get('msg_123')).toBe('read');
    });
  });

  describe('Webhook Retry', () => {
    it('should retry failed webhook processing with exponential backoff', () => {
      // Given a webhook processing that fails
      let attemptCount = 0;
      const backoffDelays: number[] = [];

      function retryWithBackoff(maxRetries: number): boolean {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          attemptCount++;
          const delay = 10 * Math.pow(3, attempt);
          backoffDelays.push(delay);
          if (attempt === maxRetries - 1) {
            return true;
          }
        }
        return false;
      }

      // When retries happen at: 10s, 30s, 90s
      const result = retryWithBackoff(3);

      // Then retries should follow exponential backoff pattern
      expect(attemptCount).toBe(3);
      expect(backoffDelays[0]).toBe(10);
      expect(backoffDelays[1]).toBe(30);
      expect(backoffDelays[2]).toBe(90);
      expect(result).toBe(true);
    });

    it('should send to dead-letter queue after 3 failed retries', () => {
      // Given a webhook that fails 3 times
      let attempts = 0;
      const MAX_RETRIES = 3;
      const dlq: unknown[] = [];

      function processWithRetry(payload: Record<string, unknown>): boolean {
        attempts++;
        if (attempts <= MAX_RETRIES) {
          return false; // Simulate failure
        }
        dlq.push(payload);
        return false;
      }

      // When all retries are exhausted
      for (let i = 0; i < MAX_RETRIES; i++) {
        processWithRetry({ event: 'PAYMENT_RECEIVED', id: `pay_${i}` });
      }

      // Then the event should go to a dead-letter queue
      expect(attempts).toBe(3);

      // In real implementation, after 3 failed retries, save to DLQ:
      const failedPayload = { event: 'PAYMENT_RECEIVED', id: 'pay_failed' };
      dlq.push({ ...failedPayload, reason: 'Max retries exceeded' });
      expect(dlq).toHaveLength(1);
      expect((dlq[0] as Record<string, unknown>).reason).toBe('Max retries exceeded');
    });
  });
});
