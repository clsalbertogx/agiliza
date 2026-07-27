export interface PixChargeResponse {
  id: string;
  qrCode: string;       // Base64 QRCode image
  copyPaste: string;    // PIX Copy & Paste key
  expiresAt: Date;
  status: string;
}

export interface PaymentGatewayPort {
  createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<PixChargeResponse>;

  getCharge(providerPaymentId: string): Promise<any>;
  
  cancelCharge(providerPaymentId: string): Promise<void>;

  handleWebhook(payload: any): {
    event: string;
    paymentId: string;
    status: string;
    metadata: Record<string, unknown>;
  };
}
