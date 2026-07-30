import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import { ApplicationError } from '@/application/errors/application.error';
import type { Either } from '@/application/types/either';
import { success, failure } from '@/application/types/either';

/**
 * Per-tenant HMAC verifier that reads webhook secrets from the database
 * instead of global environment variables.
 *
 * SEC-02: Each tenant has its own webhook secret stored in PaymentProviderConfig.
 * A03: All input (provider, signature) is validated before DB lookup.
 * A02: HMAC-SHA256 with timing-safe comparison prevents side-channel attacks.
 */
export class PerTenantHmacVerifier implements WebhookVerifierPort {
  /**
   * Verify a webhook HMAC signature using the tenant-specific secret from the DB.
   *
   * @param provider - Payment provider name (asaas, mercadopago, pagbank, polar)
   * @param rawBody  - Raw request body as string
   * @param signature - HMAC signature from the webhook header
   * @param tenantId - Tenant UUID to look up the secret
   * @returns Either<ApplicationError, boolean> — true if signature is valid
   */
  async verify(
    provider: string,
    rawBody: string,
    signature: string,
    tenantId: string,
  ): Promise<Either<ApplicationError, boolean>> {
    // Validate inputs before DB lookup (A03 — Injection prevention)
    if (!provider || typeof provider !== 'string') {
      return failure(
        ApplicationError.validation('Provider must be a non-empty string'),
      );
    }

    if (!tenantId || typeof tenantId !== 'string') {
      return failure(
        ApplicationError.validation('tenantId must be a non-empty string'),
      );
    }

    if (!signature || typeof signature !== 'string') {
      return failure(
        ApplicationError.validation('Signature must be a non-empty string'),
      );
    }

    if (!rawBody || typeof rawBody !== 'string') {
      return failure(
        ApplicationError.validation('Raw body must be a non-empty string'),
      );
    }

    try {
      const prisma = getPrismaClient();

      // Fetch webhook secret from DB per tenant (A01 — scoped to tenant)
      const config = await prisma.paymentProviderConfig.findUnique({
        where: {
          tenantId_provider: { tenantId, provider },
        },
        select: { webhookSecret: true },
      });

      if (!config?.webhookSecret) {
        // No secret configured for this tenant/provider — reject
        return success(false);
      }

      // Compute expected HMAC (A02 — SHA-256, not MD5/SHA1)
      const expected = createHmac('sha256', config.webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Timing-safe comparison prevents side-channel attacks (A02)
      try {
        const isValid = timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected),
        );
        return success(isValid);
      } catch {
        // Different-length buffers throw in timingSafeEqual — treat as invalid
        return success(false);
      }
    } catch (error) {
      return failure(
        ApplicationError.internal(
          `Failed to verify webhook signature: ${(error as Error).message}`,
        ),
      );
    }
  }
}