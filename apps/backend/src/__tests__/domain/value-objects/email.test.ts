import { describe, it, expect } from 'vitest';
import { Email } from '../../../domain/value-objects/email';
import { DomainError } from '../../../domain/errors/domain-error';

describe('Email Value Object', () => {
  describe('creation', () => {
    it('should create a valid email', () => {
      const email = Email.create('user@example.com');
      expect(email.value()).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const email = Email.create('  user@example.com  ');
      expect(email.value()).toBe('user@example.com');
    });

    it('should convert to lowercase', () => {
      const email = Email.create('USER@Example.COM');
      expect(email.value()).toBe('user@example.com');
    });

    it('should allow subdomains', () => {
      const email = Email.create('user@sub.example.com');
      expect(email.value()).toBe('user@sub.example.com');
    });

    it('should allow plus addressing', () => {
      const email = Email.create('user+tag@example.com');
      expect(email.value()).toBe('user+tag@example.com');
    });
  });

  describe('validation', () => {
    it('should throw DomainError for email without @', () => {
      expect(() => Email.create('invalid-email')).toThrow(DomainError);
    });

    it('should throw DomainError for email without domain', () => {
      expect(() => Email.create('user@')).toThrow(DomainError);
    });

    it('should throw DomainError for email without TLD', () => {
      expect(() => Email.create('user@example')).toThrow(DomainError);
    });

    it('should throw DomainError for empty string', () => {
      expect(() => Email.create('')).toThrow(DomainError);
    });

    it('should throw DomainError for email with spaces', () => {
      expect(() => Email.create('user @ example.com')).toThrow(DomainError);
    });
  });

  describe('domain', () => {
    it('should return the domain part', () => {
      const email = Email.create('user@example.com');
      expect(email.domain).toBe('example.com');
    });

    it('should return the full domain for subdomains', () => {
      const email = Email.create('user@sub.example.co.uk');
      expect(email.domain).toBe('sub.example.co.uk');
    });
  });

  describe('localPart', () => {
    it('should return the local part', () => {
      const email = Email.create('user@example.com');
      expect(email.localPart).toBe('user');
    });

    it('should return the full local part with plus tag', () => {
      const email = Email.create('user+tag@example.com');
      expect(email.localPart).toBe('user+tag');
    });
  });
});
