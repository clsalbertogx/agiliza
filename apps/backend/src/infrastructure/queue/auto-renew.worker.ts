import { Queue, Worker } from 'bullmq';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import type { AutoRenewSubscriptionUseCase } from '@/application/usecases/auto-renew-subscription.usecase';
import { getRedis } from './redis.service';

const AUTO_RENEW_QUEUE = 'auto-renew';
const JOB_NAME = 'auto-renew-subscriptions';

export function createAutoRenewQueue(): Queue {
  return new Queue(AUTO_RENEW_QUEUE, { connection: getRedis() });
}

export async function scheduleAutoRenewJob(queue: Queue): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates (e.g. after a redeploy)
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Daily at 5:00 AM
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: { pattern: '0 5 * * *' },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  );
}

/**
 * Find subscriptions whose nextBilling falls on today (ACTIVE or GRACE_PERIOD)
 * and run the auto-renew use case for each one. Failures are counted and
 * logged, not thrown — a single bad subscription must not retry the whole job.
 */
export async function renewDueSubscriptions(
  useCase: AutoRenewSubscriptionUseCase,
  subscriptionRepo: SubscriptionRepositoryPort,
): Promise<{ renewed: number; skipped: number; total: number }> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const dueSubscriptions = await subscriptionRepo.findDueForRenewal(startOfDay, endOfDay);

  let renewed = 0;
  let skipped = 0;

  for (const subscription of dueSubscriptions) {
    const result = await useCase.execute({
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
    });
    if (result.success) {
      renewed++;
    } else {
      skipped++;
    }
  }

  console.log(`[AutoRenew] Renewed: ${renewed}, Skipped: ${skipped}, Total due: ${dueSubscriptions.length}`);
  return { renewed, skipped, total: dueSubscriptions.length };
}

export function startAutoRenewWorker(
  useCase: AutoRenewSubscriptionUseCase,
  subscriptionRepo: SubscriptionRepositoryPort,
): Worker {
  const worker = new Worker(
    AUTO_RENEW_QUEUE,
    async (job) => {
      if (job.name === JOB_NAME) {
        await renewDueSubscriptions(useCase, subscriptionRepo);
        console.log('[AutoRenew] Subscription renewal check completed');
      }
    },
    { connection: getRedis() },
  );

  worker.on('completed', (job) => console.log(`[AutoRenew] Job ${job?.id} completed`));
  worker.on('failed', (job, err) => console.error(`[AutoRenew] Job ${job?.id} failed:`, err));
  worker.on('error', (err) => console.error('[AutoRenew] Worker error:', err));

  return worker;
}
