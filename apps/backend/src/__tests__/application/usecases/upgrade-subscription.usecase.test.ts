import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure } from '@/application/types/either';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { UpgradeSubscriptionUseCase } from '@/application/usecases/upgrade-subscription.usecase';
import { SubscriptionStatus, BillingCycle, type Subscription } from '@/domain/entities/subscription';
import { InvoiceStatus, type Invoice } from '@/domain/entities/invoice';

describe('UpgradeSubscriptionUseCase', () => {
  let useCase: UpgradeSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockInvoiceRepo: InvoiceRepositoryPort;
  let mockEventBus: EventBusPort;
  let mockIdGenerator: IdGeneratorPort;

  const validInput = {
    subscriptionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    newPlan: 'Enterprise Plan',
    newAmount: 199.90,
  };

  const activeSubscription: Subscription = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    plan: 'Premium Plan',
    amount: 99.90,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-09-01'),
    startDate: new Date('2026-08-01'),
    autoRenew: true,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };

  beforeEach(() => {
    mockSubscriptionRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTenantId: vi.fn(),
      findByClientId: vi.fn(),
      findActiveByNextBillingBefore: vi.fn(),
      findDueForRenewal: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    };

    mockInvoiceRepo = {
      findById: vi.fn(),
      findExistingForSubscription: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      getStats: vi.fn(),
    };

    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000099'),
      validate: vi.fn().mockReturnValue(true),
    };

    useCase = new UpgradeSubscriptionUseCase(
      mockSubscriptionRepo,
      mockInvoiceRepo,
      mockEventBus,
      mockIdGenerator,
    );
  });

  it('should upgrade an active subscription and update plan details', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);

    const mockCreditInvoice: Invoice = {
      id: '00000000-0000-0000-0000-000000000099',
      tenantId: activeSubscription.tenantId,
      clientId: activeSubscription.clientId,
      amount: 50,
      dueDate: new Date(),
      status: InvoiceStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockCreditInvoice);

    const upgradedSubscription = {
      ...activeSubscription,
      plan: 'Enterprise Plan',
      amount: 199.90,
      updatedAt: new Date(),
    };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(upgradedSubscription);

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.plan).toBe('Enterprise Plan');
      expect(result.value.amount).toBe(199.90);
    }
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
      validInput.subscriptionId,
      expect.objectContaining({
        plan: 'Enterprise Plan',
        amount: 199.90,
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription.updated',
      }),
    );
  });

  it('should upgrade with trialDays starting a new trial', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
    const mockCreditInvoice: Invoice = {
      id: '00000000-0000-0000-0000-000000000099',
      tenantId: activeSubscription.tenantId,
      clientId: activeSubscription.clientId,
      amount: 50,
      dueDate: new Date(),
      status: InvoiceStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockCreditInvoice);

    const upgradedSubscription = {
      ...activeSubscription,
      plan: 'Enterprise Plan',
      amount: 199.90,
      status: SubscriptionStatus.TRIAL,
      trialDays: 7,
      trialEndsAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockSubscriptionRepo.update).mockResolvedValue(upgradedSubscription);

    const result = await useCase.execute({ ...validInput, trialDays: 7 });

    expect(isSuccess(result)).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(SubscriptionStatus.TRIAL);
      expect(result.value.trialDays).toBe(7);
    }
  });

  it('should return NOT_FOUND when subscription does not exist', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('NOT_FOUND');
    }
    expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
  });

  it('should return INVALID_STATUS when subscription is CANCELLED', async () => {
    const cancelledSub = {
      ...activeSubscription,
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
    };
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(cancelledSub);

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INVALID_STATUS');
    }
    expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
  });

  it('should return INVALID_STATUS when subscription is EXPIRED', async () => {
    const expiredSub = {
      ...activeSubscription,
      status: SubscriptionStatus.EXPIRED,
      endDate: new Date(),
    };
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(expiredSub);

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INVALID_STATUS');
    }
  });

  it('should return INTERNAL_ERROR when update fails', async () => {
    vi.mocked(mockSubscriptionRepo.findById).mockResolvedValue(activeSubscription);
    const mockCreditInvoice: Invoice = {
      id: '00000000-0000-0000-0000-000000000099',
      tenantId: activeSubscription.tenantId,
      clientId: activeSubscription.clientId,
      amount: 50,
      dueDate: new Date(),
      status: InvoiceStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockCreditInvoice);
    vi.mocked(mockSubscriptionRepo.update).mockRejectedValue(new Error('Database error'));

    const result = await useCase.execute(validInput);

    expect(isFailure(result)).toBe(true);
    if (!result.success) {
      expect(result.value.code).toBe('INTERNAL_ERROR');
    }
  });
});
