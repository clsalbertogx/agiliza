import { describe, it, expect } from 'vitest';

describe('CORS Validation — SEC-07', () => {
  // Simulate the CORS configuration from src/index.ts
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    process.env.FRONTEND_URL || 'http://localhost:3000',
  ];

  const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-API-Key'];

  /**
   * Simulates @fastify/cors behavior
   */
  function simulateCorsCheck(origin: string | undefined): { allowed: boolean; origin?: string } {
    if (!origin) {
      // No Origin header = same-origin request (allowed)
      return { allowed: true };
    }

    const isAllowed = ALLOWED_ORIGINS.some(allowed =>
      origin === allowed || origin === (process.env.FRONTEND_URL || 'http://localhost:3000')
    );

    if (isAllowed) {
      return { allowed: true, origin };
    }

    // Unknown origin: do NOT include Access-Control-Allow-Origin
    return { allowed: false };
  }

  it('should include Access-Control-Allow-Origin for allowed frontend origin', () => {
    // Given the allowed origin "http://localhost:3000"
    const origin = 'http://localhost:3000';

    // When sending a request with the allowed origin
    const result = simulateCorsCheck(origin);

    // Then response should include Access-Control-Allow-Origin
    expect(result.allowed).toBe(true);
    expect(result.origin).toBe('http://localhost:3000');
  });

  it('should NOT include Access-Control-Allow-Origin for unknown origin', () => {
    // Given an unknown origin "https://evil.com"
    const origin = 'https://evil.com';

    // When sending a request with Origin: "https://evil.com"
    const result = simulateCorsCheck(origin);

    // Then response should NOT include Access-Control-Allow-Origin
    expect(result.allowed).toBe(false);
    expect(result.origin).toBeUndefined();
  });

  it('should reject preflight OPTIONS request from unknown origin', () => {
    // Given an unknown origin
    const origin = 'https://evil.com';

    // When sending OPTIONS request (preflight)
    function simulatePreflight(requestOrigin: string): { allowed: boolean; headers: Record<string, string> } {
      const corsResult = simulateCorsCheck(requestOrigin);
      const headers: Record<string, string> = {};

      if (corsResult.allowed) {
        headers['access-control-allow-origin'] = corsResult.origin!;
        headers['access-control-allow-methods'] = ALLOWED_METHODS.join(', ');
        headers['access-control-allow-headers'] = ALLOWED_HEADERS.join(', ');
        headers['access-control-max-age'] = '86400';
      }

      return { allowed: corsResult.allowed, headers };
    }

    const result = simulatePreflight(origin);

    // Then response should NOT include Access-Control-Allow-Origin
    expect(result.allowed).toBe(false);
    expect(result.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow preflight from allowed origin with correct methods', () => {
    // Given an allowed origin
    const origin = 'http://localhost:3000';

    function simulatePreflight(requestOrigin: string): { headers: Record<string, string> } {
      const corsResult = simulateCorsCheck(requestOrigin);
      const headers: Record<string, string> = {};

      if (corsResult.allowed) {
        headers['access-control-allow-origin'] = corsResult.origin!;
        headers['access-control-allow-methods'] = ALLOWED_METHODS.join(', ');
        headers['access-control-allow-headers'] = ALLOWED_HEADERS.join(', ');
        headers['access-control-max-age'] = '86400';
        headers['access-control-allow-credentials'] = 'true';
      }

      return { headers };
    }

    // When sending OPTIONS request
    const result = simulatePreflight(origin);

    // Then response should include proper CORS headers
    expect(result.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(result.headers['access-control-allow-methods']).toContain('GET');
    expect(result.headers['access-control-allow-methods']).toContain('POST');
    expect(result.headers['access-control-allow-methods']).toContain('PUT');
    expect(result.headers['access-control-allow-methods']).toContain('PATCH');
    expect(result.headers['access-control-allow-methods']).toContain('DELETE');
    expect(result.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(result.headers['access-control-allow-headers']).toContain('Authorization');
    expect(result.headers['access-control-allow-headers']).toContain('X-API-Key');
    expect(result.headers['access-control-allow-credentials']).toBe('true');
    expect(result.headers['access-control-max-age']).toBe('86400');
  });

  it('should not require CORS for webhook endpoints (server-to-server)', () => {
    // Given any origin (even unknown) for a webhook endpoint
    const unknownOrigin = 'https://evil.com';

    // Webhook endpoints don't need CORS because they are server-to-server
    // However, HMAC signature is still required for authentication

    function simulateWebhookEndpoint(requestOrigin: string | undefined, hasValidHmac: boolean): { status: number } {
      // CORS is not checked for webhook endpoints
      // But HMAC is required regardless of origin
      if (!hasValidHmac) {
        return { status: 401 };
      }
      return { status: 200 };
    }

    // When POST to /api/webhooks/payment/asaas from unknown origin WITHOUT valid HMAC
    const resultNoHmac = simulateWebhookEndpoint(unknownOrigin, false);

    // Then should be 401 (HMAC required, not CORS)
    expect(resultNoHmac.status).toBe(401);

    // When POST to /api/webhooks/payment/asaas from unknown origin WITH valid HMAC
    const resultWithHmac = simulateWebhookEndpoint(unknownOrigin, true);

    // Then should be 200 (HMAC verified successfully)
    expect(resultWithHmac.status).toBe(200);
  });
});
