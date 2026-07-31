import { ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';
import { AsaasPaymentProvider } from '@/infrastructure/payment/asaas.provider';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';

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
  );
}
