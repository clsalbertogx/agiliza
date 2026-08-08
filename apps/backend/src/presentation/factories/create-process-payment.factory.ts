import { ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { AsaasPaymentProvider } from '@/infrastructure/payment/asaas.provider';
import { PaymentProviderFactory } from '@/infrastructure/payment/payment-provider.factory';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';
import { createEncryptionService } from './create-encryption.factory';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';

export function createProcessPaymentUseCase(): ProcessPaymentUseCase {
  // F2: per-tenant resolution — a tenant with a Mercado Pago config is charged
  // via the MP gateway; tenants without config fall back to Asaas (env).
  const resolver = new PaymentProviderFactory(createPaymentProviderConfigRepository(), createEncryptionService());

  return new ProcessPaymentUseCase(
    new PrismaInvoiceRepository(),
    new PrismaClientRepository(),
    new PrismaPaymentRepository(),
    new AsaasPaymentProvider({
      apiKey: process.env.ASAAS_API_KEY || '',
      environment: (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    }),
    getEventBus(),
    resolver,
    new UuidV7Generator(),
  );
}
