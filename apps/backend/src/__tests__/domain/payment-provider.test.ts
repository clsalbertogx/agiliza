import { describe, expect, it } from 'vitest';
import { createPayment, PaymentProvider, paymentSchema } from '@/domain/entities/payment';

/**
 * A3 — The Payment entity's provider uses the canonical lowercase enum.
 */
describe('A3 — Payment entity provider values', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000001',
    invoiceId: '00000000-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000003',
    clientId: '00000000-0000-0000-0000-000000000004',
    amount: 100.0,
  };

  it('constructs a payment with a lowercase provider (wire format)', () => {
    const result = createPayment({ ...base, provider: PaymentProvider.MERCADO_PAGO });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.provider).toBe('mercadopago');
    }
  });

  it('PaymentProvider.ASAAS === "asaas" (lowercase, matches payment_provider_configs)', () => {
    expect(PaymentProvider.ASAAS).toBe('asaas');
    expect(PaymentProvider.MERCADO_PAGO).toBe('mercadopago');
    expect(PaymentProvider.STRIPE).toBe('stripe');
    expect(PaymentProvider.PAGBANK).toBe('pagbank');
    expect(PaymentProvider.POLAR).toBe('polar');
  });

  it('paymentSchema accepts lowercase provider values', () => {
    const parsed = paymentSchema.parse({
      ...base,
      method: 'PIX',
      provider: 'asaas',
      status: 'PENDING',
      webhookRetryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(parsed.provider).toBe('asaas');
  });

  it('paymentSchema rejects UPPERCASE provider values (data divergence)', () => {
    expect(() =>
      paymentSchema.parse({
        ...base,
        method: 'PIX',
        provider: 'ASAAS',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow();
  });
});
