import { describe, expect, it } from 'vitest';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import { GracePeriodService } from '@/domain/services/grace-period.service';

describe('GracePeriodService', () => {
  const baseSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000010',
    clientId: '00000000-0000-0000-0000-000000000020',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };

  describe('hasActiveTrial', () => {
    it('should return true when trialEndsAt is in the future', () => {
      const sub = {
        ...baseSubscription,
        trialEndsAt: new Date('2026-09-01'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.hasActiveTrial(sub, now)).toBe(true);
    });

    it('should return true when trialEndsAt equals now (inclusive boundary)', () => {
      const now = new Date('2026-08-15');
      const sub = {
        ...baseSubscription,
        trialEndsAt: now,
      };
      expect(GracePeriodService.hasActiveTrial(sub, now)).toBe(true);
    });

    it('should return false when trialEndsAt is in the past', () => {
      const sub = {
        ...baseSubscription,
        trialEndsAt: new Date('2026-08-01'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.hasActiveTrial(sub, now)).toBe(false);
    });

    it('should return false when trialEndsAt is not set', () => {
      const sub = { ...baseSubscription, status: SubscriptionStatus.ACTIVE };
      expect(GracePeriodService.hasActiveTrial(sub)).toBe(false);
    });

    it('should return false when trialEndsAt is invalid', () => {
      const sub = {
        ...baseSubscription,
        trialEndsAt: new Date('invalid'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.hasActiveTrial(sub, now)).toBe(false);
    });
  });

  describe('isInGracePeriod', () => {
    it('should return true when gracePeriodEndsAt is in the future', () => {
      const sub = {
        ...baseSubscription,
        gracePeriodEndsAt: new Date('2026-09-01'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.isInGracePeriod(sub, now)).toBe(true);
    });

    it('should return true when gracePeriodEndsAt equals now (inclusive boundary)', () => {
      const now = new Date('2026-08-15');
      const sub = {
        ...baseSubscription,
        gracePeriodEndsAt: now,
      };
      expect(GracePeriodService.isInGracePeriod(sub, now)).toBe(true);
    });

    it('should return false when gracePeriodEndsAt is in the past', () => {
      const sub = {
        ...baseSubscription,
        gracePeriodEndsAt: new Date('2026-08-01'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.isInGracePeriod(sub, now)).toBe(false);
    });

    it('should return false when gracePeriodEndsAt is not set', () => {
      const sub = { ...baseSubscription, status: SubscriptionStatus.ACTIVE };
      expect(GracePeriodService.isInGracePeriod(sub)).toBe(false);
    });

    it('should return false when gracePeriodEndsAt is invalid', () => {
      const sub = {
        ...baseSubscription,
        gracePeriodEndsAt: new Date('invalid'),
      };
      const now = new Date('2026-08-15');
      expect(GracePeriodService.isInGracePeriod(sub, now)).toBe(false);
    });
  });

  describe('enterGracePeriod', () => {
    it('should set status to GRACE_PERIOD and set gracePeriodEndsAt', () => {
      const sub = { ...baseSubscription, status: SubscriptionStatus.EXPIRED };
      const result = GracePeriodService.enterGracePeriod(sub, 7);

      expect(result.status).toBe(SubscriptionStatus.GRACE_PERIOD);
      expect(result.gracePeriodEndsAt).toBeInstanceOf(Date);
      expect(result.gracePeriodDays).toBe(7);
    });

    it('should set gracePeriodEndsAt to days from the current date', () => {
      const sub = { ...baseSubscription, status: SubscriptionStatus.EXPIRED };
      const before = new Date();
      const result = GracePeriodService.enterGracePeriod(sub, 7);
      const after = new Date();

      expect(result.gracePeriodEndsAt).toBeInstanceOf(Date);
      if (result.gracePeriodEndsAt) {
        expect(result.gracePeriodEndsAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + 6 * 86400000);
        expect(result.gracePeriodEndsAt.getTime()).toBeLessThanOrEqual(after.getTime() + 8 * 86400000);
      }
    });
  });
});
