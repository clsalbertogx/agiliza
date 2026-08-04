import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { env } from '@/config/env';
import { AsaasPaymentProvider } from './asaas.provider';
import { MercadoPagoGateway } from './mercadopago.gateway';
import { PagBankGateway } from './pagbank.gateway';
import { PolarGateway } from './polar.gateway';
import { StripeGateway } from './stripe.gateway';

export type ProviderType = 'asaas' | 'mercadopago' | 'stripe' | 'pagbank' | 'polar';

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  environment?: 'sandbox' | 'production';
  /** Provider-specific extras (e.g. public_key, publishable_key, webhook_secret). */
  publicKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
}

/**
 * Order in which providers are tried when resolving a tenant's active gateway.
 * Asaas is the default fallback because it was the first provider shipped.
 */
const PROVIDER_FALLBACK_ORDER: ProviderType[] = ['asaas', 'mercadopago', 'stripe', 'pagbank', 'polar'];

/**
 * Payment Provider Factory — Strategy selector for the payment gateway adapter.
 *
 * Three modes are supported:
 *   1. Direct construction (`static create(config)`) — used in tests and
 *      connection-probe flows that already know which provider to instantiate.
 *   2. Per-tenant resolution (`createForTenant(tenantId)`) — used by request-time
 *      use cases. Reads the tenant's configured provider from the DB, decrypts
 *      the credentials, and returns the right gateway. Falls back to Asaas
 *      with env-based credentials when no DB config exists.
 *   3. Tenant resolver with explicit provider (`createForTenantAndProvider`)
 *      — used by tenant onboarding when the user picks a provider.
 */
export class PaymentProviderFactory {
  constructor(
    private readonly configRepo?: PaymentProviderConfigRepositoryPort,
    private readonly encryption?: EncryptionPort,
  ) {}

  /**
   * Create a gateway instance directly from credentials. The provider type is
   * supplied by the caller (e.g. a connection probe, an admin route, a test).
   */
  static create(config: ProviderConfig): PaymentGatewayPort {
    switch (config.type) {
      case 'asaas':
        return new AsaasPaymentProvider({
          apiKey: config.apiKey,
          environment: config.environment || 'sandbox',
          webhookSecret: config.webhookSecret,
        });
      case 'mercadopago':
        return new MercadoPagoGateway({
          accessToken: config.apiKey,
          publicKey: config.publicKey,
          environment: config.environment || 'sandbox',
          webhookSecret: config.webhookSecret,
        });
      case 'stripe':
        return new StripeGateway({
          secretKey: config.apiKey,
          publishableKey: config.publishableKey,
          environment: config.environment || 'sandbox',
          webhookSecret: config.webhookSecret,
        });
      case 'pagbank':
        return new PagBankGateway({
          accessToken: config.apiKey,
          publicKey: config.publicKey,
          environment: config.environment || 'sandbox',
          webhookSecret: config.webhookSecret,
        });
      case 'polar':
        return new PolarGateway({
          accessToken: config.apiKey,
          environment: config.environment || 'sandbox',
          webhookSecret: config.webhookSecret,
        });
      default:
        throw new Error(`Unknown payment provider: ${(config as any).type}`);
    }
  }

  /**
   * Resolve the tenant's active gateway by inspecting the per-provider rows in
   * `payment_provider_configs`. The first active row (in `PROVIDER_FALLBACK_ORDER`)
   * wins. If none is configured, falls back to Asaas with global env credentials.
   */
  async createForTenant(tenantId: string): Promise<PaymentGatewayPort> {
    if (!this.configRepo) {
      // No repo injected — fall back to env-based Asaas.
      return this.envFallback();
    }

    for (const provider of PROVIDER_FALLBACK_ORDER) {
      try {
        const row = await this.configRepo.findByTenantAndProvider(tenantId, provider);
        if (!row || !row.apiKey) continue;
        const apiKey = this.decrypt(row.apiKey);
        return PaymentProviderFactory.create({
          type: provider,
          apiKey,
          environment: (row.environment as 'sandbox' | 'production') || 'sandbox',
          webhookSecret: (row as any).webhookSecret ? this.decrypt((row as any).webhookSecret) : undefined,
        });
      } catch {}
    }

    return this.envFallback();
  }

  /**
   * Create a gateway for a specific provider+tenant combination. Used during
   * onboarding / configuration updates when the user has just chosen a provider.
   */
  async createForTenantAndProvider(tenantId: string, provider: ProviderType): Promise<PaymentGatewayPort | null> {
    if (!this.configRepo) {
      return this.envFallbackFor(provider);
    }
    const row = await this.configRepo.findByTenantAndProvider(tenantId, provider);
    if (!row || !row.apiKey) {
      return this.envFallbackFor(provider);
    }
    const apiKey = this.decrypt(row.apiKey);
    return PaymentProviderFactory.create({
      type: provider,
      apiKey,
      environment: (row.environment as 'sandbox' | 'production') || 'sandbox',
      webhookSecret: (row as any).webhookSecret ? this.decrypt((row as any).webhookSecret) : undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private decrypt(ciphertext: string): string {
    if (!this.encryption) return ciphertext;
    try {
      return this.encryption.decrypt(ciphertext);
    } catch {
      // Stored value may already be plaintext (legacy rows / dev seeds).
      return ciphertext;
    }
  }

  /** Asaas fallback using global env vars. */
  private envFallback(): PaymentGatewayPort {
    return PaymentProviderFactory.create({
      type: 'asaas',
      apiKey: env.ASAAS_API_KEY,
      environment: env.ASAAS_ENVIRONMENT,
      webhookSecret: env.ASAAS_WEBHOOK_SECRET,
    });
  }

  /** Provider-specific env fallback used during onboarding. */
  private envFallbackFor(provider: ProviderType): PaymentGatewayPort | null {
    switch (provider) {
      case 'mercadopago':
        if (!env.MERCADO_PAGO_ACCESS_TOKEN) return null;
        return PaymentProviderFactory.create({
          type: 'mercadopago',
          apiKey: env.MERCADO_PAGO_ACCESS_TOKEN,
          publicKey: env.MERCADO_PAGO_PUBLIC_KEY,
          webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET,
        });
      case 'stripe':
        if (!env.STRIPE_SECRET_KEY) return null;
        return PaymentProviderFactory.create({
          type: 'stripe',
          apiKey: env.STRIPE_SECRET_KEY,
          publishableKey: env.STRIPE_PUBLISHABLE_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        });
      case 'pagbank':
        if (!env.PAGBANK_ACCESS_TOKEN) return null;
        return PaymentProviderFactory.create({
          type: 'pagbank',
          apiKey: env.PAGBANK_ACCESS_TOKEN,
          publicKey: env.PAGBANK_PUBLIC_KEY,
          webhookSecret: env.PAGBANK_WEBHOOK_SECRET,
        });
      case 'polar':
        if (!env.POLAR_ACCESS_TOKEN) return null;
        return PaymentProviderFactory.create({
          type: 'polar',
          apiKey: env.POLAR_ACCESS_TOKEN,
          webhookSecret: env.POLAR_WEBHOOK_SECRET,
        });
      case 'asaas':
        return this.envFallback();
      default:
        return null;
    }
  }
}
