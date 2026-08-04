import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import { PerTenantHmacVerifier } from '@/infrastructure/payment/per-tenant-hmac-verifier';

export function createHmacVerifier(): WebhookVerifierPort {
  return new PerTenantHmacVerifier();
}
