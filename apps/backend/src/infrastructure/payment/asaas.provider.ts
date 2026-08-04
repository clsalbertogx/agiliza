import type {
  BoletoChargeInput,
  BoletoChargeResponse,
  CreditCardChargeInput,
  CreditCardChargeResponse,
  PaymentGatewayPort,
  PixChargeResponse,
} from '@/application/ports/payment-gateway.port';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';

interface AsaasConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

export class AsaasPaymentProvider implements PaymentGatewayPort {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: AsaasConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl =
      config.environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
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
      qrCode: `data:image/png;base64,${Buffer.from(
        JSON.stringify({
          pixKey: 'simulated-pix-key',
          amount: params.amount,
          description: params.description,
        }),
      ).toString('base64')}`,
      copyPaste: `00020126580014BR.GOV.BCB.PIX0136${id}5204000053039865406${(params.amount * 100).toFixed(0)}5802BR5913AGILIZA6008BRASILIA62070503***6304ABCD`,
      expiresAt,
      status: 'PENDING',
    };
  }

  async getCharge(providerPaymentId: string): Promise<any> {
    return {
      id: providerPaymentId,
      status: 'CONFIRMED',
      value: 99.9,
      netValue: 97.9,
      fee: 2.0,
    };
  }

  async cancelCharge(_providerPaymentId: string): Promise<void> {
    // In real implementation: DELETE /v3/payments/{id}
  }

  async createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse> {
    const id = generateUUID();
    return {
      id,
      status: 'CONFIRMED',
      amount: input.amount,
      currency: 'BRL',
      paymentMethod: 'CREDIT_CARD',
      fee: input.amount * 0.02,
      netAmount: input.amount * 0.98,
    };
  }

  async createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse> {
    const id = generateUUID();
    const now = new Date();
    return {
      id,
      status: 'PENDING',
      amount: input.amount,
      currency: 'BRL',
      barcode: `001${(input.amount * 100).toFixed(0).padStart(10, '0')}`,
      boletoUrl: `${this.baseUrl}/boletos/${id}/boleto.pdf`,
      dueDate: input.dueDate || new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    };
  }

  async verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean> {
    if (provider !== 'asaas') return false;
    const { createHmac, timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
    const secret = process.env.ASAAS_WEBHOOK_SECRET || '';
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
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
