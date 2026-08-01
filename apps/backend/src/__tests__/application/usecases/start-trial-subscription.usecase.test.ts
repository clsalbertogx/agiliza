import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure } from '@/application/types/either';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { StartTrialSubscriptionUseCase } from '@/application/usecases/start-trial-subscription.usecase';
import { SubscriptionStatus, BillingCycle, type Subscription } from '@/domain/entities/subscription';

describe('StartTrialSubscriptionUseCase', () => {
  let useCase: StartTrialSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    trialDays: 14,
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
    startDate: new Date('2026-08-01'),
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

    useCase = new StartTrialSubscriptionUseCase(
      mockSubscriptionRepo,
      mockEventBus,
      mockIdGenerator,
    );
  });

  it('should start a trial on an active subscription', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
    const trialSub = {
      ...activeSubscription,
      status: SubscriptionStatus.TRIAL,
      trialDays: 14,
      trialEndsAt: new Date('2026-08-15'),
    };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(trialSub);

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(SubscriptionStatus.TRIAL);
      expect(result.value.trialDays).toBe(14);
    }
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
      validInput.subscriptionId,
      expect.objectContaining({
        status: SubscriptionStatus.TRIAL,
        trialDays: 14,
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

  it('should return INVALID_TRIAL when trialDays is not positive', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);

    const result = await useCase.execute({ ...validInput, trialDays: 0 });

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INVALID_TRIAL');
    }
    expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
  });

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
