import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, SubscriptionStatus, updateSubscription, startTrial } from '@/domain/entities/subscription';
import { ProrationService } from '@/domain/services/proration.service';
import { calculateNextBilling } from '@/domain/services/billing-cycle.service';
import { createInvoice, type Invoice } from '@/domain/entities/invoice';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface UpgradeSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  newPlan: string;
  newAmount: number;
  billingCycle?: Subscription['billingCycle'];
  trialDays?: number;
}

export class UpgradeSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: UpgradeSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Verify subscription is active
    if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIAL) {
      return failure(
        new ApplicationError(
          `Cannot upgrade subscription with status ${subscription.status}`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 3. Calculate prorated credit for unused portion of current cycle
    const now = new Date();
    const daysInCycle = this.getDaysInCycle(subscription.billingCycle);
    const daysUsed = this.calculateDaysUsed(subscription.nextBilling, now, subscription.billingCycle);
    const proratedCredit = ProrationService.calculateProratedAmount(
      subscription.amount,
      daysUsed,
      daysInCycle,
    );

    // 4. Calculate next billing date for new plan
    const nextBilling = calculateNextBilling(now, input.billingCycle ?? subscription.billingCycle);

    // 5. Create proration invoice (credit note if credit > 0, or debit invoice)
    if (proratedCredit > 0) {
      const creditInvoiceResult = await this.createCreditInvoice(subscription, proratedCredit);
      if (!creditInvoiceResult.success) {
        return failure(creditInvoiceResult.value);
      }
    }

    // 6. Update subscription with new plan details
    const updated = updateSubscription(subscription, {
      plan: input.newPlan,
      amount: input.newAmount,
      billingCycle: input.billingCycle ?? subscription.billingCycle,
      nextBilling,
      updatedAt: new Date(),
    });

    // 7. If trialDays provided, start a new trial
    let finalSubscription = updated;
    if (input.trialDays && input.trialDays > 0) {
      finalSubscription = startTrial(updated, input.trialDays);
    }

    // 8. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        plan: finalSubscription.plan,
        amount: finalSubscription.amount,
        billingCycle: finalSubscription.billingCycle,
        nextBilling: finalSubscription.nextBilling,
        status: finalSubscription.status,
        trialDays: finalSubscription.trialDays,
        trialEndsAt: finalSubscription.trialEndsAt,
        updatedAt: finalSubscription.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 9. Publish event
    const event = createDomainEvent(
      'subscription.updated',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        metadata: {
          subscriptionId: saved.id,
          previousPlan: subscription.plan,
          newPlan: saved.plan,
          previousAmount: subscription.amount,
          newAmount: saved.amount,
          proratedCredit,
          billingCycle: saved.billingCycle,
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }

  private getDaysInCycle(billingCycle: Subscription['billingCycle']): number {
    switch (billingCycle) {
      case 'MONTHLY': return 30;
      case 'BIMONTHLY': return 60;
      case 'QUARTERLY': return 90;
      case 'SEMIANNUAL': return 180;
      case 'ANNUAL': return 365;
      default: return 30;
    }
  }

  private calculateDaysUsed(nextBilling: Date, now: Date, billingCycle: Subscription['billingCycle']): number {
    const cycleStart = new Date(nextBilling);
    // For monthly and similar, the cycle started after the previous nextBilling
    // Days used = days since the start of the current billing cycle
    const diffMs = now.getTime() - cycleStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  private async createCreditInvoice(
    subscription: Subscription,
    creditAmount: number,
  ): Promise<Either<ApplicationError, Invoice>> {
    const invoiceId = this.idGenerator.generate();
    const dueDate = new Date();

    const invoiceResult = createInvoice({
      id: invoiceId,
      tenantId: subscription.tenantId,
      clientId: subscription.clientId,
      amount: creditAmount,
      dueDate,
      description: `Proration credit for ${subscription.plan} plan upgrade`,
    });

    if (!invoiceResult.success) {
      return failure(new ApplicationError(invoiceResult.value.message, 'INVALID_INVOICE', 400));
    }

    try {
      return success(await this.invoiceRepo.create(invoiceResult.value));
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }
  }
}
