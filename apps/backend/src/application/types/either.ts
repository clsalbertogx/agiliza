/**
 * Re-export from domain types to maintain backward compatibility.
 * Domain layer owns the Either type to comply with Clean Architecture
 * (domain must not depend on application layer).
 */
export {
  type Either,
  failure,
  flatMap,
  isFailure,
  isSuccess,
  map,
  mapError,
  success,
  unwrap,
  unwrapErr,
  unwrapOr,
} from '@/domain/types/either';
