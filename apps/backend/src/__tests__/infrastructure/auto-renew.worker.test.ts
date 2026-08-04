import { type Job, Queue, type RepeatableJob, Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { failure, success } from '@/application/types/either';
import { AutoRenewSubscriptionUseCase } from '@/application/usecases/auto-renew-subscription.usecase';
import { BillingCycle, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import {
  createAutoRenewQueue,
  renewDueSubscriptions,
  scheduleAutoRenewJob,
  startAutoRenewWorker,
} from '@/infrastructure/queue/auto-renew.worker';

// Mock BullMQ so these tests never require a live Redis instance. The mock
// factory is hoisted by vitest, so it cannot reference outer test state.
vi.mock('bullmq', () => {
  const queueMock = () => ({
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: vi.fn().mockResolvedValue(undefined),
  });

  const workerMock = () => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  });

  return {
    Queue: vi.fn().mockImplementation(queueMock),
    Worker: vi.fn().mockImplementation(workerMock),
  };
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

const now = new Date();
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000003';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    plan: 'Premium Plan',
    amount: 99.9,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextBilling: now,
    startDate: new Date('2026-06-15'),
    autoRenew: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSubscriptionRepoMock(dueForRenewal: Subscription[] = []): SubscriptionRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByTenantId: vi.fn(),
    findByClientId: vi.fn(),
    findActiveByNextBillingBefore: vi.fn(),
    findDueForRenewal: vi.fn().mockResolvedValue(dueForRenewal),
    getSubscriptionsForAnalytics: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  };
}

function makeInvoiceRepoMock(): InvoiceRepositoryPort {
  return {
    findById: vi.fn(),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };
}

function makeEventBusMock(): EventBusPort {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
  };
}

function makeIdGeneratorMock(): IdGeneratorPort {
  return {
    generate: vi.fn().mockReturnValue('generated-id'),
    validate: vi.fn().mockReturnValue(true),
  };
}

function createUseCaseMock() {
  const useCase = new AutoRenewSubscriptionUseCase(
    makeSubscriptionRepoMock(),
    makeInvoiceRepoMock(),
    makeEventBusMock(),
    makeIdGeneratorMock(),
  );
  const execute = vi.spyOn(useCase, 'execute');
  return { useCase, execute };
}

function getWorkerProcessor(): (job: Job) => Promise<void> {
  const processor = vi.mocked(Worker).mock.calls[0]?.[1];
  return processor as unknown as (job: Job) => Promise<void>;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('auto-renew worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAutoRenewQueue', () => {
    it('should create a BullMQ queue named auto-renew with the Redis connection', () => {
      createAutoRenewQueue();

      expect(Queue).toHaveBeenCalledWith('auto-renew', expect.objectContaining({ connection: expect.anything() }));
    });
  });

  describe('scheduleAutoRenewJob', () => {
    it('should remove existing repeatable jobs and schedule the daily 5 AM job', async () => {
      const queue = createAutoRenewQueue();
      vi.mocked(queue.getRepeatableJobs).mockResolvedValue([
        { key: 'repeat:auto-renew:old-job' } as unknown as RepeatableJob,
        { key: 'repeat:auto-renew:older-job' } as unknown as RepeatableJob,
      ]);

      await scheduleAutoRenewJob(queue);

      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:auto-renew:old-job');
      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:auto-renew:older-job');
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'auto-renew-subscriptions',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 5 * * *' },
          removeOnComplete: { age: 7 * 24 * 3600 },
          removeOnFail: { age: 30 * 24 * 3600 },
        }),
      );
    });

    it('should schedule the job even when no repeatable jobs exist yet', async () => {
      const queue = createAutoRenewQueue();

      await scheduleAutoRenewJob(queue);

      expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'auto-renew-subscriptions',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 5 * * *' },
        }),
      );
    });
  });

  describe('renewDueSubscriptions', () => {
    it('should renew every subscription due today', async () => {
      const { useCase, execute } = createUseCaseMock();
      const due = [makeSubscription(), makeSubscription({ id: 'sub-2', tenantId: TENANT_ID })];
      const subscriptionRepo = makeSubscriptionRepoMock(due);
      execute.mockResolvedValue(success(makeSubscription()));

      const result = await renewDueSubscriptions(useCase, subscriptionRepo);

      expect(result).toEqual({ renewed: 2, skipped: 0, total: 2 });
      expect(subscriptionRepo.findDueForRenewal).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith({ subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID });
      expect(execute).toHaveBeenCalledWith({ subscriptionId: 'sub-2', tenantId: TENANT_ID });
    });

    it('should count failures as skipped without throwing', async () => {
      const { useCase, execute } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock([
        makeSubscription(),
        makeSubscription({ id: 'sub-2', tenantId: TENANT_ID }),
      ]);
      execute
        .mockResolvedValueOnce(success(makeSubscription()))
        .mockResolvedValueOnce(failure(new ApplicationError('Auto-renew disabled', 'AUTO_RENEW_DISABLED', 409)));

      const result = await renewDueSubscriptions(useCase, subscriptionRepo);

      expect(result).toEqual({ renewed: 1, skipped: 1, total: 2 });
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it('should only look at subscriptions whose nextBilling falls on today', async () => {
      const { useCase } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock();

      await renewDueSubscriptions(useCase, subscriptionRepo);

      const [from, to] = vi.mocked(subscriptionRepo.findDueForRenewal).mock.calls[0];
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(from.getSeconds()).toBe(0);
      expect(to.getHours()).toBe(0);
      expect(to.getMinutes()).toBe(0);
      expect(to.getSeconds()).toBe(0);
      expect(to.getTime()).toBeGreaterThan(from.getTime());
    });

    it('should not call the use case when nothing is due', async () => {
      const { useCase, execute } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock([]);

      const result = await renewDueSubscriptions(useCase, subscriptionRepo);

      expect(result).toEqual({ renewed: 0, skipped: 0, total: 0 });
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('startAutoRenewWorker', () => {
    it('should create a worker for the auto-renew queue', () => {
      const { useCase } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock();

      startAutoRenewWorker(useCase, subscriptionRepo);

      expect(Worker).toHaveBeenCalledWith(
        'auto-renew',
        expect.any(Function),
        expect.objectContaining({ connection: expect.anything() }),
      );
    });

    it('should renew due subscriptions when the auto-renew job is processed', async () => {
      const { useCase, execute } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock([makeSubscription()]);
      execute.mockResolvedValue(success(makeSubscription()));

      const worker = startAutoRenewWorker(useCase, subscriptionRepo);
      const processor = getWorkerProcessor();

      await processor({ name: 'auto-renew-subscriptions', id: 'job-1', data: {} } as Job);

      expect(subscriptionRepo.findDueForRenewal).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should ignore jobs with other names', async () => {
      const { useCase, execute } = createUseCaseMock();
      const subscriptionRepo = makeSubscriptionRepoMock([makeSubscription()]);

      startAutoRenewWorker(useCase, subscriptionRepo);
      const processor = getWorkerProcessor();

      await processor({ name: 'some-other-job', id: 'job-2', data: {} } as Job);

      expect(subscriptionRepo.findDueForRenewal).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });
  });
});
