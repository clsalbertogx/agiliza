import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const _TAG_LENGTH = 16;

interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

export class AesEncryptionService implements EncryptionPort {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    if (keyHex?.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const data: EncryptedData = {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
    return JSON.stringify(data);
  }

  decrypt(ciphertext: string): string {
    const data: EncryptedData = JSON.parse(ciphertext);
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
