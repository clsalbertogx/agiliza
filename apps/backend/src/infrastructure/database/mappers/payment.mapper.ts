import type { Payment, PersistencePayment } from '@/domain/entities/payment';
import { createPaymentFromPersistence, paymentToPersistence } from '@/domain/entities/payment';
import type { DomainMapper } from './mapper.interface';

export type { PersistencePayment } from '@/domain/entities/payment';

export class PaymentMapper implements DomainMapper<PersistencePayment, Payment> {
  toDomain(persistence: PersistencePayment): Payment {
    return createPaymentFromPersistence(persistence);
  }

  toPersistence(domain: Payment): PersistencePayment {
    return paymentToPersistence(domain);
  }
}
