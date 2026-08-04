import { describe, it, expect, vi } from 'vitest';
import { AlertService } from '@/application/services/alert.service';
import type { AlertChannelPort, AlertMessage } from '@/application/ports/gateways/alert-channel.port';

function createChannelMock() {
  const sendAlert = vi.fn();
  return { channel: { sendAlert } as AlertChannelPort, sendAlert };
}

describe('AlertService', () => {
  it('alertPaymentFailed should send a warning alert with metadata', async () => {
    const { channel, sendAlert } = createChannelMock();
    const service = new AlertService(channel);

    await service.alertPaymentFailed({ invoiceId: 'inv-1', reason: 'card_declined' });

    expect(sendAlert).toHaveBeenCalledTimes(1);
    const alert = sendAlert.mock.calls[0][0] as AlertMessage;
    expect(alert.title).toContain('Payment Failed');
    expect(alert.severity).toBe('warning');
    expect(alert.metadata).toEqual({ invoiceId: 'inv-1', reason: 'card_declined' });
  });

  it('alertWebhookDrained should send a critical alert with metadata', async () => {
    const { channel, sendAlert } = createChannelMock();
    const service = new AlertService(channel);

    await service.alertWebhookDrained({ eventId: 'job-1', attempts: 5 });

    expect(sendAlert).toHaveBeenCalledTimes(1);
    const alert = sendAlert.mock.calls[0][0] as AlertMessage;
    expect(alert.title).toContain('Webhook Failed');
    expect(alert.severity).toBe('critical');
    expect(alert.metadata).toEqual({ eventId: 'job-1', attempts: 5 });
  });

  it('alertRateLimitHits should skip alerts at or below the threshold', async () => {
    const { channel, sendAlert } = createChannelMock();
    const service = new AlertService(channel);

    await service.alertRateLimitHits('tenant-1', 10);
    await service.alertRateLimitHits('tenant-1', 0);

    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('alertRateLimitHits should send a critical alert above the threshold', async () => {
    const { channel, sendAlert } = createChannelMock();
    const service = new AlertService(channel);

    await service.alertRateLimitHits('tenant-1', 42);

    expect(sendAlert).toHaveBeenCalledTimes(1);
    const alert = sendAlert.mock.calls[0][0] as AlertMessage;
    expect(alert.title).toContain('Rate Limit');
    expect(alert.severity).toBe('critical');
    expect(alert.metadata).toEqual({ tenantId: 'tenant-1', rateLimitHits: '42' });
  });
});