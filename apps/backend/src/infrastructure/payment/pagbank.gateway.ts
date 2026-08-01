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
 * Minimal contract surface that the PagBank SDK/client must expose.
 * Tests supply a fake via `clientFactory` and never load real HTTP.
 */
export interface PagBankClient {
  createCharge(body: unknown): Promise<unknown>;
  getCharge(id: string): Promise<unknown>;
  cancelCharge(id: string): Promise<unknown>;
}

export type PagBankClientFactory = (accessToken: string, environment: string) => PagBankClient;

interface PagBankConfigOptions {
  accessToken: string;
  publicKey?: string;
  environment?: 'sandbox' | 'production';
  webhookSecret?: string;
  /** Inject a custom client factory (used by tests). Production uses the real fetch-based client. */
  clientFactory?: PagBankClientFactory;
}

// ──────────────────────────────────────────────────────────────────────────
// Real fetch-based client (production)
// ──────────────────────────────────────────────────────────────────────────

let _realPagBankClientFactory: PagBankClientFactory | null = null;
function realPagBankClientFactory(): PagBankClientFactory {
  if (!_realPagBankClientFactory) {
    _realPagBankClientFactory = (token: string, environment: string) => {
      const isSandbox = environment !== 'production';
      const baseUrl = isSandbox
        ? 'https://sandbox.api.pagseguro.com'
        : 'https://api.pagseguro.com';

      return {
        async createCharge(body: unknown) {
          const response = await fetch(`${baseUrl}/charges`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`PagBank API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
        async getCharge(id: string) {
          const response = await fetch(`${baseUrl}/charges/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`PagBank API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
        async cancelCharge(id: string) {
          const response = await fetch(`${baseUrl}/charges/${id}/cancel`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(`PagBank API error: ${response.status} ${JSON.stringify(data)}`);
          }
          return data;
        },
      };
    };
  }
  return _realPagBankClientFactory;
}

/**
 * PagBank payment gateway — Strategy Pattern implementation of PaymentGatewayPort.
 *
 * Credentials:
 *   - accessToken (required): PagBank API OAuth token (Bearer).
 *   - publicKey   (optional): public key for client-side interactions.
 *   - webhookSecret (optional): used for `verifyWebhook` HMAC validation.
 */
export class PagBankGateway implements PaymentGatewayPort {
  private readonly client: PagBankClient;
  private readonly accessToken: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;

  constructor(options: PagBankConfigOptions) {
    if (!options.accessToken) {
      throw new Error('PagBank accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.publicKey = options.publicKey || '';
    this.webhookSecret = options.webhookSecret || '';

    const factory = options.clientFactory || realPagBankClientFactory();
    this.client = factory(this.accessToken, options.environment || 'sandbox');
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
      const idempotencyKey = generateUUID();
      const charge = (await this.client.createCharge({
        reference_id: params.externalReference || idempotencyKey,
        description: params.description,
        amount: {
          value: Math.round(params.amount * 100),
          currency: 'BRL',
        },
        payment_method: {
          type: 'PIX',
          pix: {
            expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        customer: params.customerId ? { id: params.customerId } : undefined,
      })) as Record<string, any>;

      const pix = charge?.payment_method?.pix ?? charge?.qr_codes?.[0] ?? {};

      return {
        id: String(charge?.id || ''),
        qrCode: pix?.qr_code_base64 || pix?.qr_code || '',
        copyPaste: pix?.qr_code_text || pix?.text || '',
        expiresAt: new Date(pix?.expiration_date || Date.now() + 24 * 60 * 60 * 1000),
        status: charge?.status || 'WAITING',
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create PIX charge on PagBank');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Credit Card
  // ────────────────────────────────────────────────────────────────────────

  async createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse> {
    try {
      const charge = (await this.client.createCharge({
        amount: { value: Math.round(input.amount * 100), currency: 'BRL' },
        description: input.description,
        payment_method: {
          type: 'CREDIT_CARD',
          card: {
            token: input.token,
            installments: input.installments || 1,
          },
        },
        customer: input.customerId ? { id: input.customerId } : undefined,
        reference_id: input.externalReference,
      })) as Record<string, any>;

      const amountData = charge?.amount ?? {};
      return {
        id: String(charge?.id ?? ''),
        status: charge?.status || 'WAITING',
        amount: typeof amountData.value === 'number' ? amountData.value / 100 : input.amount,
        currency: amountData.currency || 'BRL',
        paymentMethod: 'CREDIT_CARD',
        fee: charge?.fee_details?.[0]?.amount,
        netAmount: charge?.net_amount,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create credit-card charge on PagBank');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Boleto
  // ────────────────────────────────────────────────────────────────────────

  async createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse> {
    try {
      const charge = (await this.client.createCharge({
        amount: { value: Math.round(input.amount * 100), currency: 'BRL' },
        description: input.description,
        payment_method: {
          type: 'BOLETO',
          boleto: {
            due_date: input.dueDate
              ? input.dueDate.toISOString().split('T')[0]
              : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            instruction_lines: {
              line_1: input.description || 'Referente a serviços prestados',
            },
            holder: {
              name: input.payerName || 'Cliente',
              email: input.payerEmail || 'cliente@agiliza.local',
              tax_id: input.payerCpfCnpj || '',
            },
          },
        },
        customer: input.customerId ? { id: input.customerId } : undefined,
        reference_id: input.externalReference,
      })) as Record<string, any>;

      const amountData = charge?.amount ?? {};
      const boletoData = charge?.payment_method?.boleto ?? {};

      return {
        id: String(charge?.id ?? ''),
        status: charge?.status || 'WAITING',
        amount: amountData.value ? amountData.value / 100 : input.amount,
        currency: amountData.currency || 'BRL',
        barcode: boletoData?.barcode || boletoData?.id || '',
        boletoUrl: boletoData?.pdf || boletoData?.link || '',
        dueDate: input.dueDate,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create boleto on PagBank');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Query & cancel
  // ────────────────────────────────────────────────────────────────────────

  async getCharge(providerPaymentId: string): Promise<any> {
    try {
      return await this.client.getCharge(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to fetch PagBank charge');
    }
  }

  async cancelCharge(providerPaymentId: string): Promise<void> {
    try {
      await this.client.cancelCharge(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to cancel PagBank charge');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Webhook
  // ────────────────────────────────────────────────────────────────────────

  async verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean> {
    if (provider !== 'pagbank') return false;
    if (!this.webhookSecret) return false;
    try {
      const parts = signature.split(',').map((p) => p.trim());
      let ts: string | undefined;
      let hash: string | undefined;
      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 'ts') ts = v;
        if (k === 'v1') hash = v;
      }
      if (!ts || !hash) return false;

      let dataId = '';
      try {
        const parsed = JSON.parse(payload);
        dataId = String(parsed?.data?.id ?? '');
      } catch {
        return false;
      }

      const manifest = `id:${dataId};request-id:${dataId};ts:${ts};`;
      const expected = createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');

      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  handleWebhook(payload: any) {
    const event = payload?.type || payload?.event || 'UNKNOWN';
    const paymentId = String(payload?.data?.id ?? payload?.id ?? payload?.charge?.id ?? '');

    const statusMap: Record<string, string> = {
      CHARGE_PAID: 'paid',
      CHARGE_WAITING: 'pending',
      CHARGE_DECLINED: 'declined',
      CHARGE_CANCELED: 'cancelled',
      'charge.paid': 'paid',
      'charge.created': 'pending',
    };

    return {
      event,
      paymentId,
      status: statusMap[event] || payload?.action || 'unknown',
      metadata: {
        rawPayload: payload,
        provider: 'pagbank',
        receivedAt: new Date().toISOString(),
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────

  private mapError(err: unknown, fallback: string): Error {
    const message = (err as any)?.message || fallback;
    const wrapped = new Error(`PagBank error: ${message}`);
    (wrapped as any).cause = err;
    return wrapped;
  }
}