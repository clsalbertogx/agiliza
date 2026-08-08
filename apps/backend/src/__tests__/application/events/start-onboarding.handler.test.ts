import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartOnboardingHandler } from '@/application/events/handlers/start-onboarding.handler';
import { createDomainEvent } from '@/domain/events/domain-events';

/**
 * F1 — The onboarding trigger is an event handler subscribed to `client.created`,
 * not a route-level direct call. It must fire only when the client was created
 * without preferences.
 */
describe('StartOnboardingHandler', () => {
  const onboardingService = {
    startOnboarding: vi.fn().mockResolvedValue(undefined),
    needsOnboarding: vi.fn().mockResolvedValue(true),
  };
  const dlqPublisher = {
    publishToDLQ: vi.fn().mockResolvedValue(undefined),
  };
  const handler = new StartOnboardingHandler(onboardingService as never, dlqPublisher as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts onboarding when client.created has no preferredChannel', async () => {
    const event = createDomainEvent('client.created', {
      clientId: 'client-1',
      tenantId: 'tenant-1',
    });

    await handler.handle(event);

    expect(onboardingService.needsOnboarding).toHaveBeenCalledWith('client-1');
    expect(onboardingService.startOnboarding).toHaveBeenCalledWith('client-1', 'tenant-1');
  });

  it('does nothing when the client already has a preferred channel', async () => {
    onboardingService.needsOnboarding.mockResolvedValueOnce(false);
    const event = createDomainEvent('client.created', {
      clientId: 'client-1',
      tenantId: 'tenant-1',
      metadata: { preferredChannel: 'whatsapp' },
    });

    await handler.handle(event);

    expect(onboardingService.needsOnboarding).toHaveBeenCalledWith('client-1');
    expect(onboardingService.startOnboarding).not.toHaveBeenCalled();
  });

  it('ignores non-client events', async () => {
    onboardingService.needsOnboarding.mockResolvedValueOnce(false);
    const event = createDomainEvent('payment.confirmed', {
      clientId: 'client-1',
      tenantId: 'tenant-1',
    });

    await handler.handle(event);

    expect(onboardingService.needsOnboarding).toHaveBeenCalledWith('client-1');
    expect(onboardingService.startOnboarding).not.toHaveBeenCalled();
  });
});
