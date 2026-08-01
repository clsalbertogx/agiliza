import type {
  PaymentGatewayPort,
  PixChargeResponse,
  CreditCardChargeInput,
  CreditCardChargeResponse,
  BoletoChargeInput,
  BoletoChargeResponse,
} from '@/application/ports/payment-gateway.port';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal contract surface that the Polar API client must expose.
 * Tests supply a fake via `clientFactory` and never load real HTTP.
 */
export interface PolarClient {
  createCheckout(body: unknown): Promise<unknown>;
  getCheckout(id: string): Promise<unknown>;
  cancelCheckout(id: string): Promise<unknown>;
}

export type PolarClientFactory = (accessToken: string) => PolarClient;

interface PolarConfigOptions {
  accessToken: string;
  environment?: 'sandbox' | 'production';
  webhookSecret?: string;
  /** Inject a custom client factory (used by tests). Production uses the real fetch-based client. */
  clientFactory?: PolarClientFactory;
}

// ──────────────────────────────────────────────────────────────────────────
// Real fetch-based client (production)
// ──────────────────────────────────────────────────────────────────────────

let _realPolarClientFactory: PolarClientFactory | null = null;
function realPolarClientFactory(): PolarClientFactory {
  if (!_realPolarClientFactory) {
    _realPolarClientFactory = (token: string) => {
      const baseUrl = 'https://api.polar.sh/v1';

      return {
        async createCheckout(body: unknown) {
          const response = await fetch(`${baseUrl}/checkouts`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`Polar API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
        async getCheckout(id: string) {
          const response = await fetch(`${baseUrl}/checkouts/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`Polar API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
        async cancelCheckout(id: string) {
          const response = await fetch(`${baseUrl}/checkouts/${id}/cancel`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`Polar API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
      };
    };
  }
  return _realPolarClientFactory;
}

/**
 * Polar payment gateway — Strategy Pattern implementation of PaymentGatewayPort.
 *
 * Credentials:
 *   - accessToken (required): Polar API token (Bearer).
 *   - webhookSecret (optional): used for `verifyWebhook` HMAC validation.
 */
export class PolarGateway implements PaymentGatewayPort {
  private readonly client: PolarClient;
  private readonly accessToken: string;
  private readonly webhookSecret: string;

  constructor(options: PolarConfigOptions) {
    if (!options.accessToken) {
      throw new Error('Polar accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.webhookSecret = options.webhookSecret || '';

    const factory = options.clientFactory || realPolarClientFactory();
    this.client = factory(this.accessToken);
  }

  // ────────────────────────────────────────────────────────────────────────
  // PIX
  // ────────────────────────────────────────────────────────────────────────

  async createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<PixChargeResponse> {
    try {
      const checkout = (await this.client.createCheckout({
        product_price_id: params.externalReference,
        amount: Math.round(params.amount * 100),
        currency: 'BRL',
        customer_id: params.customerId,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing?success=true`,
        metadata: {
          description: params.description,
        },
      })) as Record<string, any>;

      const paymentMethod = checkout?.payment_method ?? {};

      return {
        id: String(checkout?.id ?? ''),
        qrCode: paymentMethod?.pix?.qr_code || paymentMethod?.qr_code || '',
        copyPaste: paymentMethod?.pix?.qr_code_text || paymentMethod?.copy_paste || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: checkout?.status || 'pending',
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create PIX charge on Polar');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Credit Card
  // ────────────────────────────────────────────────────────────────────────

  async createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse> {
    try {
      const checkout = (await this.client.createCheckout({
        product_price_id: input.externalReference,
        amount: Math.round(input.amount * 100),
        currency: 'BRL',
        customer_id: input.customerId,
        payment_method_type: 'card',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing?success=true`,
        metadata: {
          description: input.description,
        },
      })) as Record<string, any>;

      return {
        id: String(checkout?.id ?? ''),
        status: checkout?.status || 'pending',
        amount: checkout?.amount ? checkout.amount / 100 : input.amount,
        currency: checkout?.currency || 'BRL',
        paymentMethod: 'CREDIT_CARD',
        fee: checkout?.fee,
        netAmount: checkout?.net_amount,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create credit-card charge on Polar');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Boleto
  // ────────────────────────────────────────────────────────────────────────

  async createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse> {
    try {
      const checkout = (await this.client.createCheckout({
        product_price_id: input.externalReference,
        amount: Math.round(input.amount * 100),
        currency: 'BRL',
        customer_id: input.customerId,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing?success=true`,
        metadata: {
          description: input.description,
          payer_name: input.payerName || '',
          payer_email: input.payerEmail || '',
          payer_cpf_cnpj: input.payerCpfCnpj || '',
        },
      })) as Record<string, any>;

      const boletoData = checkout?.payment_method?.boleto ?? {};

      return {
        id: String(checkout?.id ?? ''),
        status: checkout?.status || 'pending',
        amount: checkout?.amount ? checkout.amount / 100 : input.amount,
        currency: checkout?.currency || 'BRL',
        barcode: boletoData?.barcode || boletoData?.id || '',
        boletoUrl: boletoData?.pdf || boletoData?.url || '',
        dueDate: input.dueDate,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create boleto on Polar');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Query & cancel
  // ────────────────────────────────────────────────────────────────────────

  async getCharge(providerPaymentId: string): Promise<any> {
    try {
      return await this.client.getCheckout(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to fetch Polar charge');
    }
  }

  async cancelCharge(providerPaymentId: string): Promise<void> {
    try {
      await this.client.cancelCheckout(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to cancel Polar charge');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Webhook
  // ────────────────────────────────────────────────────────────────────────

  async verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean> {
    if (provider !== 'polar') return false;
    if (!this.webhookSecret) return false;
    try {
      const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  handleWebhook(payload: any) {
    const event = payload?.type || payload?.event || 'UNKNOWN';
    const paymentId = String(
      payload?.data?.id ?? payload?.id ?? payload?.checkout?.id ?? '',
    );

    const statusMap: Record<string, string> = {
      'checkout.created': 'pending',
      'checkout.updated': 'updated',
      'checkout.paid': 'paid',
      'checkout.canceled': 'cancelled',
      'checkout.failed': 'failed',
      subscription_created: 'pending',
      subscription_paid: 'paid',
      subscription_canceled: 'cancelled',
    };

    return {
      event,
      paymentId,
      status: statusMap[event] || payload?.action || 'unknown',
      metadata: {
        rawPayload: payload,
        provider: 'polar',
        receivedAt: new Date().toISOString(),
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────

  private mapError(err: unknown, fallback: string): Error {
    const message = (err as any)?.message || fallback;
    const wrapped = new Error(`Polar error: ${message}`);
    (wrapped as any).cause = err;
    return wrapped;
  }
}