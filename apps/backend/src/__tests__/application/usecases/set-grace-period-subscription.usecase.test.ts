import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import { SetGracePeriodSubscriptionUseCase } from '@/application/usecases/set-grace-period-subscription.usecase';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

describe('SetGracePeriodSubscriptionUseCase', () => {
  let useCase: SetGracePeriodSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    days: 7,
  };

  const expiredSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.EXPIRED,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-15'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
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

    useCase = new SetGracePeriodSubscriptionUseCase(mockSubscriptionRepo, mockEventBus, mockIdGenerator);
  });

  it('should set grace period on an expired subscription', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSubscription);
    const graceSub = {
      ...expiredSubscription,
      status: SubscriptionStatus.GRACE_PERIOD,
      gracePeriodDays: 7,
      gracePeriodEndsAt: new Date('2026-08-22'),
    };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(graceSub);

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(SubscriptionStatus.GRACE_PERIOD);
      expect(result.value.gracePeriodDays).toBe(7);
    }
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
      validInput.subscriptionId,
      expect.objectContaining({
        status: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodDays: 7,
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription.updated',
      }),
    );
  });

  it('should return NOT_FOUND when subscription does not exist', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('NOT_FOUND');
    }
    expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
  });

  it('should return INVALID_GRACE_PERIOD when days is not positive', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSubscription);

    const result = await useCase.execute({ ...validInput, days: 0 });

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INVALID_GRACE_PERIOD');
    }
    expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
  });

  it('should return INTERNAL_ERROR when update fails', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSubscription);
    vi.mocked(mockSubscriptionRepo.update).mockRejectedValue(new Error('Database error'));

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INTERNAL_ERROR');
    }
  });
});
