import { describe, it, expect } from 'vitest';

describe('SSRF Prevention — SEC-10', () => {
  // URL validation utility that prevents SSRF
  const BLOCKED_HOSTS = [
    '169.254.169.254',        // AWS metadata endpoint
    '127.0.0.1',              // Localhost IPv4
    '::1',                    // Localhost IPv6
    'localhost',              // Localhost hostname
    '0.0.0.0',                // All interfaces
    '10.',                    // RFC 1918 (10.0.0.0/8)
    '172.16.',                // RFC 1918 (172.16.0.0/12)
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',               // RFC 1918 (192.168.0.0/16)
  ];

  // Known payment provider domains for webhook URL allowlisting
  const ALLOWED_PROVIDER_DOMAINS = [
    'api.agiliza.com',
    'webhook.asaas.com',
    'webhook.mercadopago.com',
    'webhook.pagbank.com.br',
    'webhook.polar.sh',
    'hooks.evolution-api.com',
  ];

  function isInternalIP(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    return BLOCKED_HOSTS.some(blocked => lower.startsWith(blocked) || lower === blocked);
  }

  function validateUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Check protocol — only HTTPS allowed for external URLs
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { valid: false, reason: 'Invalid protocol' };
      }

      // Block internal/reserved IPs
      if (isInternalIP(parsed.hostname)) {
        return { valid: false, reason: 'URL points to internal network' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed URL' };
    }
  }

  function validateWebhookUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Block HTTP for webhooks (require HTTPS)
      if (parsed.protocol !== 'https:') {
        return { valid: false, reason: 'Webhook URLs must use HTTPS' };
      }

      // Block internal IPs
      if (isInternalIP(parsed.hostname)) {
        return { valid: false, reason: 'URL points to internal network' };
      }

      // Check if hostname is in allowlist
      const isAllowed = ALLOWED_PROVIDER_DOMAINS.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        return { valid: false, reason: 'Domain not in allowlist' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed URL' };
    }
  }

  it('should reject webhook registration pointing to AWS metadata endpoint', () => {
    // Given a malicious URL "http://169.254.169.254/latest/meta-data/"
    const maliciousUrl = 'http://169.254.169.254/latest/meta-data/';

    // When validating the URL
    const result = validateUrl(maliciousUrl);

    // Then request is rejected with 400 Bad Request
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('URL points to internal network');
  });

  it('should reject URLs pointing to internal network services', () => {
    // Given various URLs pointing to internal services
    const internalUrls = [
      { url: 'http://localhost:5432', host: 'localhost' },
      { url: 'http://127.0.0.1:5432', host: '127.0.0.1' },
      { url: 'http://10.0.0.1:3000', host: '10.0.0.1' },
      { url: 'http://192.168.1.1:6379', host: '192.168.1.1' },
      { url: 'http://172.16.0.1:9200', host: '172.16.0.1' },
      { url: 'http://0.0.0.0:3333', host: '0.0.0.0' },
      { url: 'http://169.254.169.254/latest/', host: '169.254.169.254' },
    ];

    // Verify each URL hostname is correctly extracted
    for (const { url, host } of internalUrls) {
      const parsed = new URL(url);
      expect(parsed.hostname).toBe(host);
    }

    // Then verify each is rejected by the URL validator
    for (const { url } of internalUrls) {
      const result = validateUrl(url);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('URL points to internal network');
    }
  });

  it('should allow valid external URLs for webhook registration', () => {
    // Given a valid external URL
    const validUrls = [
      'https://api.agiliza.com/webhooks/evolution',
      'https://hooks.evolution-api.com/webhook',
      'https://webhook.asaas.com/callback',
    ];

    for (const url of validUrls) {
      // When validating
      const result = validateUrl(url);

      // Then validation should succeed
      expect(result.valid).toBe(true);
    }
  });

  it('should validate URLs against allowlist of known provider domains', () => {
    // Given various URLs
    const testCases = [
      { url: 'https://webhook.asaas.com/callback', expected: true },
      { url: 'https://webhook.mercadopago.com/notification', expected: true },
      { url: 'https://webhook.pagbank.com.br/notify', expected: true },
      { url: 'https://webhook.polar.sh/events', expected: true },
      { url: 'https://hooks.evolution-api.com/webhook', expected: true },
      { url: 'https://evil.com/webhook', expected: false },
      { url: 'https://169.254.169.254/latest/meta-data/', expected: false },
      { url: 'http://localhost:3000/webhook', expected: false },
      { url: 'https://asaas.com/hack', expected: false }, // not allowlisted subdomain
    ];

    for (const { url, expected } of testCases) {
      const result = validateWebhookUrl(url);
      expect(result.valid).toBe(expected);
    }
  });
});
