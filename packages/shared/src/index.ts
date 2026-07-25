// Shared types for Agiliza platform

export type PaymentProvider = 'asaas' | 'mercadopago' | 'pagbank' | 'polar';
export type PaymentMethod = 'pix' | 'boleto' | 'credit_card';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type ClientRiskScore = 'green' | 'yellow' | 'red';
export type MessageChannel = 'whatsapp' | 'email' | 'sms';

export interface ClientProfile {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  preferredChannel: MessageChannel;
  preferredTime?: string;
  preferredLeadDays: number;
  riskScore: ClientRiskScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  clientId: string;
  tenantId: string;
  amount: number;
  dueDate: Date;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  externalPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEvent {
  id: string;
  type: 'message_sent' | 'message_read' | 'link_clicked' | 'payment_confirmed' | 'payment_failed';
  clientId: string;
  invoiceId?: string;
  timestamp: Date;
  channel: MessageChannel;
  metadata: Record<string, unknown>;
}
