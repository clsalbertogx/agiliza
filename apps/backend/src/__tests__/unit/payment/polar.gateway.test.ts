import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PolarClient, PolarGateway } from '@/infrastructure/payment/polar.gateway';

function buildMockClient(): PolarClient {
  return {
    createCheckout: vi.fn(),
    getCheckout: vi.fn(),
    cancelCheckout: vi.fn(),
  };
}

describe('PolarGateway', () => {
  let gateway: PolarGateway;
  let mockClient: PolarClient;

  beforeEach(() => {
    mockClient = buildMockClient();
    gateway = new PolarGateway({
      accessToken: 'test_access_token',
      webhookSecret: 'test_webhook_secret',
      environment: 'sandbox',
      clientFactory: () => mockClient,
    });
  });

  describe('constructor', () => {
    it('should throw if accessToken is missing', () => {
      expect(() => new PolarGateway({ accessToken: '' })).toThrow('Polar accessToken is required');
    });
  });

  describe('createPixCharge', () => {
    it('should create a PIX charge and return a PixChargeResponse', async () => {
      mockClient.createCheckout = vi.fn().mockResolvedValue({
        id: 'ch_pix_123',
        status: 'pending',
        amount: 10050,
        currency: 'BRL',
        payment_method: {
          type: 'pix',
          pix: {
            qr_code: 'data:image/png;base64,qr_polar',
            qr_code_text: 'pix://polar123',
          },
        },
      });

      const result = await gateway.createPixCharge({
        amount: 100.5,
        description: 'Test PIX charge',
        externalReference: 'price_pix_abc',
      });

      expect(mockClient.createCheckout).toHaveBeenCalledTimes(1);
      const callArg = (mockClient.createCheckout as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.product_price_id).toBe('price_pix_abc');
      expect(callArg.amount).toBe(10050);
      expect(callArg.currency).toBe('BRL');

      expect(result.id).toBe('ch_pix_123');
      expect(result.qrCode).toBe('data:image/png;base64,qr_polar');
      expect(result.copyPaste).toBe('pix://polar123');
      expect(result.status).toBe('pending');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw when Polar API call fails', async () => {
      mockClient.createCheckout = vi.fn().mockRejectedValue(new Error('Unauthorized'));

      await expect(gateway.createPixCharge({ amount: 50, description: 'Failing charge' })).rejects.toThrow(
        'Polar error: Unauthorized',
      );
    });
  });

  describe('createCreditCardCharge', () => {
    it('should create a credit-card charge and return the response', async () => {
      mockClient.createCheckout = vi.fn().mockResolvedValue({
        id: 'cholar_cc_456',
        status: 'confirmed',
        amount: 20000,
        currency: 'BRL',
      });

      const result = await gateway.createCreditCardCharge({
        amount: 200,
        description: 'Card charge',
        token: 'tok_card_visa',
        customerId: 'cust-123',
        installments: 1,
      });

      const callArg = (mockClient.createCheckout as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount).toBe(20000);
      expect(callArg.payment_method_type).toBe('card');
      expect(callArg.customer_id).toBe('cust-123');

      expect(result.id).toBe('cholar_cc_456');
      expect(result.status).toBe('confirmed');
      expect(result.amount).toBe(200);
      expect(result.paymentMethod).toBe('CREDIT_CARD');
    });
  });

  describe('createBoletoCharge', () => {
    it('should create a boleto charge and return the response', async () => {
      mockClient.createCheckout = vi.fn().mockResolvedValue({
        id: 'cholar_boleto_789',
        status: 'pending',
        amount: 35000,
        currency: 'BRL',
        payment_method: {
          type: 'boleto',
          boleto: {
            barcode: '0019000123456789',
            url: 'https://polar.sh/checkouts/boleto_789/pdf',
          },
        },
      });

      const result = await gateway.createBoletoCharge({
        amount: 350,
        description: 'Boleto test',
        payerName: 'Maria Santos',
        payerEmail: 'maria@test.com',
        payerCpfCnpj: '98765432100',
        dueDate: new Date('2025-02-01'),
      });

      const callArg = (mockClient.createCheckout as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount).toBe(35000);
      expect(callArg.metadata.payer_name).toBe('Maria Santos');

      expect(result.id).toBe('cholar_boleto_789');
      expect(result.barcode).toBe('0019000123456789');
      expect(result.boletoUrl).toBe('https://polar.sh/checkouts/boleto_789/pdf');
      expect(result.dueDate).toEqual(new Date('2025-02-01'));
    });
  });

  describe('getCharge', () => {
    it('should retrieve a charge by id', async () => {
      mockClient.getCheckout = vi.fn().mockResolvedValue({
        id: 'cholar_xyz',
        status: 'confirmed',
        amount: 5000,
        currency: 'BRL',
      });

      const result = await gateway.getCharge('cholar_xyz');
      expect(mockClient.getCheckout).toHaveBeenCalledWith('cholar_xyz');
      expect(result.status).toBe('confirmed');
    });
  });

  describe('cancelCharge', () => {
    it('should cancel a charge by id', async () => {
      mockClient.cancelCheckout = vi.fn().mockResolvedValue({
        id: 'cholar_xyz',
        status: 'canceled',
      });
      await gateway.cancelCharge('cholar_xyz');
      expect(mockClient.cancelCheckout).toHaveBeenCalledWith('cholar_xyz');
    });
  });

  describe('verifyWebhook', () => {
    it('should return false for a non-polar provider', async () => {
      const result = await gateway.verifyWebhook('asaas', '{}', 'sig');
      expect(result).toBe(false);
    });

    it('should return false when no webhookSecret is configured', async () => {
      const gw = new PolarGateway({ accessToken: 'tok' });
      const result = await gw.verifyWebhook('polar', '{"data":{"id":"123"}}', 'abc123');
      expect(result).toBe(false);
    });

    it('should return true for a valid signature', async () => {
      const crypto = require('node:crypto');
      const secret = 'test_webhook_secret';
      const body = '{"event":"checkout.paid","data":{"id":"chevt-123"}}';
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

      const result = await gateway.verifyWebhook('polar', body, signature);
      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', async () => {
      const result = await gateway.verifyWebhook('polar', '{"data":"tampered"}', 'badsignature');
      expect(result).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('should parse a checkout.paid event', () => {
      const payload = {
        event: 'checkout.paid',
        data: { id: 'cholar-123' },
      };

      const result = gateway.handleWebhook(payload);

      expect(result.event).toBe('checkout.paid');
      expect(result.paymentId).toBe('cholar-123');
      expect(result.status).toBe('paid');
      expect(result.metadata.provider).toBe('polar');
    });

    it('should parse a subscription event', () => {
      const payload = {
        type: 'subscription_canceled',
        data: { id: 'sub-xyz' },
      };

      const result = gateway.handleWebhook(payload);
      expect(result.status).toBe('cancelled');
      expect(result.paymentId).toBe('sub-xyz');
    });

    it('should handle unknown event types', () => {
      const result = gateway.handleWebhook({ event: 'random_event' });
      expect(result.status).toBe('unknown');
    });
  });
});
