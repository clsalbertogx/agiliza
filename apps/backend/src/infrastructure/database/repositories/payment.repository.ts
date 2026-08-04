import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import type { Payment } from '@/domain/entities/payment';
import { PaymentMapper, type PersistencePayment } from '@/infrastructure/database/mappers/payment.mapper';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';

/**
 * Port-compliant Prisma payment repository.
 * Implements PaymentRepositoryPort for use with use cases.
 * Uses a DomainMapper for standardized toDomain/toPersistence mapping.
 *
 * All database operations automatically participate in the ambient
 * Unit of Work transaction when one is active (see PrismaUnitOfWork).
 */
export class PrismaPaymentRepository implements PaymentRepositoryPort {
  private prisma = getPrismaClient();
  private readonly mapper: PaymentMapper;

  constructor(mapper?: PaymentMapper) {
    this.mapper = mapper ?? new PaymentMapper();
  }

  /**
   * Returns the transactional Prisma client when called inside a
   * PrismaUnitOfWork.execute() callback, or the regular client otherwise.
   */
  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async create(payment: Payment): Promise<Payment> {
    const persistence = this.mapper.toPersistence(payment);
    const result = await this.txClient.payment.create({ data: persistence as any });
    return this.mapper.toDomain(result as unknown as PersistencePayment);
  }

  async findByInvoiceId(invoiceId: string, tenantId: string): Promise<Payment[]> {
    const results = await this.txClient.payment.findMany({
      where: { invoiceId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return results.map((r) => this.mapper.toDomain(r as unknown as PersistencePayment));
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await this.txClient.payment.findUnique({ where: { id } });
    return result ? this.mapper.toDomain(result as unknown as PersistencePayment) : null;
  }
}
