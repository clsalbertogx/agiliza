export interface EncryptionPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
