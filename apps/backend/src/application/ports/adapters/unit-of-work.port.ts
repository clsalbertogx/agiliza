import type { Either } from '../../types/either';
import type { ApplicationError } from '../../errors/application.error';

export interface UnitOfWorkPort {
  run<T>(fn: () => Promise<T>): Promise<Either<ApplicationError, T>>;
}