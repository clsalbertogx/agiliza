import { ProcessPaymentWebhookUseCase } from '@/application/usecases/process-payment-webhook.usecase';
import { PerTenantHmacVerifier } from '@/infrastructure/payment/per-tenant-hmac-verifier';
import { AsaasWebhookParser } from '@/infrastructure/payment/asaas-webhook-parser';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';

export function createProcessPaymentWebhookUseCase(): ProcessPaymentWebhookUseCase {
  return new ProcessPaymentWebhookUseCase(
    new PerTenantHmacVerifier(),
    new AsaasWebhookParser(),
    new PrismaInvoiceRepository(),
    new InMemoryEventBus(),
  );
}
