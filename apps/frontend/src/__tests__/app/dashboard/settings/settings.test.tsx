import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  describe('form rendering', () => {
    it('renders provider select field', async () => {
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      const select = screen.getByLabelText('Provedor');
      expect(select).toHaveValue('asaas');
    });

    it('renders API key input with type password', async () => {
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      const input = screen.getByLabelText('API Key');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders environment select field', async () => {
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Ambiente')).toBeInTheDocument();
      });

      const select = screen.getByLabelText('Ambiente');
      expect(select).toHaveValue('sandbox');
    });

    it('renders save button', async () => {
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('calls api.put and shows success message', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'test-api-key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-provider', {
          provider: 'asaas',
          apiKey: 'test-api-key',
          environment: 'sandbox',
        });
      });

      expect(screen.getByText('Configuração salva com sucesso!')).toBeInTheDocument();
    });

    it('shows error message on API failure', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });
      mockPut.mockRejectedValue(new Error('Conexão recusada'));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'invalid-key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(screen.getByText('Conexão recusada')).toBeInTheDocument();
      });
    });

    it('disables button while saving', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { provider: 'asaas', hasApiKey: false, environment: 'sandbox' } });
      mockPut.mockImplementation(() => new Promise(() => {}));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    });
  });

  describe('config loading', () => {
    it('loads existing config from API on mount', async () => {
      mockGet.mockResolvedValue({
        data: { provider: 'mercadopago', hasApiKey: true, environment: 'production' },
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/tenants/demo/payment-provider');
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