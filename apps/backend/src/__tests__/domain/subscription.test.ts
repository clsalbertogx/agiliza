import { describe, it, expect } from 'vitest';
import {
  createSubscription,
  createSubscriptionFromPersistence,
  subscriptionToPersistence,
  subscriptionToViewModel,
  updateSubscription,
  cancelSubscription,
  SubscriptionStatus,
  BillingCycle,
  type Subscription,
} from '@/domain/entities/subscription';

describe('Subscription Domain Entity', () => {
  const validInput = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000010',
    clientId: '00000000-0000-0000-0000-000000000020',
    plan: 'Premium Plan',
    amount: 99.90,
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
        expect(result.value.amount).toBe(99.90);
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
        amount: 99.90,
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        startDate: now,
        endDate: null,
        nextBilling: new Date('2026-09-01'),
        cancelledAt: null,
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
        amount: 49.90,
        billingCycle: 'ANNUAL',
        status: 'CANCELLED',
        startDate: now,
        endDate: new Date('2027-08-01'),
        nextBilling: new Date('2026-09-01'),
        cancelledAt: new Date('2026-08-15'),
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
        amount: 99.90,
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
        amount: 49.90,
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
        amount: 99.90,
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
      expect(viewModel.amount).toBe(99.90);
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
        amount: 99.90,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        nextBilling: new Date('2026-09-01'),
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const updated = updateSubscription(subscription, { amount: 149.90 });

      expect(updated.amount).toBe(149.90);
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
        amount: 99.90,
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
});
