import type { Either } from '../../types/either';
import type { ApplicationError } from '../../errors/application.error';

export interface WebhookVerifierPort {
  verify(
    provider: string,
    payload: string,
    signature: string,
    tenantId: string
  ): Promise<Either<ApplicationError, boolean>>;
}