import { PerTenantHmacVerifier } from '@/infrastructure/payment/per-tenant-hmac-verifier';
import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';

export function createHmacVerifier(): WebhookVerifierPort {
  return new PerTenantHmacVerifier();
}
