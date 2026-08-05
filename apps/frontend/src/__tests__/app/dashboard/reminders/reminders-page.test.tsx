import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockGet,
  },
}));

import RemindersPage from '@/app/dashboard/reminders/page';

describe('RemindersPage', () => {
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
    it('should show loading skeleton while fetching messages', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<RemindersPage />);

      expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error state with retry when API call fails', async () => {
      const user = userEvent.setup();

      mockGet.mockRejectedValueOnce(new Error('Falha na conexão'));
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 'evt-1',
            tenantId: 't1',
            clientId: 'c1',
            eventType: 'MESSAGE_SENT',
            payload: { channel: 'WHATSAPP', templateName: 'overdue_reminder' },
            createdAt: '2026-08-01T10:00:00Z',
          },
        ],
        meta: { total: 1, page: 1, perPage: 50, totalPages: 1 },
      });

      render(<RemindersPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/falha na conexão/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      await waitFor(() => {
        expect(screen.getByText('overdue_reminder')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show EmptyState guiding to schedule reminders when no messages', async () => {
      mockGet.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 50, totalPages: 0 },
      });

      render(<RemindersPage />);

      await waitFor(() => {
        expect(screen.getByText(/nenhum lembrete enviado ainda/i)).toBeInTheDocument();
      });
    });
  });

  describe('success state with data', () => {
    it('should call api.get with the authenticated tenant and render message rows', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: 'evt-1',
            tenantId: 't1',
            clientId: 'client-1',
            eventType: 'MESSAGE_SENT',
            payload: { channel: 'WHATSAPP', templateName: 'overdue_reminder', recipient: '+55 85 99999-0001' },
            createdAt: '2026-08-01T10:00:00Z',
          },
        ],
        meta: { total: 1, page: 1, perPage: 50, totalPages: 1 },
      });

      render(<RemindersPage />);

      await waitFor(() => {
        expect(screen.getByText('client-1')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ tenantId: 'demo' }));

      expect(screen.getByText('overdue_reminder')).toBeInTheDocument();
      expect(screen.getByText('WHATSAPP')).toBeInTheDocument();
    });
  });
});
