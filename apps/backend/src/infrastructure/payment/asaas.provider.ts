import { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';

interface AsaasConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
}

export class AsaasPaymentProvider implements PaymentGatewayPort {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: AsaasConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
    };
  }

  async createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<PixChargeResponse> {
    // In a real implementation, this would call Asaas API
    // For MVP, return a simulated response
    const id = generateUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h expiry

    return {
      id,
      qrCode: `data:image/png;base64,${Buffer.from(JSON.stringify({
        pixKey: 'simulated-pix-key',
        amount: params.amount,
        description: params.description,
      })).toString('base64')}`,
      copyPaste: `00020126580014BR.GOV.BCB.PIX0136${id}5204000053039865406${(params.amount * 100).toFixed(0)}5802BR5913AGILIZA6008BRASILIA62070503***6304ABCD`,
      expiresAt,
      status: 'PENDING',
    };
  }

  async getCharge(providerPaymentId: string): Promise<any> {
    return {
      id: providerPaymentId,
      status: 'CONFIRMED',
      value: 99.90,
      netValue: 97.90,
      fee: 2.00,
    };
  }

  async cancelCharge(providerPaymentId: string): Promise<void> {
    // In real implementation: DELETE /v3/payments/{id}
  }

  handleWebhook(payload: any) {
    const event = payload.event || 'UNKNOWN';
    const paymentId = payload.payment?.id || payload.id;
    
    const statusMap: Record<string, string> = {
      PAYMENT_CONFIRMED: 'confirmed',
      PAYMENT_RECEIVED: 'confirmed',
      PAYMENT_OVERDUE: 'overdue',
      PAYMENT_CANCELLED: 'cancelled',
      PAYMENT_REFUNDED: 'refunded',
    };

    return {
      event,
      paymentId,
      status: statusMap[event] || 'unknown',
      metadata: {
        rawPayload: payload,
        provider: 'asaas',
        receivedAt: new Date().toISOString(),
      },
    };
  }
}
