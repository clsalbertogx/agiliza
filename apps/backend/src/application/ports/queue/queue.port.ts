export interface QueuePort {
  addJob(jobName: string, data: Record<string, unknown>): Promise<void>;
  addBulkJobs(jobs: Array<{ name: string; data: Record<string, unknown> }>): Promise<void>;
}
