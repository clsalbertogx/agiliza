import { GetPaymentProviderConfigUseCase } from '@/application/usecases/get-payment-provider-config.usecase';
import { createEncryptionService } from './create-encryption.factory';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';

export function createGetPaymentProviderConfigUseCase(): GetPaymentProviderConfigUseCase {
  return new GetPaymentProviderConfigUseCase(createPaymentProviderConfigRepository(), createEncryptionService());
}
