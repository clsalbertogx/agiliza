import { describe, it, expect } from 'vitest';
import { Money } from '../../../domain/value-objects/money';
import { DomainError } from '../../../domain/errors/domain-error';

describe('Money Value Object', () => {
  describe('creation', () => {
    it('should create Money from a positive number', () => {
      const money = Money.create(100.5);
      expect(money.value()).toBe(100.5);
    });

    it('should create Money from zero', () => {
      const money = Money.create(0);
      expect(money.value()).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const money = Money.create(10.999);
      expect(money.value()).toBe(11.0);
    });

    it('should round to 2 decimal places (floor)', () => {
      const money = Money.create(10.001);
      expect(money.value()).toBe(10.0);
    });

    it('should create ZERO money', () => {
      const zero = Money.ZERO();
      expect(zero.value()).toBe(0);
    });
  });

  describe('validation', () => {
    it('should throw DomainError for negative amount', () => {
      expect(() => Money.create(-10)).toThrow(DomainError);
    });

    it('should throw DomainError for NaN', () => {
      expect(() => Money.create(NaN)).toThrow(DomainError);
    });

    it('should throw DomainError for Infinity', () => {
      expect(() => Money.create(Infinity)).toThrow(DomainError);
    });
  });

  describe('arithmetic', () => {
    it('should add two amounts', () => {
      const a = Money.create(100);
      const b = Money.create(50);
      const result = a.add(b);
      expect(result.value()).toBe(150);
    });

    it('should subtract a smaller amount', () => {
      const a = Money.create(100);
      const b = Money.create(30);
      const result = a.subtract(b);
      expect(result.value()).toBe(70);
    });

    it('should throw DomainError when subtraction results in negative', () => {
      const a = Money.create(30);
      const b = Money.create(100);
      expect(() => a.subtract(b)).toThrow(DomainError);
    });

    it('should multiply by a factor', () => {
      const a = Money.create(100);
      const result = a.multiply(3);
      expect(result.value()).toBe(300);
    });

    it('should multiply by a decimal factor', () => {
      const a = Money.create(100);
      const result = a.multiply(0.5);
      expect(result.value()).toBe(50);
    });

    it('should throw DomainError when multiplying by negative factor', () => {
      const a = Money.create(100);
      expect(() => a.multiply(-1)).toThrow(DomainError);
    });

    it('should throw DomainError when multiplying by NaN', () => {
      const a = Money.create(100);
      expect(() => a.multiply(NaN)).toThrow(DomainError);
    });
  });

  describe('comparison', () => {
    it('should consider equal amounts as equal', () => {
      const a = Money.create(100);
      const b = Money.create(100);
      expect(a.equals(b)).toBe(true);
    });

    it('should consider different amounts as not equal', () => {
      const a = Money.create(100);
      const b = Money.create(200);
      expect(a.equals(b)).toBe(false);
    });

    it('should detect greater than', () => {
      const a = Money.create(200);
      const b = Money.create(100);
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });

    it('should detect less than', () => {
      const a = Money.create(100);
      const b = Money.create(200);
      expect(a.isLessThan(b)).toBe(true);
      expect(b.isLessThan(a)).toBe(false);
    });
  });

  describe('toString and formatting', () => {
    it('should format as string with 2 decimal places', () => {
      const money = Money.create(100.5);
      expect(money.toString()).toBe('100.50');
    });

    it('should format as BRL currency', () => {
      const money = Money.create(1250.9);
      expect(money.toBRL()).toBe('R$ 1.250,90');
    });

    it('should format BRL with zero', () => {
      const money = Money.ZERO();
      expect(money.toBRL()).toBe('R$ 0,00');
    });
  });
});
