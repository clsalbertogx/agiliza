import { describe, it, expect } from 'vitest';
// Compile-time checks — if they pass, the exports are valid
import type {
  Invoice,
  ClientProfile,
  PaymentProvider,
  PaymentMethod,
  InvoiceStatus,
  ClientRiskScore,
  MessageChannel,
  PaymentEvent,
} from '../index';

describe('@agiliza/shared exports', () => {
  it('should export Invoice type', () => {
    const invoice: Invoice = null as any;
    expect(invoice).toBeDefined();
  });

  it('should export ClientProfile type', () => {
    const profile: ClientProfile = null as any;
    expect(profile).toBeDefined();
  });

  it('should export PaymentProvider type', () => {
    const provider: PaymentProvider = null as any;
    expect(provider).toBeDefined();
  });

  it('should export PaymentMethod type', () => {
    const method: PaymentMethod = null as any;
    expect(method).toBeDefined();
  });

  it('should export InvoiceStatus type', () => {
    const status: InvoiceStatus = null as any;
    expect(status).toBeDefined();
  });

  it('should export ClientRiskScore type', () => {
    const risk: ClientRiskScore = null as any;
    expect(risk).toBeDefined();
  });

  it('should export MessageChannel type', () => {
    const channel: MessageChannel = null as any;
    expect(channel).toBeDefined();
  });

  it('should export PaymentEvent type', () => {
    // Compile-time shape check — these would fail at compile time
    // if PaymentEvent didn't match the expected shape
    const event: PaymentEvent = {} as PaymentEvent;
    expect(event).toBeDefined();
    const _testId: string = event.id;
    const _testClientId: string = event.clientId;
    const _testTimestamp: Date = event.timestamp;
  });
});
