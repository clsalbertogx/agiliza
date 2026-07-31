import { env } from '@/config/env';
import { AesEncryptionService } from '@/infrastructure/encryption/aes-encryption.service';

let instance: AesEncryptionService | null = null;

export function createEncryptionService(): AesEncryptionService {
  if (!instance) {
    const key = env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    instance = new AesEncryptionService(key);
  }
  return instance;
}