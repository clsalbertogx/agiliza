import { DomainError } from '../errors/domain-error';

export enum InvoiceStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

/**
 * Allowed state transitions for invoice status.
 * Maps each status to the list of statuses it can transition to.
 */
const ALLOWED_TRANSITIONS: Record<InvoiceStatusEnum, InvoiceStatusEnum[]> = {
  [InvoiceStatusEnum.PENDING]: [
    InvoiceStatusEnum.PAID,
    InvoiceStatusEnum.OVERDUE,
    InvoiceStatusEnum.CANCELLED,
  ],
  [InvoiceStatusEnum.PAID]: [InvoiceStatusEnum.REFUNDED],
  [InvoiceStatusEnum.OVERDUE]: [
    InvoiceStatusEnum.PAID,
    InvoiceStatusEnum.CANCELLED,
  ],
  [InvoiceStatusEnum.CANCELLED]: [],
  [InvoiceStatusEnum.REFUNDED]: [],
};

export class InvoiceStatus {
  private readonly status: InvoiceStatusEnum;

  private constructor(status: InvoiceStatusEnum) {
    this.status = status;
  }

  static create(status: InvoiceStatusEnum): InvoiceStatus {
    return new InvoiceStatus(status);
  }

  static PENDING(): InvoiceStatus {
    return new InvoiceStatus(InvoiceStatusEnum.PENDING);
  }

  static PAID(): InvoiceStatus {
    return new InvoiceStatus(InvoiceStatusEnum.PAID);
  }

  static OVERDUE(): InvoiceStatus {
    return new InvoiceStatus(InvoiceStatusEnum.OVERDUE);
  }

  static CANCELLED(): InvoiceStatus {
    return new InvoiceStatus(InvoiceStatusEnum.CANCELLED);
  }

  static REFUNDED(): InvoiceStatus {
    return new InvoiceStatus(InvoiceStatusEnum.REFUNDED);
  }

  value(): InvoiceStatusEnum {
    return this.status;
  }

  canTransitionTo(target: InvoiceStatus): boolean {
    return ALLOWED_TRANSITIONS[this.status]?.includes(target.status) ?? false;
  }

  transitionTo(target: InvoiceStatus): InvoiceStatus {
    if (!this.canTransitionTo(target)) {
      throw new DomainError(
        `Cannot transition from ${this.status} to ${target.status}`
      );
    }
    return target;
  }

  isPending(): boolean {
    return this.status === InvoiceStatusEnum.PENDING;
  }

  isPaid(): boolean {
    return this.status === InvoiceStatusEnum.PAID;
  }

  isOverdue(): boolean {
    return this.status === InvoiceStatusEnum.OVERDUE;
  }

  isCancelled(): boolean {
    return this.status === InvoiceStatusEnum.CANCELLED;
  }

  isRefunded(): boolean {
    return this.status === InvoiceStatusEnum.REFUNDED;
  }

  isTerminal(): boolean {
    return (
      this.status === InvoiceStatusEnum.CANCELLED ||
      this.status === InvoiceStatusEnum.REFUNDED
    );
  }

  isActive(): boolean {
    return (
      this.status === InvoiceStatusEnum.PENDING ||
      this.status === InvoiceStatusEnum.OVERDUE
    );
  }

  toString(): string {
    return this.status;
  }
}
