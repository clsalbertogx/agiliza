import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

import ClientsPage from '@/app/dashboard/clients/page';

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'demo'),
        setItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton while fetching clients', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<ClientsPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error state with retry when API call fails', async () => {
      const user = userEvent.setup();

      mockGet.mockRejectedValueOnce(new Error('Falha na conexão'));
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'c1', name: 'João Silva', phone: '85999990001', email: 'joao@email.com', riskScore: 'GREEN' }],
        meta: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      });

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/falha na conexão/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show EmptyState when no clients are returned', async () => {
      mockGet.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 20, totalPages: 0 },
      });

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/nenhum cliente encontrado/i)).toBeInTheDocument();
      });
    });
  });

  describe('success state with data', () => {
    it('should call api.get with the authenticated tenant and render real clients', async () => {
      mockGet.mockResolvedValue({
        data: [
          { id: 'c1', name: 'João Silva', phone: '85999990001', email: 'joao@email.com', riskScore: 'GREEN' },
          { id: 'c2', name: 'Maria Santos', phone: '85999990002', email: 'maria@email.com', riskScore: 'RED' },
        ],
        meta: { total: 2, page: 1, perPage: 20, totalPages: 1 },
      });

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ tenantId: 'demo' }));

      expect(screen.getByText('Maria Santos')).toBeInTheDocument();

      // UPPERCASE riskScore from API must be mapped to lowercase for ClientCard
      expect(screen.getByText('green')).toBeInTheDocument();
      expect(screen.getByText('red')).toBeInTheDocument();
      expect(screen.queryByText('GREEN')).not.toBeInTheDocument();
    });

    it('should render empty email as fallback', async () => {
      mockGet.mockResolvedValue({
        data: [{ id: 'c1', name: 'Ana Costa', phone: '85999990004', email: null, riskScore: 'YELLOW' }],
        meta: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      });

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
      });
      expect(screen.getByText('yellow')).toBeInTheDocument();
    });
  });
});
