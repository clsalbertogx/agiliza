import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotifyOutboundHandler } from '@/application/events/handlers/notify-outbound.handler';
import type { DomainEvent } from '@/domain/events/domain-events';

function makeEvent(eventType: string, overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-123',
    eventType: eventType as any,
    clientId: 'client-123',
    tenantId: 'tenant-123',
    invoiceId: 'invoice-123',
    timestamp: '2026-07-29T12:00:00.000Z',
    metadata: { amount: 150 },
    ...overrides,
  } as DomainEvent;
}

describe('NotifyOutboundHandler', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('event filtering', () => {
    const irrelevantEvents = ['payment.failed', 'message.read', 'message.clicked', 'invoice.created', 'message.sent'];

    irrelevantEvents.forEach((eventType) => {
      it(`should ignore ${eventType} events`, async () => {
        const handler = new NotifyOutboundHandler('https://example.com/webhook', 'sk-test-key');

        await handler.handle(makeEvent(eventType));

        expect(fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('config checks', () => {
    it('should not send if webhookUrl is not configured', async () => {
      const handler = new NotifyOutboundHandler(undefined, 'sk-test-key');

      await handler.handle(makeEvent('client.created'));

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not send if apiKey is not configured', async () => {
      const handler = new NotifyOutboundHandler('https://example.com/webhook', undefined);

      await handler.handle(makeEvent('client.created'));

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not send if both are not configured', async () => {
      const handler = new NotifyOutboundHandler(undefined, undefined);

      await handler.handle(makeEvent('client.created'));

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it.each(['client.created', 'payment.confirmed', 'invoice.overdue', 'decision.made'])(
      'should send webhook for %s events',
      async (eventType) => {
        (fetch as any).mockResolvedValue({ ok: true });
        const handler = new NotifyOutboundHandler('https://hooks.example.com/events', 'sk-secret-123');

        await handler.handle(makeEvent(eventType));

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('https://hooks.example.com/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-secret-123',
          },
          body: expect.any(String),
        });

        const body = JSON.parse((fetch as any).mock.calls[0][1].body);
        expect(body).toEqual({
          eventType,
          tenantId: 'tenant-123',
          clientId: 'client-123',
          invoiceId: 'invoice-123',
          metadata: { amount: 150 },
          timestamp: '2026-07-29T12:00:00.000Z',
        });
      },
    );
  });

  describe('error handling', () => {
    it('should throw fetch errors so the retry loop in handleWithRetry can catch them', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));
      const handler = new NotifyOutboundHandler('https://hooks.example.com/events', 'sk-secret-123');

      await expect(handler.handle(makeEvent('client.created'))).rejects.toThrow('Network error');
    });

    it('should throw HTTP error responses so the retry loop in handleWithRetry can catch them', async () => {
      (fetch as any).mockRejectedValue(new Error('HTTP 500'));
      const handler = new NotifyOutboundHandler('https://hooks.example.com/events', 'sk-secret-123');

      await expect(handler.handle(makeEvent('client.created'))).rejects.toThrow('HTTP 500');
    });
  });
});
