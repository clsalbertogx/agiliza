import { describe, expect, it, vi } from 'vitest';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { UpsertPaymentProviderConfigUseCase } from '@/application/usecases/upsert-payment-provider-config.usecase';

function createMocks() {
  const repo: PaymentProviderConfigRepositoryPort = {
    upsert: vi.fn().mockResolvedValue(undefined),
    findByTenantAndProvider: vi.fn().mockResolvedValue(null),
  };
  const encryption: EncryptionPort = {
    encrypt: vi.fn().mockImplementation((plaintext: string) => `encrypted:${plaintext}`),
    decrypt: vi.fn().mockImplementation((ciphertext: string) => ciphertext.replace('encrypted:', '')),
  };
  return { repo, encryption };
}

describe('UpsertPaymentProviderConfigUseCase', () => {
  it('should encrypt apiKey and persist via repository', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new UpsertPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute({
      tenantId: 'tenant-1',
      provider: 'asaas',
      apiKey: 'my-api-key',
      environment: 'sandbox',
    });

    expect(result.success).toBe(true);
    expect(encryption.encrypt).toHaveBeenCalledWith('my-api-key');
    expect(repo.upsert).toHaveBeenCalledWith('tenant-1', 'asaas', {
      apiKey: 'encrypted:my-api-key',
      environment: 'sandbox',
    });
  });

  it('should return validation error when tenantId is missing', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new UpsertPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute({
      tenantId: '',
      provider: 'asaas',
      apiKey: 'my-api-key',
      environment: 'sandbox',
    });

    expect(result.success).toBe(false);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should return validation error when apiKey is missing', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new UpsertPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute({
      tenantId: 'tenant-1',
      provider: 'asaas',
      apiKey: '',
      environment: 'sandbox',
    });

    expect(result.success).toBe(false);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should return validation error when provider is missing', async () => {
    const { repo, encryption } = createMocks();
    const usecase = new UpsertPaymentProviderConfigUseCase(repo, encryption);

    const result = await usecase.execute({
      tenantId: 'tenant-1',
      provider: '',
      apiKey: 'my-api-key',
      environment: 'sandbox',
    });

    expect(result.success).toBe(false);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
