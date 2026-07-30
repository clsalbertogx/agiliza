import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetNextDecisionUseCase, type GetNextDecisionInput } from '@/application/usecases/get-next-decision.usecase';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { DecisionEngineService, type Decision } from '@/application/services/decision-engine.service';
import { ApplicationError } from '@/application/errors/application.error';
import { isSuccess, isFailure } from '@/application/types/either';
import { Client, MessageChannel, RiskScore } from '@/domain/entities/client';
import { Invoice, InvoiceStatus } from '@/domain/entities/invoice';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const INVOICE_ID = '00000000-0000-0000-0000-000000000003';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENT_ID,
    tenantId: TENANT_ID,
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    preferredChannel: MessageChannel.WHATSAPP,
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN,
    totalInvoices: 5,
    paidInvoices: 3,
    avgPaymentDelay: null,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    amount: 150.0,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: InvoiceStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeValidInput(overrides: Partial<GetNextDecisionInput> = {}): GetNextDecisionInput {
  return {
    clientId: CLIENT_ID,
    invoiceId: INVOICE_ID,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    action: 'send_reminder',
    channel: MessageChannel.WHATSAPP,
    templateName: 'friendly_reminder_d3',
    scheduledAt: new Date('2026-08-02T09:00:00.000Z'),
    confidence: 0.95,
    reasoning: ['Baixo risco — lembrete padrão'],
    ...overrides,
  };
}

describe('GetNextDecisionUseCase', () => {
  let useCase: GetNextDecisionUseCase;
  let mockClientRepo: ClientRepositoryPort;
  let mockInvoiceRepo: InvoiceRepositoryPort;
  let mockDecisionEngine: DecisionEngineService;

  beforeEach(() => {
    mockClientRepo = {
      findById: vi.fn(),
      findByPhone: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateRiskScore: vi.fn(),
    };

    mockInvoiceRepo = {
      findById: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      getStats: vi.fn(),
    };

    // Spy on decideNextAction so we can override its return
    mockDecisionEngine = {
      decideNextAction: vi.fn(),
    } as unknown as DecisionEngineService;

    useCase = new GetNextDecisionUseCase(mockClientRepo, mockInvoiceRepo, mockDecisionEngine);
  });

  describe('Happy Path', () => {
    it('should return decision for valid client and invoice', async () => {
      const client = makeClient();
      const invoice = makeInvoice();
      const decision = makeDecision();

      vi.mocked(mockClientRepo.findById).mockResolvedValue(client);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mockDecisionEngine.decideNextAction).mockReturnValue(decision);

      const result = await useCase.execute(makeValidInput());

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.action).toBe('send_reminder');
        expect(result.value.channel).toBe(MessageChannel.WHATSAPP);
        expect(result.value.templateName).toBe('friendly_reminder_d3');
        expect(result.value.scheduledAt).toBe(decision.scheduledAt.toISOString());
      }

      expect(mockClientRepo.findById).toHaveBeenCalledWith(CLIENT_ID, TENANT_ID);
      expect(mockInvoiceRepo.findById).toHaveBeenCalledWith(INVOICE_ID, TENANT_ID);
      expect(mockDecisionEngine.decideNextAction).toHaveBeenCalledWith(client, invoice, 'default');
    });

    it('should return decision for high-risk client (suggest_call)', async () => {
      const client = makeClient({ riskScore: RiskScore.RED });
      const invoice = makeInvoice();
      const decision = makeDecision({
        action: 'suggest_call',
        channel: MessageChannel.WHATSAPP,
        templateName: 'urgent_human_call',
        scheduledAt: new Date(),
        confidence: 0.7,
      });

      vi.mocked(mockClientRepo.findById).mockResolvedValue(client);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(invoice);
      vi.mocked(mockDecisionEngine.decideNextAction).mockReturnValue(decision);

      const result = await useCase.execute(makeValidInput());

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.action).toBe('suggest_call');
        expect(result.value.templateName).toBe('urgent_human_call');
      }
    });
  });

  describe('Error Cases', () => {
    it('should return NOT_FOUND when client does not exist', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(makeValidInput());

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value).toBeInstanceOf(ApplicationError);
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
        expect(result.value.message).toContain(CLIENT_ID);
      }

      expect(mockClientRepo.findById).toHaveBeenCalledWith(CLIENT_ID, TENANT_ID);
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when invoice does not exist', async () => {
      const client = makeClient();
      vi.mocked(mockClientRepo.findById).mockResolvedValue(client);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(makeValidInput());

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value).toBeInstanceOf(ApplicationError);
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
        expect(result.value.message).toContain(INVOICE_ID);
      }

      expect(mockClientRepo.findById).toHaveBeenCalledWith(CLIENT_ID, TENANT_ID);
      expect(mockInvoiceRepo.findById).toHaveBeenCalledWith(INVOICE_ID, TENANT_ID);
    });
  });
});
