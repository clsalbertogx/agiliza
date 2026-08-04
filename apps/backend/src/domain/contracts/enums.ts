// API Contract Enums — Canonical source for the public API contract.
// Frontend imports these via @agiliza/shared (which re-exports from here).
// Backend domain entities import directly from here (not from @agiliza/shared).

/** Supported payment gateway providers. */
export enum PaymentProvider {
  ASAAS = 'asaas',
  MERCADO_PAGO = 'mercadopago',
  PAGBANK = 'pagbank',
  POLAR = 'polar',
}

/** Payment methods supported by the platform. */
export enum PaymentMethod {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

/** Invoice status values (wire format: UPPERCASE). */
export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

/** Client risk score tiers (3-level: Green/Yellow/Red). */
export enum ClientRiskScore {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

/** Communication channels for outbound messages. */
export enum MessageChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}
