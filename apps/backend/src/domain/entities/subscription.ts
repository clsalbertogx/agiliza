import { type Either, failure, success } from '@/domain/types/either';
import { DomainError } from '../errors/domain-error';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAUSED = 'PAUSED',
  GRACE_PERIOD = 'GRACE_PERIOD',
  TRIAL = 'TRIAL',
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
  trialDays?: number;
  gracePeriodDays?: number;
  trialEndsAt?: Date;
  gracePeriodEndsAt?: Date;
  autoRenew?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: BillingCycle;
  trialDays?: number;
  gracePeriodDays?: number;
  autoRenew?: boolean;
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
  trialDays: number | null;
  gracePeriodDays: number | null;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  autoRenew: boolean | null;
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
  trialDays?: number;
  gracePeriodDays?: number;
  trialEndsAt?: string;
  gracePeriodEndsAt?: string;
  autoRenew?: boolean;
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

  if (!(input.nextBilling instanceof Date) || Number.isNaN(input.nextBilling.getTime())) {
    return failure(new DomainError('Invalid next billing date'));
  }

  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    return failure(new DomainError('Invalid start date'));
  }

  const trialDays = input.trialDays ?? 0;
  const gracePeriodDays = input.gracePeriodDays ?? 0;
  const autoRenew = input.autoRenew ?? true;

  if (trialDays < 0) {
    return failure(new DomainError('Trial days must be non-negative'));
  }

  if (gracePeriodDays < 0) {
    return failure(new DomainError('Grace period days must be non-negative'));
  }

  // Compute trial end date from startDate + trialDays
  const trialEndsAt = trialDays > 0 ? new Date(input.startDate.getTime() + trialDays * 86400000) : undefined;

  // Initial status: TRIAL if trialDays > 0, otherwise ACTIVE
  const initialStatus = trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE;

  const now = new Date();
  const subscription: Subscription = {
    id: input.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    plan: input.plan.trim(),
    amount: input.amount,
    billingCycle: input.billingCycle,
    status: initialStatus,
    nextBilling: input.nextBilling,
    startDate: input.startDate,
    endDate: undefined,
    cancelledAt: undefined,
    trialDays: trialDays > 0 ? trialDays : undefined,
    gracePeriodDays: gracePeriodDays > 0 ? gracePeriodDays : undefined,
    trialEndsAt,
    gracePeriodEndsAt: undefined,
    autoRenew,
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
    trialDays: data.trialDays ?? undefined,
    gracePeriodDays: data.gracePeriodDays ?? undefined,
    trialEndsAt: data.trialEndsAt ?? undefined,
    gracePeriodEndsAt: data.gracePeriodEndsAt ?? undefined,
    autoRenew: data.autoRenew ?? undefined,
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
    trialDays: subscription.trialDays ?? null,
    gracePeriodDays: subscription.gracePeriodDays ?? null,
    trialEndsAt: subscription.trialEndsAt ?? null,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt ?? null,
    autoRenew: subscription.autoRenew ?? null,
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
    trialDays: subscription.trialDays,
    gracePeriodDays: subscription.gracePeriodDays,
    trialEndsAt: subscription.trialEndsAt?.toISOString(),
    gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString(),
    autoRenew: subscription.autoRenew,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

export function updateSubscription(subscription: Subscription, updates: Partial<Subscription>): Subscription {
  return {
    ...subscription,
    ...updates,
    updatedAt: new Date(),
  };
}

export function startTrial(subscription: Subscription, trialDays: number): Subscription {
  if (trialDays <= 0) {
    throw new DomainError('Trial days must be positive');
  }
  const trialEndsAt = new Date(subscription.startDate.getTime() + trialDays * 86400000);
  return {
    ...subscription,
    status: SubscriptionStatus.TRIAL,
    trialDays,
    trialEndsAt,
    updatedAt: new Date(),
  };
}

export function enterGracePeriod(subscription: Subscription, days: number): Subscription {
  if (days <= 0) {
    throw new DomainError('Grace period days must be positive');
  }
  const gracePeriodEndsAt = new Date();
  gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + days);
  return {
    ...subscription,
    status: SubscriptionStatus.GRACE_PERIOD,
    gracePeriodDays: days,
    gracePeriodEndsAt,
    updatedAt: new Date(),
  };
}

export function hasActiveTrial(subscription: Subscription, now = new Date()): boolean {
  if (!subscription.trialEndsAt) return false;
  return now <= subscription.trialEndsAt;
}

export function isInGracePeriod(subscription: Subscription, now = new Date()): boolean {
  if (!subscription.gracePeriodEndsAt) return false;
  return now <= subscription.gracePeriodEndsAt;
}

export function cancelSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.CANCELLED,
    cancelledAt: new Date(),
    updatedAt: new Date(),
  };
}

export function expireSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.EXPIRED,
    endDate: new Date(),
    updatedAt: new Date(),
  };
}

export function renewSubscription(subscription: Subscription, nextBilling: Date, endDate?: Date): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.ACTIVE,
    nextBilling,
    ...(endDate !== undefined ? { endDate } : {}),
    updatedAt: new Date(),
  };
}

export function pauseSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.PAUSED,
    updatedAt: new Date(),
  };
}

export function resumeSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: SubscriptionStatus.ACTIVE,
    updatedAt: new Date(),
  };
}
