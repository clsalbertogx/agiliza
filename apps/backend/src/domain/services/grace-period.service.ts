import { type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';

export class GracePeriodService {
  static isInGracePeriod(subscription: Subscription, now = new Date()): boolean {
    if (!subscription.gracePeriodEndsAt) return false;
    return now <= subscription.gracePeriodEndsAt;
  }

  static enterGracePeriod(subscription: Subscription, days: number): Subscription {
    const graceEndsAt = new Date();
    graceEndsAt.setDate(graceEndsAt.getDate() + days);
    return {
      ...subscription,
      status: SubscriptionStatus.GRACE_PERIOD,
      gracePeriodEndsAt: graceEndsAt,
      gracePeriodDays: days,
      updatedAt: new Date(),
    };
  }

  static hasActiveTrial(subscription: Subscription, now = new Date()): boolean {
    if (!subscription.trialEndsAt) return false;
    return now <= subscription.trialEndsAt;
  }
}
