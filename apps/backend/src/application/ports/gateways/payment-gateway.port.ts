import type { Either } from '../../types/either';
import type { ApplicationError } from '../../errors/application.error';

export interface PixChargeResponse {
  id: string;
  qrCode: string;
  copyPaste: string;
  expiresAt: Date;
  status: string;
}

export interface PaymentGatewayPort {
  createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<Either<ApplicationError, PixChargeResponse>>;

  getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>>;

  cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>>;

  handleWebhook(payload: unknown): Either<ApplicationError, {
    event: string;
    paymentId: string;
    status: string;
    metadata: Record<string, unknown>;
  }>;
}