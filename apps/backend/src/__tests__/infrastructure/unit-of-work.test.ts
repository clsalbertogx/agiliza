import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaUnitOfWork, getTransaction } from '@/infrastructure/database/unit-of-work';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';

/**
 * Integration tests for PrismaUnitOfWork.
 *
 * These tests verify that:
 * 1. getTransaction() returns null outside a UoW scope
 * 2. getTransaction() returns a client inside a UoW scope
 * 3. Operations inside a UoW are atomic (commit all or rollback all)
 * 4. Errors inside a UoW cause a full rollback
 */

describe('PrismaUnitOfWork Integration', () => {
  const prisma = getPrismaClient();
  const uow = new PrismaUnitOfWork(prisma);

  // Helper: check if the database is reachable before running tests
  let dbAvailable = true;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      console.warn('Database not available — skipping PrismaUnitOfWork integration tests');
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    // Cleanup any test data created during tests
    if (dbAvailable) {
      await prisma.tenant.deleteMany({ where: { slug: { startsWith: 'uow-test-' } } });
      await prisma.event.deleteMany({ where: { source: 'uow-integration-test' } });
    }
  });

  // ─── Outside UoW ───────────────────────────────────────────────

  it('should return null when getTransaction() is called outside a UoW', () => {
    expect(getTransaction()).toBeNull();
  });

  // ─── Inside UoW ────────────────────────────────────────────────

  it('should return a Prisma client when getTransaction() is called inside a UoW', async () => {
    if (!dbAvailable) return;

    await uow.execute(async () => {
      const tx = getTransaction();
      expect(tx).not.toBeNull();
    });
  });

  it('should return null again after UoW completes', async () => {
    if (!dbAvailable) return;

    await uow.execute(async () => {
      // Inside — should have a tx
      expect(getTransaction()).not.toBeNull();
    });

    // Outside — should be null again
    expect(getTransaction()).toBeNull();
  });

  // ─── Successful commit ─────────────────────────────────────────

  it('should commit all operations within a UoW transaction', async () => {
    if (!dbAvailable) return;

    const slug = `uow-test-commit-${Date.now()}`;

    const result = await uow.execute(async () => {
      const tx = getTransaction()!;

      // Create a tenant inside the transaction
      const tenant = await tx.tenant.create({
        data: {
          id: crypto.randomUUID(),
          name: 'UoW Commit Test',
          slug,
          email: `${slug}@test.com`,
        },
      });

      // Verify the tenant is accessible inside the transaction
      const found = await tx.tenant.findUnique({ where: { slug } });
      expect(found).not.toBeNull();
      expect(found!.name).toBe('UoW Commit Test');

      return tenant;
    });

    // After commit, the tenant should exist in the database
    expect(result).not.toBeNull();
    expect(result.slug).toBe(slug);

    const persisted = await prisma.tenant.findUnique({ where: { slug } });
    expect(persisted).not.toBeNull();
    expect(persisted!.name).toBe('UoW Commit Test');
  });

  // ─── Rollback on error ─────────────────────────────────────────

  it('should rollback all operations when an error is thrown inside a UoW', async () => {
    if (!dbAvailable) return;

    const slug = `uow-test-rollback-${Date.now()}`;

    // Attempt to create a tenant and then throw
    await expect(
      uow.execute(async () => {
        const tx = getTransaction()!;

        await tx.tenant.create({
          data: {
            id: crypto.randomUUID(),
            name: 'UoW Rollback Test',
            slug,
            email: `${slug}@test.com`,
          },
        });

        // Verify it exists inside the transaction
        const inside = await tx.tenant.findUnique({ where: { slug } });
        expect(inside).not.toBeNull();

        // Now throw — should roll everything back
        throw new Error('Intentional rollback');
      })
    ).rejects.toThrow('Intentional rollback');

    // After the rollback, the tenant should NOT exist in the database
    const persisted = await prisma.tenant.findUnique({ where: { slug } });
    expect(persisted).toBeNull();
  });

  // ─── Nested calls ──────────────────────────────────────────────

  it('should reuse the existing transaction context for nested getTransaction() calls', async () => {
    if (!dbAvailable) return;

    const slug = `uow-test-nested-${Date.now()}`;

    await uow.execute(async () => {
      const outerTx = getTransaction();
      expect(outerTx).not.toBeNull();

      async function nestedFunction() {
        const innerTx = getTransaction();
        expect(innerTx).not.toBeNull();
        expect(innerTx).toBe(outerTx);

        // Perform an operation from the nested call
        await innerTx!.tenant.create({
          data: {
            id: crypto.randomUUID(),
            name: 'UoW Nested Test',
            slug,
            email: `${slug}@test.com`,
          },
        });
      }

      await nestedFunction();
    });

    // Verify commit
    const persisted = await prisma.tenant.findUnique({ where: { slug } });
    expect(persisted).not.toBeNull();
    expect(persisted!.name).toBe('UoW Nested Test');
  });

  // ─── AsyncLocalStorage isolation ───────────────────────────────

  it('should isolate transactions between concurrent UoW executions', async () => {
    if (!dbAvailable) return;

    const slugA = `uow-test-concurrent-a-${Date.now()}`;
    const slugB = `uow-test-concurrent-b-${Date.now()}`;

    await Promise.all([
      uow.execute(async () => {
        const tx = getTransaction()!;
        await tx.tenant.create({
          data: {
            id: crypto.randomUUID(),
            name: 'Concurrent A',
            slug: slugA,
            email: `${slugA}@test.com`,
          },
        });
      }),
      uow.execute(async () => {
        const tx = getTransaction()!;
        await tx.tenant.create({
          data: {
            id: crypto.randomUUID(),
            name: 'Concurrent B',
            slug: slugB,
            email: `${slugB}@test.com`,
          },
        });
      }),
    ]);

    // Both should have been committed
    const a = await prisma.tenant.findUnique({ where: { slug: slugA } });
    const b = await prisma.tenant.findUnique({ where: { slug: slugB } });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});
