/**
 * Re-export from domain types to maintain backward compatibility.
 * Domain layer owns the Either type to comply with Clean Architecture
 * (domain must not depend on application layer).
 */
export {
  type Either,
  success,
  failure,
  isSuccess,
  isFailure,
  map,
  mapError,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapErr,
} from '@/domain/types/either';
