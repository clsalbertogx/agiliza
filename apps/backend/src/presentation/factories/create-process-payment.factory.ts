import { type PaymentGatewayFactory, ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { AsaasPaymentProvider } from '@/infrastructure/payment/asaas.provider';
import { PaymentProviderFactory } from '@/infrastructure/payment/payment-provider.factory';
import { createEncryptionService } from './create-encryption.factory';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';

const gatewayFactory: PaymentGatewayFactory = (config) => {
  return PaymentProviderFactory.create({
    type: 'asaas',
    apiKey: config.apiKey,
    environment: config.environment as 'sandbox' | 'production',
  });
};

export function createProcessPaymentUseCase(): ProcessPaymentUseCase {
  return new ProcessPaymentUseCase(
    new PrismaInvoiceRepository(),
    new PrismaClientRepository(),
    new PrismaPaymentRepository(),
    new AsaasPaymentProvider({
      apiKey: process.env.ASAAS_API_KEY || '',
      environment: (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    }),
    new InMemoryEventBus(),
    createPaymentProviderConfigRepository(),
    createEncryptionService(),
    gatewayFactory,
  );
}
