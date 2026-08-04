import { createHmac, timingSafeEqual } from 'crypto';

export interface HmacConfig {
  provider: string;
  secret: string;
  signatureHeader: string;
  algorithm?: string;
}

const PROVIDER_CONFIGS: Record<string, HmacConfig> = {
  asaas: {
    provider: 'asaas',
    secret: process.env.ASAAS_WEBHOOK_SECRET || '',
    signatureHeader: 'asaas-signature',
    algorithm: 'sha256',
  },
  mercadopago: {
    provider: 'mercadopago',
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
    signatureHeader: 'x-signature',
    algorithm: 'sha256',
  },
};

export function verifyWebhookSignature(provider: string, payload: string, signature: string): boolean {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    console.warn(`Unknown provider: ${provider}`);
    return false;
  }

  const expectedSignature = createHmac(config.algorithm || 'sha256', config.secret)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export function getSignatureHeader(provider: string): string {
  return PROVIDER_CONFIGS[provider]?.signatureHeader || 'x-webhook-signature';
}
