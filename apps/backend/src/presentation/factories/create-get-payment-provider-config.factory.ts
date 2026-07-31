import { GetPaymentProviderConfigUseCase } from '@/application/usecases/get-payment-provider-config.usecase';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';
import { createEncryptionService } from './create-encryption.factory';

export function createGetPaymentProviderConfigUseCase(): GetPaymentProviderConfigUseCase {
  return new GetPaymentProviderConfigUseCase(
    createPaymentProviderConfigRepository(),
    createEncryptionService(),
  );
}