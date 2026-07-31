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
 * Minimal contract surface that the MercadoPago SDK must expose.
 * Tests supply a fake via `sdkFactory` and never load the real package.
 */
export interface MercadoPagoSdk {
  create(body: any): Promise<any>;
  get(params: { id: string }): Promise<any>;
  cancel(params: { id: string }): Promise<any>;
}

export interface MercadoPagoSdkConstructor {
  new (opts: { accessToken: string; options?: { timeout?: number } }): any;
  MercadoPagoConfig: MercadoPagoSdkConstructor;
  Payment: new (client: any) => MercadoPagoSdk;
}

export type MercadoPagoSdkFactory = () => {
  MercadoPagoConfig: new (opts: { accessToken: string; options?: { timeout?: number } }) => any;
  Payment: new (client: any) => MercadoPagoSdk;
};

interface MercadoPagoConfigOptions {
  accessToken: string;
  publicKey?: string;
  environment?: 'sandbox' | 'production';
  webhookSecret?: string;
  /** Inject a custom SDK factory (used by tests). Falls back to real SDK. */
  sdkFactory?: MercadoPagoSdkFactory;
}

/**
 * Lazy-load the real MercadoPago SDK. Cached for process lifetime.
 */
let _mpSdkCache: MercadoPagoSdkFactory | null = null;
function realMpSdkFactory(): ReturnType<MercadoPagoSdkFactory> {
  if (!_mpSdkCache) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _mpSdkCache = () => require('mercadopago');
  }
  return _mpSdkCache();
}

/**
 * MercadoPago payment gateway — Strategy Pattern implementation of PaymentGatewayPort.
 *
 * Credentials:
 *   - accessToken (required): server-side OAuth token (Bearer).
 *   - publicKey   (optional): public key for client-side use (Card tokenisation).
 *   - webhookSecret (optional): used for `verifyWebhook` HMAC validation.
 */
export class MercadoPagoGateway implements PaymentGatewayPort {
  private client: any;
  private payment: MercadoPagoSdk;
  private readonly accessToken: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;

  constructor(options: MercadoPagoConfigOptions) {
    if (!options.accessToken) {
      throw new Error('MercadoPago accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.publicKey = options.publicKey || '';
    this.webhookSecret = options.webhookSecret || '';

    const factory = options.sdkFactory || realMpSdkFactory;
    const sdk = factory();
    const MercadoPagoConfig = sdk.MercadoPagoConfig;
    const Payment = sdk.Payment;

    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: 5000 },
    });
    this.payment = new Payment(this.client);
  }

  async createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<PixChargeResponse> {
    try {
      const idempotencyKey = generateUUID();
      const response = await this.payment.create({
        body: {
          transaction_amount: Number(params.amount),
          description: params.description,
          payment_method_id: 'pix',
          payer: params.customerId
            ? { email: 'payer@agiliza.local', id: params.customerId }
            : { email: 'payer@agiliza.local' },
          external_reference: params.externalReference,
        },
        requestOptions: { idempotencyKey },
      });

      const pointOfInteraction = response?.point_of_interaction?.transaction_data ?? {};

      return {
        id: String(response.id),
        qrCode: pointOfInteraction.qr_code_base64 || '',
        copyPaste: pointOfInteraction.qr_code || '',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: response.status || 'PENDING',
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create PIX charge on MercadoPago');
    }
  }

  async createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse> {
    try {
      const idempotencyKey = generateUUID();
      const response = await this.payment.create({
        body: {
          transaction_amount: Number(input.amount),
          description: input.description,
          payment_method_id: 'master',
          token: input.token,
          payer: {
            email: 'payer@agiliza.local',
            id: input.customerId,
          },
          external_reference: input.externalReference,
          installments: input.installments || 1,
        },
        requestOptions: { idempotencyKey },
      });

      return {
        id: String(response.id),
        status: response.status || 'PENDING',
        amount: response.transaction_amount ?? input.amount,
        currency: 'BRL',
        paymentMethod: 'CREDIT_CARD',
        fee: response.fee_details?.[0]?.amount,
        netAmount: response.net_amount,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create credit-card charge on MercadoPago');
    }
  }

  async createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse> {
    try {
      const idempotencyKey = generateUUID();
      const response = await this.payment.create({
        body: {
          transaction_amount: Number(input.amount),
          description: input.description,
          payment_method_id: 'bolbradesco',
          payer: {
            email: input.payerEmail || 'payer@agiliza.local',
            first_name: input.payerName,
            identification: input.payerCpfCnpj
              ? { type: input.payerCpfCnpj.length > 11 ? 'CNPJ' : 'CPF', number: input.payerCpfCnpj }
              : undefined,
          },
          external_reference: input.externalReference,
          date_of_expiration: input.dueDate?.toISOString(),
        },
        requestOptions: { idempotencyKey },
      });

      return {
        id: String(response.id),
        status: response.status || 'PENDING',
        amount: response.transaction_amount ?? input.amount,
        currency: 'BRL',
        barcode: response.barcode?.content || '',
        boletoUrl: response.transaction_details?.external_resource_url,
        dueDate: input.dueDate,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create boleto on MercadoPago');
    }
  }

  async getCharge(providerPaymentId: string): Promise<any> {
    try {
      return await this.payment.get({ id: providerPaymentId });
    } catch (err) {
      throw this.mapError(err, 'Failed to fetch MercadoPago charge');
    }
  }

  async cancelCharge(providerPaymentId: string): Promise<void> {
    try {
      await this.payment.cancel({ id: providerPaymentId });
    } catch (err) {
      throw this.mapError(err, 'Failed to cancel MercadoPago charge');
    }
  }

  async verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean> {
    if (provider !== 'mercadopago') return false;
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
    const paymentId = String(
      payload?.data?.id ?? payload?.id ?? payload?.payment?.id ?? '',
    );

    const statusMap: Record<string, string> = {
      payment: payload?.action ?? 'unknown',
      payment_created: 'pending',
      payment_updated: 'updated',
      'payment.created': 'pending',
      'payment.updated': 'updated',
    };

    return {
      event,
      paymentId,
      status: statusMap[event] || payload?.action || 'unknown',
      metadata: {
        rawPayload: payload,
        provider: 'mercadopago',
        receivedAt: new Date().toISOString(),
      },
    };
  }

  private mapError(err: unknown, fallback: string): Error {
    const message = (err as any)?.message || fallback;
    const wrapped = new Error(`MercadoPago error: ${message}`);
    (wrapped as any).cause = err;
    return wrapped;
  }
}