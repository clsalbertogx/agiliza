import { describe, it, expect } from 'vitest';
import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import type { Either } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';

describe('WebhookVerifierPort — Contract Test', () => {
  it('should compile with correct verify signature (compile-time check)', () => {
    // If this compiles, the port interface is correctly shaped
    const verifier: WebhookVerifierPort = {
      verify: async (
        _provider: string,
        _payload: string,
        _signature: string,
        _tenantId: string,
      ): Promise<Either<ApplicationError, boolean>> => {
        return { success: true, value: true };
      },
    };
    expect(typeof verifier.verify).toBe('function');
  });

  it('should accept a verify returning Either.success with boolean', async () => {
    const verifier: WebhookVerifierPort = {
      verify: async () => ({ success: true, value: true }),
    };
    const result = await verifier.verify('asaas', '{}', 'sig', 'tenant-1');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('value', true);
  });

  it('should accept a verify returning Either.failure with ApplicationError', async () => {
    const verifier: WebhookVerifierPort = {
      verify: async () => ({
        success: false,
        value: ApplicationError.internal('DB failure'),
      }),
    };
    const result = await verifier.verify('asaas', '{}', 'sig', 'tenant-1');
    expect(result).toHaveProperty('success', false);
    if (!result.success) {
      expect(result.value).toBeInstanceOf(ApplicationError);
      expect(result.value).toHaveProperty('message', 'DB failure');
      expect(result.value).toHaveProperty('statusCode', 500);
      expect(result.value).toHaveProperty('code', 'INTERNAL_ERROR');
    }
  });

  it('should accept verify with exactly 4 string parameters', () => {
    // Explicit parameter count check at type level
    type VerifyFn = WebhookVerifierPort['verify'];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const checkParams: (...args: [string, string, string, string]) => Promise<Either<ApplicationError, boolean>> =
      async (_a, _b, _c, _d) => ({ success: true, value: true });
    const verifier: WebhookVerifierPort = { verify: checkParams };
    expect(typeof verifier.verify).toBe('function');
  });
});
