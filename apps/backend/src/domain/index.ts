// Base entity
export { Entity } from './entities/base.entity';
// Entity schemas and factories
export {
  type Client,
  type ClientViewModel,
  type CreateClientInput,
  clientToPersistence,
  clientToViewModel,
  createClient,
  createClientFromPersistence,
  MessageChannel,
  type PersistenceClient,
  updateClient,
} from './entities/client';
export {
  type CreateInvoiceInput,
  canTransitionTo,
  createInvoice,
  createInvoiceFromPersistence,
  type Invoice,
  InvoiceStatus,
  type InvoiceViewModel,
  invoiceToPersistence,
  invoiceToViewModel,
  isOverdue,
  PaymentMethod,
  type PersistenceInvoice,
  updateInvoice,
} from './entities/invoice';
export {
  type CreatePaymentInput,
  createPayment,
  createPaymentFromPersistence,
  type Payment,
  PaymentProvider,
  PaymentStatus,
  type PaymentViewModel,
  type PersistencePayment,
  paymentToPersistence,
  paymentToViewModel,
  updatePayment,
} from './entities/payment';
export {
  BillingCycle,
  type CreateSubscriptionInput,
  cancelSubscription,
  createSubscription,
  createSubscriptionFromPersistence,
  type PersistenceSubscription,
  type Subscription,
  SubscriptionStatus,
  type SubscriptionViewModel,
  subscriptionToPersistence,
  subscriptionToViewModel,
  updateSubscription,
} from './entities/subscription';
export {
  type CreateTenantInput,
  createTenant,
  createTenantFromPersistence,
  PaymentProvider as TenantPaymentProvider,
  type PersistenceTenant,
  type Tenant,
  type TenantViewModel,
  tenantToPersistence,
  tenantToViewModel,
  updateTenant,
} from './entities/tenant';
// Domain errors
export { DomainError } from './errors/domain-error';

// Domain Events
export { createDomainEvent, type DomainEvent, type DomainEventType } from './events/domain-events';
export { Email } from './value-objects/email';
export { Money } from './value-objects/money';
// Value Objects
export { Phone } from './value-objects/phone';
export { RiskLevel, RiskScore, type RiskScoreProps } from './value-objects/risk-score';
export { TaxId } from './value-objects/tax-id';
