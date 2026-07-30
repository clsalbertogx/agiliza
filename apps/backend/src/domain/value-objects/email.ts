import { DomainError } from '../errors/domain-error';

export class Email {
  private readonly email: string;

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(email: string) {
    this.email = this.validate(email);
  }

  private validate(email: string): string {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      throw new DomainError('Email must not be empty');
    }
    if (trimmed.length > 254) {
      throw new DomainError('Email must not exceed 254 characters');
    }
    if (!Email.EMAIL_REGEX.test(trimmed)) {
      throw new DomainError(`Invalid email format: ${email}`);
    }
    return trimmed;
  }

  static create(email: string): Email {
    return new Email(email);
  }

  value(): string {
    return this.email;
  }

  get domain(): string {
    return this.email.split('@')[1];
  }

  get localPart(): string {
    return this.email.split('@')[0];
  }

  equals(other: Email): boolean {
    return this.email === other.email;
  }
}