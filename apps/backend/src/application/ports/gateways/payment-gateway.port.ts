import type { Either } from '@/application/types/either';
import type { ApplicationError } from '@/application/errors/application.error';

export interface PixChargeResponse {
  id: string;
  qrCode: string;
  copyPaste: string;
  expiresAt: Date;
  status: string;
}

export interface CreditCardChargeInput {
  amount: number;
  description: string;
  customerId?: string;
  externalReference?: string;
  token?: string;
  installments?: number;
}

export interface CreditCardChargeResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  fee?: number;
  netAmount?: number;
}

export interface BoletoChargeInput {
  amount: number;
  description: string;
  customerId?: string;
  externalReference?: string;
  payerName?: string;
  payerEmail?: string;
  payerCpfCnpj?: string;
  payerAddress?: Record<string, unknown>;
  dueDate?: Date;
}

export interface BoletoChargeResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  barcode: string;
  boletoUrl?: string;
  dueDate?: Date;
}

export interface PaymentGatewayPort {
  createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<Either<ApplicationError, PixChargeResponse>>;

  createCreditCardCharge(input: CreditCardChargeInput): Promise<Either<ApplicationError, CreditCardChargeResponse>>;

  createBoletoCharge(input: BoletoChargeInput): Promise<Either<ApplicationError, BoletoChargeResponse>>;

  getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>>;

  cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>>;

  verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean>;

  handleWebhook(payload: unknown): Either<ApplicationError, {
    event: string;
    paymentId: string;
    status: string;
    metadata: Record<string, unknown>;
  }>;
}
