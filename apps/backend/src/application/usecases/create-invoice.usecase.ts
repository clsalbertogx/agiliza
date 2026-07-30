import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { Invoice, createInvoice } from '@/domain/entities/invoice';
import { Money } from '@/domain/value-objects/money';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface CreateInvoiceInput {
  tenantId: string;
  clientId: string;
  amount: number;
  dueDate: Date;
  description?: string;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Either<ApplicationError, Invoice>> {
    // 1. Validate client exists and belongs to tenant
    const client = await this.clientRepo.findById(input.clientId);
    if (!client) {
      return failure(new ApplicationError('Client not found', 'NOT_FOUND', 404));
    }
    if (client.tenantId !== input.tenantId) {
      return failure(new ApplicationError('Client does not belong to this tenant', 'FORBIDDEN', 403));
    }

    // 2. Validate amount via Money VO
    let moneyVO: Money;
    try {
      moneyVO = Money.create(input.amount);
      if (moneyVO.value() <= 0) {
        return failure(new ApplicationError('Amount must be positive', 'INVALID_AMOUNT', 400));
      }
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INVALID_AMOUNT', 400));
    }

    // 3. Create Invoice entity
    const invoiceResult = createInvoice({
      id: this.idGenerator.generate(),
      tenantId: input.tenantId,
      clientId: input.clientId,
      amount: moneyVO.value(),
      dueDate: input.dueDate,
      description: input.description,
    });

    if (!invoiceResult.success) {
      return failure(new ApplicationError(invoiceResult.value.message, 'INVALID_INVOICE', 400));
    }

    // 4. Save
    let saved: Invoice;
    try {
      saved = await this.invoiceRepo.create(invoiceResult.value);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 5. Publish event
    const event = createDomainEvent('invoice.created', {
      clientId: input.clientId,
      tenantId: input.tenantId,
      invoiceId: saved.id,
      metadata: { amount: saved.amount, dueDate: saved.dueDate.toISOString() },
    }, this.idGenerator.generate());
    this.eventBus.publish(event);

    return success(saved);
  }
}