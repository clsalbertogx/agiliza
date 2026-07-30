import type { Either } from '@/application/types/either';
import type { ApplicationError } from '@/application/errors/application.error';

export interface UnitOfWorkPort {
  run<T>(fn: () => Promise<T>): Promise<Either<ApplicationError, T>>;
}