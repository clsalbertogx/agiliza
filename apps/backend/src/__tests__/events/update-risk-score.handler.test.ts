import { describe, expect, it, vi } from 'vitest';
import { UpdateRiskScoreHandler } from '@/application/events/handlers/update-risk-score.handler';
import type { RiskCalculatorService } from '@/application/services/risk-calculator.service';
import { RiskScore } from '@/domain/entities/client';
import type { DomainEvent } from '@/domain/events/domain-events';

function createMocks() {
  const invoiceRepo = {
    findById: vi.fn(),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };

  const clientRepo = {
    findById: vi.fn(),
    findByPhone: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateRiskScore: vi.fn(),
  };

  const riskCalculator = {
    calculate: vi.fn(),
  };

  return { invoiceRepo, clientRepo, riskCalculator };
}

function makeEvent(eventType: string, overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-123',
    eventType: eventType as any,
    clientId: 'client-123',
    tenantId: 'tenant-123',
    invoiceId: 'invoice-123',
    timestamp: new Date().toISOString(),
    metadata: {},
    ...overrides,
  } as DomainEvent;
}

describe('UpdateRiskScoreHandler', () => {
  describe('event filtering', () => {
    const irrelevantEvents = [
      'invoice.created',
      'client.created',
      'decision.made',
      'message.sent',
      'message.delivered',
    ];

    irrelevantEvents.forEach((eventType) => {
      it(`should ignore ${eventType} events`, async () => {
        const { invoiceRepo, clientRepo, riskCalculator } = createMocks();
        const handler = new UpdateRiskScoreHandler(
          clientRepo,
          invoiceRepo,
          riskCalculator as unknown as RiskCalculatorService,
        );

        await handler.handle(makeEvent(eventType));

        expect(riskCalculator.calculate).not.toHaveBeenCalled();
        expect(clientRepo.updateRiskScore).not.toHaveBeenCalled();
      });
    });
  });

  describe('happy path', () => {
    it.each(['payment.confirmed', 'payment.failed', 'invoice.overdue', 'message.read', 'message.clicked'])(
      'should process %s events and update risk score',
      async (eventType) => {
        const { invoiceRepo, clientRepo, riskCalculator } = createMocks();
        const handler = new UpdateRiskScoreHandler(
          clientRepo,
          invoiceRepo,
          riskCalculator as unknown as RiskCalculatorService,
        );

        riskCalculator.calculate.mockResolvedValue(RiskScore.YELLOW);

        await handler.handle(makeEvent(eventType));

        expect(riskCalculator.calculate).toHaveBeenCalledWith('client-123', 'tenant-123');
        expect(clientRepo.updateRiskScore).toHaveBeenCalledWith('client-123', RiskScore.YELLOW);
      },
    );
  });

  describe('error handling', () => {
    it('should throw transient errors so the retry loop in handleWithRetry can catch them', async () => {
      const { invoiceRepo, clientRepo, riskCalculator } = createMocks();
      const handler = new UpdateRiskScoreHandler(
        clientRepo,
        invoiceRepo,
        riskCalculator as unknown as RiskCalculatorService,
      );

      riskCalculator.calculate.mockRejectedValue(new Error('Risk calculation failed'));

      await expect(handler.handle(makeEvent('payment.confirmed'))).rejects.toThrow('Risk calculation failed');
    });
  });
});
