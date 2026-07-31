import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeGateway, StripeSdk } from '@/infrastructure/payment/stripe.gateway';

function buildMockStripe(): StripeSdk {
  return {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
}

describe('StripeGateway', () => {
  let gateway: StripeGateway;
  let stripeMock: StripeSdk;

  beforeEach(() => {
    stripeMock = buildMockStripe();
    gateway = new StripeGateway({
      secretKey: 'sk_test_mock',
      publishableKey: 'pk_test_mock',
      webhookSecret: 'whsec_test',
      environment: 'sandbox',
      sdkFactory: () => stripeMock,
    });
  });

  describe('createPixCharge', () => {
    it('should create a PIX charge and return a PixChargeResponse', async () => {
      stripeMock.paymentIntents.create = vi.fn().mockResolvedValue({
        id: 'pi_pix_123',
        status: 'requires_payment_method',
        next_action: {
          pix_display_qr_code: {
            image_url_png: 'data:image/png;base64,qr',
            image_url: 'pix://1234abc',
          },
        },
      });

      const result = await gateway.createPixCharge({
        amount: 150.00,
        description: 'Test PIX',
        externalReference: 'inv-001',
      });

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
      const callArgs = (stripeMock.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.amount).toBe(15000);
      expect(callArgs.currency).toBe('brl');
      expect(callArgs.payment_method_types).toEqual(['pix']);
      expect(callArgs.metadata.external_reference).toBe('inv-001');

      expect(result.id).toBe('pi_pix_123');
      expect(result.qrCode).toBe('data:image/png;base64,qr');
      expect(result.copyPaste).toBe('pix://1234abc');
      expect(result.status).toBe('requires_payment_method');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw on Stripe API error', async () => {
      stripeMock.paymentIntents.create = vi.fn().mockRejectedValue(new Error('Invalid API key'));

      await expect(
        gateway.createPixCharge({ amount: 50, description: 'Fail' }),
      ).rejects.toThrow('Stripe error: Invalid API key');
    });
  });

  describe('createCreditCardCharge', () => {
    it('should create a credit-card charge and return the response', async () => {
      stripeMock.paymentIntents.create = vi.fn().mockResolvedValue({
        id: 'pi_card_456',
        status: 'succeeded',
        amount: 20000,
      });

      const result = await gateway.createCreditCardCharge({
        amount: 200.00,
        description: 'Card test',
        token: 'pm_card_visa',
        installments: 1,
        customerId: 'cus_123',
      });

      const callArgs = (stripeMock.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.amount).toBe(20000);
      expect(callArgs.payment_method_types).toEqual(['card']);
      expect(callArgs.payment_method).toBe('pm_card_visa');
      expect(callArgs.confirm).toBe(true);
      expect(callArgs.customer).toBe('cus_123');

      expect(result.id).toBe('pi_card_456');
      expect(result.status).toBe('succeeded');
      expect(result.paymentMethod).toBe('CREDIT_CARD');
    });
  });

  describe('createBoletoCharge', () => {
    it('should create a boleto charge and return the response', async () => {
      stripeMock.paymentIntents.create = vi.fn().mockResolvedValue({
        id: 'pi_boleto_789',
        status: 'requires_payment_method',
        amount: 35000,
        next_action: {
          boleto_display_details: {
            number: '0019000123456789',
            hosted_voucher_url: 'https://stripe.com/boleto/pi_boleto_789',
          },
        },
      });

      const result = await gateway.createBoletoCharge({
        amount: 350.00,
        description: 'Boleto test',
        payerCpfCnpj: '12345678901',
        payerName: 'Maria Santos',
        payerEmail: 'maria@test.com',
        dueDate: new Date('2025-02-01'),
      });

      const callArgs = (stripeMock.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.amount).toBe(35000);
      expect(callArgs.payment_method_types).toEqual(['boleto']);
      expect(callArgs.payment_method_data?.boleto?.tax_id).toBe('12345678901');

      expect(result.id).toBe('pi_boleto_789');
      expect(result.barcode).toBe('0019000123456789');
      expect(result.boletoUrl).toBe('https://stripe.com/boleto/pi_boleto_789');
      expect(result.dueDate).toEqual(new Date('2025-02-01'));
    });
  });

  describe('getCharge', () => {
    it('should retrieve a PaymentIntent by id', async () => {
      stripeMock.paymentIntents.retrieve = vi.fn().mockResolvedValue({ id: 'pi_xyz', status: 'succeeded' });
      const result = await gateway.getCharge('pi_xyz');
      expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith('pi_xyz');
      expect(result.status).toBe('succeeded');
    });
  });

  describe('cancelCharge', () => {
    it('should cancel a PaymentIntent by id', async () => {
      stripeMock.paymentIntents.cancel = vi.fn().mockResolvedValue({ id: 'pi_xyz', status: 'canceled' });
      await gateway.cancelCharge('pi_xyz');
      expect(stripeMock.paymentIntents.cancel).toHaveBeenCalledWith('pi_xyz');
    });
  });

  describe('verifyWebhook', () => {
    it('should return false for a non-stripe provider', async () => {
      const result = await gateway.verifyWebhook('asaas', '{}', 'sig');
      expect(result).toBe(false);
    });

    it('should return false when no webhookSecret is configured', async () => {
      const gw = new StripeGateway({ secretKey: 'sk_test_xxx' });
      const result = await gw.verifyWebhook('stripe', '{}', 'sig');
      expect(result).toBe(false);
    });

    it('should return true when constructEvent succeeds', async () => {
      stripeMock.webhooks.constructEvent = vi.fn().mockReturnValue({ id: 'evt_123', type: 'payment_intent.succeeded' });
      const result = await gateway.verifyWebhook('stripe', '{"raw":"body"}', 'stripe-signature-value');
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        '{"raw":"body"}', 'stripe-signature-value', 'whsec_test',
      );
      expect(result).toBe(true);
    });

    it('should return false when constructEvent throws', async () => {
      stripeMock.webhooks.constructEvent = vi.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      const result = await gateway.verifyWebhook('stripe', '{}', 'bad-sig');
      expect(result).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('should parse a PaymentIntent succeeded event', () => {
      const payload = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', status: 'succeeded' } },
      };

      const result = gateway.handleWebhook(payload);
      expect(result.event).toBe('payment_intent.succeeded');
      expect(result.paymentId).toBe('pi_123');
      expect(result.status).toBe('confirmed');
      expect(result.metadata.provider).toBe('stripe');
    });

    it('should parse a PaymentIntent failed event', () => {
      const payload = {
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_456', status: 'requires_payment_method' } },
      };

      const result = gateway.handleWebhook(payload);
      expect(result.status).toBe('failed');
    });
  });

  describe('constructor', () => {
    it('should throw if secretKey is empty', () => {
      expect(() => new StripeGateway({ secretKey: '' })).toThrow(
        'Stripe secretKey is required',
      );
    });
  });
});