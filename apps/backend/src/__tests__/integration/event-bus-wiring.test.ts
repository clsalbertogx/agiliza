import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F1 — Event Bus wiring at the composition root.
 *
 * Bug: `index.ts` creates ONE bus and subscribes 12 handlers, but ~18 factories
 * create `new InMemoryEventBus()` per call. Use cases publish to the bus they
 * receive (zero subscribers) → domain events never fire handlers.
 *
 * This test builds the real composition chain the way `index.ts` does:
 *   initContainer() → registerEventHandlers(getEventBus())
 * then drives the real create-client factory (which MUST publish to the same
 * shared bus). A handler subscribed to `client.created` must run.
 *
 * The onboarding service is mocked so we can spy on its side-effect.
 */
const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findByPhone: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: {
      findUnique: mockState.findById,
      findFirst: mockState.findByPhone,
      findMany: mockState.findMany,
      create: mockState.create,
      update: mockState.update,
      count: mockState.count,
    },
  })),
}));

const mockStartOnboarding = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockNeedsOnboarding = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('@/presentation/factories/create-onboarding.factory', () => ({
  createOnboardingService: vi.fn(() => ({
    startOnboarding: mockStartOnboarding,
    needsOnboarding: mockNeedsOnboarding,
  })),
}));

import { getEventBus, resetEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { createCreateClientUseCase } from '@/presentation/factories/create-client.factory';
import { registerEventHandlers } from '@/presentation/factories/register-event-handlers';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('F1 — Event bus wiring (single shared bus)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartOnboarding.mockClear();
    resetEventBus();
    // Mirror the composition root: handlers subscribe to the shared bus.
    registerEventHandlers(getEventBus());
  });

  it('client.created published by the create-client use case reaches the subscribed onboarding handler', async () => {
    mockState.findByPhone.mockResolvedValue(null);
    mockState.findById.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: TENANT_ID,
      name: 'Wiring Test',
      phone: '5511999990000',
      preferredChannel: 'WHATSAPP',
      preferredLeadDays: 3,
      riskScore: 'GREEN',
      totalInvoices: 0,
      paidInvoices: 0,
      avgPaymentDelay: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockState.create.mockImplementation(async (args: { data: Record<string, unknown> }) => args.data);
    mockNeedsOnboarding.mockResolvedValue(true);

    const useCase = createCreateClientUseCase();
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      name: 'Wiring Test',
      phone: '5511999990000',
    });

    expect(result.success).toBe(true);
    await flushMicrotasks();

    expect(mockStartOnboarding).toHaveBeenCalledTimes(1);
    expect(mockStartOnboarding).toHaveBeenCalledWith(expect.any(String), TENANT_ID);
  });

  it('does NOT start onboarding when the client was created with a preferred channel', async () => {
    mockState.findByPhone.mockResolvedValue(null);
    mockState.findById.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000011',
      tenantId: TENANT_ID,
      name: 'Pref Client',
      phone: '5511999991111',
      preferredChannel: 'EMAIL',
      preferredTime: '09:00',
      preferredLeadDays: 3,
      riskScore: 'GREEN',
      totalInvoices: 0,
      paidInvoices: 0,
      avgPaymentDelay: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockState.create.mockImplementation(async (args: { data: Record<string, unknown> }) => args.data);
    mockNeedsOnboarding.mockResolvedValue(false);

    const useCase = createCreateClientUseCase();
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      name: 'Pref Client',
      phone: '5511999991111',
      preferredChannel: 'email',
    });

    expect(result.success).toBe(true);
    await flushMicrotasks();
    expect(mockStartOnboarding).not.toHaveBeenCalled();
  });
});
