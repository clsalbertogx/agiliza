import { BillingCycle } from '@/domain/entities/subscription';

export function calculateNextBilling(currentBilling: Date, cycle: BillingCycle): Date {
  const next = new Date(currentBilling);
  switch (cycle) {
    case BillingCycle.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case BillingCycle.BIMONTHLY:
      next.setMonth(next.getMonth() + 2);
      break;
    case BillingCycle.QUARTERLY:
      next.setMonth(next.getMonth() + 3);
      break;
    case BillingCycle.SEMIANNUAL:
      next.setMonth(next.getMonth() + 6);
      break;
    case BillingCycle.ANNUAL:
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export function getReferenceMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
