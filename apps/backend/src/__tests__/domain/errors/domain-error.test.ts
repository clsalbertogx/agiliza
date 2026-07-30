import { describe, it, expect } from 'vitest';
import { DomainError } from '@/domain/errors/domain-error';

describe('DomainError', () => {
  it('should create a DomainError with a message', () => {
    const error = new DomainError('Something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Something went wrong');
  });

  it('should have the name "DomainError"', () => {
    const error = new DomainError('Test error');
    expect(error.name).toBe('DomainError');
  });

  it('should preserve the stack trace', () => {
    const error = new DomainError('Stack trace test');
    expect(error.stack).toBeDefined();
  });

  it('should work with throw and catch', () => {
    expect(() => {
      throw new DomainError('Thrown error');
    }).toThrow(DomainError);

    expect(() => {
      throw new DomainError('Thrown error');
    }).toThrow('Thrown error');
  });
});
