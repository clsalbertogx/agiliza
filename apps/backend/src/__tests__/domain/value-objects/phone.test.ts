import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/errors/domain-error';
import { Phone } from '@/domain/value-objects/phone';

describe('Phone Value Object', () => {
  describe('creation', () => {
    it('should create a phone with 10 digits (landline)', () => {
      const phone = Phone.create('1198765432');
      expect(phone.value()).toBe('1198765432');
    });

    it('should create a phone with 11 digits (mobile)', () => {
      const phone = Phone.create('11987654321');
      expect(phone.value()).toBe('11987654321');
    });

    it('should create a phone with 13 digits (international)', () => {
      const phone = Phone.create('5511987654321');
      expect(phone.value()).toBe('5511987654321');
    });

    it('should strip non-digit characters', () => {
      const phone = Phone.create('(11) 98765-4321');
      expect(phone.value()).toBe('11987654321');
    });

    it('should strip international prefix formatting', () => {
      const phone = Phone.create('+55 (11) 98765-4321');
      expect(phone.value()).toBe('5511987654321');
    });
  });

  describe('validation', () => {
    it('should throw DomainError for less than 10 digits', () => {
      expect(() => Phone.create('119876543')).toThrow(DomainError);
    });

    it('should throw DomainError for more than 13 digits', () => {
      expect(() => Phone.create('551191987654321')).toThrow(DomainError);
    });

    it('should throw DomainError for empty string', () => {
      expect(() => Phone.create('')).toThrow(DomainError);
    });

    it('should throw DomainError for non-numeric string with no digits', () => {
      expect(() => Phone.create('abc-defg-hij')).toThrow(DomainError);
    });
  });

  describe('formatted', () => {
    it('should format 11-digit mobile number', () => {
      const phone = Phone.create('11987654321');
      expect(phone.formatted()).toBe('(11) 98765-4321');
    });

    it('should format 10-digit landline number', () => {
      const phone = Phone.create('1198765432');
      expect(phone.formatted()).toBe('(11) 9876-5432');
    });

    it('should format 13-digit international number', () => {
      const phone = Phone.create('5511987654321');
      expect(phone.formatted()).toBe('+55 (11) 98765-4321');
    });
  });

  describe('value', () => {
    it('should return the raw digits', () => {
      const phone = Phone.create('(11) 98765-4321');
      expect(phone.value()).toBe('11987654321');
    });
  });
});
