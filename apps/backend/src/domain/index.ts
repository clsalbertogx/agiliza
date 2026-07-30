// Base entity
export { Entity } from './entities/base.entity';

// Domain errors
export { DomainError } from './errors/domain-error';

// Value Objects (import directly from domain/value-objects/* for full module imports)
export { Phone } from './value-objects/phone';
export { Email } from './value-objects/email';
export { Money } from './value-objects/money';
export { TaxId, TaxIdType } from './value-objects/tax-id';
export {
  InvoiceStatus as InvoiceStatusVO,
  InvoiceStatusEnum,
} from './value-objects/invoice-status';
export {
  RiskScore as RiskScoreVO,
  RiskLevel,
  type RiskScoreProps,
} from './value-objects/risk-score';

// Domain Events
export { createDomainEvent, type DomainEvent, type DomainEventType } from './events/domain-events';

// Entity schemas — import directly from domain/entities/* for these
export { clientSchema, createClient, RiskScore, MessageChannel, type Client } from './entities/client';
export { invoiceSchema, createInvoice, isOverdue, canTransitionTo, InvoiceStatus, PaymentMethod, type Invoice } from './entities/invoice';
export { paymentSchema, type Payment } from './entities/payment';
