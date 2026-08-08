import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { PaymentWebhookParserPort } from '@/application/ports/gateways/payment-webhook-parser.port';
import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { type Either, failure, isFailure, success } from '@/application/types/either';
import { InvoiceStatus, updateInvoice } from '@/domain/entities/invoice';
import { createPayment, PaymentStatus, updatePayment } from '@/domain/entities/payment';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

export interface ProcessPaymentWebhookInput {
  provider: string;
  rawBody: string;
  signature: string;
  tenantId: string;
}

export interface ProcessPaymentWebhookOutput {
  received: boolean;
  provider: string;
}

export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly verifier: WebhookVerifierPort,
    private readonly parser: PaymentWebhookParserPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: ProcessPaymentWebhookInput): Promise<Either<ApplicationError, ProcessPaymentWebhookOutput>> {
    // 1. Verify webhook signature
    const verification = await this.verifier.verify(input.provider, input.rawBody, input.signature, input.tenantId);

    if (isFailure(verification)) {
      return failure(verification.value);
    }

    if (!verification.value) {
      return failure(new ApplicationError('Invalid webhook signature', 'UNAUTHORIZED', 401));
    }

    // 2. Parse webhook payload
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(input.rawBody);
    } catch {
      return failure(ApplicationError.validation('Invalid webhook payload — unable to parse body'));
    }

    const webhookData = this.parser.parse(input.provider, body);

    // If we can't parse the event (unknown event type / provider), acknowledge receipt
    if (!webhookData) {
      return success({ received: true, provider: input.provider });
    }

    // 3. Process based on status
    if (webhookData.status === 'confirmed' && webhookData.invoiceId) {
      // Find invoice (tenant-scoped)
      const invoice = await this.invoiceRepo.findById(webhookData.invoiceId, input.tenantId);

      if (invoice && invoice.status !== InvoiceStatus.PAID) {
        // Update invoice status to PAID using domain function
        const updatedInvoice = updateInvoice(invoice, {
          status: InvoiceStatus.PAID,
          paidAt: webhookData.paidAt || new Date(),
          externalPaymentId: webhookData.providerPaymentId,
        });

        await this.invoiceRepo.update(updatedInvoice);

        // Record payment
        const paymentResult = createPayment({
          id: this.idGenerator.generate(),
          tenantId: input.tenantId,
          invoiceId: webhookData.invoiceId,
          clientId: invoice.clientId,
          amount: webhookData.amount ?? Number(invoice.amount),
          provider: input.provider as any,
          externalId: webhookData.providerPaymentId,
          paymentMethod: invoice.paymentMethod || 'PIX',
        });

        if (!isFailure(paymentResult)) {
          const confirmedPayment = updatePayment(paymentResult.value, {
            status: PaymentStatus.CONFIRMED,
            webhookReceivedAt: new Date(),
          });
          await this.paymentRepo.create(confirmedPayment);
        }

        // Publish payment.confirmed event
        const event = createDomainEvent(
          'payment.confirmed',
          {
            clientId: invoice.clientId,
            tenantId: input.tenantId,
            invoiceId: webhookData.invoiceId,
            metadata: {
              amount: webhookData.amount,
              provider: input.provider,
              providerPaymentId: webhookData.providerPaymentId,
            },
          },
          this.idGenerator.generate(),
        );
        this.eventBus.publish(event);
      }
    }

    return success({ received: true, provider: input.provider });
  }
}
