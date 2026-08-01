import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { CreateInvoiceForSubscriptionUseCase } from '@/application/usecases/create-invoice-for-subscription.usecase';
import { Subscription, SubscriptionStatus, BillingCycle } from '@/domain/entities/subscription';
import { InvoiceStatus } from '@/domain/entities/invoice';
import { Client, MessageChannel, RiskScore } from '@/domain/entities/client';

describe('CreateInvoiceForSubscriptionUseCase', () => {
  let useCase: CreateInvoiceForSubscriptionUseCase;
  let mockSubscriptionRepo: SubscriptionRepositoryPort;
  let mockInvoiceRepo: InvoiceRepositoryPort;
  let mockClientRepo: ClientRepositoryPort;
  let mockEventBus: EventBusPort;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
  const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000003';

  const mockSubscription: Subscription = {
    id: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    plan: 'Premium Plan',
    amount: 99.90,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: new Date('2026-07-15'),
    startDate: new Date('2026-06-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClient: Client = {
    id: CLIENT_ID,
    tenantId: TENANT_ID,
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

    useCase = new CreateInvoiceForSubscriptionUseCase(
      mockSubscriptionRepo,
      mockInvoiceRepo,
      mockClientRepo,
      mockEventBus,
    );
  });

  describe('Happy Path', () => {
    it('should create invoice for active subscription with nextBilling before now', async () => {
      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice) => ({
        ...invoice,
        id: 'generated-invoice-id',
      }));

      const result = await useCase.execute();

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      // Verify invoice was created with correct data
      expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          clientId: CLIENT_ID,
          subscriptionId: SUBSCRIPTION_ID,
          amount: 99.90,
          dueDate: mockSubscription.nextBilling,
          status: InvoiceStatus.PENDING,
        }),
      );
    });

    it('should update nextBilling after invoice creation', async () => {
      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice) => ({
        ...invoice,
        id: 'generated-invoice-id',
      }));

      await useCase.execute();

      // Next billing should be ~1 month after current nextBilling
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        SUBSCRIPTION_ID,
        expect.objectContaining({
          nextBilling: expect.any(Date),
        }),
      );
      const updateCall = vi.mocked(mockSubscriptionRepo.update).mock.calls[0];
      const updatedNextBilling = updateCall[1].nextBilling as Date;
      expect(updatedNextBilling.getTime()).toBeGreaterThan(mockSubscription.nextBilling.getTime());
    });

    it('should publish subscription.invoice.created event', async () => {
      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice) => ({
        ...invoice,
        id: 'generated-invoice-id',
      }));

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.invoice.created',
          clientId: CLIENT_ID,
          tenantId: TENANT_ID,
          invoiceId: 'generated-invoice-id',
          metadata: expect.objectContaining({
            subscriptionId: SUBSCRIPTION_ID,
            amount: 99.90,
          }),
        }),
      );
    });
  });

  describe('Idempotency', () => {
    it('should skip if invoice already exists for reference month', async () => {
      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue({
        id: 'existing-invoice-id',
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        subscriptionId: SUBSCRIPTION_ID,
        amount: 99.90,
        dueDate: mockSubscription.nextBilling,
        description: 'Premium Plan - 2026-07',
        status: InvoiceStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await useCase.execute();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);

      // Should not create a new invoice or update next billing
      expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should skip if client not found', async () => {
      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);

      // Should not create invoice or update subscription
      expect(mockInvoiceRepo.create).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('should handle multiple subscriptions', async () => {
      const sub2: Subscription = {
        ...mockSubscription,
        id: 'subscription-2',
        amount: 199.90,
        billingCycle: BillingCycle.ANNUAL,
      };

      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([mockSubscription, sub2]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById).mockResolvedValue(mockClient);
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice) => ({
        ...invoice,
        id: `generated-${invoice.subscriptionId}`,
      }));

      const result = await useCase.execute();

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockInvoiceRepo.create).toHaveBeenCalledTimes(2);
      expect(mockSubscriptionRepo.update).toHaveBeenCalledTimes(2);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });

    it('should continue processing remaining subscriptions when one fails', async () => {
      const subOk: Subscription = {
        ...mockSubscription,
        id: 'subscription-ok',
      };
      const subFail: Subscription = {
        ...mockSubscription,
        id: 'subscription-fail',
      };

      vi.mocked(mockSubscriptionRepo.findActiveByNextBillingBefore).mockResolvedValue([subFail, subOk]);
      vi.mocked(mockInvoiceRepo.findExistingForSubscription).mockResolvedValue(null);
      vi.mocked(mockClientRepo.findById)
        .mockResolvedValueOnce(null) // subFail: client not found
        .mockResolvedValueOnce(mockClient); // subOk: client found
      vi.mocked(mockInvoiceRepo.create).mockImplementation(async (invoice) => ({
        ...invoice,
        id: `generated-${invoice.subscriptionId}`,
      }));

      const result = await useCase.execute();

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);

      // Only the successful one should have created invoice and updated billing
      expect(mockInvoiceRepo.create).toHaveBeenCalledTimes(1);
      expect(mockSubscriptionRepo.update).toHaveBeenCalledTimes(1);
    });
  });
});
