import { describe, expect, it } from 'vitest';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import { SubscriptionAnalyticsService } from '@/domain/services/subscription-analytics.service';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 100,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  };
}

describe('SubscriptionAnalyticsService', () => {
  const from = new Date('2026-08-01');
  const to = new Date('2026-08-31');

  describe('MRR', () => {
    it('should calculate MRR normalizing different billing cycles to monthly', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100, billingCycle: BillingCycle.MONTHLY }),
        makeSubscription({ id: 'sub-2', amount: 300, billingCycle: BillingCycle.BIMONTHLY }),
        makeSubscription({ id: 'sub-3', amount: 900, billingCycle: BillingCycle.QUARTERLY }),
        makeSubscription({ id: 'sub-4', amount: 600, billingCycle: BillingCycle.SEMIANNUAL }),
        makeSubscription({ id: 'sub-5', amount: 1200, billingCycle: BillingCycle.ANNUAL }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      // 100 + 150 + 300 + 100 + 100 = 750
      expect(result.mrr).toBe(750);
      expect(result.monthlyAmount).toBe(750);
      expect(result.activeCount).toBe(5);
    });

    it('should include TRIAL subscriptions in MRR', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100 }),
        makeSubscription({ id: 'sub-trial', amount: 50, status: SubscriptionStatus.TRIAL }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.mrr).toBe(150);
      expect(result.activeCount).toBe(2);
    });

    it('should ignore EXPIRED and PAUSED subscriptions in active and cancelled counts', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100 }),
        makeSubscription({ id: 'sub-expired', amount: 500, status: SubscriptionStatus.EXPIRED }),
        makeSubscription({ id: 'sub-paused', amount: 500, status: SubscriptionStatus.PAUSED }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.activeCount).toBe(1);
      expect(result.cancelledCount).toBe(0);
      expect(result.mrr).toBe(100);
    });
  });

  describe('Churn rate', () => {
    it('should calculate churn rate as cancelled / total * 100', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1' }),
        makeSubscription({ id: 'sub-2' }),
        makeSubscription({ id: 'sub-3' }),
        makeSubscription({ id: 'sub-4', status: SubscriptionStatus.CANCELLED }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.churn).toBe(25);
      expect(result.activeCount).toBe(3);
      expect(result.cancelledCount).toBe(1);
    });
  });

  describe('LTV', () => {
    it('should calculate LTV when churn > 0', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100 }),
        makeSubscription({ id: 'sub-2', amount: 100 }),
        makeSubscription({ id: 'sub-3', amount: 100 }),
        makeSubscription({ id: 'sub-4', status: SubscriptionStatus.CANCELLED }),
      ];

      // churn = 25% -> avgLifetime = 4 months; MRR = 300 -> LTV = 1200
      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.churn).toBe(25);
      expect(result.ltv).toBe(1200);
    });

    it('should return null LTV when churn is 0', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100 }),
        makeSubscription({ id: 'sub-2', amount: 100 }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.churn).toBe(0);
      expect(result.ltv).toBeNull();
    });
  });

  describe('ARPU', () => {
    it('should calculate ARPU as monthly revenue per active subscription', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', amount: 100 }),
        makeSubscription({ id: 'sub-2', amount: 50 }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.arpu).toBe(75);
    });

    it('should be 0 when there are no active subscriptions', () => {
      const result = SubscriptionAnalyticsService.calculate([], from, to);

      expect(result.arpu).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty subscriptions', () => {
      const result = SubscriptionAnalyticsService.calculate([], from, to);

      expect(result.mrr).toBe(0);
      expect(result.monthlyAmount).toBe(0);
      expect(result.arpu).toBe(0);
      expect(result.churn).toBe(0);
      expect(result.ltv).toBeNull();
      expect(result.activeCount).toBe(0);
      expect(result.cancelledCount).toBe(0);
    });

    it('should handle all-cancelled subscriptions', () => {
      const subscriptions = [
        makeSubscription({ id: 'sub-1', status: SubscriptionStatus.CANCELLED }),
        makeSubscription({ id: 'sub-2', status: SubscriptionStatus.CANCELLED }),
      ];

      const result = SubscriptionAnalyticsService.calculate(subscriptions, from, to);

      expect(result.mrr).toBe(0);
      expect(result.churn).toBe(100);
      expect(result.ltv).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.cancelledCount).toBe(2);
    });
  });
});
