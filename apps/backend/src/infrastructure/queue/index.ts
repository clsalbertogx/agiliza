export {
  getRedis,
  connectRedis,
  disconnectRedis,
} from './redis.service';

export {
  QueueNames,
  ReconcilePaymentPayloadSchema,
  SendNotificationPayloadSchema,
  ProcessWebhookPayloadSchema,
  FailedWebhookPayloadSchema,
  DEFAULT_JOB_OPTIONS,
  DLQ_JOB_OPTIONS,
} from './queue-definitions';

export type {
  QueueName,
  ReconcilePaymentPayload,
  SendNotificationPayload,
  ProcessWebhookPayload,
  FailedWebhookPayload,
} from './queue-definitions';

export {
  getQueue,
  addJob,
  addFailedWebhookJob,
  createWorker,
  closeAllQueues,
} from './queue-manager';

export {
  startReminderWorker,
  closeWorker,
} from './worker';

export { startDeadLetterWorker } from './dead-letter.worker';

export { BullMQDLQPublisher } from './bullmq-dlq.publisher';
