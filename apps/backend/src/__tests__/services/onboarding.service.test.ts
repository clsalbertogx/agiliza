import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { EventRepositoryPort } from '@/application/ports/repositories/event.repository.port';
import { OnboardingService } from '@/application/services/onboarding.service';
import { MessageChannel } from '@/domain/entities/client';
import { RiskScore } from '@/domain/value-objects/risk-score';

function createMocks() {
  const clientRepo: ClientRepositoryPort = {
    findById: vi.fn(),
    findByPhone: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateRiskScore: vi.fn(),
  };

  const eventRepo: EventRepositoryPort = {
    save: vi.fn(),
    findByTenantId: vi.fn(),
  };

  const messageProvider: MessageProviderPort = {
    sendText: vi.fn().mockResolvedValue({
      externalId: 'ext-123',
      status: 'queued',
      timestamp: new Date().toISOString(),
    }),
    sendTemplate: vi.fn(),
    getStatus: vi.fn(),
  };

  return { clientRepo, eventRepo, messageProvider };
}

const makeClient = (overrides = {}) => ({
  id: 'client-123',
  tenantId: 'tenant-123',
  name: 'John Doe',
  phone: '5511999998888',
  email: 'john@example.com',
  document: '12345678901',
  preferredChannel: MessageChannel.WHATSAPP,
  preferredTime: '09:00',
  preferredLeadDays: 3,
  riskScore: RiskScore.GREEN,
  totalInvoices: 0,
  paidInvoices: 0,
  avgPaymentDelay: null,
  ...overrides,
});

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMocks();
    service = new OnboardingService(mocks.clientRepo, mocks.eventRepo, mocks.messageProvider);
  });

  describe('startOnboarding', () => {
    it('should create onboarding session and send first question when client exists', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      expect(mocks.clientRepo.findById).toHaveBeenCalledWith(client.id);
      expect(mocks.messageProvider.sendText).toHaveBeenCalledOnce();
      expect(mocks.messageProvider.sendText).toHaveBeenCalledWith(
        expect.objectContaining({
          to: client.phone,
          tenantId: client.tenantId,
          clientId: client.id,
        }),
      );
      // Verify it sent a question text (first question mentions "Pergunta 1")
      const callArg = vi.mocked(mocks.messageProvider.sendText).mock.calls[0][0];
      expect(callArg.text).toContain('Pergunta 1 de 3');
    });

    it('should throw error when client is not found', async () => {
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(null);

      await expect(service.startOnboarding('nonexistent', 'tenant-123')).rejects.toThrow('Client not found');

      expect(mocks.messageProvider.sendText).not.toHaveBeenCalled();
    });

    it('should format phone with 55 prefix when missing', async () => {
      const client = makeClient({ phone: '11999998888' });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      expect(mocks.messageProvider.sendText).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `55${client.phone}`,
        }),
      );
    });
  });

  describe('sendQuestion', () => {
    it('should throw error when onboarding session not found', async () => {
      await expect(service.sendQuestion('no-session')).rejects.toThrow('Onboarding session not found');
    });

    it('should throw error when session is expired', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      // Advance time past 24h expiry
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      await expect(service.sendQuestion(client.id)).rejects.toThrow('Onboarding session expired');

      vi.useRealTimers();
    });

    it('should send the correct question text for current question index', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      // First call (from startOnboarding) - question 0
      const firstCall = vi.mocked(mocks.messageProvider.sendText).mock.calls[0][0];
      expect(firstCall.text).toContain('Pergunta 1 de 3');
    });
  });

  describe('processAnswer', () => {
    it('should return error when session not found', async () => {
      const result = await service.processAnswer('no-session', '1');

      expect(result.completed).toBe(false);
      expect(result.message).toContain('onboarding não encontrada');
    });

    it('should return error when session is expired', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = await service.processAnswer(client.id, '1');

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Sessão expirada');

      vi.useRealTimers();
    });

    it('should accept channel answer by number (1, 2, 3)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      const result = await service.processAnswer(client.id, '2'); // EMAIL

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Pergunta 2');
      // Should have sent second question
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(2);
    });

    it('should accept channel answer by name (whatsapp, email, sms)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      const result = await service.processAnswer(client.id, 'email');

      expect(result.completed).toBe(false);
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid channel answer and re-ask question', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      const result = await service.processAnswer(client.id, '99');

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Opção inválida');
      // Should have sent the question again (re-ask)
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(2);
    });

    it('should accept time answer by number (1, 2, 3)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1'); // channel

      const result = await service.processAnswer(client.id, '3'); // night

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Pergunta 3');
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(3);
    });

    it('should accept time answer by name (manhã, tarde, noite)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1'); // channel

      const result = await service.processAnswer(client.id, 'tarde');

      expect(result.completed).toBe(false);
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(3);
    });

    it('should reject invalid time answer and re-ask', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1'); // channel

      const result = await service.processAnswer(client.id, '99');

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Opção inválida');
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(3); // re-ask
    });

    it('should accept lead days answer (1, 2, 3, 4)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1'); // channel
      await service.processAnswer(client.id, '1'); // time

      const result = await service.processAnswer(client.id, '3'); // 5 days

      expect(result.message).toContain('Tudo pronto');
      expect(mocks.messageProvider.sendText).toHaveBeenCalledTimes(3);
    });

    it('should reject invalid lead days answer and re-ask', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1'); // channel
      await service.processAnswer(client.id, '1'); // time

      const result = await service.processAnswer(client.id, '99');

      expect(result.completed).toBe(false);
      expect(result.message).toContain('Opção inválida');
    });

    it('should complete onboarding and save preferences after all 3 answers', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '2'); // channel: EMAIL
      await service.processAnswer(client.id, '3'); // time: 19:00

      const result = await service.processAnswer(client.id, '4'); // 7 days

      expect(result.completed).toBe(true);
      expect(result.message).toContain('Tudo pronto');

      // Should have updated client preferences
      expect(mocks.clientRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: client.id,
          preferredChannel: MessageChannel.EMAIL,
          preferredTime: '19:00',
          preferredLeadDays: 7,
        }),
      );

      // Should have saved completion event
      expect(mocks.eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'client.risk.updated',
          clientId: client.id,
          tenantId: client.tenantId,
          metadata: expect.objectContaining({
            type: 'onboarding_completed',
            preferences: expect.objectContaining({
              channel: MessageChannel.EMAIL,
              time: '19:00',
              leadDays: 7,
            }),
          }),
        }),
      );
    });

    it('should return session not found when called after completion (state deleted)', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');

      // State is deleted after completion, so next call returns session not found
      const result = await service.processAnswer(client.id, '1');
      expect(result.completed).toBe(false);
      expect(result.message).toContain('não encontrada');
    });
  });

  describe('completeOnboarding (via processAnswer completion)', () => {
    it('should throw error if client disappears in completeOnboarding', async () => {
      const client = makeClient();

      // findById calls during the 4 operations:
      // startOnboarding: findById (1) + sendQuestion's findById (2)
      // processAnswer #1 (channel): sendQuestion's findById (3)
      // processAnswer #2 (time): sendQuestion's findById (4)
      // processAnswer #3 (leadDays): completeOnboarding's findById (5) → null
      vi.mocked(mocks.clientRepo.findById)
        .mockResolvedValueOnce(client) // 1: startOnboarding
        .mockResolvedValueOnce(client) // 2: startOnboarding → sendQuestion
        .mockResolvedValueOnce(client) // 3: processAnswer channel → sendQuestion
        .mockResolvedValueOnce(client) // 4: processAnswer time → sendQuestion
        .mockResolvedValueOnce(null); // 5: completeOnboarding → throw!

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');

      await expect(service.processAnswer(client.id, '1')).rejects.toThrow('Client not found');
    });

    it('should use provided lead days from answer', async () => {
      const client = makeClient({ preferredLeadDays: 5 });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');

      expect(mocks.clientRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: client.id,
          preferredLeadDays: 1, // answer '1' maps to 1 day
        }),
      );
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return active true with current question when session exists', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      const status = await service.getOnboardingStatus(client.id);
      expect(status.active).toBe(true);
      expect(status.currentQuestion).toBe(0);
    });

    it('should return active false when no session exists', async () => {
      const status = await service.getOnboardingStatus('no-session');
      expect(status.active).toBe(false);
      expect(status.currentQuestion).toBeUndefined();
    });

    it('should return active false when session is expired', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.startOnboarding(client.id, client.tenantId);

      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const status = await service.getOnboardingStatus(client.id);
      expect(status.active).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle client repo failure on startOnboarding', async () => {
      vi.mocked(mocks.clientRepo.findById).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.startOnboarding('client-123', 'tenant-123')).rejects.toThrow('Database connection failed');
    });

    it('should handle message provider failure on startOnboarding', async () => {
      const client = makeClient();
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(mocks.messageProvider.sendText).mockRejectedValue(new Error('Provider API error'));

      await expect(service.startOnboarding(client.id, client.tenantId)).rejects.toThrow('Provider API error');
    });

    it('should handle client repo update failure on completion', async () => {
      const client = makeClient();

      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(mocks.clientRepo.update).mockRejectedValue(new Error('DB error on update'));

      await service.startOnboarding(client.id, client.tenantId);
      await service.processAnswer(client.id, '1');
      await service.processAnswer(client.id, '1');

      await expect(service.processAnswer(client.id, '1')).rejects.toThrow('DB error on update');
    });
  });
});
