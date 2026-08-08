import type { DLQPort } from '@/application/ports/queue/dlq.port';
import type { OnboardingService } from '@/application/services/onboarding.service';
import type { DomainEvent } from '@/domain/events/domain-events';

export class StartOnboardingHandler {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly dlqPublisher: DLQPort,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const { clientId, tenantId } = event;
    const needsOnboarding = await this.onboardingService.needsOnboarding(clientId);
    if (needsOnboarding) {
      await this.onboardingService.startOnboarding(clientId, tenantId);
    }
  }

  async handleWithRetry(event: DomainEvent): Promise<void> {
    try {
      await this.handle(event);
    } catch (error) {
      await this.dlqPublisher.publishToDLQ(event, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
