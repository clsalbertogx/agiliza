import { describe, expect, it } from 'vitest';
import {
  BillingCycle,
  cancelSubscription,
  createSubscription,
  createSubscriptionFromPersistence,
  enterGracePeriod,
  hasActiveTrial,
  isInGracePeriod,
  type Subscription,
  SubscriptionStatus,
  startTrial,
  subscriptionToPersistence,
  subscriptionToViewModel,
  updateSubscription,
} from '@/domain/entities/subscription';

describe('Subscription Domain Entity', () => {
  const validInput = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000010',
    clientId: '00000000-0000-0000-0000-000000000020',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
  };

  describe('createSubscription', () => {
    it('should create a subscription with valid input', () => {
      const result = createSubscription(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe(validInput.id);
        expect(result.value.tenantId).toBe(validInput.tenantId);
        expect(result.value.clientId).toBe(validInput.clientId);
        expect(result.value.plan).toBe('Premium Plan');
        expect(result.value.amount).toBe(99.9);
        expect(result.value.billingCycle).toBe(BillingCycle.MONTHLY);
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result.value.nextBilling).toEqual(validInput.nextBilling);
        expect(result.value.startDate).toEqual(validInput.startDate);
        expect(result.value.cancelledAt).toBeUndefined();
        expect(result.value.endDate).toBeUndefined();
        expect(result.value.createdAt).toBeInstanceOf(Date);
        expect(result.value.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should fail when plan name is empty', () => {
      const result = createSubscription({ ...validInput, plan: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Plan name is required');
      }
    });

    it('should fail when plan name is only whitespace', () => {
      const result = createSubscription({ ...validInput, plan: '   ' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Plan name is required');
      }
    });

    it('should fail when amount is zero', () => {
      const result = createSubscription({ ...validInput, amount: 0 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Amount must be positive');
      }
    });

    it('should fail when amount is negative', () => {
      const result = createSubscription({ ...validInput, amount: -10 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Amount must be positive');
      }
    });

    it('should fail when billing cycle is invalid', () => {
      const result = createSubscription({ ...validInput, billingCycle: 'INVALID' as BillingCycle });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Invalid billing cycle');
      }
    });

    it('should fail when nextBilling is invalid', () => {
      const result = createSubscription({ ...validInput, nextBilling: new Date('invalid') });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Invalid next billing date');
      }
    });

    it('should fail when startDate is invalid', () => {
      const result = createSubscription({ ...validInput, startDate: new Date('invalid') });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Invalid start date');
      }
    });

    it('should trim plan name', () => {
      const result = createSubscription({ ...validInput, plan: '  Basic Plan  ' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.plan).toBe('Basic Plan');
      }
    });
  });

  describe('createSubscriptionFromPersistence', () => {
    it('should restore a subscription from persistence data', () => {
      const now = new Date();
      const persistence = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        startDate: now,
        endDate: null,
        nextBilling: new Date('2026-09-01'),
        cancelledAt: null,
        trialDays: null,
        gracePeriodDays: null,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        autoRenew: null,
        createdAt: now,
        updatedAt: now,
      };

      const subscription = createSubscriptionFromPersistence(persistence);

      expect(subscription.id).toBe(persistence.id);
      expect(subscription.plan).toBe('Premium Plan');
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.billingCycle).toBe(BillingCycle.MONTHLY);
      expect(subscription.endDate).toBeUndefined();
      expect(subscription.cancelledAt).toBeUndefined();
    });

    it('should handle nullable fields as undefined', () => {
      const now = new Date();
      const persistence = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Basic',
        amount: 49.9,
        billingCycle: 'ANNUAL',
        status: 'CANCELLED',
        startDate: now,
        endDate: new Date('2027-08-01'),
        nextBilling: new Date('2026-09-01'),
        cancelledAt: new Date('2026-08-15'),
        trialDays: 14,
        gracePeriodDays: null,
        trialEndsAt: new Date('2026-08-15'),
        gracePeriodEndsAt: null,
        autoRenew: null,
        createdAt: now,
        updatedAt: now,
      };

      const subscription = createSubscriptionFromPersistence(persistence);

      expect(subscription.status).toBe(SubscriptionStatus.CANCELLED);
      expect(subscription.endDate).toBeInstanceOf(Date);
      expect(subscription.cancelledAt).toBeInstanceOf(Date);
    });
  });

  describe('subscriptionToPersistence', () => {
    it('should convert a subscription to persistence format', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const persistence = subscriptionToPersistence(subscription);

      expect(persistence.plan).toBe('Premium Plan');
      expect(persistence.status).toBe('ACTIVE');
      expect(persistence.endDate).toBeNull();
      expect(persistence.cancelledAt).toBeNull();
    });

    it('should convert optional dates to null in persistence', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Basic',
        amount: 49.9,
        billingCycle: BillingCycle.ANNUAL,
        status: SubscriptionStatus.CANCELLED,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        endDate: new Date('2027-08-01'),
        cancelledAt: new Date('2026-08-15'),
        createdAt: now,
        updatedAt: now,
      };

      const persistence = subscriptionToPersistence(subscription);

      expect(persistence.endDate).toBeInstanceOf(Date);
      expect(persistence.cancelledAt).toBeInstanceOf(Date);
    });
  });

  describe('subscriptionToViewModel', () => {
    it('should convert to view model with ISO date strings', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const viewModel = subscriptionToViewModel(subscription);

      expect(viewModel.id).toBe(subscription.id);
      expect(viewModel.plan).toBe('Premium Plan');
      expect(viewModel.amount).toBe(99.9);
      expect(viewModel.billingCycle).toBe('MONTHLY');
      expect(viewModel.status).toBe('ACTIVE');
      expect(viewModel.nextBilling).toBe('2026-09-01T00:00:00.000Z');
      expect(viewModel.startDate).toBe(now.toISOString());
      expect(viewModel.cancelledAt).toBeUndefined();
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription fields', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const updated = updateSubscription(subscription, { amount: 149.9 });

      expect(updated.amount).toBe(149.9);
      expect(updated.plan).toBe('Premium Plan');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });
  });

  describe('cancelSubscription', () => {
    it('should set status to CANCELLED and set cancelledAt', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const cancelled = cancelSubscription(subscription);

      expect(cancelled.status).toBe(SubscriptionStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(cancelled.updatedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(cancelled.id).toBe(subscription.id);
    });
  });

  describe('Trial and Grace Period fields', () => {
    it('should create subscription with default autoRenew true and no trial', () => {
      const result = createSubscription(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.autoRenew).toBe(true);
        expect(result.value.trialDays).toBeUndefined();
        expect(result.value.trialEndsAt).toBeUndefined();
        expect(result.value.gracePeriodDays).toBeUndefined();
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
      }
    });

    it('should create subscription in TRIAL status when trialDays > 0', () => {
      const result = createSubscription({
        ...validInput,
        trialDays: 7,
        gracePeriodDays: 5,
        autoRenew: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe(SubscriptionStatus.TRIAL);
        expect(result.value.trialDays).toBe(7);
        expect(result.value.gracePeriodDays).toBe(5);
        expect(result.value.autoRenew).toBe(false);
        expect(result.value.trialEndsAt).toBeInstanceOf(Date);
        // trialEndsAt = startDate + 7 days
        expect(result.value.trialEndsAt?.getTime()).toBe(validInput.startDate.getTime() + 7 * 86400000);
      }
    });

    it('should reject negative trialDays', () => {
      const result = createSubscription({ ...validInput, trialDays: -1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Trial days must be non-negative');
      }
    });

    it('should reject negative gracePeriodDays', () => {
      const result = createSubscription({ ...validInput, gracePeriodDays: -1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.value.message).toContain('Grace period days must be non-negative');
      }
    });
  });

  describe('startTrial', () => {
    it('should set status to TRIAL and compute trialEndsAt from startDate', () => {
      const now = new Date('2026-08-01');
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const trial = startTrial(subscription, 14);

      expect(trial.status).toBe(SubscriptionStatus.TRIAL);
      expect(trial.trialDays).toBe(14);
      expect(trial.trialEndsAt).toBeInstanceOf(Date);
      expect(trial.trialEndsAt?.getTime()).toBe(now.getTime() + 14 * 86400000);
    });

    it('should throw when trialDays is not positive', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      expect(() => startTrial(subscription, 0)).toThrow('Trial days must be positive');
    });
  });

  describe('enterGracePeriod', () => {
    it('should set status to GRACE_PERIOD and set gracePeriodEndsAt', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.EXPIRED,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const grace = enterGracePeriod(subscription, 5);

      expect(grace.status).toBe(SubscriptionStatus.GRACE_PERIOD);
      expect(grace.gracePeriodDays).toBe(5);
      expect(grace.gracePeriodEndsAt).toBeInstanceOf(Date);
    });

    it('should throw when days is not positive', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.EXPIRED,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      expect(() => enterGracePeriod(subscription, 0)).toThrow('Grace period days must be positive');
    });
  });

  describe('hasActiveTrial', () => {
    it('should return true when trialEndsAt is in the future', () => {
      const now = new Date('2026-08-15');
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.TRIAL,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        trialEndsAt: new Date('2026-09-01'),
        createdAt: now,
        updatedAt: now,
      };

      expect(hasActiveTrial(subscription, new Date('2026-08-15'))).toBe(true);
    });

    it('should return false when trialEndsAt is in the past', () => {
      const now = new Date('2026-08-15');
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.TRIAL,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        trialEndsAt: new Date('2026-08-01'),
        createdAt: now,
        updatedAt: now,
      };

      expect(hasActiveTrial(subscription, new Date('2026-08-15'))).toBe(false);
    });

    it('should return false when trialEndsAt is not set', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      expect(hasActiveTrial(subscription)).toBe(false);
    });
  });

  describe('isInGracePeriod', () => {
    it('should return true when gracePeriodEndsAt is in the future', () => {
      const now = new Date('2026-08-15');
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.GRACE_PERIOD,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        gracePeriodEndsAt: new Date('2026-09-01'),
        createdAt: now,
        updatedAt: now,
      };

      expect(isInGracePeriod(subscription, new Date('2026-08-15'))).toBe(true);
    });

    it('should return false when gracePeriodEndsAt is in the past', () => {
      const now = new Date('2026-08-15');
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.GRACE_PERIOD,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        gracePeriodEndsAt: new Date('2026-08-01'),
        createdAt: now,
        updatedAt: now,
      };

      expect(isInGracePeriod(subscription, new Date('2026-08-15'))).toBe(false);
    });

    it('should return false when gracePeriodEndsAt is not set', () => {
      const now = new Date();
      const subscription: Subscription = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000010',
        clientId: '00000000-0000-0000-0000-000000000020',
        plan: 'Premium Plan',
        amount: 99.9,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      expect(isInGracePeriod(subscription)).toBe(false);
    });
  });
});
