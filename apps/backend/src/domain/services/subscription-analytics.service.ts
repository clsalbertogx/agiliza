import { Subscription, SubscriptionStatus, BillingCycle } from '@/domain/entities/subscription';

/**
 * Aggregate revenue/retention metrics computed from subscription snapshots.
 */
export interface SubscriptionAnalytics {
  /** Monthly Recurring Revenue — sum of active subscription amounts normalized to monthly. */
  mrr: number;
  /** Average Revenue Per User — monthly revenue per active subscription. */
  arpu: number;
  /** Churn rate as % (0-100), 0 when there are no subscriptions. */
  churn: number;
  /** Lifetime Value in months of MRR — null when churn <= 0. */
  ltv: number | null;
  /** Number of active (ACTIVE + TRIAL) subscriptions. */
  activeCount: number;
  /** Number of cancelled subscriptions. */
  cancelledCount: number;
  /** Sum of active subscription amounts normalized to monthly (same as MRR). */
  monthlyAmount: number;
}

const MONTHLY_FACTOR: Record<BillingCycle, number> = {
  [BillingCycle.MONTHLY]: 1,
  [BillingCycle.BIMONTHLY]: 1 / 2,
  [BillingCycle.QUARTERLY]: 1 / 3,
  [BillingCycle.SEMIANNUAL]: 1 / 6,
  [BillingCycle.ANNUAL]: 1 / 12,
};

export class SubscriptionAnalyticsService {
  static calculate(subscriptions: Subscription[], _from: Date, _to: Date): SubscriptionAnalytics {
    const active = subscriptions.filter(
      (s) => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.TRIAL,
    );
    const cancelled = subscriptions.filter((s) => s.status === SubscriptionStatus.CANCELLED);

    const activeCount = active.length;
    const cancelledCount = cancelled.length;

    // MRR: sum of monthly-normalized amounts for active subscriptions
    let monthlyAmount = 0;
    for (const sub of active) {
      monthlyAmount += sub.amount * (MONTHLY_FACTOR[sub.billingCycle] ?? 1);
    }
    monthlyAmount = Math.round(monthlyAmount * 100) / 100;

    const churnRate = subscriptions.length > 0 ? (cancelledCount / subscriptions.length) * 100 : 0;
    const churn = Math.round(churnRate * 100) / 100;

    const arpu = activeCount > 0 ? Math.round((monthlyAmount / activeCount) * 100) / 100 : 0;

    let ltv: number | null = null;
    if (churnRate > 0) {
      const avgLifetime = 1 / (churnRate / 100); // months
      ltv = Math.round(monthlyAmount * avgLifetime * 100) / 100;
    }

    return {
      mrr: monthlyAmount,
      arpu,
      churn,
      ltv,
      activeCount,
      cancelledCount,
      monthlyAmount,
    };
  }
}
