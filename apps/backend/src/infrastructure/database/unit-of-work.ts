import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';
import type { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';

/**
 * AsyncLocalStorage-based transaction context.
 * Allows repositories to detect whether they are inside a transaction
 * without receiving the transaction client explicitly as a parameter.
 */
const asyncLocalStorage = new AsyncLocalStorage<PrismaClient>();

/**
 * Returns the current transactional Prisma client when called inside
 * a PrismaUnitOfWork.execute() callback, or `null` when outside one.
 *
 * Repositories use this in a getter so they automatically participate
 * in the ambient transaction without any manual propagation.
 */
export function getTransaction(): PrismaClient | null {
  return asyncLocalStorage.getStore() ?? null;
}

/**
 * Prisma-backed Unit of Work.
 *
 * Wraps a callback inside a Prisma $transaction. Inside the callback,
 * all repository calls that use `getTransaction()` will automatically
 * receive the transactional client, ensuring atomic commits/rollbacks.
 *
 * @example
 * const uow = new PrismaUnitOfWork(prisma);
 * const result = await uow.execute(async () => {
 *   const invoice = await invoiceRepo.create(data);
 *   await eventRepo.save(event);
 *   return invoice;
 * });
 */
export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaClient) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return asyncLocalStorage.run(tx as unknown as PrismaClient, () => fn());
    });
  }
}
