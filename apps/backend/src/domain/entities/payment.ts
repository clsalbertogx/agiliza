import { z } from 'zod';
import { PaymentMethod } from './invoice';

export const paymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  provider: z.string(),
  providerPaymentId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'failed', 'refunded']).default('pending'),
  fee: z.number().optional(),
  netAmount: z.number().optional(),
  webhookReceivedAt: z.date().optional(),
  webhookRetryCount: z.number().int().default(0),
  createdAt: z.date().default(() => new Date()),
});

export type Payment = z.infer<typeof paymentSchema>;
