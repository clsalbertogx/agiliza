import type {
  BoletoChargeInput,
  BoletoChargeResponse,
  CreditCardChargeInput,
  CreditCardChargeResponse,
  PaymentGatewayPort,
  PixChargeResponse,
} from '@/application/ports/payment-gateway.port';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';

/**
 * Minimal contract surface that the Stripe SDK must expose to satisfy this gateway.
 * Defined locally so tests can mock it without depending on the real package types.
 */
export interface StripeSdk {
  paymentIntents: {
    create: (params: any, opts?: any) => Promise<any>;
    retrieve: (id: string) => Promise<any>;
    cancel: (id: string) => Promise<any>;
  };
  webhooks: {
    constructEvent: (payload: string | Buffer, sig: string, secret: string) => any;
  };
}

/**
 * Factory signature: given the secret key, return a Stripe SDK instance.
 * Exposed so production code uses the real `stripe` package while tests inject
 * a pre-built mock object directly.
 */
export type StripeSdkFactory = (secretKey: string, options?: Record<string, unknown>) => StripeSdk;

interface StripeConfigOptions {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
  /** Inject a custom SDK factory (used by tests). Production uses default. */
  sdkFactory?: StripeSdkFactory;
}

/**
 * Lazy-load the real Stripe SDK. Loaded once on first call, cached for the
 * lifetime of the process. We use a dynamic require so that consumers who
 * never instantiate a StripeGateway never pay the load cost.
 */
let _realSdkCache: StripeSdkFactory | null = null;
function realStripeFactory(secretKey: string, options?: Record<string, unknown>): StripeSdk {
  if (!_realSdkCache) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    _realSdkCache = (key, opts) => new Stripe(key, opts) as unknown as StripeSdk;
  }
  return _realSdkCache(secretKey, options);
}

/**
 * Stripe payment gateway — Strategy Pattern implementation of PaymentGatewayPort.
 *
 * Credentials:
 *   - secretKey     (required): server-side secret key (sk_test_… / sk_live_…).
 *   - publishableKey (optional): publishable key, used in client-side flows.
 *   - webhookSecret  (optional): whsec_… value used to verify webhook signatures.
 */
export class StripeGateway implements PaymentGatewayPort {
  private readonly stripe: StripeSdk;
  private readonly secretKey: string;
  private readonly publishableKey: string;
  private readonly webhookSecret: string;

  constructor(options: StripeConfigOptions) {
    if (!options.secretKey) {
      throw new Error('Stripe secretKey is required');
    }
    this.secretKey = options.secretKey;
    this.publishableKey = options.publishableKey || '';
    this.webhookSecret = options.webhookSecret || '';
    const factory = options.sdkFactory || ((key, opts) => realStripeFactory(key, opts));
    this.stripe = factory(this.secretKey, { apiVersion: '2024-06-20' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PIX — Stripe supports PIX in Brazil via PaymentIntents with payment_method_types.
  // ──────────────────────────────────────────────────────────────────────────
  async createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<PixChargeResponse> {
    try {
      const amountInCents = Math.round(params.amount * 100);
      const idempotencyKey = generateUUID();
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: 'brl',
          payment_method_types: ['pix'],
          description: params.description,
          metadata: { external_reference: params.externalReference || '' },
        },
        { idempotencyKey },
      );

      return {
        id: intent.id,
        qrCode: intent.next_action?.pix_display_qr_code?.image_url_png || '',
        copyPaste: intent.next_action?.pix_display_qr_code?.image_url || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: intent.status || 'requires_payment_method',
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create PIX charge on Stripe');
    }
  }

  async createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse> {
    try {
      const amountInCents = Math.round(input.amount * 100);
      const idempotencyKey = generateUUID();
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: 'brl',
          payment_method_types: ['card'],
          description: input.description,
          confirm: true,
          payment_method: input.token,
          customer: input.customerId,
          metadata: { external_reference: input.externalReference || '' },
        },
        { idempotencyKey },
      );

      return {
        id: intent.id,
        status: intent.status,
        amount: input.amount,
        currency: 'brl',
        paymentMethod: 'CREDIT_CARD',
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create credit-card charge on Stripe');
    }
  }

  async createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse> {
    try {
      const amountInCents = Math.round(input.amount * 100);
      const idempotencyKey = generateUUID();
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: 'brl',
          payment_method_types: ['boleto'],
          description: input.description,
          metadata: {
            external_reference: input.externalReference || '',
            payer_name: input.payerName || '',
            payer_email: input.payerEmail || '',
            payer_cpf_cnpj: input.payerCpfCnpj || '',
          },
          payment_method_data: input.payerCpfCnpj
            ? { type: 'boleto', boleto: { tax_id: input.payerCpfCnpj } }
            : undefined,
        },
        { idempotencyKey },
      );

      const boletoDetails = intent.next_action?.boleto_display_details ?? {};
      return {
        id: intent.id,
        status: intent.status,
        amount: input.amount,
        currency: 'brl',
        barcode: boletoDetails.number || '',
        boletoUrl: boletoDetails.hosted_voucher_url,
        dueDate: input.dueDate,
      };
    } catch (err) {
      throw this.mapError(err, 'Failed to create boleto on Stripe');
    }
  }

  async getCharge(providerPaymentId: string): Promise<any> {
    try {
      return await this.stripe.paymentIntents.retrieve(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to fetch Stripe charge');
    }
  }

  async cancelCharge(providerPaymentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(providerPaymentId);
    } catch (err) {
      throw this.mapError(err, 'Failed to cancel Stripe charge');
    }
  }

  /**
   * Verify a Stripe webhook signature.
   * Wraps `stripe.webhooks.constructEvent`, which throws when the signature is invalid.
   */
  async verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean> {
    if (provider !== 'stripe') return false;
    if (!this.webhookSecret) return false;
    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  handleWebhook(payload: any) {
    const event = payload?.type || 'UNKNOWN';
    const obj = payload?.data?.object || {};
    const paymentId = String(obj?.id ?? '');
    const intentStatus = obj?.status;

    const statusMap: Record<string, string> = {
      'payment_intent.succeeded': 'confirmed',
      'payment_intent.payment_failed': 'failed',
      'payment_intent.canceled': 'cancelled',
      'payment_intent.processing': 'pending',
      'payment_intent.requires_payment_method': 'pending',
    };

    return {
      event,
      paymentId,
      status: statusMap[event] || intentStatus || 'unknown',
      metadata: {
        rawPayload: payload,
        provider: 'stripe',
        receivedAt: new Date().toISOString(),
      },
    };
  }

  private mapError(err: unknown, fallback: string): Error {
    const message = (err as any)?.message || fallback;
    const wrapped = new Error(`Stripe error: ${message}`);
    (wrapped as any).cause = err;
    return wrapped;
  }
}
