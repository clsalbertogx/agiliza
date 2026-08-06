import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { QueuePort } from '@/application/ports/queue/queue.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { EventRepositoryPort } from '@/application/ports/repositories/event.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { DecisionEngineService } from '@/application/services/decision-engine.service';
import { ReminderService } from '@/application/services/reminder.service';
import { type Client, MessageChannel } from '@/domain/entities/client';
import { type Invoice, InvoiceStatus } from '@/domain/entities/invoice';
import { RiskScore } from '@/domain/value-objects/risk-score';

function createMocks() {
  const invoiceRepo: InvoiceRepositoryPort = {
    findById: vi.fn(),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };

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

  const queue: QueuePort = {
    addJob: vi.fn().mockResolvedValue(undefined),
    addBulkJobs: vi.fn(),
  };

  const messageProvider: MessageProviderPort = {
    sendText: vi.fn(),
    sendTemplate: vi.fn().mockResolvedValue({
      externalId: 'ext-456',
      status: 'queued',
      timestamp: new Date().toISOString(),
    }),
    getStatus: vi.fn(),
  };

  return { invoiceRepo, clientRepo, eventRepo, queue, messageProvider };
}

function createMockDecisionEngine(): DecisionEngineService {
  return {
    decideNextAction: vi.fn().mockReturnValue({
      action: 'send_reminder',
      channel: MessageChannel.WHATSAPP,
      templateName: 'friendly_reminder_d3',
      scheduledAt: new Date('2026-08-02T09:00:00.000Z'),
      confidence: 0.95,
      reasoning: ['Baixo risco — lembrete padrão'],
    }),
  } as unknown as DecisionEngineService;
}

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-123',
  tenantId: 'tenant-123',
  clientId: 'client-123',
  amount: 250.5,
  dueDate: new Date('2026-08-05'),
  status: InvoiceStatus.PENDING,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
  ...overrides,
});

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-123',
  tenantId: 'tenant-123',
  name: 'Maria Silva',
  phone: '5511999998888',
  email: 'maria@example.com',
  document: '12345678901',
  preferredChannel: MessageChannel.WHATSAPP,
  preferredTime: '09:00',
  preferredLeadDays: 3,
  riskScore: RiskScore.GREEN,
  totalInvoices: 5,
  paidInvoices: 4,
  avgPaymentDelay: 2,
  ...overrides,
});

