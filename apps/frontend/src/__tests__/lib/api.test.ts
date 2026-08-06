import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('apiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'test-token'),
        setItem: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses o envelope de erro { error: { code, message } } e lança a mensagem real', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'VALIDATION_ERROR', message: 'querystring/tenantId must match format "uuid"' },
      }),
    } as Response);

    await expect(apiClient('/api/whatever')).rejects.toThrow('querystring/tenantId must match format "uuid"');
  });

  it('lança a string de erro quando o envelope é { error: "texto" }', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Slug already in use' }),
    } as Response);

    await expect(apiClient('/api/tenants')).rejects.toThrow('Slug already in use');
  });

  it('cai para HTTP status quando o envelope de erro é inválido', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { nested: { deep: true } } }),
    } as Response);

    await expect(apiClient('/api/x')).rejects.toThrow('HTTP 500');
  });

  it('não inclui tenantId na query quando o valor é null/undefined', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);
    global.fetch = fetchMock;

    await apiClient('/api/clients', { params: { tenantId: null, perPage: '100' } });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('perPage=100');
    expect(url).not.toContain('tenantId');
  });

  it('inclui tenantId na query quando o valor é uma string real', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);
    global.fetch = fetchMock;

    await apiClient('/api/clients', { params: { tenantId: TEST_TENANT_ID } });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`tenantId=${TEST_TENANT_ID}`);
  });
});
