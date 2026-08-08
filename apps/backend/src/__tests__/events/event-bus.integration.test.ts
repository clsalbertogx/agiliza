import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotifyOutboundHandler } from '@/application/events/handlers/notify-outbound.handler';
import { SendReceiptHandler } from '@/application/events/handlers/send-receipt.handler';
import { UpdateRiskScoreHandler } from '@/application/events/handlers/update-risk-score.handler';
import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { RiskCalculatorService } from '@/application/services/risk-calculator.service';
import { logger } from '@/config/logger';
import { RiskScore } from '@/domain/entities/client';
import type { DomainEvent, DomainEventType } from '@/domain/events/domain-events';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(eventType: string, overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType: eventType as DomainEventType,
    clientId: 'client-123',
    tenantId: 'tenant-123',
    invoiceId: 'invoice-123',
    timestamp: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

function makeMockInvoice() {
  return {
    id: 'invoice-123',
    clientId: 'client-123',
    tenantId: 'tenant-123',
    amount: 150.0,
    dueDate: new Date('2026-08-15'),
    status: 'PAID',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMockClient() {
  return {
    id: 'client-123',
    tenantId: 'tenant-123',
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    document: '12345678901',
    preferredChannel: 'WHATSAPP',
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN,
    totalInvoices: 5,
    paidInvoices: 3,
    avgPaymentDelay: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Test-specific wiring — mirrors registerEventHandlers but uses mock ports
// ---------------------------------------------------------------------------

function wireHandlersWithMocks(eventBus: InMemoryEventBus) {
  const invoiceRepo: InvoiceRepositoryPort = {
    findById: vi.fn().mockResolvedValue(makeMockInvoice()),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };

  const clientRepo: ClientRepositoryPort = {
    findById: vi.fn().mockResolvedValue(makeMockClient()),
    findByPhone: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateRiskScore: vi.fn(),
  };

  const messageProvider: MessageProviderPort = {
    sendText: vi.fn(),
    sendTemplate: vi.fn().mockResolvedValue({
      externalId: 'msg-123',
      status: 'queued',
      timestamp: new Date().toISOString(),
    }),
    getStatus: vi.fn(),
  };

  // Services
  const riskCalculator = new RiskCalculatorService(clientRepo, invoiceRepo);

  // Handlers
  const sendReceipt = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);
  const updateRisk = new UpdateRiskScoreHandler(clientRepo, invoiceRepo, riskCalculator);
  const notifyOutbound = new NotifyOutboundHandler(); // no webhook → early return

  // Subscribe — same pattern as registerEventHandlers
  eventBus.subscribe('payment.confirmed', (e) => sendReceipt.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => updateRisk.handle(e));
  eventBus.subscribe('payment.failed', (e) => updateRisk.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => updateRisk.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('message.read', (e) => updateRisk.handle(e));
  eventBus.subscribe('message.clicked', (e) => updateRisk.handle(e));
  eventBus.subscribe('client.created', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('decision.made', (e) => notifyOutbound.handle(e));

  return { invoiceRepo, clientRepo, messageProvider, sendReceipt, updateRisk, notifyOutbound };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InMemoryEventBus — Integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Test 1 — publish triggers all subscribed handlers
  // -----------------------------------------------------------------------
  describe('publish triggers all subscribed handlers', () => {
    it('should call every handler subscribed to the published event', async () => {
      const eventBus = new InMemoryEventBus();
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      const handler3 = vi.fn().mockResolvedValue(undefined);

      eventBus.subscribe('payment.confirmed', handler1);
      eventBus.subscribe('payment.confirmed', handler2);
      eventBus.subscribe('payment.confirmed', handler3);

      eventBus.publish(makeEvent('payment.confirmed'));

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
        expect(handler3).toHaveBeenCalledTimes(1);
      });
    });

    it('should pass the event payload to each handler', async () => {
      const eventBus = new InMemoryEventBus();
      const handler = vi.fn().mockResolvedValue(undefined);
      eventBus.subscribe('payment.confirmed', handler);

      const event = makeEvent('payment.confirmed', { invoiceId: 'inv-999', metadata: { amount: 200 } });
      eventBus.publish(event);

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(event);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Test 2 — handler error does not affect other handlers
  // -----------------------------------------------------------------------
  describe('handler error isolation', () => {
    it('should continue executing remaining handlers when one throws', async () => {
      const eventBus = new InMemoryEventBus();
      const calls: string[] = [];

      const handler1 = vi.fn(async () => {
        calls.push('handler1');
      });
      const handler2 = vi.fn(async () => {
        throw new Error('Handler 2 failed');
      });
      const handler3 = vi.fn(async () => {
        calls.push('handler3');
      });

      eventBus.subscribe('payment.confirmed', handler1);
      eventBus.subscribe('payment.confirmed', handler2);
      eventBus.subscribe('payment.confirmed', handler3);

      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      // Catch unhandled rejection from handler2 so it doesn't pollute the test
      const rejectionHandler = vi.fn();
      process.on('unhandledRejection', rejectionHandler);

      // publish is synchronous — calls all handlers without awaiting
      expect(() => {
        eventBus.publish(makeEvent('payment.confirmed'));
      }).not.toThrow();

      // handler1 and handler3 must execute even though handler2 throws
      await vi.waitFor(() => {
        expect(calls).toContain('handler1');
        expect(calls).toContain('handler3');
      });

      process.off('unhandledRejection', rejectionHandler);

      // The error from handler2 should be caught and logged by the event bus
      expect(loggerErrorSpy).toHaveBeenCalledWith({ err: expect.any(Error) }, 'Event handler failed');

      loggerErrorSpy.mockRestore();
    });

    it('should catch handler errors and log them without crashing', async () => {
      const eventBus = new InMemoryEventBus();
      const handler = vi.fn().mockRejectedValue(new Error('Unexpected crash'));

      eventBus.subscribe('payment.confirmed', handler);

      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const rejectionHandler = vi.fn();
      process.on('unhandledRejection', rejectionHandler);

      expect(() => {
        eventBus.publish(makeEvent('payment.confirmed'));
      }).not.toThrow();

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalled();
      });

      process.off('unhandledRejection', rejectionHandler);

      expect(loggerErrorSpy).toHaveBeenCalledWith({ err: expect.any(Error) }, 'Event handler failed');

      loggerErrorSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Test 3 — multiple handlers for same event all execute
  // -----------------------------------------------------------------------
  describe('multiple handlers for the same event type', () => {
    it('should execute all three handlers subscribed to payment.confirmed', async () => {
      const eventBus = new InMemoryEventBus();
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      const handler3 = vi.fn().mockResolvedValue(undefined);

      eventBus.subscribe('payment.confirmed', handler1);
      eventBus.subscribe('payment.confirmed', handler2);
      eventBus.subscribe('payment.confirmed', handler3);

      eventBus.publish(makeEvent('payment.confirmed'));

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        expect(handler3).toHaveBeenCalled();
      });
    });

    it('should execute handlers in the order they were subscribed', async () => {
      const eventBus = new InMemoryEventBus();
      const executionOrder: number[] = [];

      const handler1 = vi.fn(async () => {
        executionOrder.push(1);
      });
      const handler2 = vi.fn(async () => {
        executionOrder.push(2);
      });
      const handler3 = vi.fn(async () => {
        executionOrder.push(3);
      });

      eventBus.subscribe('payment.confirmed', handler1);
      eventBus.subscribe('payment.confirmed', handler2);
      eventBus.subscribe('payment.confirmed', handler3);

      eventBus.publish(makeEvent('payment.confirmed'));

      await vi.waitFor(() => {
        expect(executionOrder.length).toBe(3);
      });

      // Handlers are fire-and-forget (unawaited), but forEach is synchronous,
      // so handlers are invoked in subscription order.
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  // -----------------------------------------------------------------------
  // Test 4 — handler not subscribed to event type is not called
  // -----------------------------------------------------------------------
  describe('event type filtering', () => {
    it('should not call handler when publishing a different event type', async () => {
      const eventBus = new InMemoryEventBus();
      const paymentHandler = vi.fn().mockResolvedValue(undefined);
      const invoiceHandler = vi.fn().mockResolvedValue(undefined);

      eventBus.subscribe('payment.confirmed', paymentHandler);
      eventBus.subscribe('invoice.created', invoiceHandler);

      // Publish only invoice.created
      eventBus.publish(makeEvent('invoice.created'));

      await vi.waitFor(() => {
        expect(invoiceHandler).toHaveBeenCalled();
      });

      // paymentHandler must NOT have been called
      expect(paymentHandler).not.toHaveBeenCalled();
    });

    it('should not call any handler when publishing an event type with no subscribers', async () => {
      const eventBus = new InMemoryEventBus();
      const handler = vi.fn().mockResolvedValue(undefined);

      eventBus.subscribe('payment.confirmed', handler);

      // Publish an event type that nobody subscribed to
      eventBus.publish(makeEvent('decision.made'));

      // Wait a small tick to let any (incorrect) microtasks settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only call handlers registered for the exact event type published', async () => {
      const eventBus = new InMemoryEventBus();
      const calls: string[] = [];

      const paymentHandler = vi.fn(async () => {
        calls.push('payment');
      });
      const overdueHandler = vi.fn(async () => {
        calls.push('overdue');
      });
      const failedHandler = vi.fn(async () => {
        calls.push('failed');
      });

      eventBus.subscribe('payment.confirmed', paymentHandler);
      eventBus.subscribe('invoice.overdue', overdueHandler);
      eventBus.subscribe('payment.failed', failedHandler);

      // Publish only payment.confirmed
      eventBus.publish(makeEvent('payment.confirmed'));

      await vi.waitFor(() => {
        expect(calls).toEqual(['payment']);
      });

      expect(overdueHandler).not.toHaveBeenCalled();
      expect(failedHandler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 5 — real handler wiring via registerEventHandlers
  // -----------------------------------------------------------------------
  describe('real handler wiring', () => {
    it('should execute all real handlers when publishing payment.confirmed', async () => {
      const eventBus = new InMemoryEventBus();
      const { invoiceRepo, clientRepo, messageProvider, notifyOutbound } = wireHandlersWithMocks(eventBus);

      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      eventBus.publish(makeEvent('payment.confirmed'));

      // SendReceiptHandler — fetches invoice + client, sends template
      await vi.waitFor(() => {
        expect(invoiceRepo.findById).toHaveBeenCalledWith('invoice-123');
      });
      await vi.waitFor(() => {
        expect(clientRepo.findById).toHaveBeenCalledWith('client-123');
      });
      await vi.waitFor(() => {
        expect(messageProvider.sendTemplate).toHaveBeenCalled();
      });

      // UpdateRiskScoreHandler — recalculates risk and updates client
      await vi.waitFor(() => {
        expect(clientRepo.updateRiskScore).toHaveBeenCalled();
      });

      // NotifyOutboundHandler — not configured (no webhook), returns early
      // Should not have thrown or produced error logs
      expect(loggerErrorSpy).not.toHaveBeenCalled();

      loggerErrorSpy.mockRestore();
    });

    it('should execute UpdateRiskScoreHandler on risk-affecting events', async () => {
      const eventBus = new InMemoryEventBus();
      const { clientRepo } = wireHandlersWithMocks(eventBus);

      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      // payment.failed should trigger UpdateRiskScoreHandler
      eventBus.publish(makeEvent('payment.failed'));

      await vi.waitFor(() => {
        expect(clientRepo.updateRiskScore).toHaveBeenCalled();
      });

      expect(loggerErrorSpy).not.toHaveBeenCalled();
      loggerErrorSpy.mockRestore();
    });

    it('should not call SendReceiptHandler on non-payment events', async () => {
      const eventBus = new InMemoryEventBus();
      const { messageProvider, clientRepo } = wireHandlersWithMocks(eventBus);

      // invoice.overdue should NOT trigger SendReceiptHandler
      eventBus.publish(makeEvent('invoice.overdue'));

      await vi.waitFor(() => {
        // UpdateRiskScoreHandler should have run
        expect(clientRepo.updateRiskScore).toHaveBeenCalled();
      });

      // SendReceiptHandler only runs for payment.confirmed
      expect(messageProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('should handle NotifyOutboundHandler when webhook is configured', async () => {
      const eventBus = new InMemoryEventBus();

      // Manually create a configured NotifyOutboundHandler
      const notifyOutbound = new NotifyOutboundHandler('https://hooks.example.com/events', 'sk-test-key');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      eventBus.subscribe('client.created', (e) => notifyOutbound.handle(e));

      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      eventBus.publish(makeEvent('client.created'));

      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      expect(loggerErrorSpy).not.toHaveBeenCalled();
      loggerErrorSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });
});
