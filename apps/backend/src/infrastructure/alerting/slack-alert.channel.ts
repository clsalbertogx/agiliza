import type { AlertChannelPort, AlertMessage } from '@/application/ports/gateways/alert-channel.port';

export class SlackAlertChannel implements AlertChannelPort {
  private readonly webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  }

  private severityColor(severity: AlertMessage['severity']): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      default:
        return 'good';
    }
  }

  async sendAlert(alert: AlertMessage): Promise<void> {
    if (!this.webhookUrl) return; // silent no-op if not configured

    const payload = {
      attachments: [
        {
          color: this.severityColor(alert.severity),
          title: alert.title,
          text: alert.message,
          fields: Object.entries(alert.metadata || {}).map(([title, value]) => ({
            title,
            value: String(value),
            short: true,
          })),
        },
      ],
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}
