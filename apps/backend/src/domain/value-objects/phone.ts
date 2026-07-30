import { DomainError } from '../errors/domain-error';

export class Phone {
  private readonly phone: string;

  private constructor(phone: string) {
    this.phone = this.validate(phone);
  }

  private validate(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      throw new DomainError(
        `Invalid phone number: must have 10-13 digits, got ${digits.length}`
      );
    }
    return digits;
  }

  static create(phone: string): Phone {
    return new Phone(phone);
  }

  value(): string {
    return this.phone;
  }

  formatted(): string {
    if (this.phone.length === 13) {
      // +55 (11) 99999-9999
      return `+${this.phone.slice(0, 2)} (${this.phone.slice(2, 4)}) ${this.phone.slice(4, 9)}-${this.phone.slice(9)}`;
    }
    if (this.phone.length === 11) {
      // (11) 99999-9999
      return `(${this.phone.slice(0, 2)}) ${this.phone.slice(2, 7)}-${this.phone.slice(7)}`;
    }
    if (this.phone.length === 10) {
      // (11) 9999-9999
      return `(${this.phone.slice(0, 2)}) ${this.phone.slice(2, 6)}-${this.phone.slice(6)}`;
    }
    return this.phone;
  }
}
