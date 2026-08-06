import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
    put: mockPut,
  },
}));

import SettingsPage from '@/app/dashboard/settings/page';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => TEST_TENANT_ID),
        setItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('loading state', () => {
    it('shows skeleton while fetching config', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<SettingsPage />);

      expect(screen.getByText('Configurações')).toBeInTheDocument();
      expect(screen.getByText('Gateway de Pagamento')).toBeInTheDocument();
    });
  });

  describe('config loading', () => {
    it('loads existing config from payment-provider endpoint', async () => {
      mockGet.mockResolvedValue({
        data: { provider: 'mercadopago', environment: 'production', hasApiKey: true },
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(`/api/tenants/${TEST_TENANT_ID}/payment-provider`);
      });

      expect(screen.getByLabelText('Provedor')).toHaveValue('mercadopago');
      expect(screen.getByLabelText('Ambiente')).toHaveValue('production');
    });

    it('handles missing config gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toHaveValue('asaas');
      });

      expect(screen.getByLabelText('Ambiente')).toHaveValue('sandbox');
    });
  });
});
