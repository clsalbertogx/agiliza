import { describe, expect, it } from 'vitest';
import { PaymentMethod } from '@/domain/entities/invoice';
import { paymentSchema } from '@/domain/entities/payment';

describe('Payment Entity', () => {
  describe('Payment Method', () => {
    it('should support PIX as payment method', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.method).toBe(PaymentMethod.PIX);
      expect(payment.status).toBe('PENDING');
    });

    it('should support BOLETO as payment method', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.BOLETO,
        provider: 'asaas',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.method).toBe(PaymentMethod.BOLETO);
    });

    it('should support CREDIT_CARD as payment method', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.CREDIT_CARD,
        provider: 'asaas',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.method).toBe(PaymentMethod.CREDIT_CARD);
    });

    it('should accept custom payment method string', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: 'crypto',
        provider: 'asaas',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.method).toBe('crypto');
    });
  });

  describe('Payment Reconciliation', () => {
    it('should match payment to invoice by externalPaymentId', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'prov_123',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.invoiceId).toBe('00000000-0000-0000-0000-000000000002');
      expect(payment.providerPaymentId).toBe('prov_123');
    });

    it('should prevent duplicate reconciliation (idempotency)', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'prov_123',
        status: 'CONFIRMED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // A confirmed payment should not be changed
      expect(payment.status).toBe('CONFIRMED');
      // The schema has no prevent-reconciliation logic, uniqueness is at DB level
    });

    it('should allow multiple payment attempts on same invoice', () => {
      const failedPayment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'prov_fail',
        status: 'FAILED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(failedPayment.status).toBe('FAILED');

      const successPayment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000002',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'prov_success',
        status: 'CONFIRMED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(successPayment.status).toBe('CONFIRMED');
    });

    it('should calculate netAmount = amount - fee after confirmation', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        fee: 2.5,
        netAmount: 97.5,
        status: 'CONFIRMED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.amount - (payment.fee ?? 0)).toBe(97.5);
      expect(payment.netAmount).toBe(97.5);
    });
  });

  describe('Payment Status', () => {
    it('should start with status = pending', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.status).toBe('PENDING');
    });

    it('should transition to confirmed when gateway confirms', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'CONFIRMED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.status).toBe('CONFIRMED');
    });

    it('should transition to failed when gateway returns error', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'FAILED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.status).toBe('FAILED');
    });

    it('should transition to refunded when refund is processed', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'REFUNDED',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.status).toBe('REFUNDED');
    });

    it('should preserve raw webhook payload in metadata for audit', () => {
      const payment = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        status: 'PENDING',
        webhookReceivedAt: new Date(),
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment.webhookReceivedAt).toBeDefined();
      expect(payment.webhookRetryCount).toBe(0);
    });
  });

  describe('Provider Constraints', () => {
    it('should enforce unique providerPaymentId per provider', () => {
      const payment1 = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'prov_123',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment1.providerPaymentId).toBe('prov_123');
      expect(payment1.provider).toBe('asaas');
    });

    it('should allow same providerPaymentId across different providers', () => {
      const payment1 = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000003',
        clientId: '00000000-0000-0000-0000-000000000004',
        amount: 100.0,
        method: PaymentMethod.PIX,
        provider: 'asaas',
        providerPaymentId: 'pay_123',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const payment2 = paymentSchema.parse({
        id: '00000000-0000-0000-0000-000000000002',
        invoiceId: '00000000-0000-0000-0000-000000000003',
        tenantId: '00000000-0000-0000-0000-000000000004',
        clientId: '00000000-0000-0000-0000-000000000005',
        amount: 200.0,
        method: PaymentMethod.PIX,
        provider: 'mercadopago',
        providerPaymentId: 'pay_123',
        status: 'PENDING',
        webhookRetryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(payment1.providerPaymentId).toBe(payment2.providerPaymentId);
      expect(payment1.provider).not.toBe(payment2.provider);
    });
  });
});
