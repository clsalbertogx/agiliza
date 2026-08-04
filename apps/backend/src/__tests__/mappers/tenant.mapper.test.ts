import { describe, expect, it } from 'vitest';
import type { PaymentProvider, Tenant } from '@/domain/entities/tenant';
import { type PersistenceTenant, TenantMapper } from '@/infrastructure/database/mappers/tenant.mapper';

describe('TenantMapper', () => {
  const mapper = new TenantMapper();

  const mockPersistence: PersistenceTenant = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Company',
    slug: 'test-company',
    document: '12345678901234',
    email: 'admin@test.com',
    phone: '5511999998888',
    config: { theme: 'dark' },
    paymentProvider: 'asaas',
    paymentProviderConfig: { apiKey: 'sk_test_xxx' },
    decisionConfig: { channels: ['WHATSAPP'] },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-07-28T00:00:00Z'),
  };

  const mockDomain: Tenant = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Company',
    slug: 'test-company',
    document: '12345678901234',
    email: 'admin@test.com',
    phone: '5511999998888',
    config: { theme: 'dark' },
    paymentProvider: 'asaas' as PaymentProvider,
    paymentProviderConfig: { apiKey: 'sk_test_xxx' },
    decisionConfig: { channels: ['WHATSAPP'] },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-07-28T00:00:00Z'),
  };

  describe('toDomain', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toDomain(mockPersistence);

      expect(result.id).toBe(mockDomain.id);
      expect(result.name).toBe(mockDomain.name);
      expect(result.slug).toBe(mockDomain.slug);
      expect(result.document).toBe(mockDomain.document);
      expect(result.email).toBe(mockDomain.email);
      expect(result.phone).toBe(mockDomain.phone);
      expect(result.config).toEqual(mockDomain.config);
      expect(result.paymentProvider).toBe(mockDomain.paymentProvider);
      expect(result.paymentProviderConfig).toEqual(mockDomain.paymentProviderConfig);
      expect(result.decisionConfig).toEqual(mockDomain.decisionConfig);
      expect(result.createdAt).toEqual(mockDomain.createdAt);
      expect(result.updatedAt).toEqual(mockDomain.updatedAt);
    });

    it('should convert null document to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, document: null });
      expect(result.document).toBeUndefined();
    });

    it('should convert null phone to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, phone: null });
      expect(result.phone).toBeUndefined();
    });

    it('should convert null config to undefined', () => {
      const result = mapper.toDomain({ ...mockPersistence, config: null });
      expect(result.config).toBeNull();
    });

    it('should map different payment providers', () => {
      const result = mapper.toDomain({ ...mockPersistence, paymentProvider: 'mercadopago' });
      expect(result.paymentProvider).toBe('mercadopago');
    });

    it('should handle null paymentProviderConfig', () => {
      const result = mapper.toDomain({ ...mockPersistence, paymentProviderConfig: null });
      expect(result.paymentProviderConfig).toBeNull();
    });

    it('should handle null decisionConfig', () => {
      const result = mapper.toDomain({ ...mockPersistence, decisionConfig: null });
      expect(result.decisionConfig).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toPersistence(mockDomain);

      expect(result.id).toBe(mockPersistence.id);
      expect(result.name).toBe(mockPersistence.name);
      expect(result.slug).toBe(mockPersistence.slug);
      expect(result.document).toBe(mockPersistence.document);
      expect(result.email).toBe(mockPersistence.email);
      expect(result.phone).toBe(mockPersistence.phone);
      expect(result.paymentProvider).toBe(mockPersistence.paymentProvider);
    });

    it('should convert undefined document to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, document: undefined });
      expect(result.document).toBeNull();
    });

    it('should convert undefined phone to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, phone: undefined });
      expect(result.phone).toBeNull();
    });

    it('should convert undefined config to null', () => {
      const result = mapper.toPersistence({ ...mockDomain, config: undefined });
      expect(result.config).toBeNull();
    });

    it('should preserve dates', () => {
      const result = mapper.toPersistence(mockDomain);
      expect(result.createdAt).toBe(mockDomain.createdAt);
      expect(result.updatedAt).toBe(mockDomain.updatedAt);
    });
  });
});
