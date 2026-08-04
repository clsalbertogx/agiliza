import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/errors/domain-error';
import { TaxId } from '@/domain/value-objects/tax-id';

describe('TaxId Value Object', () => {
  describe('CPF creation and validation', () => {
    it('should create a valid CPF', () => {
      const cpf = TaxId.create('529.982.247-25');
      expect(cpf.value()).toBe('52998224725');
      expect(cpf.type).toBe('CPF');
      expect(cpf.isCPF()).toBe(true);
      expect(cpf.isCNPJ()).toBe(false);
    });

    it('should create a valid CPF from digits only', () => {
      const cpf = TaxId.create('52998224725');
      expect(cpf.value()).toBe('52998224725');
    });

    it('should throw DomainError for invalid CPF check digits', () => {
      expect(() => TaxId.create('529.982.247-24')).toThrow(DomainError);
    });

    it('should throw DomainError for CPF with all same digits', () => {
      expect(() => TaxId.create('111.111.111-11')).toThrow(DomainError);
    });

    it('should throw DomainError for CPF with fewer than 11 digits', () => {
      expect(() => TaxId.create('123.456.789-0')).toThrow(DomainError);
    });
  });

  describe('CNPJ creation and validation', () => {
    it('should create a valid CNPJ', () => {
      const cnpj = TaxId.create('11.222.333/0001-81');
      expect(cnpj.value()).toBe('11222333000181');
      expect(cnpj.type).toBe('CNPJ');
      expect(cnpj.isCNPJ()).toBe(true);
      expect(cnpj.isCPF()).toBe(false);
    });

    it('should create a valid CNPJ from digits only', () => {
      const cnpj = TaxId.create('11222333000181');
      expect(cnpj.value()).toBe('11222333000181');
    });

    it('should throw DomainError for invalid CNPJ check digits', () => {
      expect(() => TaxId.create('11.222.333/0001-80')).toThrow(DomainError);
    });

    it('should throw DomainError for CNPJ with all same digits', () => {
      expect(() => TaxId.create('11.111.111/1111-11')).toThrow(DomainError);
    });

    it('should throw DomainError for CNPJ with fewer than 14 digits', () => {
      expect(() => TaxId.create('11.222.333/0001-8')).toThrow(DomainError);
    });
  });

  describe('formatting', () => {
    it('should format CPF with mask', () => {
      const cpf = TaxId.create('52998224725');
      expect(cpf.formatted()).toBe('529.982.247-25');
    });

    it('should format CNPJ with mask', () => {
      const cnpj = TaxId.create('11222333000181');
      expect(cnpj.formatted()).toBe('11.222.333/0001-81');
    });
  });

  describe('validation edge cases', () => {
    it('should throw DomainError for empty string', () => {
      expect(() => TaxId.create('')).toThrow(DomainError);
    });

    it('should throw DomainError for non-numeric string', () => {
      expect(() => TaxId.create('abcdefghijk')).toThrow(DomainError);
    });

    it('should throw DomainError for 12 digits (neither CPF nor CNPJ)', () => {
      expect(() => TaxId.create('123456789012')).toThrow(DomainError);
    });

    it('should work with another valid CPF (012.345.678-90)', () => {
      // CPF: 012.345.678-90 is a well-known test CPF
      const cpf = TaxId.create('01234567890');
      expect(cpf.value()).toBe('01234567890');
      expect(cpf.type).toBe('CPF');
    });

    it('should work with another valid CNPJ', () => {
      const cnpj = TaxId.create('04567895000100');
      expect(cnpj.value()).toBe('04567895000100');
      expect(cnpj.type).toBe('CNPJ');
    });
  });
});
