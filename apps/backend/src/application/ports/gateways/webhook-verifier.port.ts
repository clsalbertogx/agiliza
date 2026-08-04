import type { ApplicationError } from '@/application/errors/application.error';
import type { Either } from '@/application/types/either';

export interface WebhookVerifierPort {
  verify(
    provider: string,
    payload: string,
    signature: string,
    tenantId: string,
  ): Promise<Either<ApplicationError, boolean>>;
}
