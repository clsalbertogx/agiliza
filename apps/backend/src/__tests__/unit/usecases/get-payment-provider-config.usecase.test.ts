import { describe, it, expect, vi } from 'vitest';
import { GetPaymentProviderConfigUseCase } from '@/application/usecases/get-payment-provider-config.usecase';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';

function createMocks() {
  const repo: PaymentProviderConfigRepositoryPort = {
    upsert: vi.fn(),
    findByTenantAndProvider: vi.fn(),
  };
  const encryption: EncryptionPort = {
    encrypt: vi.fn().mockImplementation((plaintext: string) => `encrypted:${plaintext}`),
    decrypt: vi.fn().mockImplementation((ciphertext: string) => ciphertext.replace('encrypted:', '')),
  };
  return { repo, encryption };
}

describe('GetPaymentProviderConfigUseCase', () => {
  it('should return decrypted config when found', async () => {
    const { repo, encryption } = createMocks();
    vi.mocked(repo.findByTenantAndProvider).mockResolvedValue({
      apiKey: 'encrypted:my-api-key',
      environment: 'production',
    });

    const usecase = new GetPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute('tenant-1', 'asaas');

    expect(result.success).toBe(true);
    if (result.success && result.value) {
      expect(result.value.apiKey).toBe('my-api-key');
      expect(result.value.environment).toBe('production');
    }
    expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:my-api-key');
  });

  it('should return null when no config exists', async () => {
    const { repo, encryption } = createMocks();
    vi.mocked(repo.findByTenantAndProvider).mockResolvedValue(null);

    const usecase = new GetPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute('tenant-1', 'asaas');

    expect(result.success).toBe(true);
    expect(result.value).toBeNull();
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });

  it('should return validation error when tenantId is empty', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new GetPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute('', 'asaas');

    expect(result.success).toBe(false);
    expect(repo.findByTenantAndProvider).not.toHaveBeenCalled();
  });

  it('should return validation error when provider is empty', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new GetPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute('tenant-1', '');

    expect(result.success).toBe(false);
    expect(repo.findByTenantAndProvider).not.toHaveBeenCalled();
  });
});