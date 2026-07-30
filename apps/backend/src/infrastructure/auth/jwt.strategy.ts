import { timingSafeEqual, createHmac } from 'node:crypto';

export interface AuthPayload {
  tenantId: string;
  userId: string;
  role: 'owner' | 'user';
}

// Simple token encoding/decoding for MVP
// In production, use a proper JWT library
export function createToken(payload: AuthPayload, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string, secret: string): AuthPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Recompute expected signature using the same algorithm as createToken
    const expectedSig = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    const actualSig = parts[2];

    // Timing-safe comparison — fail early on length mismatch to avoid crypto error
    if (expectedSig.length !== actualSig.length) return null;
    if (!timingSafeEqual(Buffer.from(expectedSig), Buffer.from(actualSig))) {
      return null;
    }

    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    // Validate required claims — return null if any are missing (A01 / A02)
    if (!body.tenantId || !body.userId || !body.role) return null;
    // Reject missing exp and off-by-one edge case (exp === now is already expired)
    if (!body.exp || body.exp <= Math.floor(Date.now() / 1000)) return null;
    return { tenantId: body.tenantId, userId: body.userId, role: body.role };
  } catch {
    return null;
  }
}
