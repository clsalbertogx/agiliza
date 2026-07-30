import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Either, isSuccess, isFailure } from '../../../application/types/either';
import { ApplicationError } from '../../../application/errors/application.error';
import { InvoiceRepositoryPort } from '../../../application/ports/repositories/invoice.repository.port';
import { ClientRepositoryPort } from '../../../application/ports/repositories/client.repository.port';
import { EventBusPort } from '../../../application/ports/adapters/event-bus.port';
import { Invoice, createInvoice, InvoiceStatus } from '../../../domain/entities/invoice';
import { Client, createClient, MessageChannel, RiskScore } from '../../../domain/entities/client';
import { Money } from '../../../domain/value-objects/money';
import { CreateInvoiceUseCase, CreateInvoiceInput } from '../../../application/usecases/create-invoice.usecase';

const mockInvoiceRepo: InvoiceRepositoryPort = {
  findById: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  getStats: vi.fn(),
};

const mockClientRepo: ClientRepositoryPort = {
  findById: vi.fn(),
  findByPhone: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

const mockEventBus: EventBusPort = {
  publish: vi.fn(),
  subscribe: vi.fn(),
};

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const CLIENT_ID = '00000000-0000-0000-0000-000000000002';

  const validInput: CreateInvoiceInput = {
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    amount: 150.00,
    dueDate: new Date('2026-08-15'),
    description: 'Test invoice',
  };

  const mockClient: Client = createClient({
    id: CLIENT_ID,
    tenantId: TENANT_ID,
    name: 'John Doe',
    phone: '5511999998888',
    preferredChannel: MessageChannel.WHATSAPP,
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN,
    totalInvoices: 0,
    paidInvoices: 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateInvoiceUseCase(mockInvoiceRepo, mockClientRepo, mockEventBus);
  });

  describe('Happy Path', () => {
    it('should create an invoice successfully with all fields', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice: Invoice) => invoice);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.amount).toBe(150.00);
        expect(result.value.dueDate).toEqual(new Date('2026-08-15'));
        expect(result.value.description).toBe('Test invoice');
        expect(result.value.status).toBe(InvoiceStatus.PENDING);
        expect(result.value.tenantId).toBe(TENANT_ID);
        expect(result.value.clientId).toBe(CLIENT_ID);
      }
    });

    it('should create an invoice with minimal required fields', async () => {
      const minimalInput: CreateInvoiceInput = {
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        amount: 100.00,
        dueDate: new Date('2026-08-15'),
      };

      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice: Invoice) => invoice);

      const result = await useCase.execute(minimalInput);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.amount).toBe(100.00);
        expect(result.value.description).toBeUndefined();
      }
    });

    it('should publish InvoiceCreated event on success', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice: Invoice) => invoice);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = vi.mocked(mockEventBus.publish).mock.calls[0][0];
      expect(publishedEvent.eventType).toBe('invoice.created');
      expect(publishedEvent.clientId).toBe(CLIENT_ID);
      expect(publishedEvent.tenantId).toBe(TENANT_ID);
      expect(publishedEvent.invoiceId).toBeDefined();
      expect(publishedEvent.metadata).toEqual({
        amount: 150.00,
        dueDate: new Date('2026-08-15').toISOString(),
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return NOT_FOUND error when client does not exist', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
      }
    });

    it('should return FORBIDDEN error when client belongs to different tenant', async () => {
      const otherTenantClient = createClient({
        ...mockClient,
        tenantId: '00000000-0000-0000-0000-000000000003',
      });
      vi.mocked(mockClientRepo.findById).mockResolvedValue(otherTenantClient);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('FORBIDDEN');
        expect(result.value.statusCode).toBe(403);
      }
    });

    it('should return INVALID_AMOUNT error for negative amount', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      const invalidInput = { ...validInput, amount: -50 };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INVALID_AMOUNT');
        expect(result.value.statusCode).toBe(400);
      }
    });

    it('should return INVALID_AMOUNT error for zero amount', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      const invalidInput = { ...validInput, amount: 0 };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INVALID_AMOUNT');
      }
    });

    it('should return INVALID_AMOUNT error for NaN amount', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      const invalidInput = { ...validInput, amount: NaN };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INVALID_AMOUNT');
      }
    });

    it('should return INVALID_AMOUNT error for Infinity amount', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      const invalidInput = { ...validInput, amount: Infinity };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INVALID_AMOUNT');
      }
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when invoice creation fails', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
        expect(result.value.statusCode).toBe(500);
      }
    });
  });
});