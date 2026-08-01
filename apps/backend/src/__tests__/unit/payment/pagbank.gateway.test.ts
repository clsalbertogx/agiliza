import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PagBankGateway, PagBankClient } from '@/infrastructure/payment/pagbank.gateway';

function buildMockClient(): PagBankClient {
  return {
    createCharge: vi.fn(),
    getCharge: vi.fn(),
    cancelCharge: vi.fn(),
  };
}

describe('PagBankGateway', () => {
  let gateway: PagBankGateway;
  let mockClient: PagBankClient;

  beforeEach(() => {
    mockClient = buildMockClient();
    gateway = new PagBankGateway({
      accessToken: 'test_access_token',
      publicKey: 'test_public_key',
      webhookSecret: 'test_webhook_secret',
      environment: 'sandbox',
      clientFactory: () => mockClient,
    });
  });

  describe('constructor', () => {
    it('should throw if accessToken is missing', () => {
      expect(() => new PagBankGateway({ accessToken: '' })).toThrow(
        'PagBank accessToken is required',
      );
    });
  });

  describe('createPixCharge', () => {
    it('should create a PIX charge and return a PixChargeResponse', async () => {
      mockClient.createCharge = vi.fn().mockResolvedValue({
        id: 'charge_pix_123',
        status: 'WAITING',
        amount: { value: 10050, currency: 'BRL' },
        payment_method: {
          type: 'PIX',
          pix: {
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUg==',
            qr_code_text: '00020126580014BR.GOV.BCB.PIX0136charge_pix_123',
            expiration_date: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      });

      const result = await gateway.createPixCharge({
        amount: 100.50,
        description: 'Test PIX charge',
        externalReference: 'inv-001',
      });

      expect(mockClient.createCharge).toHaveBeenCalledTimes(1);
      const callArg = (mockClient.createCharge as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount.value).toBe(10050);
      expect(callArg.payment_method.type).toBe('PIX');
      expect(callArg.reference_id).toBe('inv-001');

      expect(result.id).toBe('charge_pix_123');
      expect(result.qrCode).toBe('iVBORw0KGgoAAAANSUhEUg==');
      expect(result.copyPaste).toBe('00020126580014BR.GOV.BCB.PIX0136charge_pix_123');
      expect(result.status).toBe('WAITING');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw when PagBank API call fails', async () => {
      mockClient.createCharge = vi.fn().mockRejectedValue(new Error('Invalid access token'));

      await expect(
        gateway.createPixCharge({ amount: 50, description: 'Failing charge' }),
      ).rejects.toThrow('PagBank error: Invalid access token');
    });
  });

  describe('createCreditCardCharge', () => {
    it('should create a credit-card charge and return the response', async () => {
      mockClient.createCharge = vi.fn().mockResolvedValue({
        id: 'charge_cc_456',
        status: 'PAID',
        amount: { value: 20000, currency: 'BRL' },
      });

      const result = await gateway.createCreditCardCharge({
        amount: 200,
        description: 'Card charge',
        token: 'card_token_abc',
        customerId: 'cust-123',
        installments: 3,
      });

      const callArg = (mockClient.createCharge as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount.value).toBe(20000);
      expect(callArg.payment_method.type).toBe('CREDIT_CARD');
      expect(callArg.payment_method.card.token).toBe('card_token_abc');
      expect(callArg.payment_method.card.installments).toBe(3);

      expect(result.id).toBe('charge_cc_456');
      expect(result.status).toBe('PAID');
      expect(result.amount).toBe(200);
      expect(result.paymentMethod).toBe('CREDIT_CARD');
    });
  });

  describe('createBoletoCharge', () => {
    it('should create a boleto charge and return the response', async () => {
      mockClient.createCharge = vi.fn().mockResolvedValue({
        id: 'charge_boleto_789',
        status: 'WAITING',
        amount: { value: 35000, currency: 'BRL' },
        payment_method: {
          type: 'BOLETO',
          boleto: {
            barcode: '0019000123456789',
            pdf: 'https://sandbox.api.pagseguro.com/charges/boleto_123.pdf',
          },
        },
      });

      const result = await gateway.createBoletoCharge({
        amount: 350,
        description: 'Boleto test',
        payerName: 'João Silva',
        payerEmail: 'joao@test.com',
        payerCpfCnpj: '12345678901',
        dueDate: new Date('2025-01-01'),
      });

      const callArg = (mockClient.createCharge as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount.value).toBe(35000);
      expect(callArg.payment_method.type).toBe('BOLETO');
      expect(callArg.payment_method.boleto.holder.name).toBe('João Silva');
      expect(callArg.payment_method.boleto.holder.tax_id).toBe('12345678901');

      expect(result.id).toBe('charge_boleto_789');
      expect(result.barcode).toBe('0019000123456789');
      expect(result.boletoUrl).toBe('https://sandbox.api.pagseguro.com/charges/boleto_123.pdf');
      expect(result.dueDate).toEqual(new Date('2025-01-01'));
    });
  });

  describe('getCharge', () => {
    it('should retrieve a charge by id', async () => {
      mockClient.getCharge = vi.fn().mockResolvedValue({
        id: 'charge_123',
        status: 'PAID',
        amount: { value: 5000, currency: 'BRL' },
      });

      const result = await gateway.getCharge('charge_123');
      expect(mockClient.getCharge).toHaveBeenCalledWith('charge_123');
      expect(result.status).toBe('PAID');
    });
  });

  describe('cancelCharge', () => {
    it('should cancel a charge by id', async () => {
      mockClient.cancelCharge = vi.fn().mockResolvedValue({ id: 'charge_123', status: 'CANCELED' });
      await gateway.cancelCharge('charge_123');
      expect(mockClient.cancelCharge).toHaveBeenCalledWith('charge_123');
    });
  });

  describe('verifyWebhook', () => {
    it('should return false for a non-pagbank provider', async () => {
      const result = await gateway.verifyWebhook('asaas', '{}', 'sig');
      expect(result).toBe(false);
    });

    it('should return false when no webhookSecret is configured', async () => {
      const gw = new PagBankGateway({ accessToken: 'tok' });
      const result = await gw.verifyWebhook('pagbank', '{"data":{"id":"123"}}', 'ts=1,v1=abc');
      expect(result).toBe(false);
    });

    it('should return false for an invalid signature format', async () => {
      const result = await gateway.verifyWebhook('pagbank', '{"data":{"id":"123"}}', 'invalid');
      expect(result).toBe(false);
    });

    it('should return true for a valid signature', async () => {
      const crypto = require('crypto');
      const secret = 'test_webhook_secret';
      const body = '{"data":{"id":"evt-123"}}';
      const ts = Math.floor(Date.now() / 1000).toString();
      const dataId = 'evt-123';
      const manifest = `id:${dataId};request-id:${dataId};ts:${ts};`;
      const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      const signature = `ts=${ts},v1=${hash}`;

      const result = await gateway.verifyWebhook('pagbank', body, signature);
      expect(result).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('should parse a webhook payload and return event metadata', () => {
      const payload = {
        type: 'CHARGE_PAID',
        data: { id: 'charge-123' },
      };

      const result = gateway.handleWebhook(payload);

      expect(result.event).toBe('CHARGE_PAID');
      expect(result.paymentId).toBe('charge-123');
      expect(result.status).toBe('paid');
      expect(result.metadata.provider).toBe('pagbank');
    });

    it('should handle unknown event types', () => {
      const result = gateway.handleWebhook({ event: 'unknown_event', id: 'ch_1' });
      expect(result.status).toBe('unknown');
    });
  });
});