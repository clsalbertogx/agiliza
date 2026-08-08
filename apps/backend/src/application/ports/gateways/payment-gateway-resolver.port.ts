// Canonical runtime port — the concrete gateways implement this one, not the
// Either-based `gateways/payment-gateway.port` (contract-track duplicate).
import type { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import type { PaymentProvider } from '@/domain/contracts/enums';

/** A gateway resolved for a tenant, together with the provider actually used. */
export interface ResolvedPaymentGateway {
  gateway: PaymentGatewayPort;
  provider: PaymentProvider;
}

/**
 * F2 — per-tenant payment gateway resolution.
 *
 * The ProcessPaymentUseCase depends on this port instead of a hardcoded
 * gateway so that a tenant configured with Mercado Pago (or Stripe, etc.)
 * is charged via that gateway, not the Asaas default.
 */
export interface PaymentGatewayResolverPort {
  resolveForTenant(tenantId: string): Promise<ResolvedPaymentGateway>;
  resolveForTenantAndProvider(tenantId: string, provider: PaymentProvider): Promise<ResolvedPaymentGateway | null>;
}
