import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import { ToggleAutoRenewSubscriptionUseCase } from '@/application/usecases/toggle-auto-renew-subscription.usecase';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

describe('ToggleAutoRenewSubscriptionUseCase', () => {
  let useCase: ToggleAutoRenewSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    autoRenew: false,
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
    startDate: new Date('2026-08-01'),
    autoRenew: true,
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

    useCase = new ToggleAutoRenewSubscriptionUseCase(mockSubscriptionRepo, mockEventBus, mockIdGenerator);
  });

  it('should toggle autoRenew to false', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
    const updatedSub = { ...activeSubscription, autoRenew: false };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(updatedSub);

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.autoRenew).toBe(false);
    }
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
      validInput.subscriptionId,
      expect.objectContaining({
        autoRenew: false,
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription.updated',
      }),
    );
  });

  it('should toggle autoRenew to true', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue({ ...activeSubscription, autoRenew: false });
    const updatedSub = { ...activeSubscription, autoRenew: true };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(updatedSub);

    const result = await useCase.execute({ ...validInput, autoRenew: true });

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.autoRenew).toBe(true);
    }
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
