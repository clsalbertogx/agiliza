import { describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import { AutoPayHandler } from '@/application/events/handlers/auto-pay.handler';
import { logger } from '@/config/logger';
import type { DomainEvent } from '@/domain/events/domain-events';
import { failure, success } from '@/domain/types/either';

function makeSubscriptionInvoiceCreatedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-auto-123',
    eventType: 'subscription.invoice.created',
    clientId: 'client-123',
    tenantId: 'tenant-123',
    invoiceId: 'invoice-123',
    timestamp: new Date().toISOString(),
    metadata: {
      subscriptionId: 'sub-123',
      amount: 99.9,
      refMonth: '2026-08',
    },
    ...overrides,
  } as DomainEvent;
}

function makeOtherEvent(eventType: string = 'invoice.created'): DomainEvent {
  return {
    eventId: 'evt-other-456',
    eventType: eventType as any,
    clientId: 'client-123',
    tenantId: 'tenant-123',
    timestamp: new Date().toISOString(),
    metadata: {},
  } as DomainEvent;
}

function createMocks() {
  const processPayment = {
    execute: vi.fn(),
  };

  const renewSubscription = {
    execute: vi.fn(),
  };

  return { processPayment, renewSubscription };
}

describe('AutoPayHandler', () => {
  describe('event filtering', () => {
    const irrelevantEvents = [
      'payment.confirmed',
      'payment.failed',
      'invoice.created',
      'invoice.overdue',
      'client.created',
      'message.sent',
      'subscription.created',
      'subscription.cancelled',
    ];

    irrelevantEvents.forEach((eventType) => {
      it(`should ignore ${eventType} events`, async () => {
        const { processPayment, renewSubscription } = createMocks();
        const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

        await handler.handle(makeOtherEvent(eventType));

        expect(processPayment.execute).not.toHaveBeenCalled();
        expect(renewSubscription.execute).not.toHaveBeenCalled();
      });
    });

    it('should ignore subscription.invoice.created events without invoiceId', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      await handler.handle(makeSubscriptionInvoiceCreatedEvent({ invoiceId: undefined }));

      expect(processPayment.execute).not.toHaveBeenCalled();
      expect(renewSubscription.execute).not.toHaveBeenCalled();
    });

    it('should ignore subscription.invoice.created events without subscriptionId in metadata', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      await handler.handle(
        makeSubscriptionInvoiceCreatedEvent({
          metadata: { amount: 99.9, refMonth: '2026-08' },
        }),
      );

      expect(processPayment.execute).not.toHaveBeenCalled();
      expect(renewSubscription.execute).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('should process payment and renew subscription on success', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      processPayment.execute.mockResolvedValue(
        success({ status: 'PENDING', pix: { qrCode: 'qr', copyPaste: 'copy', expiresAt: new Date() } }),
      );
      renewSubscription.execute.mockResolvedValue(success({ id: 'sub-123' }));

      const loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

      await handler.handle(makeSubscriptionInvoiceCreatedEvent());

      expect(processPayment.execute).toHaveBeenCalledWith({
        invoiceId: 'invoice-123',
        tenantId: 'tenant-123',
      });
      expect(renewSubscription.execute).toHaveBeenCalledWith({
        subscriptionId: 'sub-123',
        tenantId: 'tenant-123',
      });
      expect(loggerInfoSpy).toHaveBeenCalledWith('[AutoPay] Invoice %s auto-paid successfully', 'invoice-123');
      loggerInfoSpy.mockRestore();
    });
  });

  describe('payment failure', () => {
    it('should log warning and NOT throw when payment fails', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      processPayment.execute.mockResolvedValue(
        failure(new ApplicationError('Payment provider declined', 'PAYMENT_DECLINED', 402)),
      );

      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await expect(handler.handle(makeSubscriptionInvoiceCreatedEvent())).resolves.toBeUndefined();

      expect(processPayment.execute).toHaveBeenCalledTimes(1);
      expect(renewSubscription.execute).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[AutoPay] Invoice %s auto-pay failed: %s',
        'invoice-123',
        'Payment provider declined',
      );
      loggerWarnSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should throw transient errors from processPayment so the retry loop in handleWithRetry can catch them', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      processPayment.execute.mockRejectedValue(new Error('Database connection lost'));

      await expect(handler.handle(makeSubscriptionInvoiceCreatedEvent())).rejects.toThrow('Database connection lost');
    });

    it('should throw transient errors from renewSubscription so the retry loop in handleWithRetry can catch them', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      processPayment.execute.mockResolvedValue(
        success({ status: 'PENDING', pix: { qrCode: 'qr', copyPaste: 'copy', expiresAt: new Date() } }),
      );
      renewSubscription.execute.mockRejectedValue(new Error('Failed to renew'));

      await expect(handler.handle(makeSubscriptionInvoiceCreatedEvent())).rejects.toThrow('Failed to renew');
    });
  });

  describe('logging', () => {
    it('should call both log and warn with appropriate messages', async () => {
      const { processPayment, renewSubscription } = createMocks();
      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      processPayment.execute.mockResolvedValue(
        failure(new ApplicationError('Insufficient funds', 'INSUFFICIENT_FUNDS', 402)),
      );

      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await handler.handle(makeSubscriptionInvoiceCreatedEvent());

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[AutoPay] Invoice %s auto-pay failed: %s',
        'invoice-123',
        'Insufficient funds',
      );
      loggerWarnSpy.mockRestore();
    });
  });
});
