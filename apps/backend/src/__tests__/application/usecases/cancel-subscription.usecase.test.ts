import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import {
  type CancelSubscriptionInput,
  CancelSubscriptionUseCase,
} from '@/application/usecases/cancel-subscription.usecase';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

describe('CancelSubscriptionUseCase', () => {
  let useCase: CancelSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const now = new Date();
  const validInput: CancelSubscriptionInput = {
    id: '00000000-0000-0000-0000-000000000003',
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

    useCase = new CancelSubscriptionUseCase(mockSubscriptionRepo, mockEventBus, mockIdGenerator);
  });

  describe('Happy Path', () => {
    it('should cancel an active subscription successfully', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      const cancelledSubscription = {
        ...activeSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.cancel).mockResolvedValue(cancelledSubscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.CANCELLED);
        expect(result.value.cancelledAt).toBeInstanceOf(Date);
      }

      expect(mockSubscriptionRepo.findById).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
      );
      expect(mockSubscriptionRepo.cancel).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should publish subscription.cancelled event on success', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      const cancelledSubscription = {
        ...activeSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.cancel).mockResolvedValue(cancelledSubscription);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.cancelled',
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
      expect(mockSubscriptionRepo.cancel).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when subscription belongs to different tenant', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute({
        id: '00000000-0000-0000-0000-000000000003',
        tenantId: '00000000-0000-0000-0000-000000000099',
      });

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('NOT_FOUND');
      }
    });

    it('should return CONFLICT when subscription is already cancelled', async () => {
      const cancelledSub = {
        ...activeSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(cancelledSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('CONFLICT');
        expect(result.value.message).toContain('already cancelled');
      }
      expect(mockSubscriptionRepo.cancel).not.toHaveBeenCalled();
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when cancel fails', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
      vi.mocked(mockSubscriptionRepo.cancel).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
