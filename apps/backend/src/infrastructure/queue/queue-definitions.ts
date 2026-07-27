import { z } from 'zod';

/**
 * Queue names used throughout the application.
 */
export const QueueNames = {
  RECONCILE_PAYMENT: 'reconcile-payment',
  SEND_NOTIFICATION: 'send-notification',
  PROCESS_WEBHOOK: 'process-webhook',
  SEND_MESSAGE: 'send-message',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

/**
 * Zod schemas for job payloads.
 */
export const ReconcilePaymentPayloadSchema = z.object({
  providerPaymentId: z.string().min(1),
  provider: z.enum(['asaas', 'mercadopago', 'pagbank', 'polar']),
  event: z.string(),
  occurredAt: z.string().datetime(),
});

export type ReconcilePaymentPayload = z.infer<typeof ReconcilePaymentPayloadSchema>;

export const SendNotificationPayloadSchema = z.object({
  type: z.enum(['email', 'sms', 'whatsapp']),
  recipient: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export type SendNotificationPayload = z.infer<typeof SendNotificationPayloadSchema>;

export const ProcessWebhookPayloadSchema = z.object({
  provider: z.enum(['asaas', 'mercadopago', 'pagbank', 'polar', 'evolution']),
  rawBody: z.string(),
  headers: z.record(z.string()),
  receivedAt: z.string().datetime(),
});

export type ProcessWebhookPayload = z.infer<typeof ProcessWebhookPayloadSchema>;

/**
 * Job options shared across queues.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600 * 24,     // 1 day
    count: 100,
  },
  removeOnFail: {
    age: 3600 * 24 * 7, // 7 days
  },
};
