import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

// Mock next/navigation (used by some components)
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import DashboardPage from '@/app/dashboard/page';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: NOT demo mode
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'demo'),
        setItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton while fetching data', () => {
      // Return a promise that never resolves to keep loading state
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<DashboardPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error state when API call fails', async () => {
      mockGet.mockRejectedValue(new Error('Falha na conexão'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/falha na conexão/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });

    it('should retry fetch when retry button is clicked', async () => {
      const user = userEvent.setup();

      // The page fires stats, invoices and clients inside Promise.all
      // (3 parallel calls per load). Use an endpoint-aware implementation so the
      // failure is isolated to the first stats attempt and retries succeed.
      let statsAttempt = 0;
      mockGet.mockImplementation((endpoint: string) => {
        if (endpoint === '/api/invoices/stats') {
          statsAttempt += 1;
          if (statsAttempt === 1) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve({
            data: {
              total: 10,
              paid: 5,
              pending: 3,
              overdue: 2,
              totalAmount: 5000,
              paidAmount: 2500,
              pendingAmount: 1500,
              overdueAmount: 1000,
            },
          });
        }
        if (endpoint === '/api/invoices') {
          return Promise.resolve({
            data: [],
            meta: { total: 0, page: 1, perPage: 5, totalPages: 0 },
          });
        }
        // '/api/clients'
        return Promise.resolve({ data: [] });
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      await waitFor(() => {
        expect(screen.getByText(/faturamento/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty invoices', () => {
    it('should show empty message when no invoices are returned', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 5,
          paid: 3,
          pending: 1,
          overdue: 1,
          totalAmount: 5000,
          paidAmount: 2500,
          pendingAmount: 1500,
          overdueAmount: 1000,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 1, perPage: 5, totalPages: 0 },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/últimas faturas/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/nenhuma fatura encontrada/i)).toBeInTheDocument();
    });
  });

  describe('success state with data', () => {
    it('should render KPI cards with formatted values', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 10,
          paid: 5,
          pending: 3,
          overdue: 2,
          totalAmount: 5000,
          paidAmount: 2500,
          pendingAmount: 1500,
          overdueAmount: 1000,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 'inv-1',
            clientId: 'client-1',
            amount: 150,
            dueDate: '2026-08-15T00:00:00Z',
            status: 'PENDING',
          },
        ],
        meta: { total: 1, page: 1, perPage: 5, totalPages: 1 },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/faturamento/i)).toBeInTheDocument();
      });

      // Check KPI values are rendered
      // totalCollected = paidAmount = 2500 — appears as Faturamento value
      const kpiValues = screen.getAllByText('R$ 2.500,00');
      expect(kpiValues.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('5/10')).toBeInTheDocument(); // paidInvoices / totalInvoices
    });

    it('should show invoices in the table when available', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 1,
          paid: 1,
          pending: 0,
          overdue: 0,
          totalAmount: 150,
          paidAmount: 150,
          pendingAmount: 0,
          overdueAmount: 0,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 'inv-1',
            clientId: 'client-1',
            amount: 150,
            dueDate: '2026-08-15T00:00:00Z',
            status: 'PAID',
          },
        ],
        meta: { total: 1, page: 1, perPage: 5, totalPages: 1 },
      });
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'client-1', name: 'Joana Lima' }],
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/últimas faturas/i)).toBeInTheDocument();
      });

      // clientName should be resolved from the /api/clients map, not the raw clientId
      expect(screen.getByText('Joana Lima')).toBeInTheDocument();
      expect(screen.queryByText('client-1')).not.toBeInTheDocument();
    });
  });

  describe('demo mode', () => {
    it('should show demo data when NEXT_PUBLIC_DEMO_MODE is true', async () => {
      vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');

      render(<DashboardPage />);

      // Demo mode simulates a delay, so wait for data
      await waitFor(() => {
        expect(screen.getByText(/faturamento/i)).toBeInTheDocument();
      });

      // Demo data values
      expect(screen.getByText('R$ 12.450,00')).toBeInTheDocument(); // totalCollected
      expect(screen.getByText('32/45')).toBeInTheDocument(); // paidInvoices / totalInvoices

      // Wired components: StatCard KPI row + ReportChart status pie
      expect(screen.getByText('Distribuição de Faturas por Status')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Gráfico de pizza' })).toBeInTheDocument();

      // Demo mode should NOT call the API
      expect(mockGet).not.toHaveBeenCalled();

      // Should show demo client names
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
  });
});
