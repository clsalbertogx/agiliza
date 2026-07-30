import { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import { AsaasPaymentProvider } from './asaas.provider';

type ProviderType = 'asaas' | 'mercadopago' | 'pagbank' | 'polar';

interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  environment?: 'sandbox' | 'production';
}

export class PaymentProviderFactory {
  static create(config: ProviderConfig): PaymentGatewayPort {
    switch (config.type) {
      case 'asaas':
        return new AsaasPaymentProvider({
          apiKey: config.apiKey,
          environment: config.environment || 'sandbox',
        });
      case 'mercadopago':
        throw new Error('Mercado Pago provider not yet implemented');
      case 'pagbank':
        throw new Error('PagBank provider not yet implemented');
      case 'polar':
        throw new Error('Polar provider not yet implemented');
      default:
        throw new Error(`Unknown payment provider: ${config.type}`);
    }
  }
}
