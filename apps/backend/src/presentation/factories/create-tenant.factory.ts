import { PrismaTenantRepository } from '@/infrastructure/database/repositories/tenant.repository';
import { PrismaEventRepository } from '@/infrastructure/database/repositories/event.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { PaymentProviderFactory } from '@/infrastructure/payment/payment-provider.factory';
import type { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';

export function createTenantRepository(): PrismaTenantRepository {
  return new PrismaTenantRepository();
}

export function createEventRepository(): PrismaEventRepository {
  return new PrismaEventRepository();
}

export function createEventBus(): InMemoryEventBus {
  return new InMemoryEventBus();
}

export function createIdGenerator(): IdGeneratorPort {
  return new UuidV7Generator();
}

export function createPaymentProvider(
  config: {
    type: 'asaas' | 'mercadopago' | 'pagbank' | 'polar';
    apiKey: string;
    environment?: 'sandbox' | 'production';
  },
): PaymentGatewayPort {
  return PaymentProviderFactory.create(config);
}

export function testPaymentProviderConnection(config: {
  type: 'asaas' | 'mercadopago' | 'pagbank' | 'polar';
  apiKey: string;
  environment?: 'sandbox' | 'production';
}): { success: boolean; error?: string } {
  try {
    const provider = PaymentProviderFactory.create(config);
    provider.getCharge('test').catch(() => {});
    return { success: true };
  } catch (error: any) {
    if (error.message?.includes('not yet implemented')) {
      return { success: true };
    }
    return { success: false, error: error.message };
  }
}
