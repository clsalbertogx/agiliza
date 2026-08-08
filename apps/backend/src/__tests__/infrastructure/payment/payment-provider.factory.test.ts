import { describe, expect, it, vi } from 'vitest';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { PaymentProvider } from '@/domain/contracts/enums';
import { AsaasPaymentProvider } from '@/infrastructure/payment/asaas.provider';
import { MercadoPagoGateway } from '@/infrastructure/payment/mercadopago.gateway';
import { PaymentProviderFactory } from '@/infrastructure/payment/payment-provider.factory';

/**
 * F2(b) — PaymentProviderFactory.createForTenant fallback order:
 * tenant-configured provider wins, default (Asaas env) is the fallback.
 */
describe('PaymentProviderFactory — per-tenant resolution', () => {
  function configRepo(mpOnly = false): PaymentProviderConfigRepositoryPort {
    return {
      findByTenantAndProvider: vi.fn(async (_tenantId, provider) => {
        if (provider === 'mercadopago' && mpOnly) return { apiKey: 'mp-test-access-token', environment: 'sandbox' };
        return null;
      }),
      upsert: vi.fn(),
    };
  }

  it('returns the Mercado Pago gateway for a tenant configured with MP', async () => {
    const factory = new PaymentProviderFactory(configRepo(true));
    const resolved = await factory.createForTenant('tenant-mp');

    expect(resolved.gateway).toBeInstanceOf(MercadoPagoGateway);
    expect(resolved.provider).toBe('mercadopago');
  });

  it('falls back to the Asaas gateway (with its provider) when no tenant config exists', async () => {
    const factory = new PaymentProviderFactory(configRepo(false));
    const resolved = await factory.createForTenant('tenant-empty');

    expect(resolved.gateway).toBeInstanceOf(AsaasPaymentProvider);
    expect(resolved.provider).toBe('asaas');
  });

  it('exposes the resolved provider so callers persist the ACTUAL gateway used', async () => {
    const factory = new PaymentProviderFactory(configRepo(true));
    const resolved = await factory.createForTenantAndProvider('tenant-mp', PaymentProvider.MERCADO_PAGO);

    expect(resolved?.gateway).toBeInstanceOf(MercadoPagoGateway);
    expect(resolved?.provider).toBe('mercadopago');
  });
});
