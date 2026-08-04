import { describe, expect, it } from 'vitest';
import type { Payment } from '@/domain/entities/payment';
import { PaymentMapper, type PersistencePayment } from '@/infrastructure/database/mappers/payment.mapper';

describe('PaymentMapper', () => {
  const mapper = new PaymentMapper();

  const mockPersistence: PersistencePayment = {
    id: '00000000-0000-0000-0000-000000000001',
    invoiceId: '00000000-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000003',
    clientId: '00000000-0000-0000-0000-000000000004',
    amount: 150.5,
    method: 'PIX',
    provider: 'asaas',
    providerPaymentId: 'pay_123',
    status: 'confirmed',
    fee: 3.5,
    netAmount: 147.0,
    webhookReceivedAt: new Date('2026-07-28T10:00:00Z'),
    webhookRetryCount: 0,
    createdAt: new Date('2026-07-28T09:00:00Z'),
    updatedAt: new Date('2026-07-28T10:00:00Z'),
  };

  const mockDomain: Payment = {
    id: '00000000-0000-0000-0000-000000000001',
    invoiceId: '00000000-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000003',
    clientId: '00000000-0000-0000-0000-000000000004',
    amount: 150.5,
    method: 'PIX' as Payment['method'],
    provider: 'asaas',
    providerPaymentId: 'pay_123',
    status: 'confirmed' as Payment['status'],
    fee: 3.5,
    netAmount: 147.0,
    webhookReceivedAt: new Date('2026-07-28T10:00:00Z'),
    webhookRetryCount: 0,
    createdAt: new Date('2026-07-28T09:00:00Z'),
    updatedAt: new Date('2026-07-28T10:00:00Z'),
  };

  describe('toDomain', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toDomain(mockPersistence);

      expect(result.id).toBe(mockDomain.id);
      expect(result.invoiceId).toBe(mockDomain.invoiceId);
      expect(result.tenantId).toBe(mockDomain.tenantId);
      expect(result.clientId).toBe(mockDomain.clientId);
      expect(result.amount).toBe(mockDomain.amount);
      expect(result.method).toBe(mockDomain.method);
      expect(result.provider).toBe(mockDomain.provider);
      expect(result.providerPaymentId).toBe(mockDomain.providerPaymentId);
      expect(result.status).toBe(mockDomain.status);
      expect(result.fee).toBe(mockDomain.fee);
      expect(result.netAmount).toBe(mockDomain.netAmount);
      expect(result.webhookReceivedAt).toEqual(mockDomain.webhookReceivedAt);
      expect(result.webhookRetryCount).toBe(mockDomain.webhookRetryCount);
      expect(result.createdAt).toEqual(mockDomain.createdAt);
    });

    it('should convert null providerPaymentId to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, providerPaymentId: null });
      expect(result.providerPaymentId).toBeUndefined();
    });

    it('should convert null fee to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, fee: null });
      expect(result.fee).toBeUndefined();
    });

    it('should convert null netAmount to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, netAmount: null });
      expect(result.netAmount).toBeUndefined();
    });

    it('should convert null webhookReceivedAt to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, webhookReceivedAt: null });
      expect(result.webhookReceivedAt).toBeUndefined();
    });

    it('should handle zero amount', () => {
      const result = mapper.toDomain({ ...mockPersistence, amount: 0 });
      expect(result.amount).toBe(0);
    });

    it('should handle pending status', () => {
      const result = mapper.toDomain({ ...mockPersistence, status: 'pending' });
      expect(result.status).toBe('pending');
    });
  });

  describe('toPersistence', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toPersistence(mockDomain);

      expect(result.id).toBe(mockPersistence.id);
      expect(result.invoiceId).toBe(mockPersistence.invoiceId);
      expect(result.tenantId).toBe(mockPersistence.tenantId);
      expect(result.clientId).toBe(mockPersistence.clientId);
      expect(result.amount).toBe(mockPersistence.amount);
      expect(result.method).toBe(mockPersistence.method);
      expect(result.provider).toBe(mockPersistence.provider);
      expect(result.status).toBe(mockPersistence.status);
      expect(result.webhookRetryCount).toBe(mockPersistence.webhookRetryCount);
    });

    it('should convert undefined providerPaymentId to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, providerPaymentId: undefined });
      expect(result.providerPaymentId).toBeNull();
    });

    it('should convert undefined fee to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, fee: undefined });
      expect(result.fee).toBeNull();
    });

    it('should convert undefined netAmount to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, netAmount: undefined });
      expect(result.netAmount).toBeNull();
    });

    it('should convert undefined webhookReceivedAt to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, webhookReceivedAt: undefined });
      expect(result.webhookReceivedAt).toBeNull();
    });

    it('should set updatedAt as a Date', () => {
      const result = mapper.toPersistence(mockDomain);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });
});
