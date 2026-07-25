import { FastifyRequest, FastifyReply } from 'fastify';

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
  const signature = Buffer.from(`${header}.${body}:${secret}`).toString('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string, secret: string): AuthPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (body.exp < Math.floor(Date.now() / 1000)) return null;
    return { tenantId: body.tenantId, userId: body.userId, role: body.role };
  } catch {
    return null;
  }
}
