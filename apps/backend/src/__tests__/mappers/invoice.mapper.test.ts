import { describe, it, expect } from 'vitest';
import { InvoiceMapper, type PersistenceInvoice } from '@/infrastructure/database/mappers/invoice.mapper';
import type { Invoice, InvoiceStatus, PaymentMethod } from '@/domain/entities/invoice';

describe('InvoiceMapper', () => {
  const mapper = new InvoiceMapper();

  const mockPersistence: PersistenceInvoice = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    subscriptionId: null,
    amount: 150.50,
    dueDate: new Date('2026-08-01T00:00:00Z'),
    description: 'Monthly service fee',
    status: 'PENDING',
    paymentMethod: 'PIX',
    pixQRCode: 'base64-qr-code',
    pixCopyPaste: 'pix-copy-paste-key',
    pixExpiresAt: new Date('2026-08-02T00:00:00Z'),
    externalPaymentId: 'ext_pay_123',
    paidAt: null,
    metadata: { source: 'manual' },
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-28T00:00:00Z'),
  };

  const mockDomain: Invoice = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    amount: 150.50,
    dueDate: new Date('2026-08-01T00:00:00Z'),
    description: 'Monthly service fee',
    status: 'PENDING' as InvoiceStatus,
    paymentMethod: 'PIX' as PaymentMethod,
    pixQRCode: 'base64-qr-code',
    pixCopyPaste: 'pix-copy-paste-key',
    pixExpiresAt: new Date('2026-08-02T00:00:00Z'),
    externalPaymentId: 'ext_pay_123',
    paidAt: undefined,
    metadata: { source: 'manual' },
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-28T00:00:00Z'),
  };

  describe('toDomain', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toDomain(mockPersistence);

      expect(result.id).toBe(mockDomain.id);
      expect(result.tenantId).toBe(mockDomain.tenantId);
      expect(result.clientId).toBe(mockDomain.clientId);
      expect(result.amount).toBe(mockDomain.amount);
      expect(result.dueDate).toEqual(mockDomain.dueDate);
      expect(result.description).toBe(mockDomain.description);
      expect(result.status).toBe(mockDomain.status);
      expect(result.paymentMethod).toBe(mockDomain.paymentMethod);
      expect(result.pixQRCode).toBe(mockDomain.pixQRCode);
      expect(result.pixCopyPaste).toBe(mockDomain.pixCopyPaste);
      expect(result.pixExpiresAt).toEqual(mockDomain.pixExpiresAt);
      expect(result.externalPaymentId).toBe(mockDomain.externalPaymentId);
      expect(result.paidAt).toBeUndefined();
      expect(result.metadata).toEqual(mockDomain.metadata);
      expect(result.createdAt).toEqual(mockDomain.createdAt);
      expect(result.updatedAt).toEqual(mockDomain.updatedAt);
    });

    it('should convert null description to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, description: null });
      expect(result.description).toBeUndefined();
    });

    it('should convert null paymentMethod to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, paymentMethod: null });
      expect(result.paymentMethod).toBeNull();
    });

    it('should convert null pixExpiresAt to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, pixExpiresAt: null });
      expect(result.pixExpiresAt).toBeUndefined();
    });

    it('should convert null paidAt to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, paidAt: null });
      expect(result.paidAt).toBeUndefined();
    });

    it('should handle zero amount', () => {
      const result = mapper.toDomain({ ...mockPersistence, amount: 0 });
      expect(result.amount).toBe(0);
    });
  });

  describe('toPersistence', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toPersistence(mockDomain);

      expect(result.id).toBe(mockPersistence.id);
      expect(result.tenantId).toBe(mockPersistence.tenantId);
      expect(result.clientId).toBe(mockPersistence.clientId);
      expect(result.amount).toBe(mockPersistence.amount);
      expect(result.dueDate).toEqual(mockPersistence.dueDate);
      expect(result.description).toBe(mockPersistence.description);
      expect(result.status).toBe(mockPersistence.status);
      expect(result.paymentMethod).toBe(mockPersistence.paymentMethod);
      expect(result.pixQRCode).toBe(mockPersistence.pixQRCode);
      expect(result.pixCopyPaste).toBe(mockPersistence.pixCopyPaste);
      expect(result.externalPaymentId).toBe(mockPersistence.externalPaymentId);
      expect(result.metadata).toEqual(mockPersistence.metadata);
    });

    it('should convert undefined description to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, description: undefined });
      expect(result.description).toBeNull();
    });

    it('should convert undefined paymentMethod to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, paymentMethod: undefined });
      expect(result.paymentMethod).toBeNull();
    });

    it('should convert undefined paidAt to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, paidAt: undefined });
      expect(result.paidAt).toBeNull();
    });

    it('should set subscriptionId to null', () => {
      const result = mapper.toPersistence(mockDomain);
      expect(result.subscriptionId).toBeNull();
    });
  });
});
