import { DomainError } from '../errors/domain-error';
import { Either, success, failure } from '@/domain/types/either';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAUSED = 'PAUSED',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  BIMONTHLY = 'BIMONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL',
}

export interface Subscription {
  id: string;
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  nextBilling: Date;
  startDate: Date;
  endDate?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: BillingCycle;
}

export interface PersistenceSubscription {
  id: string;
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  nextBilling: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionViewModel {
  id: string;
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: string;
  status: string;
  nextBilling: string;
  startDate: string;
  endDate?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function createSubscription(
  input: CreateSubscriptionInput & { id: string; nextBilling: Date; startDate: Date },
): Either<DomainError, Subscription> {
  if (!input.plan || input.plan.trim().length === 0) {
    return failure(new DomainError('Plan name is required'));
  }

  if (input.amount <= 0) {
    return failure(new DomainError('Amount must be positive'));
  }

  const validCycles = Object.values(BillingCycle);
  if (!validCycles.includes(input.billingCycle)) {
    return failure(new DomainError(`Invalid billing cycle: ${input.billingCycle}`));
  }

  if (!(input.nextBilling instanceof Date) || isNaN(input.nextBilling.getTime())) {
    return failure(new DomainError('Invalid next billing date'));
  }

  if (!(input.startDate instanceof Date) || isNaN(input.startDate.getTime())) {
    return failure(new DomainError('Invalid start date'));
  }

  const now = new Date();
  const subscription: Subscription = {
    id: input.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    plan: input.plan.trim(),
    amount: input.amount,
    billingCycle: input.billingCycle,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: input.nextBilling,
    startDate: input.startDate,
    endDate: undefined,
    cancelledAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  return success(subscription);
}

export function createSubscriptionFromPersistence(data: PersistenceSubscription): Subscription {
  return {
    id: data.id,
    tenantId: data.tenantId,
    clientId: data.clientId,
    plan: data.plan,
    amount: data.amount,
    billingCycle: data.billingCycle as BillingCycle,
    status: data.status as SubscriptionStatus,
    startDate: data.startDate,
    endDate: data.endDate ?? undefined,
    nextBilling: data.nextBilling,
    cancelledAt: data.cancelledAt ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscriptionToPersistence(subscription: Subscription): PersistenceSubscription {
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    clientId: subscription.clientId,
    plan: subscription.plan,
    amount: subscription.amount,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate ?? null,
    nextBilling: subscription.nextBilling,
    cancelledAt: subscription.cancelledAt ?? null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export function subscriptionToViewModel(subscription: Subscription): SubscriptionViewModel {
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    clientId: subscription.clientId,
    plan: subscription.plan,
    amount: subscription.amount,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    nextBilling: subscription.nextBilling.toISOString(),
    startDate: subscription.startDate.toISOString(),
    endDate: subscription.endDate?.toISOString(),
    cancelledAt: subscription.cancelledAt?.toISOString(),
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

export function updateSubscription(
  subscription: Subscription,
  updates: Partial<Subscription>,
): Subscription {
  return {
    ...subscription,
    ...updates,
    updatedAt: new Date(),
  };
}

export function cancelSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.CANCELLED,
    cancelledAt: new Date(),
    updatedAt: new Date(),
  };
}