describe('ReminderService', () => {
  let service: ReminderService;
  let mocks: ReturnType<typeof createMocks>;
  let decisionEngine: DecisionEngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMocks();
    decisionEngine = createMockDecisionEngine();
    service = new ReminderService(
      mocks.invoiceRepo,
      mocks.clientRepo,
      mocks.eventRepo,
      mocks.queue,
      mocks.messageProvider,
      decisionEngine,
    );
  });

  describe('processPendingReminders', () => {
    it('should process pending invoices and get decisions from engine', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      const result = await service.processPendingReminders('tenant-123');

      expect(result.processed).toBe(1);
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].action).toBe('send_reminder');

      expect(mocks.invoiceRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          status: 'PENDING',
        }),
      );
      expect(mocks.clientRepo.findById).toHaveBeenCalledWith(invoice.clientId);
      expect(vi.mocked(decisionEngine.decideNextAction)).toHaveBeenCalledWith(client, invoice, 'default');
    });

    it('should skip invoices where client is not found', async () => {
      const invoice = makeInvoice();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(null); // client not found

      const result = await service.processPendingReminders('tenant-123');

      expect(result.processed).toBe(1); // still counted as processed
      expect(result.decisions).toHaveLength(0); // engine not called since client is null
      expect(mocks.eventRepo.save).not.toHaveBeenCalled();
      expect(mocks.queue.addJob).not.toHaveBeenCalled();
    });

    it('should queue a job for each invoice with correct data', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(decisionEngine.decideNextAction).mockReturnValue({
        action: 'send_reminder',
        channel: MessageChannel.WHATSAPP,
        templateName: 'friendly_reminder_d3',
        scheduledAt: new Date('2026-08-02T09:00:00.000Z'),
        confidence: 0.95,
        reasoning: ['Baixo risco — lembrete padrão'],
      });

      await service.processPendingReminders('tenant-123');

      expect(mocks.queue.addJob).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({
          invoiceId: invoice.id,
          clientId: client.id,
          tenantId: client.tenantId,
          to: client.phone,
          channel: MessageChannel.WHATSAPP,
          templateName: 'friendly_reminder_d3',
          variables: expect.objectContaining({
            name: 'Maria',
            value: expect.any(String),
            dueDate: expect.any(String),
          }),
        }),
      );
    });

    it('should log decision event for each processed invoice', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.processPendingReminders('tenant-123');

      expect(mocks.eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'decision.made',
          clientId: client.id,
          tenantId: client.tenantId,
          invoiceId: invoice.id,
          metadata: expect.objectContaining({
            invoiceId: invoice.id,
            decision: expect.any(Object),
          }),
        }),
      );
    });

    it('should handle multiple invoices', async () => {
      const invoice1 = makeInvoice({ id: 'inv-1', clientId: 'client-1' });
      const invoice2 = makeInvoice({ id: 'inv-2', clientId: 'client-2' });
      const client1 = makeClient({ id: 'client-1', name: 'João' });
      const client2 = makeClient({ id: 'client-2', name: 'Ana' });

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice1, invoice2],
        total: 2,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValueOnce(client1).mockResolvedValueOnce(client2);

      const result = await service.processPendingReminders('tenant-123');

      expect(result.processed).toBe(2);
      expect(result.decisions).toHaveLength(2);
      expect(mocks.queue.addJob).toHaveBeenCalledTimes(2);
      expect(mocks.eventRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should handle empty invoice list', async () => {
      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.processPendingReminders('tenant-123');

      expect(result.processed).toBe(0);
      expect(result.decisions).toHaveLength(0);
      expect(mocks.queue.addJob).not.toHaveBeenCalled();
      expect(mocks.eventRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('sendReminderNow', () => {
    it('should send a template message and return result', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      const result = await service.sendReminderNow(invoice.id, 'tenant-123');

      expect(result).toBeDefined();
      expect(result.externalId).toBe('ext-456');

      expect(mocks.invoiceRepo.findById).toHaveBeenCalledWith(invoice.id, 'tenant-123');
      expect(mocks.clientRepo.findById).toHaveBeenCalledWith(client.id);
      expect(mocks.messageProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: client.phone,
          tenantId: 'tenant-123',
          clientId: client.id,
          invoiceId: invoice.id,
          templateName: 'friendly_reminder_d3',
          variables: expect.objectContaining({
            name: 'Maria',
            value: expect.any(String),
            dueDate: expect.any(String),
          }),
        }),
      );
    });

    it('should throw error when invoice is not found', async () => {
      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(null);

      await expect(service.sendReminderNow('nonexistent', 'tenant-123')).rejects.toThrow('Invoice not found');

      expect(mocks.clientRepo.findById).not.toHaveBeenCalled();
      expect(mocks.messageProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('should throw error when client is not found', async () => {
      const invoice = makeInvoice();
      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(null);

      await expect(service.sendReminderNow(invoice.id, 'tenant-123')).rejects.toThrow('Client not found');

      expect(mocks.messageProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('should include pixCopyPaste when available', async () => {
      const invoice = makeInvoice({ pixCopyPaste: 'pix-copy-paste-key' });
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.sendReminderNow(invoice.id, 'tenant-123');

      expect(mocks.messageProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            pixLink: 'pix-copy-paste-key',
          }),
        }),
      );
    });

    it('should indicate PIX not available when pixCopyPaste is missing', async () => {
      const invoice = makeInvoice({ pixCopyPaste: undefined });
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.sendReminderNow(invoice.id, 'tenant-123');

      expect(mocks.messageProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            pixLink: 'PIX não disponível',
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle invoice repo failure on processPendingReminders', async () => {
      vi.mocked(mocks.invoiceRepo.findMany).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.processPendingReminders('tenant-123')).rejects.toThrow('Database connection failed');
    });

    it('should handle queue failure on scheduleReminder', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(mocks.queue.addJob).mockRejectedValue(new Error('Queue unavailable'));

      await expect(service.processPendingReminders('tenant-123')).rejects.toThrow('Queue unavailable');
    });

    it('should handle message provider failure on sendReminderNow', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(mocks.messageProvider.sendTemplate).mockRejectedValue(new Error('Provider API error'));

      await expect(service.sendReminderNow(invoice.id, 'tenant-123')).rejects.toThrow('Provider API error');
    });

    it('should handle event repo failure on processPendingReminders', async () => {
      const invoice = makeInvoice();
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);
      vi.mocked(mocks.eventRepo.save).mockRejectedValue(new Error('Event log failure'));

      await expect(service.processPendingReminders('tenant-123')).rejects.toThrow('Event log failure');
    });
  });

  describe('edge cases', () => {
    it('should handle invoice with large amount', async () => {
      const invoice = makeInvoice({ amount: 999999.99 });
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.processPendingReminders('tenant-123');

      expect(mocks.queue.addJob).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({
          variables: expect.objectContaining({
            value: 'R$ 999999.99',
          }),
        }),
      );
    });

    it('should handle invoice with zero amount', async () => {
      const invoice = makeInvoice({ amount: 0 });
      const client = makeClient();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.processPendingReminders('tenant-123');

      expect(mocks.queue.addJob).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({
          variables: expect.objectContaining({
            value: 'R$ 0.00',
          }),
        }),
      );
    });

    it('should handle client with long name', async () => {
      const client = makeClient({
        name: 'Antônio Carlos Gomes de Oliveira Filho Sobrinho',
      });
      const invoice = makeInvoice();

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.processPendingReminders('tenant-123');

      // Should use only first name
      expect(mocks.queue.addJob).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({
          variables: expect.objectContaining({
            name: 'Antônio',
          }),
        }),
      );
    });

    it('should use the decision scheduledAt for dueDate in the job variables', async () => {
      // The dueDate in the job comes from decision.scheduledAt.toLocaleDateString('pt-BR')
      // not from invoice.dueDate
      const invoice = makeInvoice({
        dueDate: new Date('2026-08-15T00:00:00.000Z'),
      });
      const client = makeClient();

      // Mock engine returns a decision with scheduledAt of 2026-08-02
      vi.mocked(decisionEngine.decideNextAction).mockReturnValue({
        action: 'send_reminder',
        channel: MessageChannel.WHATSAPP,
        templateName: 'friendly_reminder_d3',
        scheduledAt: new Date('2026-08-02T09:00:00.000Z'),
        confidence: 0.95,
        reasoning: ['Baixo risco — lembrete padrão'],
      });

      vi.mocked(mocks.invoiceRepo.findMany).mockResolvedValue({
        data: [invoice],
        total: 1,
      });
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.processPendingReminders('tenant-123');

      // The dueDate is formatted from decision.scheduledAt
      const expectedDate = new Date('2026-08-02T09:00:00.000Z').toLocaleDateString('pt-BR');

      expect(mocks.queue.addJob).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({
          variables: expect.objectContaining({
            dueDate: expectedDate,
          }),
        }),
      );
    });

    it('should handle client with phone without 55 prefix for sendReminderNow', async () => {
      const invoice = makeInvoice();
      const client = makeClient({ phone: '11999998888' });

      vi.mocked(mocks.invoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mocks.clientRepo.findById).mockResolvedValue(client);

      await service.sendReminderNow(invoice.id, 'tenant-123');

      expect(mocks.messageProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '11999998888', // phone as-is, no prefix added
        }),
      );
    });
  });
});
