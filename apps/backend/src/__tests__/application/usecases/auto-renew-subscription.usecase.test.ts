import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import { AutoRenewSubscriptionUseCase } from '@/application/usecases/auto-renew-subscription.usecase';
import { type Invoice, InvoiceStatus } from '@/domain/entities/invoice';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

describe('AutoRenewSubscriptionUseCase', () => {
  let useCase: AutoRenewSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockInvoiceRepo: InvoiceRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const now = new Date('2026-08-15');
  const validInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  const activeSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-08-20'),
    startDate: new Date('2026-07-20'),
    autoRenew: true,
    createdAt: now,
    updatedAt: now,
  };

  const gracePeriodSubscription: Subscription = {
    ...activeSubscription,
    status: SubscriptionStatus.GRACE_PERIOD,
    gracePeriodEndsAt: new Date('2026-08-25'),
    gracePeriodDays: 5,
  };

  beforeEach(() => {
    mockSubscriptionRepo = {
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

    mockInvoiceRepo = {
      findById: vi.fn(),
      findExistingForSubscription: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      getStats: vi.fn(),
    };

    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000099'),
      validate: vi.fn().mockReturnValue(true),
    };

    useCase = new AutoRenewSubscriptionUseCase(mockSubscriptionRepo, mockInvoiceRepo, mockEventBus, mockIdGenerator);
  });

  describe('Happy Path', () => {
    it('should auto-renew an active subscription successfully', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);

      const mockInvoice: Invoice = {
        id: '00000000-0000-0000-0000-000000000099',
        tenantId: activeSubscription.tenantId,
        clientId: activeSubscription.clientId,
        subscriptionId: activeSubscription.id,
        amount: activeSubscription.amount,
        dueDate: new Date(),
        status: InvoiceStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      const renewedSubscription = {
        ...activeSubscription,
        nextBilling: new Date('2026-09-20'),
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(renewedSubscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result.value.nextBilling).toBeInstanceOf(Date);
      }
      expect(mockInvoiceRepo.create).toHaveBeenCalled();
      expect(mockSubscriptionRepo.update).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.renewed',
          invoiceId: mockInvoice.id,
        }),
      );
    });

    it('should auto-renew a subscription in grace period', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(gracePeriodSubscription);

      const mockInvoice: Invoice = {
        id: '00000000-0000-0000-0000-000000000099',
        tenantId: gracePeriodSubscription.tenantId,
        clientId: gracePeriodSubscription.clientId,
        subscriptionId: gracePeriodSubscription.id,
        amount: gracePeriodSubscription.amount,
        dueDate: new Date(),
        status: InvoiceStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      const renewedSubscription = {
        ...gracePeriodSubscription,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-20'),
        gracePeriodEndsAt: undefined,
        gracePeriodDays: undefined,
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(renewedSubscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result.value.gracePeriodEndsAt).toBeUndefined();
      }
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.renewed',
          metadata: expect.objectContaining({
            inGracePeriod: true,
          }),
        }),
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
      }
      expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('should return AUTO_RENEW_DISABLED when autoRenew is false', async () => {
      const disabledSub = { ...activeSubscription, autoRenew: false };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(disabledSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('AUTO_RENEW_DISABLED');
      }
      expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
    });

    it('should return TRIAL_ACTIVE when subscription is in trial', async () => {
      const trialSub = {
        ...activeSubscription,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date('2026-09-15'),
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(trialSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('TRIAL_ACTIVE');
      }
      expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
    });

    it('should return INVALID_STATUS when subscription is CANCELLED', async () => {
      const cancelledSub = {
        ...activeSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(cancelledSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_STATUS');
      }
    });

    it('should return INVALID_STATUS when subscription is EXPIRED', async () => {
      const expiredSub = {
        ...activeSubscription,
        status: SubscriptionStatus.EXPIRED,
        endDate: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_STATUS');
      }
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when invoice creation fails', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      vi.mocked(mockInvoiceRepo.create).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR when update fails', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);

      const mockInvoice: Invoice = {
        id: '00000000-0000-0000-0000-000000000099',
        tenantId: activeSubscription.tenantId,
        clientId: activeSubscription.clientId,
        subscriptionId: activeSubscription.id,
        amount: activeSubscription.amount,
        dueDate: new Date(),
        status: InvoiceStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(mockSubscriptionRepo.update).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
