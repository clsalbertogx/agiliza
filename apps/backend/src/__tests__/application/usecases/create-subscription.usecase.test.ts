import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import {
  type CreateSubscriptionInput,
  CreateSubscriptionUseCase,
} from '@/application/usecases/create-subscription.usecase';
import { type Client, MessageChannel, RiskScore } from '@/domain/entities/client';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

describe('CreateSubscriptionUseCase', () => {
  let useCase: CreateSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockClientRepo: ClientRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput: CreateSubscriptionInput = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
  };

  const mockClient: Client = {
    id: '00000000-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'John Doe',
    phone: '5511999998888',
    preferredChannel: MessageChannel.WHATSAPP,
    preferredLeadDays: 3,
    riskScore: RiskScore.GREEN,
    totalInvoices: 0,
    paidInvoices: 0,
    avgPaymentDelay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockSubscriptionRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTenantId: vi.fn(),
      findByClientId: vi.fn(),
      findActiveByNextBillingBefore: vi.fn(),
      findDueForRenewal: vi.fn(),
      getSubscriptionsForAnalytics: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    };

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
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000003'),
      validate: vi.fn().mockReturnValue(true),
    };

    useCase = new CreateSubscriptionUseCase(mockSubscriptionRepo, mockClientRepo, mockEventBus, mockIdGenerator);
  });

  describe('Happy Path', () => {
    it('should create a subscription successfully', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockSubscriptionRepo.create).mockImplementation(async (subscription: Subscription) => subscription);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        expect(result.value.plan).toBe('Premium Plan');
        expect(result.value.amount).toBe(99.9);
        expect(result.value.billingCycle).toBe(BillingCycle.MONTHLY);
        expect(result.value.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result.value.tenantId).toBe('00000000-0000-0000-0000-000000000001');
        expect(result.value.clientId).toBe('00000000-0000-0000-0000-000000000002');
        expect(result.value.nextBilling).toBeInstanceOf(Date);
        expect(result.value.startDate).toBeInstanceOf(Date);
      }

      expect(mockClientRepo.findById).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
      );
      expect(mockSubscriptionRepo.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should calculate next billing date for monthly cycle', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockSubscriptionRepo.create).mockImplementation(async (subscription: Subscription) => subscription);

      const before = new Date();
      const result = await useCase.execute(validInput);
      const after = new Date();

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        // Next billing should be ~1 month from now
        const nextBilling = result.value.nextBilling;
        expect(nextBilling.getTime()).toBeGreaterThan(before.getTime());
        expect(nextBilling.getTime()).toBeLessThan(
          new Date(after.getFullYear(), after.getMonth() + 1, after.getDate() + 1).getTime(),
        );
      }
    });

    it('should calculate next billing date for annual cycle', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockSubscriptionRepo.create).mockImplementation(async (subscription: Subscription) => subscription);

      const result = await useCase.execute({ ...validInput, billingCycle: BillingCycle.ANNUAL });

      expect(isSuccess(result)).toBe(true);
      if (result.success) {
        const nextBilling = result.value.nextBilling;
        expect(nextBilling.getFullYear()).toBe(new Date().getFullYear() + 1);
      }
    });

    it('should publish subscription.created event on success', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockSubscriptionRepo.create).mockImplementation(async (subscription: Subscription) => subscription);

      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.created',
          tenantId: '00000000-0000-0000-0000-000000000001',
          clientId: '00000000-0000-0000-0000-000000000002',
        }),
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return NOT_FOUND when client does not exist', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
      }
      expect(mockSubscriptionRepo.create).not.toHaveBeenCalled();
    });

    it('should return INVALID_SUBSCRIPTION for empty plan', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);

      const result = await useCase.execute({ ...validInput, plan: '' });

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_SUBSCRIPTION');
      }
      expect(mockSubscriptionRepo.create).not.toHaveBeenCalled();
    });

    it('should return INVALID_SUBSCRIPTION for zero amount', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);

      const result = await useCase.execute({ ...validInput, amount: 0 });

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INVALID_SUBSCRIPTION');
      }
      expect(mockSubscriptionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('Repository Errors', () => {
    it('should return INTERNAL_ERROR when save fails', async () => {
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockSubscriptionRepo.create).mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (!result.success) {
        expect(result.value.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
