import { ApplicationError } from '@/application/errors/application.error';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { type Either, failure, success } from '@/application/types/either';

export interface UpsertPaymentProviderConfigInput {
  tenantId: string;
  provider: string;
  apiKey: string;
  environment: string;
}

export class UpsertPaymentProviderConfigUseCase {
  constructor(
    private readonly paymentProviderConfigRepo: PaymentProviderConfigRepositoryPort,
    private readonly encryption: EncryptionPort,
  ) {}

  async execute(input: UpsertPaymentProviderConfigInput): Promise<Either<ApplicationError, void>> {
    if (!input.tenantId) {
      return failure(ApplicationError.validation('Tenant ID is required'));
    }
    if (!input.provider) {
      return failure(ApplicationError.validation('Provider is required'));
    }
    if (!input.apiKey) {
      return failure(ApplicationError.validation('API key is required'));
    }

    const encryptedApiKey = this.encryption.encrypt(input.apiKey);

    await this.paymentProviderConfigRepo.upsert(input.tenantId, input.provider, {
      apiKey: encryptedApiKey,
      environment: input.environment,
    });

    return success(undefined);
  }
}
