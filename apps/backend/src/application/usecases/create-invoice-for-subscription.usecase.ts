import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { logger } from '@/config/logger';
import { type Invoice, InvoiceStatus } from '@/domain/entities/invoice';
import { calculateNextBilling, getReferenceMonth } from '@/domain/services/billing-cycle.service';

export interface RecurringInvoiceResult {
  created: number;
  skipped: number;
  errors: number;
}

export class CreateInvoiceForSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(): Promise<RecurringInvoiceResult> {
    const now = new Date();
    const subscriptions = await this.subscriptionRepo.findActiveByNextBillingBefore(now);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const refMonth = getReferenceMonth(sub.nextBilling);

        // Idempotency check: skip if invoice already exists for this month
        const existing = await this.invoiceRepo.findExistingForSubscription(sub.id, refMonth);
        if (existing) {
          skipped++;
          continue;
        }

        // Verify client still exists
        const client = await this.clientRepo.findById(sub.clientId, sub.tenantId);
        if (!client) {
          errors++;
          continue;
        }

        // Create invoice linked to subscription
        const invoice: Invoice = {
          id: crypto.randomUUID(),
          tenantId: sub.tenantId,
          clientId: sub.clientId,
          subscriptionId: sub.id,
          amount: sub.amount,
          dueDate: sub.nextBilling,
          description: `${sub.plan} - ${refMonth}`,
          status: InvoiceStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const saved = await this.invoiceRepo.create(invoice);

        // Update next billing date
        const nextBilling = calculateNextBilling(sub.nextBilling, sub.billingCycle);
        await this.subscriptionRepo.update(sub.id, { nextBilling });

        // Publish event
        this.eventBus.publish({
          eventType: 'subscription.invoice.created',
          eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          clientId: sub.clientId,
          tenantId: sub.tenantId,
          invoiceId: saved.id,
          timestamp: new Date().toISOString(),
          metadata: {
            subscriptionId: sub.id,
            amount: sub.amount,
            refMonth,
          },
        });

        created++;
      } catch (error) {
        // Recoverable: a single failing subscription must not abort the batch.
        // Logged as an error for operator visibility; the count drives alerting.
        logger.error({ err: error }, `[CreateInvoiceForSubscription] Error for subscription ${sub.id}:`);
        errors++;
      }
    }

    return { created, skipped, errors };
  }
}
