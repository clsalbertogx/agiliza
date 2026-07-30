// API Contract Interfaces — Canonical source for the public API contract.
// Frontend imports these via @agiliza/shared (which re-exports from here).
// Backend mappers/presenters convert domain entities to these shapes.

import {
  PaymentProvider,
  PaymentMethod,
  InvoiceStatus,
  ClientRiskScore,
  MessageChannel,
} from './enums';

/** Client profile as returned by the REST API. */
export interface ClientProfile {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  preferredChannel: MessageChannel;
  preferredTime?: string;
  preferredLeadDays: number;
  riskScore: ClientRiskScore;
  riskScoreReason?: unknown;
  riskScoreUpdatedAt?: Date;
  totalInvoices: number;
  paidInvoices: number;
  avgPaymentDelay?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Invoice as returned by the REST API. */
export interface Invoice {
  id: string;
  tenantId: string;
  clientId: string;
  amount: number;
  dueDate: Date;
  description?: string;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  pixQRCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;
  externalPaymentId?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Payment-related event visible to the frontend activity feed. */
export interface PaymentEvent {
  id: string;
  type:
    | 'message_sent'
    | 'message_read'
    | 'link_clicked'
    | 'payment_confirmed'
    | 'payment_failed';
  clientId: string;
  invoiceId?: string;
  timestamp: Date;
  channel: MessageChannel;
  metadata: Record<string, unknown>;
}

// Re-export enums for convenience when importing interfaces
export type {
  PaymentProvider,
  PaymentMethod,
  InvoiceStatus,
  ClientRiskScore,
  MessageChannel,
} from './enums';