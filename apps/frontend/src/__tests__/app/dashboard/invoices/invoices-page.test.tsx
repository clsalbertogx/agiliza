import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

import InvoicesPage from '@/app/dashboard/invoices/page';

describe('InvoicesPage', () => {
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
    it('should show loading skeleton while fetching data', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<InvoicesPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error state with retry when API calls fail', async () => {
      const user = userEvent.setup();

      // The page fires stats, invoices and clients inside Promise.all (3 parallel
      // calls per load). Once-mocks would be exhausted on the retry (2nd load), so
      // use an endpoint-aware implementation instead: fail the stats call only on
      // the first attempt.
      let failedOnce = false;

      mockGet.mockImplementation((endpoint: string) => {
        if (endpoint === '/api/invoices/stats') {
          if (!failedOnce) {
            failedOnce = true;
            return Promise.reject(new Error('Falha na conexão'));
          }
          return Promise.resolve({
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
        }
        if (endpoint === '/api/invoices') {
          return Promise.resolve({
            data: [{ id: 'inv-1', clientId: 'client-1', amount: 150, dueDate: '2026-08-15T00:00:00Z', status: 'PAID' }],
            meta: { total: 1, page: 1, perPage: 50, totalPages: 1 },
          });
        }
        // '/api/clients'
        return Promise.resolve({
          data: [{ id: 'client-1', name: 'ACME Corp' }],
        });
      });

      render(<InvoicesPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/falha na conexão/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      await waitFor(() => {
        expect(screen.getByText(/total faturado/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show EmptyState when no invoices are returned', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 1, perPage: 50, totalPages: 0 },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
      });

      render(<InvoicesPage />);

      await waitFor(() => {
        expect(screen.getByText(/nenhuma fatura encontrada/i)).toBeInTheDocument();
      });
    });
  });

  describe('success state with data', () => {
    it('should call api.get with the authenticated tenant, render stats and invoices, and resolve client names', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 3,
          paid: 1,
          pending: 1,
          overdue: 1,
          totalAmount: 300,
          paidAmount: 100,
          pendingAmount: 100,
          overdueAmount: 100,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          { id: 'inv-1', clientId: 'client-1', amount: 100, dueDate: '2026-08-15T00:00:00Z', status: 'PAID' },
          { id: 'inv-2', clientId: 'client-2', amount: 100, dueDate: '2026-08-16T00:00:00Z', status: 'PENDING' },
          { id: 'inv-3', clientId: 'client-3', amount: 100, dueDate: '2026-07-01T00:00:00Z', status: 'OVERDUE' },
        ],
        meta: { total: 3, page: 1, perPage: 50, totalPages: 1 },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          { id: 'client-1', name: 'ACME Corp' },
          { id: 'client-2', name: 'Beta Ltd' },
          { id: 'client-3', name: 'Gamma LLC' },
        ],
      });

      render(<InvoicesPage />);

      await waitFor(() => {
        expect(screen.getByText(/total faturado/i)).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(mockGet).toHaveBeenCalledWith('/api/invoices/stats', expect.objectContaining({ tenantId: 'demo' }));
      expect(mockGet).toHaveBeenCalledWith('/api/invoices', expect.objectContaining({ tenantId: 'demo' }));
      expect(mockGet).toHaveBeenCalledWith(
        '/api/clients',
        expect.objectContaining({ tenantId: 'demo', perPage: '100' }),
      );

      expect(screen.getByText('ACME Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
      expect(screen.getByText('Gamma LLC')).toBeInTheDocument();
      expect(screen.queryByText('client-1')).not.toBeInTheDocument();
    });

    it('should filter out CANCELLED and REFUNDED invoices from the table', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          total: 4,
          paid: 1,
          pending: 1,
          overdue: 1,
          totalAmount: 300,
          paidAmount: 100,
          pendingAmount: 100,
          overdueAmount: 100,
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          { id: 'inv-1', clientId: 'client-1', amount: 100, dueDate: '2026-08-15T00:00:00Z', status: 'PAID' },
          { id: 'inv-2', clientId: 'client-2', amount: 100, dueDate: '2026-08-16T00:00:00Z', status: 'CANCELLED' },
          { id: 'inv-3', clientId: 'client-3', amount: 100, dueDate: '2026-08-17T00:00:00Z', status: 'REFUNDED' },
          { id: 'inv-4', clientId: 'client-4', amount: 100, dueDate: '2026-07-01T00:00:00Z', status: 'OVERDUE' },
        ],
        meta: { total: 4, page: 1, perPage: 50, totalPages: 1 },
      });
      mockGet.mockResolvedValueOnce({
        data: [
          { id: 'client-1', name: 'ACME Corp' },
          { id: 'client-2', name: 'Beta Ltd' },
          { id: 'client-3', name: 'Gamma LLC' },
          { id: 'client-4', name: 'Delta Inc' },
        ],
      });

      render(<InvoicesPage />);

      await waitFor(() => {
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
      });

      expect(screen.getByText('Delta Inc')).toBeInTheDocument();
      expect(screen.queryByText('Beta Ltd')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma LLC')).not.toBeInTheDocument();
    });
  });
});
