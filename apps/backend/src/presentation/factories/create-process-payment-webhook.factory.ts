import { ProcessPaymentWebhookUseCase } from '@/application/usecases/process-payment-webhook.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { AsaasWebhookParser } from '@/infrastructure/payment/asaas-webhook-parser';
import { PerTenantHmacVerifier } from '@/infrastructure/payment/per-tenant-hmac-verifier';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createProcessPaymentWebhookUseCase(): ProcessPaymentWebhookUseCase {
  return new ProcessPaymentWebhookUseCase(
    new PerTenantHmacVerifier(),
    new AsaasWebhookParser(),
    new PrismaInvoiceRepository(),
    new PrismaPaymentRepository(),
    getEventBus(),
    new UuidV7Generator(),
  );
}
