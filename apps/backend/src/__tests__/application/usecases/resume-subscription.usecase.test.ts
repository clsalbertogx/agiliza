import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { ResumeSubscriptionUseCase, ResumeSubscriptionInput } from '@/application/usecases/resume-subscription.usecase';
import { SubscriptionStatus, BillingCycle, type Subscription } from '@/domain/entities/subscription';

describe('ResumeSubscriptionUseCase', () => {
  let useCase: ResumeSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const now = new Date();
  const validInput: ResumeSubscriptionInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  const pausedSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.90,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.PAUSED,
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

    useCase = new ResumeSubscriptionUseCase(
      mockSubscriptionRepo,
      mockEventBus,
      mockIdGenerator,
    );
  });

  describe('Happy Path', () => {
    it('should resume a paused subscription successfully', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(pausedSubscription);
      const resumedSubscription = {
        ...pausedSubscription,
        status: SubscriptionStatus.ACTIVE,
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(resumedSubscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
      }

      expect(mockSubscriptionRepo.findById).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
      );
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000003',
        expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should publish subscription.resumed event on success', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(pausedSubscription);
      const resumedSubscription = {
        ...pausedSubscription,
        status: SubscriptionStatus.ACTIVE,
        updatedAt: new Date(),
      };
      vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(resumedSubscription);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.resumed',
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

    it('should return INVALID_STATUS when subscription is not PAUSED', async () => {
      const activeSub = {
        ...pausedSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSub);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_STATUS');
        expect(result.value.statusCode).toBe(409);
        expect(result.value.message).toContain('ACTIVE');
      }
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when update fails', async () => {
      vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(pausedSubscription);
      vi.mocked(mockSubscriptionRepo.update).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
