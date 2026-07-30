import { DomainError } from '../errors/domain-error';

export class Money {
  private readonly amount: number;

  private constructor(amount: number) {
    this.amount = this.validate(amount);
  }

  private validate(amount: number): number {
    if (!Number.isFinite(amount)) {
      throw new DomainError('Amount must be a finite number');
    }
    if (amount < 0) {
      throw new DomainError('Amount must not be negative');
    }
    // Round to 2 decimal places to avoid floating-point issues
    const rounded = Math.round(amount * 100) / 100;
    return rounded;
  }

  static create(amount: number): Money {
    return new Money(amount);
  }

  static ZERO(): Money {
    return new Money(0);
  }

  value(): number {
    return this.amount;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new DomainError('Subtraction result must not be negative');
    }
    return new Money(result);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new DomainError('Multiplication factor must be a finite number');
    }
    if (factor < 0) {
      throw new DomainError('Multiplication factor must not be negative');
    }
    return new Money(this.amount * factor);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    return this.amount < other.amount;
  }

  toString(): string {
    return this.amount.toFixed(2);
  }

  toBRL(): string {
    const [integerPart, decimalPart] = this.amount.toFixed(2).split('.');
    // Add thousands separator (period) every 3 digits from the right
    const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${withThousands},${decimalPart}`;
  }
}
