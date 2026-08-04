export interface PixChargeResponse {
  id: string;
  qrCode: string; // Base64 QRCode image
  copyPaste: string; // PIX Copy & Paste key
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
  }): Promise<PixChargeResponse>;

  createCreditCardCharge(input: CreditCardChargeInput): Promise<CreditCardChargeResponse>;

  createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResponse>;

  getCharge(providerPaymentId: string): Promise<any>;

  cancelCharge(providerPaymentId: string): Promise<void>;

  verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean>;

  handleWebhook(payload: any): {
    event: string;
    paymentId: string;
    status: string;
    metadata: Record<string, unknown>;
  };
}
