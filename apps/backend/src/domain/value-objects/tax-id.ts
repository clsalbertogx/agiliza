import { DomainError } from '../errors/domain-error';

export type TaxIdType = 'CPF' | 'CNPJ';

export class TaxId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = this.validate(value);
  }

  private validate(taxId: string): string {
    const digits = taxId.replace(/\D/g, '');

    if (digits.length !== 11 && digits.length !== 14) {
      throw new DomainError(
        `Invalid tax ID: must have 11 (CPF) or 14 (CNPJ) digits, got ${digits.length}`
      );
    }

    // Validate check digits based on length
    if (digits.length === 11 && !TaxId.isValidCPF(digits)) {
      throw new DomainError('Invalid CPF: check digits do not match');
    }

    if (digits.length === 14 && !TaxId.isValidCNPJ(digits)) {
      throw new DomainError('Invalid CNPJ: check digits do not match');
    }

    return digits;
  }

  static create(taxId: string): TaxId {
    return new TaxId(taxId);
  }

  value(): string {
    return this._value;
  }

  get type(): TaxIdType {
    return this._value.length === 11 ? 'CPF' : 'CNPJ';
  }

  formatted(): string {
    if (this._value.length === 11) {
      // 123.456.789-09
      return this._value.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        '$1.$2.$3-$4'
      );
    }
    // 12.345.678/0001-90
    return this._value.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  /**
   * Validates CPF check digits.
   */
  private static isValidCPF(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false; // All same digits

    const digits = cpf.split('').map(Number);

    // First check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    const digit1 = remainder === 10 ? 0 : remainder;
    if (digits[9] !== digit1) return false;

    // Second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    remainder = (sum * 10) % 11;
    const digit2 = remainder === 10 ? 0 : remainder;
    if (digits[10] !== digit2) return false;

    return true;
  }

  /**
   * Validates CNPJ check digits.
   */
  private static isValidCNPJ(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) return false; // All same digits

    const digits = cnpj.split('').map(Number);

    // First check digit
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * weights1[i];
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digits[12] !== digit1) return false;

    // Second check digit
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += digits[i] * weights2[i];
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (digits[13] !== digit2) return false;

    return true;
  }

  isCPF(): boolean {
    return this.type === 'CPF';
  }

  isCNPJ(): boolean {
    return this.type === 'CNPJ';
  }
}
