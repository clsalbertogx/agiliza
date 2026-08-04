import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoGateway, type MercadoPagoSdk } from '@/infrastructure/payment/mercadopago.gateway';

function buildMockSdk(): { sdk: MercadoPagoSdk; MercadoPagoConfig: any; Payment: any } {
  const sdk: MercadoPagoSdk = {
    create: vi.fn(),
    get: vi.fn(),
    cancel: vi.fn(),
  };
  const MercadoPagoConfig = vi.fn().mockImplementation(() => ({ accessToken: 'mock' }));
  const Payment = vi.fn().mockImplementation(() => sdk);
  return { sdk, MercadoPagoConfig, Payment };
}

describe('MercadoPagoGateway', () => {
  let gateway: MercadoPagoGateway;
  let mockSdk: { sdk: MercadoPagoSdk; MercadoPagoConfig: any; Payment: any };

  beforeEach(() => {
    mockSdk = buildMockSdk();
    gateway = new MercadoPagoGateway({
      accessToken: 'test_access_token',
      publicKey: 'test_public_key',
      webhookSecret: 'test_webhook_secret',
      environment: 'sandbox',
      sdkFactory: () => ({ MercadoPagoConfig: mockSdk.MercadoPagoConfig, Payment: mockSdk.Payment }),
    });
  });

  describe('createPixCharge', () => {
    it('should create a PIX charge and return a PixChargeResponse', async () => {
      mockSdk.sdk.create = vi.fn().mockResolvedValue({
        id: '123456789',
        status: 'pending',
        point_of_interaction: {
          transaction_data: {
            qr_code: '00020126580014BR.GOV.BCB.PIX',
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUg==',
            ticket_url: 'https://mp.com/pix/ticket',
          },
        },
      });

      const result = await gateway.createPixCharge({
        amount: 100.5,
        description: 'Test PIX charge',
        externalReference: 'invoice-001',
      });

      expect(mockSdk.sdk.create).toHaveBeenCalledTimes(1);
      const callArg = (mockSdk.sdk.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.body.transaction_amount).toBe(100.5);
      expect(callArg.body.payment_method_id).toBe('pix');
      expect(callArg.body.external_reference).toBe('invoice-001');

      expect(result.id).toBe('123456789');
      expect(result.qrCode).toBe('iVBORw0KGgoAAAANSUhEUg==');
      expect(result.copyPaste).toBe('00020126580014BR.GOV.BCB.PIX');
      expect(result.status).toBe('pending');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw an error when the MP API call fails', async () => {
      mockSdk.sdk.create = vi.fn().mockRejectedValue(new Error('Invalid access token'));

      await expect(
        gateway.createPixCharge({
          amount: 50,
          description: 'Failing charge',
        }),
      ).rejects.toThrow('MercadoPago error: Invalid access token');
    });
  });

  describe('createCreditCardCharge', () => {
    it('should create a credit-card charge and return the response', async () => {
      mockSdk.sdk.create = vi.fn().mockResolvedValue({
        id: '987654321',
        status: 'approved',
        transaction_amount: 200,
        fee_details: [{ amount: 5 }],
        net_amount: 191,
      });

      const result = await gateway.createCreditCardCharge({
        amount: 200,
        description: 'Card charge',
        token: 'card_token_xyz',
        customerId: 'cust-123',
        installments: 3,
      });

      const callArg = (mockSdk.sdk.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.body.transaction_amount).toBe(200);
      expect(callArg.body.payment_method_id).toBe('master');
      expect(callArg.body.token).toBe('card_token_xyz');
      expect(callArg.body.installments).toBe(3);

      expect(result.id).toBe('987654321');
      expect(result.status).toBe('approved');
      expect(result.amount).toBe(200);
      expect(result.paymentMethod).toBe('CREDIT_CARD');
      expect(result.fee).toBe(5);
      expect(result.netAmount).toBe(191);
    });
  });

  describe('createBoletoCharge', () => {
    it('should create a boleto and return the response with barcode', async () => {
      mockSdk.sdk.create = vi.fn().mockResolvedValue({
        id: 'boleto-123',
        status: 'pending',
        transaction_amount: 300,
        barcode: { content: '0019000123456789' },
        transaction_details: { external_resource_url: 'https://mp.com/boleto/123.pdf' },
      });

      const result = await gateway.createBoletoCharge({
        amount: 300,
        description: 'Boleto test',
        payerName: 'João Silva',
        payerEmail: 'joao@test.com',
        payerCpfCnpj: '12345678901',
        dueDate: new Date('2025-01-01'),
      });

      expect(result.id).toBe('boleto-123');
      expect(result.barcode).toBe('0019000123456789');
      expect(result.boletoUrl).toBe('https://mp.com/boleto/123.pdf');
      expect(result.dueDate).toEqual(new Date('2025-01-01'));
    });
  });

  describe('getCharge', () => {
    it('should retrieve a charge by id', async () => {
      mockSdk.sdk.get = vi.fn().mockResolvedValue({ id: '123456789', status: 'approved', amount: 100 });

      const result = await gateway.getCharge('123456789');
      expect(mockSdk.sdk.get).toHaveBeenCalledWith({ id: '123456789' });
      expect(result.status).toBe('approved');
    });
  });

  describe('cancelCharge', () => {
    it('should cancel a charge by id', async () => {
      mockSdk.sdk.cancel = vi.fn().mockResolvedValue({ deleted: true });
      await gateway.cancelCharge('123456789');
      expect(mockSdk.sdk.cancel).toHaveBeenCalledWith({ id: '123456789' });
    });
  });

  describe('verifyWebhook', () => {
    it('should return false for a non-mercadopago provider', async () => {
      const result = await gateway.verifyWebhook('asaas', '{}', 'sig');
      expect(result).toBe(false);
    });

    it('should return false when no webhookSecret is configured', async () => {
      const gw = new MercadoPagoGateway({ accessToken: 'tok' });
      const result = await gw.verifyWebhook('mercadopago', '{"data":{"id":"123"}}', 'ts=1,v1=abc');
      expect(result).toBe(false);
    });

    it('should return false for an invalid signature format', async () => {
      const result = await gateway.verifyWebhook('mercadopago', '{"data":{"id":"123"}}', 'invalid-signature');
      expect(result).toBe(false);
    });

    it('should return true for a valid signature', async () => {
      const crypto = require('node:crypto');
      const secret = 'test_webhook_secret';
      const body = '{"data":{"id":"evt-123"}}';
      const ts = Math.floor(Date.now() / 1000).toString();
      const dataId = 'evt-123';
      const manifest = `id:${dataId};request-id:${dataId};ts:${ts};`;
      const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      const signature = `ts=${ts},v1=${hash}`;

      const result = await gateway.verifyWebhook('mercadopago', body, signature);
      expect(result).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('should parse a webhook payload and return event metadata', () => {
      const payload = {
        type: 'payment',
        action: 'payment.updated',
        data: { id: 'payment-123' },
      };

      const result = gateway.handleWebhook(payload);

      expect(result.event).toBe('payment');
      expect(result.paymentId).toBe('payment-123');
      expect(result.status).toBe('payment.updated');
      expect(result.metadata.provider).toBe('mercadopago');
    });
  });

  describe('constructor', () => {
    it('should throw if accessToken is missing', () => {
      expect(() => new MercadoPagoGateway({ accessToken: '' })).toThrow('MercadoPago accessToken is required');
    });
  });
});
