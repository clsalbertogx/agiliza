import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

import RiskPage from '@/app/dashboard/risk/page';

describe('RiskPage', () => {
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

      render(<RiskPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('success state with data', () => {
    it('should call the real endpoints with the authenticated tenant', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          green: { count: 12, percentage: 60 },
          yellow: { count: 5, percentage: 25 },
          red: { count: 3, percentage: 15 },
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'c1', name: 'João Silva', phone: '85999990001', email: 'joao@email.com', riskScore: 'GREEN' }],
        meta: { total: 1, page: 1, perPage: 100, totalPages: 1 },
      });

      render(<RiskPage />);

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/api/reports/risk-distribution',
        expect.objectContaining({ tenantId: 'demo' }),
      );
      expect(mockGet).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ tenantId: 'demo' }));
    });

    it('should render real distribution counts with percentages and mapped client risk', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          green: { count: 12, percentage: 60 },
          yellow: { count: 5, percentage: 25 },
          red: { count: 3, percentage: 15 },
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'c1', name: 'Maria Santos', phone: '85999990002', email: 'maria@email.com', riskScore: 'RED' }],
        meta: { total: 1, page: 1, perPage: 100, totalPages: 1 },
      });

      render(<RiskPage />);

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });

      // Real distribution counts
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Percentages rendered as subtitles
      expect(screen.getAllByText(/60%/).length).toBeGreaterThan(0);

      // UPPERCASE riskScore from API mapped to lowercase for ClientCard
      expect(screen.getByText('red')).toBeInTheDocument();
      expect(screen.queryByText('RED')).not.toBeInTheDocument();
    });
  });

  describe('fallback demo data', () => {
    it('should fall back to demo clients when both API calls fail', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      render(<RiskPage />);

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      // Demo fallback shows the 5 fictional clients
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show EmptyState when no clients are returned', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          green: { count: 0, percentage: 0 },
          yellow: { count: 0, percentage: 0 },
          red: { count: 0, percentage: 0 },
        },
      });
      mockGet.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 1, perPage: 100, totalPages: 0 },
      });

      render(<RiskPage />);

      await waitFor(() => {
        expect(screen.getByText(/nenhum cliente encontrado/i)).toBeInTheDocument();
      });
    });
  });
});
