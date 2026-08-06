import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

import ReportsPage from '@/app/dashboard/reports/page';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('ReportsPage', () => {
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
    it('should show loading skeleton while fetching data', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<ReportsPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('should call the cash-flow endpoint with the authenticated tenant', async () => {
      mockGet.mockResolvedValue({
        data: {
          forecast: [
            {
              month: 'Agosto 2026',
              expectedRevenue: 5000,
              expectedDefaults: 600,
              recoveryEstimate: 180,
              netForecast: 4580,
              confidence: 0.95,
            },
          ],
          summary: {
            totalExpectedRevenue: 5000,
            totalExpectedDefaults: 600,
            totalRecoveryEstimate: 180,
            totalNetForecast: 4580,
            averageConfidence: 0.95,
          },
        },
      });

      render(<ReportsPage />);

      await waitFor(() => {
        expect(screen.getByText('Agosto 2026')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/api/reports/cash-flow',
        expect.objectContaining({ tenantId: TEST_TENANT_ID, months: '6' }),
      );
    });
  });

  describe('error state', () => {
    it('should show ErrorState instead of fabricated mock forecast on API failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      render(<ReportsPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/não foi possível carregar os dados/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();

      // No fabricated forecast is rendered (R$ 33.000,00 was the old fabricated total)
      expect(screen.queryByText(/R\$ 33\.000,00/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Agosto 2026')).not.toBeInTheDocument();
    });
  });
});
