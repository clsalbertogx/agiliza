import { AlertChannelPort, AlertMessage } from '@/application/ports/gateways/alert-channel.port';

export class AlertService {
  constructor(private readonly channel: AlertChannelPort) {}

  async alertPaymentFailed(metadata: Record<string, unknown>): Promise<void> {
    await this.channel.sendAlert({
      title: '⚠️ Payment Failed',
      message: 'A payment could not be processed.',
      severity: 'warning',
      metadata,
    });
  }

  async alertWebhookDrained(metadata: Record<string, unknown>): Promise<void> {
    await this.channel.sendAlert({
      title: '🔥 Webhook Failed (DLQ)',
      message: 'A webhook exhausted all retries and was sent to the dead letter queue.',
      severity: 'critical',
      metadata,
    });
  }

  async alertRateLimitHits(tenantId: string, count: number): Promise<void> {
    if (count <= 10) return; // threshold
    await this.channel.sendAlert({
      title: '🚨 High Rate Limit Activity',
      message: `Tenant ${tenantId} is hitting rate limits frequently.`,
      severity: 'critical',
      metadata: { tenantId, rateLimitHits: String(count) },
    });
  }
}