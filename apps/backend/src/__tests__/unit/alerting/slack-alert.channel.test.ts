import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackAlertChannel } from '@/infrastructure/alerting/slack-alert.channel';

describe('SlackAlertChannel', () => {
  const webhookUrl = 'https://slack.example.com/hooks/live-rotation';

  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.SLACK_WEBHOOK_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be a no-op when no webhook URL is configured', async () => {
    const channel = new SlackAlertChannel('');

    await channel.sendAlert({
      title: 'Title',
      message: 'Message',
      severity: 'critical',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should fall back to the SLACK_WEBHOOK_URL env var when no URL is passed', async () => {
    process.env.SLACK_WEBHOOK_URL = webhookUrl;
    fetchMock.mockResolvedValue({ ok: true });

    const channel = new SlackAlertChannel();
    await channel.sendAlert({ title: 'Title', message: 'Message', severity: 'info' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(webhookUrl);
  });

  it('should post to the webhook URL with a JSON payload', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const channel = new SlackAlertChannel(webhookUrl);

    await channel.sendAlert({
      title: '⚠️ Payment Failed',
      message: 'A payment could not be processed.',
      severity: 'warning',
      metadata: { invoiceId: 'inv-123' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(webhookUrl);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].title).toBe('⚠️ Payment Failed');
    expect(body.attachments[0].text).toBe('A payment could not be processed.');
  });

  it.each([
    ['critical', 'danger'],
    ['warning', 'warning'],
    ['info', 'good'],
  ] as const)('should map severity %s to color %s', async (severity, expectedColor) => {
    fetchMock.mockResolvedValue({ ok: true });
    const channel = new SlackAlertChannel(webhookUrl);

    await channel.sendAlert({ title: 'T', message: 'M', severity });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.attachments[0].color).toBe(expectedColor);
  });

  it('should include metadata as attachment fields', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const channel = new SlackAlertChannel(webhookUrl);

    await channel.sendAlert({
      title: 'T',
      message: 'M',
      severity: 'info',
      metadata: { tenantId: 'tenant-1', attempts: 3 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.attachments[0].fields).toEqual([
      { title: 'tenantId', value: 'tenant-1', short: true },
      { title: 'attempts', value: '3', short: true },
    ]);
  });
});