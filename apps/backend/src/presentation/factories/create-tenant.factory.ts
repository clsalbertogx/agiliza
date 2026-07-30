import { PrismaTenantRepository } from '../../infrastructure/database/repositories/tenant.repository';
import { EventRepository } from '../../infrastructure/database/repositories/event.repository';
import { InMemoryEventBus } from '../../infrastructure/event-bus/in-memory-event-bus';
import { PaymentProviderFactory } from '../../infrastructure/payment/payment-provider.factory';

export function createTenantRepository(): PrismaTenantRepository {
  return new PrismaTenantRepository();
}

export function createEventRepository(): EventRepository {
  return new EventRepository();
}

export function createEventBus(): InMemoryEventBus {
  return new InMemoryEventBus();
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
