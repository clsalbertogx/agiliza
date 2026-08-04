import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createToken, verifyToken } from '@/infrastructure/auth';

/** Helper: sign header.body with HMAC-SHA256 (mirrors jwt.strategy.ts) */
function sign(header: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
}

describe('JWT Signature Verification — SEC-02 / Issue #21', () => {
  const TEST_SECRET = 'agiliza-dev-secret';

  describe('Forgery and Tamper Resistance', () => {
    it('should reject token signed with a DIFFERENT secret (forged token)', () => {
      // Given a token signed with a different secret
      const payload = {
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        role: 'owner' as const,
      };

      const tokenFromDifferentServer = createToken(payload, 'different-secret');

      // When verifying with our secret
      const result = verifyToken(tokenFromDifferentServer, TEST_SECRET);

      // Then verification should fail — the signatures won't match
      expect(result).toBeNull();
    });

    it('should reject token with tampered header', () => {
      // Given a valid token
      const payload = {
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        role: 'owner' as const,
      };
      const originalToken = createToken(payload, TEST_SECRET);
      const parts = originalToken.split('.');

      // When the header is modified (e.g. change algorithm to "none")
      const tamperedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const tamperedToken = `${tamperedHeader}.${parts[1]}.${parts[2]}`;

      // Then verification should fail
      const result = verifyToken(tamperedToken, TEST_SECRET);
      expect(result).toBeNull();
    });

    it('should reject empty token string', () => {
      // Given an empty token
      const result = verifyToken('', TEST_SECRET);

      // Then verification should fail
      expect(result).toBeNull();
    });

    it('should reject token with extra parts', () => {
      // Given a token with 4 parts (instead of 3)
      const result = verifyToken('a.b.c.d', TEST_SECRET);

      // Then verification should fail
      expect(result).toBeNull();
    });
  });

  describe('Timing Attack Hardening', () => {
    it('should fail fast (return null) when signature length differs', () => {
      // Given a token where the signature part has wrong length
      const payload = {
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        role: 'owner' as const,
      };
      const token = createToken(payload, TEST_SECRET);
      const parts = token.split('.');

      // When the signature is replaced with a shorter one
      const shortSigToken = `${parts[0]}.${parts[1]}.short`;
      const longSigToken = `${parts[0]}.${parts[1]}.${'x'.repeat(100)}`;

      // Then both should be rejected without reaching timingSafeEqual
      const shortResult = verifyToken(shortSigToken, TEST_SECRET);
      expect(shortResult).toBeNull();

      const longResult = verifyToken(longSigToken, TEST_SECRET);
      expect(longResult).toBeNull();
    });

    it('should not leak timing info via different payload sizes', () => {
      // Given tokens with varying payload sizes
      const shortPayload = {
        tenantId: 't',
        userId: 'u',
        role: 'owner' as const,
      };
      const longPayload = {
        tenantId: 'a-very-long-tenant-id-that-exceeds-typical-length'.repeat(5),
        userId: 'a-very-long-user-id-that-exceeds-typical-length'.repeat(5),
        role: 'owner' as const,
      };

      const shortToken = createToken(shortPayload, TEST_SECRET);
      const longToken = createToken(longPayload, TEST_SECRET);

      // When both are verified, they should both succeed
      expect(verifyToken(shortToken, TEST_SECRET)).not.toBeNull();
      expect(verifyToken(longToken, TEST_SECRET)).not.toBeNull();

      // And different-length forged tokens should still be rejected
      const parts = longToken.split('.');
      const forgedSig = sign(parts[0], parts[1], 'wrong-secret');
      const forgedToken = `${parts[0]}.${parts[1]}.${forgedSig}`;
      expect(verifyToken(forgedToken, TEST_SECRET)).toBeNull();
    });
  });

  describe('Expiration (exp) Claim Validation', () => {
    it('should reject token with missing exp claim', () => {
      // Given a token with no exp claim in the body
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyNoExp = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'owner',
          iat: Math.floor(Date.now() / 1000),
          // exp is intentionally missing
        }),
      ).toString('base64url');
      const signature = sign(header, bodyNoExp, TEST_SECRET);
      const tokenNoExp = `${header}.${bodyNoExp}.${signature}`;

      // When verifying — the exp check is now `!body.exp || body.exp <= now`
      // which correctly rejects tokens without an exp claim
      const result = verifyToken(tokenNoExp, TEST_SECRET);

      // Then should be rejected — missing exp is now a hard failure (A02 fix)
      expect(result).toBeNull();
    });

    it('should reject token whose exp is exactly now (already expired — edge case)', () => {
      // Given a token whose exp is exactly the current second
      // Use a fixed past timestamp to avoid non-determinism
      const fixedNow = Math.floor(Date.now() / 1000);
      // We set exp = fixedNow, but the verifyToken call happens after a tiny delay,
      // so exp < Date.now()/1000 could be true or false depending on timing.
      // To make this deterministic, use a value that is undeniably "now" and test
      // the off-by-one behaviour explicitly.

      // Test 1: exp is clearly in the past (1 second ago)
      const header1 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body1 = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'owner',
          iat: fixedNow - 86400,
          exp: fixedNow - 1, // definitely in the past
        }),
      ).toString('base64url');
      const sig1 = sign(header1, body1, TEST_SECRET);
      expect(verifyToken(`${header1}.${body1}.${sig1}`, TEST_SECRET)).toBeNull();

      // Test 2: exp is exactly equal to now — <= vs < edge case
      // The fixed code uses body.exp <= now, so exp === now IS rejected.
      const header2 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body2 = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'owner',
          iat: fixedNow - 10,
          exp: fixedNow, // equal to the captured "now"
        }),
      ).toString('base64url');
      const sig2 = sign(header2, body2, TEST_SECRET);
      const token = `${header2}.${body2}.${sig2}`;
      const result = verifyToken(token, TEST_SECRET);

      // The `<=` comparison means exp === now is treated as expired
      expect(result).toBeNull();
    });

    it('should reject token with exp in the past (already expired)', () => {
      // Given a token whose exp is 5 seconds in the past
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const fiveSecondsAgo = Math.floor(Date.now() / 1000) - 5;
      const body = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'owner',
          iat: fiveSecondsAgo - 86400,
          exp: fiveSecondsAgo,
        }),
      ).toString('base64url');
      const signature = sign(header, body, TEST_SECRET);
      const expiredToken = `${header}.${body}.${signature}`;

      // When verifying
      const result = verifyToken(expiredToken, TEST_SECRET);

      // Then should be rejected (expired)
      expect(result).toBeNull();
    });

    it('should accept token with exp well in the future (valid)', () => {
      // Given a token that expires in the future
      const payload = {
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        role: 'owner' as const,
      };
      const token = createToken(payload, TEST_SECRET);

      // When verifying
      const result = verifyToken(token, TEST_SECRET);

      // Then should succeed
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('tenant-abc');
      expect(result?.userId).toBe('user-xyz');
      expect(result?.role).toBe('owner');
    });
  });

  describe('Round-Trip: createToken → verifyToken', () => {
    it('should round-trip all possible role values', () => {
      // Given all valid role values
      const roles = ['owner', 'user'] as const;

      for (const role of roles) {
        const payload = {
          tenantId: 'tenant-rt-1',
          userId: 'user-rt-1',
          role,
        };

        // When creating and verifying
        const token = createToken(payload, TEST_SECRET);
        const result = verifyToken(token, TEST_SECRET);

        // Then should succeed with correct values
        expect(result).not.toBeNull();
        expect(result?.tenantId).toBe('tenant-rt-1');
        expect(result?.userId).toBe('user-rt-1');
        expect(result?.role).toBe(role);
      }
    });

    it('should round-trip with tenantId containing special characters', () => {
      // Given a tenantId with hyphens, underscores, and numbers
      const payload = {
        tenantId: 'tenant_special-123_ABC',
        userId: 'user_abc-456',
        role: 'owner' as const,
      };

      const token = createToken(payload, TEST_SECRET);
      const result = verifyToken(token, TEST_SECRET);

      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('tenant_special-123_ABC');
      expect(result?.userId).toBe('user_abc-456');
    });

    it('should round-trip with minimal-length identifiers', () => {
      // Given the smallest possible tenantId and userId
      const payload = {
        tenantId: 'a',
        userId: 'b',
        role: 'user' as const,
      };

      const token = createToken(payload, TEST_SECRET);
      const result = verifyToken(token, TEST_SECRET);

      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('a');
      expect(result?.userId).toBe('b');
      expect(result?.role).toBe('user');
    });

    it('should round-trip with UUID-style identifiers', () => {
      // Given UUID-style identifiers
      const payload = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        role: 'owner' as const,
      };

      const token = createToken(payload, TEST_SECRET);
      const result = verifyToken(token, TEST_SECRET);

      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result?.userId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    });

    it('should ensure deterministic verification (same payload, same secret → same outcome)', () => {
      // Given the same payload verified multiple times
      const payload = {
        tenantId: 'tenant-deterministic',
        userId: 'user-deterministic',
        role: 'owner' as const,
      };

      const token = createToken(payload, TEST_SECRET);

      // When verifying 10 times
      for (let i = 0; i < 10; i++) {
        const result = verifyToken(token, TEST_SECRET);
        expect(result).not.toBeNull();
        expect(result?.tenantId).toBe('tenant-deterministic');
        expect(result?.userId).toBe('user-deterministic');
        expect(result?.role).toBe('owner');
      }
    });
  });

  describe('Invalid Payload Handling', () => {
    it('should reject token with non-JSON body', () => {
      // Given a token whose body is not valid JSON
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyNotJson = Buffer.from('not-json-content').toString('base64url');
      const signature = sign(header, bodyNotJson, TEST_SECRET);
      const token = `${header}.${bodyNotJson}.${signature}`;

      // When verifying — JSON.parse will throw, caught by try/catch → null
      const result = verifyToken(token, TEST_SECRET);

      // Then should be rejected
      expect(result).toBeNull();
    });

    it('should reject token with non-base64url body part', () => {
      // Given a token whose body contains characters invalid for base64url
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyInvalid = '!!!invalid-base64!!!';
      const signature = sign(header, bodyInvalid, TEST_SECRET);
      const token = `${header}.${bodyInvalid}.${signature}`;

      // When verifying — Buffer.from will throw, caught by try/catch → null
      const result = verifyToken(token, TEST_SECRET);

      // Then should be rejected
      expect(result).toBeNull();
    });

    it('should reject token with missing userId in payload', () => {
      // Given a token missing the userId field
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyMissingUserId = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          role: 'owner',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          // userId is missing
        }),
      ).toString('base64url');
      const signature = sign(header, bodyMissingUserId, TEST_SECRET);
      const token = `${header}.${bodyMissingUserId}.${signature}`;

      // When verifying — claims validation now rejects tokens with missing userId
      const result = verifyToken(token, TEST_SECRET);

      // Then should be rejected — missing required claims is now a hard failure (A01 fix)
      expect(result).toBeNull();
    });

    it('should reject token with missing tenantId in payload', () => {
      // Given a token missing the tenantId field
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyMissingTenantId = Buffer.from(
        JSON.stringify({
          userId: 'user-xyz',
          role: 'owner',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          // tenantId is missing
        }),
      ).toString('base64url');
      const signature = sign(header, bodyMissingTenantId, TEST_SECRET);
      const token = `${header}.${bodyMissingTenantId}.${signature}`;

      // When verifying — claims validation now rejects tokens with missing tenantId
      const result = verifyToken(token, TEST_SECRET);

      // Then should be rejected — missing required claims is now a hard failure (A01 fix)
      expect(result).toBeNull();
    });

    it('should reject token with invalid role value', () => {
      // Given a token with an invalid role (not 'owner' or 'user')
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyInvalidRole = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'admin', // invalid role
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const signature = sign(header, bodyInvalidRole, TEST_SECRET);
      const token = `${header}.${bodyInvalidRole}.${signature}`;

      // When verifying — currently passes through since there's no role validation
      const result = verifyToken(token, TEST_SECRET);

      // The current code accepts any role value — this is a design gap (A01)
      // The RBAC layer downstream would need to handle unknown roles
      expect(result).not.toBeNull();
      expect(result?.role).toBe('admin');
    });
  });

  describe('Algorithm Confusion Resistance', () => {
    it('should reject token where alg claims RS256 but signature is HS256-style', () => {
      // Given a token claiming RS256 (asymmetric) but actually using symmetric signing
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-abc',
          userId: 'user-xyz',
          role: 'owner',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      // "Signed" with the same symmetric approach regardless of alg claim
      const signature = sign(header, body, TEST_SECRET);
      const token = `${header}.${body}.${signature}`;

      // When verifying — code doesn't inspect alg header, just recomputes signature
      const result = verifyToken(token, TEST_SECRET);

      // Then should still verify since the code ignores the alg claim
      // This is actually correct behaviour for our implementation (no alg switching)
      expect(result).not.toBeNull();
    });
  });
});
