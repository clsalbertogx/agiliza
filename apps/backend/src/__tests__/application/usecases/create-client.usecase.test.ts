import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { Either, isFailure, isSuccess } from '@/application/types/either';
import { type CreateClientInput, CreateClientUseCase } from '@/application/usecases/create-client.usecase';
import { type Client, createClient, MessageChannel, RiskScore } from '@/domain/entities/client';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Email } from '@/domain/value-objects/email';
import { Phone } from '@/domain/value-objects/phone';

describe('CreateClientUseCase', () => {
  let useCase: CreateClientUseCase;
  let mockClientRepo: ClientRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput: CreateClientInput = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    preferredChannel: 'whatsapp',
    preferredLeadDays: 3,
  };

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

    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
      validate: vi.fn().mockReturnValue(true),
    };

    useCase = new CreateClientUseCase(mockClientRepo, mockEventBus, mockIdGenerator);
  });

  describe('Happy Path', () => {
    it('should create a client successfully with all fields', async () => {
      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(null);
      vi.mocked(mockClientRepo.create).mockImplementation(async (client: Client) => client);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('John Doe');
        expect(result.value.phone).toBe('5511999998888');
        expect(result.value.email).toBe('john@example.com');
        expect(result.value.preferredChannel).toBe(MessageChannel.WHATSAPP);
        expect(result.value.preferredLeadDays).toBe(3);
        expect(result.value.tenantId).toBe('00000000-0000-0000-0000-000000000001');
        expect(result.value.riskScore).toStrictEqual(RiskScore.GREEN);
      }

      expect(mockClientRepo.findByPhone).toHaveBeenCalledWith('5511999998888', '00000000-0000-0000-0000-000000000001');
      expect(mockClientRepo.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should create a client with minimal required fields', async () => {
      const minimalInput: CreateClientInput = {
        tenantId: '00000000-0000-0000-0000-000000000001',
        name: 'Jane Doe',
        phone: '5511888887777',
      };

      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(null);
      vi.mocked(mockClientRepo.create).mockImplementation(async (client: Client) => client);

      const result = await useCase.execute(minimalInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('Jane Doe');
        expect(result.value.preferredChannel).toBe(MessageChannel.WHATSAPP);
        expect(result.value.preferredLeadDays).toBe(3);
        expect(result.value.email).toBeUndefined();
      }
    });

    it('should publish ClientCreated event on success', async () => {
      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(null);
      vi.mocked(mockClientRepo.create).mockImplementation(async (client: Client) => client);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'client.created',
          tenantId: '00000000-0000-0000-0000-000000000001',
          clientId: expect.any(String),
        }),
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return INVALID_PHONE error for invalid phone format', async () => {
      const invalidInput = { ...validInput, phone: '123' };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_PHONE');
      }
      expect(mockClientRepo.findByPhone).not.toHaveBeenCalled();
      expect(mockClientRepo.create).not.toHaveBeenCalled();
    });

    it('should return INVALID_EMAIL error for invalid email format', async () => {
      const invalidInput = { ...validInput, email: 'invalid-email' };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_EMAIL');
      }
    });

    it('should return INVALID_EMAIL error for empty email', async () => {
      const invalidInput = { ...validInput, email: '' };

      const result = await useCase.execute(invalidInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_EMAIL');
      }
    });
  });

  describe('Conflict Errors', () => {
    it('should return CONFLICT error when phone already exists in tenant', async () => {
      const existingClient: Client = {
        id: '00000000-0000-0000-0000-000000000002',
        tenantId: '00000000-0000-0000-0000-000000000001',
        name: 'Existing Client',
        phone: '5511999998888',
        preferredChannel: MessageChannel.WHATSAPP,
        preferredLeadDays: 3,
        riskScore: RiskScore.GREEN,
        totalInvoices: 0,
        paidInvoices: 0,
        avgPaymentDelay: null,
      };

      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(existingClient);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('CONFLICT');
        expect(result.value.message).toContain('already exists');
      }
      expect(mockClientRepo.create).not.toHaveBeenCalled();
    });

    it('should allow same phone in different tenant', async () => {
      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(null);
      vi.mocked(mockClientRepo.create).mockImplementation(async (client: Client) => client);

      const result = await useCase.execute({ ...validInput, tenantId: '00000000-0000-0000-0000-000000000002' });

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when save fails', async () => {
      vi.mocked(mockClientRepo.findByPhone).mockResolvedValue(null);
      vi.mocked(mockClientRepo.create).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
