import { describe, expect, it } from 'vitest';
import {
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
} from '@/application/types/either';

describe('Either', () => {
  describe('success', () => {
    it('should create a success Either', () => {
      const result = success(42);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should work with any type', () => {
      const result = success({ name: 'test' });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'test' });
    });
  });

  describe('failure', () => {
    it('should create a failure Either', () => {
      const result = failure('error message');
      expect(result.success).toBe(false);
      expect(result.value).toBe('error message');
    });

    it('should work with Error objects', () => {
      const error = new Error('test error');
      const result = failure(error);
      expect(result.success).toBe(false);
      expect(result.value).toBe(error);
    });
  });

  describe('isSuccess', () => {
    it('should return true for success', () => {
      const result = success(42);
      expect(isSuccess(result)).toBe(true);
    });

    it('should return false for failure', () => {
      const result = failure('error');
      expect(isSuccess(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = success(42);
      if (isSuccess(result)) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('isFailure', () => {
    it('should return true for failure', () => {
      const result = failure('error');
      expect(isFailure(result)).toBe(true);
    });

    it('should return false for success', () => {
      const result = success(42);
      expect(isFailure(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = failure('error');
      if (isFailure(result)) {
        expect(result.value).toBe('error');
      }
    });
  });

  describe('map', () => {
    it('should transform success value', () => {
      const result = success(2);
      const mapped = map(result, (x) => x * 2);
      expect(mapped.success).toBe(true);
      expect(mapped.value).toBe(4);
    });

    it('should not transform failure', () => {
      const result = failure('error');
      const mapped = map(result, (x) => x * 2);
      expect(mapped.success).toBe(false);
      expect(mapped.value).toBe('error');
    });
  });

  describe('mapError', () => {
    it('should transform failure value', () => {
      const result = failure('error');
      const mapped = mapError(result, (e) => new Error(e));
      expect(mapped.success).toBe(false);
      expect(mapped.value).toBeInstanceOf(Error);
    });

    it('should not transform success', () => {
      const result = success(42);
      const mapped = mapError(result, (e) => new Error(e));
      expect(mapped.success).toBe(true);
      expect(mapped.value).toBe(42);
    });
  });

  describe('flatMap', () => {
    it('should chain success to success', () => {
      const result = success(2);
      const chained = flatMap(result, (x) => success(x * 3));
      expect(chained.success).toBe(true);
      expect(chained.value).toBe(6);
    });

    it('should chain success to failure', () => {
      const result = success(2);
      const chained = flatMap(result, () => failure('error'));
      expect(chained.success).toBe(false);
      expect(chained.value).toBe('error');
    });

    it('should not chain failure', () => {
      const result = failure('error');
      const chained = flatMap(result, (x) => success(x * 3));
      expect(chained.success).toBe(false);
      expect(chained.value).toBe('error');
    });
  });

  describe('unwrap', () => {
    it('should return value for success', () => {
      const result = success(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for failure', () => {
      const result = failure('error');
      expect(() => unwrap(result)).toThrow('error');
    });
  });

  describe('unwrapOr', () => {
    it('should return value for success', () => {
      const result = success(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for failure', () => {
      const result = failure('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrapErr', () => {
    it('should return error for failure', () => {
      const result = failure('error');
      expect(unwrapErr(result)).toBe('error');
    });

    it('should throw for success', () => {
      const result = success(42);
      expect(() => unwrapErr(result)).toThrow('Expected failure but got success');
    });
  });
});
