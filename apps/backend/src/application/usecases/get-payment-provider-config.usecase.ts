import { ApplicationError } from '@/application/errors/application.error';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { type Either, failure, success } from '@/application/types/either';

export interface GetPaymentProviderConfigOutput {
  apiKey: string;
  environment: string;
}

export class GetPaymentProviderConfigUseCase {
  constructor(
    private readonly paymentProviderConfigRepo: PaymentProviderConfigRepositoryPort,
    private readonly encryption: EncryptionPort,
  ) {}

  async execute(
    tenantId: string,
    provider: string,
  ): Promise<Either<ApplicationError, GetPaymentProviderConfigOutput | null>> {
    if (!tenantId) {
      return failure(ApplicationError.validation('Tenant ID is required'));
    }
    if (!provider) {
      return failure(ApplicationError.validation('Provider is required'));
    }

    const config = await this.paymentProviderConfigRepo.findByTenantAndProvider(tenantId, provider);
    if (!config) {
      return success(null);
    }

    const decryptedApiKey = this.encryption.decrypt(config.apiKey);

    return success({
      apiKey: decryptedApiKey,
      environment: config.environment,
    });
  }
}
