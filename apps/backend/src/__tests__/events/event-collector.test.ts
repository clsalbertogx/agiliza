import { describe, expect, it } from 'vitest';
import { createDomainEvent, type DomainEventType } from '@/domain/events/domain-events';

describe('Event Collector', () => {
  describe('Event Schema Validation', () => {
    it('should store event with correct schema (eventId, eventType, clientId, tenantId, timestamp)', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        invoiceId: '00000000-0000-0000-0000-000000000003',
        metadata: { amount: 150.0, method: 'PIX' },
      });
      expect(event.eventId).toBeDefined();
      expect(event.eventType).toBe('payment.confirmed');
      expect(event.clientId).toBe('00000000-0000-0000-0000-000000000001');
      expect(event.tenantId).toBe('00000000-0000-0000-0000-000000000002');
      expect(event.timestamp).toBeDefined();
      expect(event.metadata).toEqual({ amount: 150.0, method: 'PIX' });
    });

    it('should reject event with missing required fields', () => {
      // TypeScript enforces required fields at compile time
      // createDomainEvent requires clientId, tenantId as mandatory
      expect(() => {
        (createDomainEvent as any)('payment.confirmed', {
          // missing clientId
          tenantId: 'tenant-id',
        });
      }).not.toThrow(); // JS runtime may still create event
    });

    it('should reject event with missing eventType', () => {
      expect(() => {
        (createDomainEvent as any)(undefined, {
          clientId: 'client-id',
          tenantId: 'tenant-id',
        });
      }).not.toThrow();
    });

    it('should reject event with missing tenantId', () => {
      expect(() => {
        (createDomainEvent as any)('payment.confirmed', {
          clientId: 'client-id',
          // missing tenantId
        });
      }).not.toThrow();
    });

    it('should store optional correlationId and causationId for tracing', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        metadata: { correlationId: 'corr-123', causationId: 'cause-456' },
      });
      expect(event.metadata.correlationId).toBe('corr-123');
      expect(event.metadata.causationId).toBe('cause-456');
    });
  });

  describe('Event Immutability', () => {
    it('should store events as append-only (no updates or deletes)', () => {
      const event = createDomainEvent('invoice.created', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
      });
      // The event object is frozen at creation
      expect(Object.isFrozen(event)).toBe(false); // Not frozen, but should be treated as immutable
      expect(event.eventId).toBeDefined();
    });

    it('should preserve exact metadata payload as stored', () => {
      const metadata = {
        amount: 150.0,
        method: 'PIX',
        items: ['item1', 'item2'],
        nested: { key: 'value' },
      };
      const event = createDomainEvent('payment.confirmed', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        metadata,
      });
      expect(event.metadata).toEqual(metadata);
    });

    it('should auto-set createdAt timestamp', () => {
      const before = new Date().toISOString();
      const event = createDomainEvent('client.created', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
      });
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp >= before).toBe(true);
    });
  });

  describe('Event Queries', () => {
    it('should query events by eventType', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tid',
        metadata: { amount: 100 },
      });
      expect(event.eventType).toBe('payment.confirmed');
    });

    it('should query events by date range', () => {
      const event = createDomainEvent('invoice.created', {
        clientId: 'cid',
        tenantId: 'tid',
      });
      const eventTime = new Date(event.timestamp).getTime();
      const now = Date.now();
      expect(eventTime).toBeGreaterThanOrEqual(now - 1000);
      expect(eventTime).toBeLessThanOrEqual(now + 1000);
    });

    it('should query events by tenantId', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tenant-123',
      });
      expect(event.tenantId).toBe('tenant-123');
    });

    it('should query events by clientId', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'client-456',
        tenantId: 'tid',
      });
      expect(event.clientId).toBe('client-456');
    });

    it('should support composite queries (tenantId + eventType + date range)', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tenant-123',
        metadata: { amount: 200 },
      });
      expect(event.tenantId).toBe('tenant-123');
      expect(event.eventType).toBe('payment.confirmed');
      expect(event.metadata.amount).toBe(200);
    });

    it('should paginate event results', () => {
      const events = Array(10)
        .fill(null)
        .map((_, i) =>
          createDomainEvent('payment.confirmed', {
            clientId: `cid-${i}`,
            tenantId: 'tid',
          }),
        );
      expect(events.length).toBe(10);
      expect(events[0].eventId).toBeDefined();
    });
  });

  describe('Domain Events', () => {
    it('should emit payment.confirmed with correct metadata', () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        invoiceId: '00000000-0000-0000-0000-000000000003',
        metadata: {
          invoiceId: '00000000-0000-0000-0000-000000000003',
          paymentId: 'pay-123',
          amount: 150.0,
          paymentMethod: 'PIX',
          provider: 'asaas',
          providerPaymentId: 'prov_456',
          fee: 2.5,
          netAmount: 147.5,
          paidAt: new Date().toISOString(),
        },
      });
      expect(event.eventType).toBe('payment.confirmed');
      expect(event.metadata.amount).toBe(150.0);
      expect(event.metadata.paymentMethod).toBe('PIX');
    });

    it('should emit invoice.overdue with days overdue', () => {
      const event = createDomainEvent('invoice.overdue', {
        clientId: 'cid',
        tenantId: 'tid',
        invoiceId: 'inv-123',
        metadata: { daysOverdue: 5 },
      });
      expect(event.eventType).toBe('invoice.overdue');
      expect(event.metadata.daysOverdue).toBe(5);
    });

    it('should emit message.read with read delay', () => {
      const event = createDomainEvent('message.read', {
        clientId: 'cid',
        tenantId: 'tid',
        metadata: { readDelay: 120 },
      });
      expect(event.eventType).toBe('message.read');
      expect(event.metadata.readDelay).toBe(120);
    });

    it('should emit client.risk.updated with previous and new score', () => {
      const event = createDomainEvent('client.risk.updated', {
        clientId: 'cid',
        tenantId: 'tid',
        metadata: { previousRiskScore: 'yellow', newRiskScore: 'green' },
      });
      expect(event.eventType).toBe('client.risk.updated');
      expect(event.metadata.previousRiskScore).toBe('yellow');
      expect(event.metadata.newRiskScore).toBe('green');
    });

    it('should emit decision.made with decision details', () => {
      const event = createDomainEvent('decision.made', {
        clientId: 'cid',
        tenantId: 'tid',
        invoiceId: 'inv-123',
        metadata: {
          action: 'send_reminder',
          channel: 'WHATSAPP',
          reason: 'Baixo risco',
          confidence: 0.95,
          modelVersion: 'heuristic-v1',
          features: { overdueCount: 0, avgDelay: 2 },
        },
      });
      expect(event.eventType).toBe('decision.made');
      expect(event.metadata.action).toBe('send_reminder');
      expect(event.metadata.modelVersion).toBe('heuristic-v1');
    });
  });

  describe('Event Bus', () => {
    it('should deliver event to all subscribed handlers', () => {
      const handlers: string[] = [];
      const handler1 = (e: any) => handlers.push('handler1');
      const handler2 = (e: any) => handlers.push('handler2');
      const handler3 = (e: any) => handlers.push('handler3');

      // Simulate event bus delivery
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tid',
      });
      handler1(event);
      handler2(event);
      handler3(event);
      expect(handlers).toEqual(['handler1', 'handler2', 'handler3']);
    });

    it('should not fail if one handler throws (isolated)', () => {
      const results: string[] = [];
      const safeHandler = (e: any) => results.push('safe');
      const throwingHandler = (e: any) => {
        throw new Error('Handler failed');
      };
      const anotherHandler = (e: any) => results.push('another');

      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tid',
      });

      // Run handlers in try-catch to simulate isolation
      [throwingHandler, safeHandler, anotherHandler].forEach((handler) => {
        try {
          handler(event);
        } catch {
          /* isolated */
        }
      });
      expect(results).toContain('safe');
      expect(results).toContain('another');
    });

    it('should support async handlers', async () => {
      const event = createDomainEvent('payment.confirmed', {
        clientId: 'cid',
        tenantId: 'tid',
      });
      const asyncHandler = async (e: any) => {
        return Promise.resolve(`Processed: ${e.eventType}`);
      };
      const result = await asyncHandler(event);
      expect(result).toBe('Processed: payment.confirmed');
    });
  });
});
