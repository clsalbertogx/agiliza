import { describe, expect, it } from 'vitest';
import type { Client } from '@/domain/entities/client';
import { RiskScore } from '@/domain/entities/client';
import { ClientMapper, type PersistenceClient } from '@/infrastructure/database/mappers/client.mapper';

describe('ClientMapper', () => {
  const mapper = new ClientMapper();

  const mockPersistence: PersistenceClient = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    document: '12345678901',
    preferredChannel: 'WHATSAPP',
    preferredTime: '09:00',
    preferredLeadDays: 3,
    riskScore: 'GREEN',
    riskScoreReason: { factor: 'on_time' },
    riskScoreUpdatedAt: new Date('2026-07-28T10:00:00Z'),
    totalInvoices: 5,
    paidInvoices: 3,
    avgPaymentDelay: 2.5,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-07-28T10:00:00Z'),
  };

  const mockDomain: Client = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    document: '12345678901',
    preferredChannel: 'WHATSAPP' as any,
    preferredTime: '09:00',
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN as unknown as RiskScore,
    riskScoreReason: { factor: 'on_time' },
    riskScoreUpdatedAt: new Date('2026-07-28T10:00:00Z'),
    totalInvoices: 5,
    paidInvoices: 3,
    avgPaymentDelay: 2.5 as number | null,
  };

  describe('toDomain', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toDomain(mockPersistence);

      expect(result.id).toBe(mockDomain.id);
      expect(result.tenantId).toBe(mockDomain.tenantId);
      expect(result.name).toBe(mockDomain.name);
      expect(result.phone).toBe(mockDomain.phone);
      expect(result.email).toBe(mockDomain.email);
      expect(result.document).toBe(mockDomain.document);
      expect(result.preferredChannel).toBe(mockDomain.preferredChannel);
      expect(result.preferredTime).toBe(mockDomain.preferredTime);
      expect(result.preferredLeadDays).toBe(mockDomain.preferredLeadDays);
      expect(result.riskScore).toStrictEqual(mockDomain.riskScore);
      expect(result.riskScoreReason).toEqual(mockDomain.riskScoreReason);
      expect(result.riskScoreUpdatedAt).toEqual(mockDomain.riskScoreUpdatedAt);
      expect(result.totalInvoices).toBe(mockDomain.totalInvoices);
      expect(result.paidInvoices).toBe(mockDomain.paidInvoices);
      expect(result.avgPaymentDelay).toBe(mockDomain.avgPaymentDelay);
    });

    it('should convert null email to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, email: null });
      expect(result.email).toBeUndefined();
    });

    it('should convert null document to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, document: null });
      expect(result.document).toBeUndefined();
    });

    it('should convert null preferredTime to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, preferredTime: null });
      expect(result.preferredTime).toBeUndefined();
    });

    it('should convert null riskScoreUpdatedAt to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, riskScoreUpdatedAt: null });
      expect(result.riskScoreUpdatedAt).toBeUndefined();
    });

    it('should handle null avgPaymentDelay', () => {
      const result = mapper.toDomain({ ...mockPersistence, avgPaymentDelay: null });
      expect(result.avgPaymentDelay).toBeNull();
    });

    it('should handle null riskScoreReason', () => {
      const result = mapper.toDomain({ ...mockPersistence, riskScoreReason: null });
      expect(result.riskScoreReason).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toPersistence(mockDomain);

      expect(result.id).toBe(mockPersistence.id);
      expect(result.tenantId).toBe(mockPersistence.tenantId);
      expect(result.name).toBe(mockPersistence.name);
      expect(result.phone).toBe(mockPersistence.phone);
      expect(result.email).toBe(mockPersistence.email);
      expect(result.document).toBe(mockPersistence.document);
      expect(result.preferredChannel).toBe(mockPersistence.preferredChannel);
      expect(result.preferredTime).toBe(mockPersistence.preferredTime);
      expect(result.preferredLeadDays).toBe(mockPersistence.preferredLeadDays);
      expect(result.riskScore).toBe(mockPersistence.riskScore);
      expect(result.totalInvoices).toBe(mockPersistence.totalInvoices);
      expect(result.paidInvoices).toBe(mockPersistence.paidInvoices);
      expect(result.avgPaymentDelay).toBe(mockPersistence.avgPaymentDelay);
    });

    it('should convert undefined email to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, email: undefined });
      expect(result.email).toBeNull();
    });

    it('should convert undefined document to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, document: undefined });
      expect(result.document).toBeNull();
    });

    it('should convert undefined preferredTime to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, preferredTime: undefined });
      expect(result.preferredTime).toBeNull();
    });

    it('should convert undefined riskScoreUpdatedAt to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, riskScoreUpdatedAt: undefined });
      expect(result.riskScoreUpdatedAt).toBeNull();
    });

    it('should pass through undefined avgPaymentDelay', () => {
      const result = mapper.toPersistence({ ...mockDomain, avgPaymentDelay: undefined as any });
      expect(result.avgPaymentDelay).toBeUndefined();
    });

    it('should set createdAt and updatedAt to current date', () => {
      const result = mapper.toPersistence(mockDomain);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });
});
