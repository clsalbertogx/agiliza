import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { ExpireSubscriptionUseCase, ExpireSubscriptionInput } from '@/application/usecases/expire-subscription.usecase';
import { SubscriptionStatus, BillingCycle, type Subscription } from '@/domain/entities/subscription';

describe('ExpireSubscriptionUseCase', () => {
  let useCase: ExpireSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const now = new Date();
  const validInput: ExpireSubscriptionInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  const activeSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.90,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-09-01'),
    startDate: now,
    createdAt: now,
    updatedAt: now,
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

    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000099'),
      validate: vi.fn().mockReturnValue(true),
    };

    useCase = new ExpireSubscriptionUseCase(
      mockSubscriptionRepo,
      mockEventBus,
      mockIdGenerator,
    );
  });

  describe('Happy Path', () => {
    it('should expire an active subscription successfully', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      const expiredSubscription = {
        ...activeSubscription,
        status: SubscriptionStatus.EXPIRED,
        endDate: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(expiredSubscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.EXPIRED);
        expect(result.value.endDate).toBeInstanceOf(Date);
      }

      expect(mockSubscriptionRepo.findById).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
      );
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        expect.objectContaining({
          status: SubscriptionStatus.EXPIRED,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should publish subscription.expired event on success', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      const expiredSubscription = {
        ...activeSubscription,
        status: SubscriptionStatus.EXPIRED,
        endDate: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(expiredSubscription);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.expired',
          tenantId: '00000000-0000-0000-0000-000000000001',
          clientId: '00000000-0000-0000-0000-000000000002',
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
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when subscription belongs to different tenant', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute({
        subscriptionId: '00000000-0000-0000-0000-000000000003',
        tenantId: '00000000-0000-0000-0000-000000000099',
      });

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('NOT_FOUND');
      }
    });

    it('should return INVALID_STATUS when subscription is already expired', async () => {
      const expiredSub = {
        ...activeSubscription,
        status: SubscriptionStatus.EXPIRED,
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_STATUS');
        expect(result.value.statusCode).toBe(409);
        expect(result.value.message).toContain('EXPIRED');
      }
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('should return INVALID_STATUS when subscription is already cancelled', async () => {
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
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when update fails', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      vi.mocked(mockSubscriptionRepo.update).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
