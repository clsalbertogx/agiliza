import type { Invoice, PersistenceInvoice } from '@/domain/entities/invoice';
import { createInvoiceFromPersistence, invoiceToPersistence } from '@/domain/entities/invoice';
import type { DomainMapper } from './mapper.interface';

export type { PersistenceInvoice } from '@/domain/entities/invoice';

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? new Date(value) : value;
}

export class InvoiceMapper implements DomainMapper<PersistenceInvoice, Invoice> {
  toDomain(persistence: PersistenceInvoice): Invoice {
    return createInvoiceFromPersistence(persistence);
  }

  toPersistence(domain: Invoice): PersistenceInvoice {
    return invoiceToPersistence(domain);
  }
}
