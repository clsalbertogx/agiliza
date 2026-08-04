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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it('loads existing config from payment-config endpoint', async () => {
      mockGet.mockResolvedValue({
        data: { provider: 'mercadopago', accessToken: 'mp_token_xxx', environment: 'production' },
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/tenants/demo/payment-config');
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
