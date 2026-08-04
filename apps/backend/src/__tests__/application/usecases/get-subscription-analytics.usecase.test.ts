import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import { GetSubscriptionAnalyticsUseCase } from '@/application/usecases/get-subscription-analytics.usecase';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';

describe('GetSubscriptionAnalyticsUseCase', () => {
  let useCase: GetSubscriptionAnalyticsUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const from = new Date('2026-08-01');
  const to = new Date('2026-08-31');

  const activeSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: TENANT_ID,
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };

  const cancelledSubscription: Subscription = {
    ...activeSubscription,
    id: '00000000-0000-0000-0000-000000000004',
    status: SubscriptionStatus.CANCELLED,
    cancelledAt: new Date('2026-08-10'),
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

    useCase = new GetSubscriptionAnalyticsUseCase(mockSubscriptionRepo);
  });

  describe('Happy path', () => {
    it('should return analytics with MRR, churn and LTV', async () => {
      vi.mocked(mockSubscriptionRepo.getSubscriptionsForAnalytics).mockResolvedValue([
        activeSubscription,
        cancelledSubscription,
      ]);

      const result = await useCase.execute({ tenantId: TENANT_ID, from, to });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.mrr).toBe(99.9);
        expect(result.value.churn).toBe(50);
        expect(result.value.ltv).toBe(199.8);
        expect(result.value.activeCount).toBe(1);
        expect(result.value.cancelledCount).toBe(1);
      }

      expect(mockSubscriptionRepo.getSubscriptionsForAnalytics).toHaveBeenCalledWith(TENANT_ID, from, to);
    });

    it('should default `from` to the start of the current month and `to` to now', async () => {
      vi.mocked(mockSubscriptionRepo.getSubscriptionsForAnalytics).mockResolvedValue([]);

      const now = new Date();
      const result = await useCase.execute({ tenantId: TENANT_ID });

      expect(isSuccess(result)).toBe(true);

      const [tenantId, defaultFrom, defaultTo] = vi.mocked(mockSubscriptionRepo.getSubscriptionsForAnalytics).mock
        .calls[0];
      expect(tenantId).toBe(TENANT_ID);
      expect(defaultFrom).toBeInstanceOf(Date);
      expect(defaultFrom.getFullYear()).toBe(now.getFullYear());
      expect(defaultFrom.getMonth()).toBe(now.getMonth());
      expect(defaultFrom.getDate()).toBe(1);
      expect(defaultTo).toBeInstanceOf(Date);
    });
  });

  describe('Validation', () => {
    it('should return VALIDATION_ERROR when tenantId is missing', async () => {
      const result = await useCase.execute({ tenantId: '' });

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('VALIDATION_ERROR');
        expect(result.value.statusCode).toBe(400);
      }
      expect(mockSubscriptionRepo.getSubscriptionsForAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('Repository errors', () => {
    it('should return INTERNAL_ERROR when repository fails', async () => {
      vi.mocked(mockSubscriptionRepo.getSubscriptionsForAnalytics).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute({ tenantId: TENANT_ID, from, to });

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
        expect(result.value.statusCode).toBe(500);
      }
    });
  });
});
