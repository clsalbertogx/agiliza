import { describe, it, expect } from 'vitest';
import type { PaymentGatewayPort, WebhookVerifierPort, MessageProviderPort } from '../../../application/ports/gateways';
import type { UnitOfWorkPort, EventBusPort } from '../../../application/ports/adapters';
import type { Either } from '../../../application/types/either';
import type { ApplicationError } from '../../../application/errors/application.error';

describe('Gateway Ports', () => {
  describe('PaymentGatewayPort', () => {
    it('should have correct method signatures with Either return types', () => {
      const port: PaymentGatewayPort = {
        createPixCharge: async () => ({ success: true, value: { id: '', qrCode: '', copyPaste: '', expiresAt: new Date(), status: '' } }),
        getCharge: async () => ({ success: true, value: { id: '', qrCode: '', copyPaste: '', expiresAt: new Date(), status: '' } }),
        cancelCharge: async () => ({ success: true, value: undefined }),
        handleWebhook: () => ({ success: true, value: { event: '', paymentId: '', status: '', metadata: {} } }),
      };

      expect(typeof port.createPixCharge).toBe('function');
      expect(typeof port.getCharge).toBe('function');
      expect(typeof port.cancelCharge).toBe('function');
      expect(typeof port.handleWebhook).toBe('function');
    });
  });

  describe('WebhookVerifierPort', () => {
    it('should have correct method signature with Either return type', () => {
      const port: WebhookVerifierPort = {
        verify: async () => ({ success: true, value: true }),
      };

      expect(typeof port.verify).toBe('function');
    });
  });

  describe('MessageProviderPort', () => {
    it('should have correct method signatures', () => {
      const port: MessageProviderPort = {
        sendText: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
        sendTemplate: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
        getStatus: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
      };

      expect(typeof port.sendText).toBe('function');
      expect(typeof port.sendTemplate).toBe('function');
      expect(typeof port.getStatus).toBe('function');
    });
  });
});

describe('Adapter Ports', () => {
  describe('UnitOfWorkPort', () => {
    it('should have correct method signature with Either return type', () => {
      const port: UnitOfWorkPort = {
        run: async (fn) => ({ success: true, value: await fn() }),
      };

      expect(typeof port.run).toBe('function');
    });
  });

  describe('EventBusPort', () => {
    it('should have correct method signatures', () => {
      const port: EventBusPort = {
        publish: () => {},
        subscribe: () => {},
      };

      expect(typeof port.publish).toBe('function');
      expect(typeof port.subscribe).toBe('function');
    });
  });
});