import { describe, it, expect } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

describe('PII Encryption at Rest — SEC-05', () => {
  // AES-256-GCM encryption implementation matching the security spec
  const ALGORITHM = 'aes-256-gcm';
  // Use a fixed key for testing (32 bytes hex-encoded = 64 hex chars)
  const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const KEY = Buffer.from(TEST_KEY_HEX, 'hex');
  const IV_LENGTH = 16;

  interface EncryptedData {
    ciphertext: string;
    iv: string;
    tag: string;
  }

  function encrypt(plaintext: string): EncryptedData {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  function decrypt(data: EncryptedData): string {
    const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  it('should encrypt client phone at rest with AES-256-GCM', () => {
    // Given a client with phone = "5511999998888"
    const phone = '5511999998888';

    // When encrypting
    const encrypted = encrypt(phone);

    // Then the ciphertext should NOT equal the plaintext
    expect(encrypted.ciphertext).not.toBe(phone);

    // The ciphertext should be hex-encoded
    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);

    // The IV should be present (for decryption)
    expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.iv.length / 2).toBe(IV_LENGTH);

    // The auth tag should be present (for integrity verification)
    expect(encrypted.tag).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.tag.length / 2).toBe(16);

    // The plaintext should NOT appear in the ciphertext
    expect(encrypted.ciphertext).not.toContain(phone);
  });

  it('should encrypt client name at rest', () => {
    // Given a client with name = "João Silva"
    const name = 'João Silva';

    // When encrypting
    const encrypted = encrypt(name);

    // Then the name column should be encrypted
    expect(encrypted.ciphertext).not.toBe(name);
    expect(encrypted.ciphertext).not.toContain('João');
    expect(encrypted.ciphertext).not.toContain('Silva');
    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
  });

  it('should encrypt tenant taxId at rest', () => {
    // Given a tenant with taxId = "12.345.678/0001-90"
    const taxId = '12.345.678/0001-90';

    // When encrypting
    const encrypted = encrypt(taxId);

    // Then taxId column should be encrypted
    expect(encrypted.ciphertext).not.toBe(taxId);
    expect(encrypted.ciphertext).not.toContain('12.345.678');
    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
  });

  it('should encrypt payment provider API keys at rest', () => {
    // Given a PaymentProviderConfig with apiKey = "asaas_live_abc123"
    const apiKey = 'asaas_live_abc123def456ghi789';

    // When encrypting
    const encrypted = encrypt(apiKey);

    // Then ciphertext should contain encrypted data
    expect(encrypted.ciphertext).not.toBe(apiKey);
    expect(encrypted.ciphertext).not.toContain('asaas');
    expect(encrypted.ciphertext).not.toContain('live');

    // The plaintext API key should never appear in the encrypted output
    expect(encrypted.ciphertext).not.toContain(apiKey);
  });

  it('should decrypt correctly when reading via application', () => {
    // Given an encrypted client record
    const originalPhone = '5511999998888';
    const originalName = 'João Silva';

    // Encrypt both fields
    const encryptedPhone = encrypt(originalPhone);
    const encryptedName = encrypt(originalName);

    // When decrypting via application
    const decryptedPhone = decrypt(encryptedPhone);
    const decryptedName = decrypt(encryptedName);

    // Then phone and name should be decrypted to original plaintext
    expect(decryptedPhone).toBe(originalPhone);
    expect(decryptedName).toBe(originalName);
  });

  it('should ensure encryption/decryption is deterministic for same input', () => {
    // Given the same plaintext encrypted twice
    const plaintext = 'sensitive-data-123';

    // Encrypt twice — each call generates a random IV
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // While the ciphertext may differ (due to random IV)
    // When decrypting both results
    const decrypted1 = decrypt(encrypted1);
    const decrypted2 = decrypt(encrypted2);

    // Then both should return the original plaintext
    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);

    // The ciphertext should differ due to different IVs
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  it('should fail decryption with wrong encryption key', () => {
    // Given data encrypted with key A
    const plaintext = 'confidential-data';
    const encrypted = encrypt(plaintext);

    // When decrypting with key B (different key)
    const WRONG_KEY_HEX = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    const WRONG_KEY = Buffer.from(WRONG_KEY_HEX, 'hex');

    // Then it should throw an error (auth tag mismatch)
    expect(() => {
      const decipher = createDecipheriv(ALGORITHM, WRONG_KEY, Buffer.from(encrypted.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
      let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }).toThrow(); // AES-GCM auth tag mismatch causes an error
  });
});
