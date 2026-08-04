import { describe, it, expect, vi } from 'vitest';
import { AlertOnPaymentFailedHandler } from '@/application/events/handlers/alert-on-payment-failed.handler';
import type { AlertService } from '@/application/services/alert.service';
import type { DomainEvent } from '@/domain/events/domain-events';

function createMocks() {
  const alertPaymentFailed = vi.fn();
  return {
    alertService: { alertPaymentFailed } as unknown as AlertService,
    alertPaymentFailed,
  };
}

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-1',
    eventType: 'payment.failed',
    clientId: 'client-1',
    tenantId: 'tenant-1',
    invoiceId: 'inv-1',
    timestamp: new Date().toISOString(),
    metadata: { reason: 'card_declined' },
    ...overrides,
  };
}

describe('AlertOnPaymentFailedHandler', () => {
  it('should alert with invoice/tenant/client and reason for payment.failed events', async () => {
    const { alertService, alertPaymentFailed } = createMocks();
    const handler = new AlertOnPaymentFailedHandler(alertService);

    await handler.handle(makeEvent());

    expect(alertPaymentFailed).toHaveBeenCalledTimes(1);
    expect(alertPaymentFailed).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      reason: 'card_declined',
    });
  });

  it('should not alert for non-payment events', async () => {
    const { alertService, alertPaymentFailed } = createMocks();
    const handler = new AlertOnPaymentFailedHandler(alertService);

    await handler.handle(makeEvent({ eventType: 'payment.confirmed' }));

    expect(alertPaymentFailed).not.toHaveBeenCalled();
  });
});