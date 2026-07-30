export interface PaymentWebhookData {
  providerPaymentId: string;
  status: 'confirmed' | 'failed' | 'refunded';
  invoiceId?: string;
  amount?: number;
  paidAt?: Date;
  rawPayload: Record<string, unknown>;
}

export interface PaymentWebhookParserPort {
  parse(provider: string, payload: Record<string, unknown>): PaymentWebhookData | null;
}
