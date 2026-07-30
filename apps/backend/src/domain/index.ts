// Base entity
export { Entity } from './entities/base.entity';

// Domain errors
export { DomainError } from './errors/domain-error';

// Value Objects
export { Phone } from './value-objects/phone';
export { Email } from './value-objects/email';
export { Money } from './value-objects/money';
export { TaxId } from './value-objects/tax-id';
export { RiskScore, RiskLevel, type RiskScoreProps } from './value-objects/risk-score';

// Domain Events
export { createDomainEvent, type DomainEvent, type DomainEventType } from './events/domain-events';

// Entity schemas and factories
export { createClient, createClientFromPersistence, clientToPersistence, clientToViewModel, updateClient, type Client, type CreateClientInput, type PersistenceClient, type ClientViewModel, MessageChannel } from './entities/client';
export { createInvoice, createInvoiceFromPersistence, invoiceToPersistence, invoiceToViewModel, updateInvoice, isOverdue, canTransitionTo, type Invoice, type CreateInvoiceInput, type PersistenceInvoice, type InvoiceViewModel, InvoiceStatus, PaymentMethod } from './entities/invoice';
export { createPayment, createPaymentFromPersistence, paymentToPersistence, paymentToViewModel, updatePayment, type Payment, type CreatePaymentInput, type PersistencePayment, type PaymentViewModel, PaymentStatus, PaymentProvider } from './entities/payment';
export { createTenant, createTenantFromPersistence, tenantToPersistence, tenantToViewModel, updateTenant, type Tenant, type CreateTenantInput, type PersistenceTenant, type TenantViewModel, PaymentProvider as TenantPaymentProvider } from './entities/tenant';