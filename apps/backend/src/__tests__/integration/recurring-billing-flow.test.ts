import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import { AutoPayHandler } from '@/application/events/handlers/auto-pay.handler';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import type { RecurringInvoiceResult } from '@/application/usecases/create-invoice-for-subscription.usecase';
import { CreateInvoiceForSubscriptionUseCase } from '@/application/usecases/create-invoice-for-subscription.usecase';
import { ExpireSubscriptionUseCase } from '@/application/usecases/expire-subscription.usecase';
import { type Client, MessageChannel, RiskScore } from '@/domain/entities/client';
import { InvoiceStatus } from '@/domain/entities/invoice';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { DomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { failure, isSuccess, success } from '@/domain/types/either';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000003';

function makeActiveSubscription(nextBilling?: Date): Subscription {
  return {
    id: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: nextBilling ?? new Date(),
    startDate: new Date('2026-06-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMockClient(): Client {
  return {
    id: CLIENT_ID,
    tenantId: TENANT_ID,
    name: 'John Doe',
    phone: '5511999998888',
    preferredChannel: MessageChannel.WHATSAPP,
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN,
    totalInvoices: 0,
    paidInvoices: 0,
    avgPaymentDelay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeEmptyInvoiceRepo(): InvoiceRepositoryPort {
  return {
    findById: vi.fn(),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };
}

function makeEmptySubscriptionRepo(): SubscriptionRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByTenantId: vi.fn(),
    findByClientId: vi.fn(),
    findActiveByNextBillingBefore: vi.fn(),
    findDueForRenewal: vi.fn(),
    getSubscriptionsForAnalytics: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  };
}

function makeEmptyClientRepo(): ClientRepositoryPort {
  return {
    findById: vi.fn(),
    findByPhone: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateRiskScore: vi.fn(),
  };
}

function makeSubscriptionInvoiceCreatedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-auto-123',
    eventType: 'subscription.invoice.created',
    clientId: CLIENT_ID,
    tenantId: TENANT_ID,
    invoiceId: 'invoice-123',
    timestamp: new Date().toISOString(),
    metadata: {
      subscriptionId: SUBSCRIPTION_ID,
      amount: 99.9,
      refMonth: '2026-08',
    },
    ...overrides,
  };
}

// ===========================================================================
// Suite
// ===========================================================================

describe('Recurring Billing Flow — Integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Test 1 — Full recurring billing flow
  // -----------------------------------------------------------------------
  describe('CreateInvoiceForSubscriptionUseCase — full flow', () => {
    it('should create invoice, update nextBilling, and publish event for active subscription due today', async () => {
      const eventBus = new InMemoryEventBus();
      const subscription = makeActiveSubscription();

      const invoiceRepo: InvoiceRepositoryPort = {
        ...makeEmptyInvoiceRepo(),
        findExistingForSubscription: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async (inv) => ({
          ...inv,
          id: 'generated-invoice-id',
        })),
      };

      const subscriptionRepo: SubscriptionRepositoryPort = {
        ...makeEmptySubscriptionRepo(),
        findActiveByNextBillingBefore: vi.fn().mockResolvedValue([subscription]),
        update: vi.fn().mockResolvedValue({
          ...subscription,
          nextBilling: new Date('2026-08-15'),
        }),
      };

      const clientRepo: ClientRepositoryPort = {
        ...makeEmptyClientRepo(),
        findById: vi.fn().mockResolvedValue(makeMockClient()),
      };

      // Spy on the event published through InMemoryEventBus
      const eventSpy = vi.fn();
      eventBus.subscribe('subscription.invoice.created', eventSpy);

      const useCase = new CreateInvoiceForSubscriptionUseCase(subscriptionRepo, invoiceRepo, clientRepo, eventBus);

      const result: RecurringInvoiceResult = await useCase.execute();

      // Assert result counts
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      // Assert invoice was created with correct data
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          clientId: CLIENT_ID,
          subscriptionId: SUBSCRIPTION_ID,
          amount: 99.9,
          dueDate: subscription.nextBilling,
          status: InvoiceStatus.PENDING,
        }),
      );

      // Assert nextBilling was updated (moved forward)
      expect(subscriptionRepo.update).toHaveBeenCalledWith(
        SUBSCRIPTION_ID,
        expect.objectContaining({
          nextBilling: expect.any(Date),
        }),
      );
      const updateCall = vi.mocked(subscriptionRepo.update).mock.calls[0];
      const updatedNextBilling = updateCall[1].nextBilling as Date;
      expect(updatedNextBilling.getTime()).toBeGreaterThan(subscription.nextBilling.getTime());

      // Assert event was published on InMemoryEventBus
      await vi.waitFor(() => {
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'subscription.invoice.created',
            clientId: CLIENT_ID,
            tenantId: TENANT_ID,
            invoiceId: 'generated-invoice-id',
            metadata: expect.objectContaining({
              subscriptionId: SUBSCRIPTION_ID,
              amount: 99.9,
            }),
          }),
        );
      });
    });
  });

  // -----------------------------------------------------------------------
  // Test 2 — Subscription lifecycle: expire
  // -----------------------------------------------------------------------
  describe('ExpireSubscriptionUseCase — lifecycle', () => {
    it('should expire an ACTIVE subscription and publish event', async () => {
      const eventBus = new InMemoryEventBus();
      const activeSubscription = makeActiveSubscription(new Date('2026-07-15'));

      const subscriptionRepo: SubscriptionRepositoryPort = {
        ...makeEmptySubscriptionRepo(),
        findById: vi.fn().mockResolvedValue(activeSubscription),
        update: vi.fn().mockImplementation(async (_id, data) => ({
          ...activeSubscription,
          ...data,
          id: SUBSCRIPTION_ID,
        })),
      };

      const idGenerator: IdGeneratorPort = {
        generate: vi.fn().mockReturnValue('evt-generated-id'),
        validate: vi.fn().mockReturnValue(true),
      };

      const eventSpy = vi.fn();
      eventBus.subscribe('subscription.expired', eventSpy);

      const useCase = new ExpireSubscriptionUseCase(subscriptionRepo, eventBus, idGenerator);

      const result = await useCase.execute({
        subscriptionId: SUBSCRIPTION_ID,
        tenantId: TENANT_ID,
      });

      // Assert successful expiry
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.status).toBe(SubscriptionStatus.EXPIRED);
      }

      // Assert persistence
      expect(subscriptionRepo.update).toHaveBeenCalledWith(
        SUBSCRIPTION_ID,
        expect.objectContaining({
          status: SubscriptionStatus.EXPIRED,
        }),
      );

      // Assert event published
      await vi.waitFor(() => {
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'subscription.expired',
            tenantId: TENANT_ID,
            clientId: CLIENT_ID,
          }),
        );
      });
    });
  });

  // -----------------------------------------------------------------------
  // Test 3 — Auto-pay on invoice created (happy path)
  // -----------------------------------------------------------------------
  describe('AutoPayHandler — payment success', () => {
    it('should process payment and renew subscription on subscription.invoice.created', async () => {
      const processPayment = {
        execute: vi.fn().mockResolvedValue(
          success({
            status: 'PENDING',
            pix: {
              qrCode: 'qr-code-data',
              copyPaste: 'pix-copy-paste',
              expiresAt: new Date(),
            },
          }),
        ),
      };

      const renewSubscription = {
        execute: vi.fn().mockResolvedValue(success({ id: SUBSCRIPTION_ID })),
      };

      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handler.handle(makeSubscriptionInvoiceCreatedEvent());

      // Assert payment was processed
      expect(processPayment.execute).toHaveBeenCalledWith({
        invoiceId: 'invoice-123',
        tenantId: TENANT_ID,
      });

      // Assert subscription was renewed on success
      expect(renewSubscription.execute).toHaveBeenCalledWith({
        subscriptionId: SUBSCRIPTION_ID,
        tenantId: TENANT_ID,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('auto-paid successfully'));

      consoleLogSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Test 4 — Auto-pay failure doesn't crash
  // -----------------------------------------------------------------------
  describe('AutoPayHandler — payment failure', () => {
    it('should log warning and NOT call renew when payment fails', async () => {
      const processPayment = {
        execute: vi
          .fn()
          .mockResolvedValue(failure(new ApplicationError('Payment provider declined', 'PAYMENT_DECLINED', 402))),
      };

      const renewSubscription = {
        execute: vi.fn(),
      };

      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await handler.handle(makeSubscriptionInvoiceCreatedEvent());

      // Assert payment was attempted
      expect(processPayment.execute).toHaveBeenCalledTimes(1);

      // Assert renew was NOT called
      expect(renewSubscription.execute).not.toHaveBeenCalled();

      // Assert warning was logged (not thrown)
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('auto-pay failed'));

      consoleWarnSpy.mockRestore();
    });

    it('should propagate thrown errors from processPayment so handleWithRetry can catch them', async () => {
      const processPayment = {
        execute: vi.fn().mockRejectedValue(new Error('Database connection lost')),
      };

      const renewSubscription = {
        execute: vi.fn(),
      };

      const handler = new AutoPayHandler(processPayment as any, renewSubscription as any);

      await expect(handler.handle(makeSubscriptionInvoiceCreatedEvent())).rejects.toThrow('Database connection lost');
    });
  });

  // -----------------------------------------------------------------------
  // Test 5 — Idempotency: duplicate run doesn't create duplicate invoices
  // -----------------------------------------------------------------------
  describe('CreateInvoiceForSubscriptionUseCase — idempotency', () => {
    it('should skip when invoice already exists for the reference month', async () => {
      const subscription = makeActiveSubscription();

      const invoiceRepo: InvoiceRepositoryPort = {
        ...makeEmptyInvoiceRepo(),
        findExistingForSubscription: vi.fn().mockResolvedValue({
          id: 'existing-invoice-id',
          tenantId: TENANT_ID,
          clientId: CLIENT_ID,
          subscriptionId: SUBSCRIPTION_ID,
          amount: 99.9,
          dueDate: subscription.nextBilling,
          description: 'Premium Plan - 2026-07',
          status: InvoiceStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const subscriptionRepo: SubscriptionRepositoryPort = {
        ...makeEmptySubscriptionRepo(),
        findActiveByNextBillingBefore: vi.fn().mockResolvedValue([subscription]),
      };

      const clientRepo = makeEmptyClientRepo();
      const eventBus = new InMemoryEventBus();

      const useCase = new CreateInvoiceForSubscriptionUseCase(subscriptionRepo, invoiceRepo, clientRepo, eventBus);

      const result = await useCase.execute();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);

      // No new data should be created/updated
      expect(invoiceRepo.create).not.toHaveBeenCalled();
      expect(subscriptionRepo.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 6 — Inactive subscriptions are skipped
  // -----------------------------------------------------------------------
  describe('CreateInvoiceForSubscriptionUseCase — no due subscriptions', () => {
    it('should create 0 invoices when no active subscriptions are due for billing', async () => {
      const subscriptionRepo: SubscriptionRepositoryPort = {
        ...makeEmptySubscriptionRepo(),
        findActiveByNextBillingBefore: vi.fn().mockResolvedValue([]),
      };

      const invoiceRepo = makeEmptyInvoiceRepo();
      const clientRepo = makeEmptyClientRepo();
      const eventBus = new InMemoryEventBus();

      const useCase = new CreateInvoiceForSubscriptionUseCase(subscriptionRepo, invoiceRepo, clientRepo, eventBus);

      const result = await useCase.execute();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      expect(invoiceRepo.create).not.toHaveBeenCalled();
      expect(subscriptionRepo.update).not.toHaveBeenCalled();
    });
  });
});
