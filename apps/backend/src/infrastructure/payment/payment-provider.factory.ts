import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type {
  PaymentGatewayResolverPort,
  ResolvedPaymentGateway,
} from '@/application/ports/gateways/payment-gateway-resolver.port';
import type { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { PaymentProvider } from '@/domain/contracts/enums';
import { AsaasPaymentProvider } from './asaas.provider';
import { MercadoPagoGateway } from './mercadopago.gateway';
import { PagBankGateway } from './pagbank.gateway';
import { PolarGateway } from './polar.gateway';
import { StripeGateway } from './stripe.gateway';

export type ProviderType = PaymentProvider;

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
const PROVIDER_FALLBACK_ORDER: ProviderType[] = [
  PaymentProvider.ASAAS,
  PaymentProvider.MERCADO_PAGO,
  PaymentProvider.STRIPE,
  PaymentProvider.PAGBANK,
  PaymentProvider.POLAR,
];

/**
 * Payment Provider Factory — Strategy selector for the payment gateway adapter.
 *
 * Modes:
 *   1. Direct construction (`static create(config)`) — connection probes and
 *      onboarding flows that already know which provider to instantiate.
 *   2. Per-tenant resolution (`resolveForTenant(tenantId)`) — request-time use
 *      cases. Reads the tenant's configured provider from the DB, decrypts the
 *      credentials, and returns the right gateway plus the provider that was
 *      actually used. Falls back to Asaas with env credentials when no DB
 *      config exists.
 *   3. Tenant resolver with explicit provider (`resolveForTenantAndProvider`)
 *      — used when the caller already knows which provider to use.
 *
 * Implements `PaymentGatewayResolverPort` so it can be injected straight into
 * the ProcessPaymentUseCase (F2).
 */
export class PaymentProviderFactory implements PaymentGatewayResolverPort {
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
  async resolveForTenant(tenantId: string): Promise<ResolvedPaymentGateway> {
    if (!this.configRepo) {
      // No repo injected — fall back to env-based Asaas.
      return this.envFallback();
    }

    for (const provider of PROVIDER_FALLBACK_ORDER) {
      try {
        const row = await this.configRepo.findByTenantAndProvider(tenantId, provider);
        if (!row?.apiKey) continue;
        const apiKey = this.decrypt(row.apiKey);
        return {
          gateway: PaymentProviderFactory.create({
            type: provider,
            apiKey,
            environment: (row.environment as 'sandbox' | 'production') || 'sandbox',
            webhookSecret: (row as { webhookSecret?: string }).webhookSecret
              ? this.decrypt((row as { webhookSecret?: string }).webhookSecret as string)
              : undefined,
          }),
          provider,
        };
      } catch (err) {
        // DB lookup or decrypt failure for this provider — log and try the next
        // fallback instead of failing the whole resolution.
        logger.warn({ err, provider }, 'payment provider resolution failed');
      }
    }

    return this.envFallback();
  }

  /**
   * Resolve a gateway for a specific provider+tenant combination. Used during
   * onboarding / configuration updates when the user has just chosen a provider.
   */
  async resolveForTenantAndProvider(tenantId: string, provider: ProviderType): Promise<ResolvedPaymentGateway | null> {
    if (!this.configRepo) {
      return this.envFallbackFor(provider);
    }
    const row = await this.configRepo.findByTenantAndProvider(tenantId, provider);
    if (!row?.apiKey) {
      return this.envFallbackFor(provider);
    }
    return {
      gateway: PaymentProviderFactory.create({
        type: provider,
        apiKey: this.decrypt(row.apiKey),
        environment: (row.environment as 'sandbox' | 'production') || 'sandbox',
        webhookSecret: (row as { webhookSecret?: string }).webhookSecret
          ? this.decrypt((row as { webhookSecret?: string }).webhookSecret as string)
          : undefined,
      }),
      provider,
    };
  }

  /** @deprecated Use `resolveForTenant` — kept for external callers/tests. */
  createForTenant(tenantId: string): Promise<ResolvedPaymentGateway> {
    return this.resolveForTenant(tenantId);
  }

  /** @deprecated Use `resolveForTenantAndProvider` — kept for external callers/tests. */
  createForTenantAndProvider(tenantId: string, provider: ProviderType): Promise<ResolvedPaymentGateway | null> {
    return this.resolveForTenantAndProvider(tenantId, provider);
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
  private envFallback(): ResolvedPaymentGateway {
    return {
      gateway: PaymentProviderFactory.create({
        type: PaymentProvider.ASAAS,
        apiKey: env.ASAAS_API_KEY,
        environment: env.ASAAS_ENVIRONMENT,
        webhookSecret: env.ASAAS_WEBHOOK_SECRET,
      }),
      provider: PaymentProvider.ASAAS,
    };
  }

  /** Provider-specific env fallback used during onboarding. */
  private envFallbackFor(provider: ProviderType): ResolvedPaymentGateway | null {
    switch (provider) {
      case 'mercadopago':
        if (!env.MERCADO_PAGO_ACCESS_TOKEN) return null;
        return {
          gateway: PaymentProviderFactory.create({
            type: PaymentProvider.MERCADO_PAGO,
            apiKey: env.MERCADO_PAGO_ACCESS_TOKEN,
            publicKey: env.MERCADO_PAGO_PUBLIC_KEY,
            webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET,
          }),
          provider,
        };
      case 'stripe':
        if (!env.STRIPE_SECRET_KEY) return null;
        return {
          gateway: PaymentProviderFactory.create({
            type: PaymentProvider.STRIPE,
            apiKey: env.STRIPE_SECRET_KEY,
            publishableKey: env.STRIPE_PUBLISHABLE_KEY,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET,
          }),
          provider,
        };
      case 'pagbank':
        if (!env.PAGBANK_ACCESS_TOKEN) return null;
        return {
          gateway: PaymentProviderFactory.create({
            type: PaymentProvider.PAGBANK,
            apiKey: env.PAGBANK_ACCESS_TOKEN,
            publicKey: env.PAGBANK_PUBLIC_KEY,
            webhookSecret: env.PAGBANK_WEBHOOK_SECRET,
          }),
          provider,
        };
      case 'polar':
        if (!env.POLAR_ACCESS_TOKEN) return null;
        return {
          gateway: PaymentProviderFactory.create({
            type: PaymentProvider.POLAR,
            apiKey: env.POLAR_ACCESS_TOKEN,
            webhookSecret: env.POLAR_WEBHOOK_SECRET,
          }),
          provider,
        };
      case 'asaas':
        return this.envFallback();
      default:
        return null;
    }
  }
}
