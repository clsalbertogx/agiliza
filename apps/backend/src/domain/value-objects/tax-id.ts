import { DomainError } from '../errors/domain-error';

export class TaxId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = this.validate(value);
  }

  private validate(value: string): string {
    const digits = value.replace(/\D/g, '');

    if (digits.length === 11) {
      if (!this.validateCPF(digits)) {
        throw new DomainError('Invalid CPF');
      }
      return digits;
    }

    if (digits.length === 14) {
      if (!this.validateCNPJ(digits)) {
        throw new DomainError('Invalid CNPJ');
      }
      return digits;
    }

    throw new DomainError('Tax ID must be 11 digits (CPF) or 14 digits (CNPJ)');
  }

  private validateCPF(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i], 10) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf[9], 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i], 10) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf[10], 10)) return false;

    return true;
  }

  private validateCNPJ(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i], 10) * weights1[i];
    }
    let digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(cnpj[12], 10)) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i], 10) * weights2[i];
    }
    digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(cnpj[13], 10)) return false;

    return true;
  }

  static create(value: string): TaxId {
    return new TaxId(value);
  }

  value(): string {
    return this._value;
  }

  get type(): 'CPF' | 'CNPJ' {
    return this._value.length === 11 ? 'CPF' : 'CNPJ';
  }

  formatted(): string {
    if (this._value.length === 11) {
      return this._value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return this._value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  isCPF(): boolean {
    return this._value.length === 11;
  }

  isCNPJ(): boolean {
    return this._value.length === 14;
  }

  equals(other: TaxId): boolean {
    return this._value === other._value;
  }
}
