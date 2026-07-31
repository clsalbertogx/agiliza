import { describe, it, expect } from 'vitest';
import { AesEncryptionService } from '@/infrastructure/encryption/aes-encryption.service';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('AesEncryptionService', () => {
  it('should throw on invalid key length', () => {
    expect(() => new AesEncryptionService('tooshort')).toThrow();
    expect(() => new AesEncryptionService('')).toThrow();
  });

  it('should encrypt and decrypt correctly', () => {
    const service = new AesEncryptionService(TEST_KEY);
    const plaintext = 'my-super-secret-api-key-123';

    const encrypted = service.encrypt(plaintext);

    // Encrypted result should be a JSON string with ciphertext, iv, tag
    expect(() => JSON.parse(encrypted)).not.toThrow();
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty('ciphertext');
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('tag');

    // Should not contain plaintext
    expect(encrypted).not.toContain(plaintext);

    // Decrypt should return original
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same input (due to random IV)', () => {
    const service = new AesEncryptionService(TEST_KEY);
    const plaintext = 'same-input';

    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);

    // Both should decrypt to the original
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should fail decryption with wrong key', () => {
    const service = new AesEncryptionService(TEST_KEY);
    const wrongService = new AesEncryptionService('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210');
    const plaintext = 'confidential-data';

    const encrypted = service.encrypt(plaintext);

    expect(() => wrongService.decrypt(encrypted)).toThrow();
  });

  it('should fail decryption of tampered ciphertext', () => {
    const service = new AesEncryptionService(TEST_KEY);
    const plaintext = 'sensitive-data';

    const encrypted = service.encrypt(plaintext);
    const parsed = JSON.parse(encrypted);
    // Tamper with ciphertext
    const tampered = JSON.stringify({ ...parsed, ciphertext: parsed.ciphertext.slice(0, -2) + 'ff' });

    expect(() => service.decrypt(tampered)).toThrow();
  });
});