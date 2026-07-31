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

const EMPTY_CONFIG = { data: { provider: 'asaas', environment: 'sandbox' } };

describe('SettingsPage — Multi-Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provider selector', () => {
    it('renders all provider options', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      const select = screen.getByLabelText('Provedor') as HTMLSelectElement;
      const optionValues = Array.from(select.options).map((o) => o.value);

      expect(optionValues).toEqual(
        expect.arrayContaining(['asaas', 'mercadopago', 'stripe', 'pagbank', 'polar']),
      );
      expect(optionValues).toHaveLength(5);
    });

    it('displays friendly labels for each provider', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      const select = screen.getByLabelText('Provedor') as HTMLSelectElement;
      const labels = Array.from(select.options).map((o) => o.text);

      expect(labels).toEqual(
        expect.arrayContaining(['Asaas', 'Mercado Pago', 'Stripe', 'PagBank', 'Polar']),
      );
    });
  });

  describe('dynamic fields per provider', () => {
    it('shows apiKey + environment for Asaas', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Ambiente')).toBeInTheDocument();
      expect(screen.queryByLabelText('Access Token')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Secret Key')).not.toBeInTheDocument();
    });

    it('shows accessToken + environment for Mercado Pago', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await userEvent.setup().selectOptions(screen.getByLabelText('Provedor'), 'mercadopago');

      expect(screen.getByLabelText('Access Token')).toBeInTheDocument();
      expect(screen.getByLabelText('Ambiente')).toBeInTheDocument();
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    });

    it('shows secretKey, publishableKey, webhookSecret + environment for Stripe', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await userEvent.setup().selectOptions(screen.getByLabelText('Provedor'), 'stripe');

      expect(screen.getByLabelText('Secret Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Publishable Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Webhook Secret')).toBeInTheDocument();
      expect(screen.getByLabelText('Ambiente')).toBeInTheDocument();
    });

    it('shows accessToken + environment for PagBank', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await userEvent.setup().selectOptions(screen.getByLabelText('Provedor'), 'pagbank');

      expect(screen.getByLabelText('Access Token')).toBeInTheDocument();
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    });

    it('shows accessToken + environment for Polar', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await userEvent.setup().selectOptions(screen.getByLabelText('Provedor'), 'polar');

      expect(screen.getByLabelText('Access Token')).toBeInTheDocument();
    });

    it('resets config fields when switching providers', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('API Key'), 'asaas-key');

      await user.selectOptions(screen.getByLabelText('Provedor'), 'mercadopago');

      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
      const accessTokenInput = screen.getByLabelText('Access Token') as HTMLInputElement;
      expect(accessTokenInput.value).toBe('');
    });

    it('renders secret fields as password type', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'password');

      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText('Provedor'), 'stripe');

      expect(screen.getByLabelText('Secret Key')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Webhook Secret')).toHaveAttribute('type', 'password');
    });

    it('renders publishableKey as text type', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await userEvent.setup().selectOptions(screen.getByLabelText('Provedor'), 'stripe');

      expect(screen.getByLabelText('Publishable Key')).toHaveAttribute('type', 'text');
    });
  });

  describe('form submission', () => {
    it('submits Asaas config with apiKey + environment', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'asaas_test_key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'asaas',
          apiKey: 'asaas_test_key',
          environment: 'sandbox',
        });
      });

      expect(screen.getByText('Configuração salva com sucesso!')).toBeInTheDocument();
    });

    it('submits Mercado Pago config with accessToken + environment', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Provedor'), 'mercadopago');
      await user.type(screen.getByLabelText('Access Token'), 'mp_access_token_123');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'mercadopago',
          accessToken: 'mp_access_token_123',
          environment: 'sandbox',
        });
      });
    });

    it('submits Stripe config with all four fields', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Provedor'), 'stripe');
      await user.type(screen.getByLabelText('Secret Key'), 'sk_test_xxx');
      await user.type(screen.getByLabelText('Publishable Key'), 'pk_test_xxx');
      await user.type(screen.getByLabelText('Webhook Secret'), 'whsec_xxx');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'stripe',
          secretKey: 'sk_test_xxx',
          publishableKey: 'pk_test_xxx',
          webhookSecret: 'whsec_xxx',
          environment: 'sandbox',
        });
      });
    });

    it('submits PagBank config with accessToken + environment', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Provedor'), 'pagbank');
      await user.type(screen.getByLabelText('Access Token'), 'pagbank_token');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'pagbank',
          accessToken: 'pagbank_token',
          environment: 'sandbox',
        });
      });
    });

    it('submits Polar config with accessToken + environment', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Provedor'), 'polar');
      await user.type(screen.getByLabelText('Access Token'), 'polar_token');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'polar',
          accessToken: 'polar_token',
          environment: 'sandbox',
        });
      });
    });

    it('submits selected environment with production value', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Ambiente')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'asaas_key');
      await user.selectOptions(screen.getByLabelText('Ambiente'), 'production');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/api/tenants/demo/payment-config', {
          provider: 'asaas',
          apiKey: 'asaas_key',
          environment: 'production',
        });
      });
    });
  });

  describe('validation', () => {
    it('blocks submission when required Asaas field is empty', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(mockPut).not.toHaveBeenCalled();
      expect(screen.getByText('Campos obrigatórios:')).toBeInTheDocument();
      // API Key appears both as label and in the validation error list
      expect(screen.getAllByText('API Key')).toHaveLength(2);
    });

    it('blocks submission when Stripe required fields are missing', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Provedor')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Provedor'), 'stripe');
      await user.type(screen.getByLabelText('Secret Key'), 'sk_test');
      // publishableKey missing
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(mockPut).not.toHaveBeenCalled();
      expect(screen.getByText('Campos obrigatórios:')).toBeInTheDocument();
      // Publishable Key appears both as label and in the validation error list
      expect(screen.getAllByText('Publishable Key')).toHaveLength(2);
    });

    it('clears validation errors when fields are filled', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      // First submit to trigger validation
      await user.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(screen.getByText('Campos obrigatórios:')).toBeInTheDocument();

      // Type to clear validation
      await user.type(screen.getByLabelText('API Key'), 'key');
      expect(screen.queryByText('Campos obrigatórios:')).not.toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('shows loading skeleton initially', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<SettingsPage />);

      // While loading, form fields are not visible
      expect(screen.queryByLabelText('Provedor')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    });

    it('shows saving state on submit button', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockImplementation(() => new Promise(() => {}));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'test-key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    });

    it('shows error message on API failure', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockRejectedValue(new Error('Conexão recusada'));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(screen.getByText('Conexão recusada')).toBeInTheDocument();
      });
    });

    it('shows success message on successful save', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(EMPTY_CONFIG);
      mockPut.mockResolvedValue({ data: {} });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('API Key'), 'key');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(screen.getByText('Configuração salva com sucesso!')).toBeInTheDocument();
      });
    });
  });

  describe('config loading', () => {
    it('populates fields from loaded config', async () => {
      mockGet.mockResolvedValue({
        data: {
          provider: 'stripe',
          secretKey: 'sk_live_loaded',
          publishableKey: 'pk_live_loaded',
          environment: 'production',
        },
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Secret Key')).toBeInTheDocument();
      });

      expect((screen.getByLabelText('Secret Key') as HTMLInputElement).value).toBe('sk_live_loaded');
      expect((screen.getByLabelText('Publishable Key') as HTMLInputElement).value).toBe('pk_live_loaded');
      expect(screen.getByLabelText('Ambiente')).toHaveValue('production');
    });

    it('loads from payment-config endpoint', async () => {
      mockGet.mockResolvedValue(EMPTY_CONFIG);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/tenants/demo/payment-config');
      });
    });
  });
});
