import { describe, expect, it } from 'vitest';
import {
  type DomainEventLog,
  EventMapper,
  type PersistenceEvent,
} from '@/infrastructure/database/mappers/event.mapper';

describe('EventMapper', () => {
  const mapper = new EventMapper();

  const mockPersistence: PersistenceEvent = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    eventType: 'PAYMENT_CONFIRMED',
    payload: { amount: 150.5, method: 'PIX' },
    source: 'webhook',
    createdAt: new Date('2026-07-28T10:00:00Z'),
  };

  const mockDomain: DomainEventLog = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    eventType: 'PAYMENT_CONFIRMED',
    payload: { amount: 150.5, method: 'PIX' },
    source: 'webhook',
    createdAt: new Date('2026-07-28T10:00:00Z'),
  };

  describe('toDomain', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toDomain(mockPersistence);

      expect(result.id).toBe(mockDomain.id);
      expect(result.tenantId).toBe(mockDomain.tenantId);
      expect(result.clientId).toBe(mockDomain.clientId);
      expect(result.eventType).toBe(mockDomain.eventType);
      expect(result.payload).toEqual(mockDomain.payload);
      expect(result.source).toBe(mockDomain.source);
      expect(result.createdAt).toEqual(mockDomain.createdAt);
    });

    it('should handle null clientId', () => {
      const result = mapper.toDomain({ ...mockPersistence, clientId: null });
      expect(result.clientId).toBeNull();
    });

    it('should handle null source', () => {
      const result = mapper.toDomain({ ...mockPersistence, source: null });
      expect(result.source).toBeNull();
    });

    it('should handle different event types', () => {
      const result = mapper.toDomain({ ...mockPersistence, eventType: 'INVOICE_CREATED' });
      expect(result.eventType).toBe('INVOICE_CREATED');
    });

    it('should handle empty payload', () => {
      const result = mapper.toDomain({ ...mockPersistence, payload: {} });
      expect(result.payload).toEqual({});
    });
  });

  describe('toPersistence', () => {
    it('should map all fields correctly', () => {
      const result = mapper.toPersistence(mockDomain);

      expect(result.id).toBe(mockPersistence.id);
      expect(result.tenantId).toBe(mockPersistence.tenantId);
      expect(result.clientId).toBe(mockPersistence.clientId);
      expect(result.eventType).toBe(mockPersistence.eventType);
      expect(result.payload).toEqual(mockPersistence.payload);
      expect(result.source).toBe(mockPersistence.source);
      expect(result.createdAt).toEqual(mockPersistence.createdAt);
    });

    it('should preserve null clientId', () => {
      const result = mapper.toPersistence({ ...mockDomain, clientId: null });
      expect(result.clientId).toBeNull();
    });

    it('should preserve null source', () => {
      const result = mapper.toPersistence({ ...mockDomain, source: null });
      expect(result.source).toBeNull();
    });
  });
});
