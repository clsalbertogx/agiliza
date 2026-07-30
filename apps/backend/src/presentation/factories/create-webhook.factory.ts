import { PerTenantHmacVerifier } from '@/infrastructure/payment/per-tenant-hmac-verifier';

export function createHmacVerifier(): PerTenantHmacVerifier {
  return new PerTenantHmacVerifier();
}
