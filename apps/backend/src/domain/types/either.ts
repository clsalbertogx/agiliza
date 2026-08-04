export type Either<L, R> = { success: true; value: R } | { success: false; value: L };

export function success<R>(value: R): Either<never, R> {
  return { success: true, value };
}

export function failure<L>(value: L): Either<L, never> {
  return { success: false, value };
}

export function isSuccess<L, R>(either: Either<L, R>): either is { success: true; value: R } {
  return either.success === true;
}

export function isFailure<L, R>(either: Either<L, R>): either is { success: false; value: L } {
  return either.success === false;
}

export function map<L, R, R2>(either: Either<L, R>, fn: (value: R) => R2): Either<L, R2> {
  if (either.success) {
    return success(fn(either.value));
  }
  return either;
}

export function mapError<L, L2, R>(either: Either<L, R>, fn: (error: L) => L2): Either<L2, R> {
  if (!either.success) {
    return failure(fn(either.value));
  }
  return either;
}

export function flatMap<L, R, R2>(either: Either<L, R>, fn: (value: R) => Either<L, R2>): Either<L, R2> {
  if (either.success) {
    return fn(either.value);
  }
  return either;
}

export function unwrap<L, R>(either: Either<L, R>): R {
  if (either.success) {
    return either.value;
  }
  throw either.value;
}

export function unwrapOr<L, R>(either: Either<L, R>, defaultValue: R): R {
  if (either.success) {
    return either.value;
  }
  return defaultValue;
}

export function unwrapErr<L, R>(either: Either<L, R>): L {
  if (!either.success) {
    return either.value;
  }
  throw new Error('Expected failure but got success');
}
