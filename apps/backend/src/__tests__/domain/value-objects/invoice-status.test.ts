import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/errors/domain-error';
import { InvoiceStatus, InvoiceStatusEnum } from '@/domain/value-objects/invoice-status';

describe('InvoiceStatus Value Object', () => {
  describe('creation', () => {
    it('should create PENDING status', () => {
      const status = InvoiceStatus.PENDING();
      expect(status.value()).toBe(InvoiceStatusEnum.PENDING);
    });

    it('should create PAID status', () => {
      const status = InvoiceStatus.PAID();
      expect(status.value()).toBe(InvoiceStatusEnum.PAID);
    });

    it('should create OVERDUE status', () => {
      const status = InvoiceStatus.OVERDUE();
      expect(status.value()).toBe(InvoiceStatusEnum.OVERDUE);
    });

    it('should create CANCELLED status', () => {
      const status = InvoiceStatus.CANCELLED();
      expect(status.value()).toBe(InvoiceStatusEnum.CANCELLED);
    });

    it('should create REFUNDED status', () => {
      const status = InvoiceStatus.REFUNDED();
      expect(status.value()).toBe(InvoiceStatusEnum.REFUNDED);
    });

    it('should create from enum value', () => {
      const status = InvoiceStatus.create(InvoiceStatusEnum.PENDING);
      expect(status.value()).toBe(InvoiceStatusEnum.PENDING);
    });
  });

  describe('state queries', () => {
    it('should identify PENDING status', () => {
      expect(InvoiceStatus.PENDING().isPending()).toBe(true);
      expect(InvoiceStatus.PENDING().isPaid()).toBe(false);
      expect(InvoiceStatus.PENDING().isOverdue()).toBe(false);
      expect(InvoiceStatus.PENDING().isCancelled()).toBe(false);
      expect(InvoiceStatus.PENDING().isRefunded()).toBe(false);
    });

    it('should identify PAID status', () => {
      expect(InvoiceStatus.PAID().isPaid()).toBe(true);
      expect(InvoiceStatus.PAID().isPending()).toBe(false);
    });

    it('should identify OVERDUE status', () => {
      expect(InvoiceStatus.OVERDUE().isOverdue()).toBe(true);
    });

    it('should identify CANCELLED status', () => {
      expect(InvoiceStatus.CANCELLED().isCancelled()).toBe(true);
    });

    it('should identify REFUNDED status', () => {
      expect(InvoiceStatus.REFUNDED().isRefunded()).toBe(true);
    });
  });

  describe('terminal state', () => {
    it('should consider CANCELLED as terminal', () => {
      expect(InvoiceStatus.CANCELLED().isTerminal()).toBe(true);
    });

    it('should consider REFUNDED as terminal', () => {
      expect(InvoiceStatus.REFUNDED().isTerminal()).toBe(true);
    });

    it('should not consider PENDING as terminal', () => {
      expect(InvoiceStatus.PENDING().isTerminal()).toBe(false);
    });

    it('should not consider PAID as terminal', () => {
      expect(InvoiceStatus.PAID().isTerminal()).toBe(false);
    });

    it('should not consider OVERDUE as terminal', () => {
      expect(InvoiceStatus.OVERDUE().isTerminal()).toBe(false);
    });
  });

  describe('active state', () => {
    it('should consider PENDING as active', () => {
      expect(InvoiceStatus.PENDING().isActive()).toBe(true);
    });

    it('should consider OVERDUE as active', () => {
      expect(InvoiceStatus.OVERDUE().isActive()).toBe(true);
    });

    it('should not consider PAID as active', () => {
      expect(InvoiceStatus.PAID().isActive()).toBe(false);
    });

    it('should not consider CANCELLED as active', () => {
      expect(InvoiceStatus.CANCELLED().isActive()).toBe(false);
    });

    it('should not consider REFUNDED as active', () => {
      expect(InvoiceStatus.REFUNDED().isActive()).toBe(false);
    });
  });

  describe('state machine transitions', () => {
    describe('PENDING transitions', () => {
      const status = InvoiceStatus.PENDING();

      it('should transition to PAID', () => {
        const result = status.transitionTo(InvoiceStatus.PAID());
        expect(result.isPaid()).toBe(true);
      });

      it('should transition to OVERDUE', () => {
        const result = status.transitionTo(InvoiceStatus.OVERDUE());
        expect(result.isOverdue()).toBe(true);
      });

      it('should transition to CANCELLED', () => {
        const result = status.transitionTo(InvoiceStatus.CANCELLED());
        expect(result.isCancelled()).toBe(true);
      });

      it('should NOT transition to REFUNDED', () => {
        expect(() => status.transitionTo(InvoiceStatus.REFUNDED())).toThrow(DomainError);
      });
    });

    describe('PAID transitions', () => {
      const status = InvoiceStatus.PAID();

      it('should transition to REFUNDED', () => {
        const result = status.transitionTo(InvoiceStatus.REFUNDED());
        expect(result.isRefunded()).toBe(true);
      });

      it('should NOT transition back to PENDING', () => {
        expect(() => status.transitionTo(InvoiceStatus.PENDING())).toThrow(DomainError);
      });

      it('should NOT transition to OVERDUE', () => {
        expect(() => status.transitionTo(InvoiceStatus.OVERDUE())).toThrow(DomainError);
      });

      it('should NOT transition to CANCELLED', () => {
        expect(() => status.transitionTo(InvoiceStatus.CANCELLED())).toThrow(DomainError);
      });
    });

    describe('OVERDUE transitions', () => {
      const status = InvoiceStatus.OVERDUE();

      it('should transition to PAID', () => {
        const result = status.transitionTo(InvoiceStatus.PAID());
        expect(result.isPaid()).toBe(true);
      });

      it('should transition to CANCELLED', () => {
        const result = status.transitionTo(InvoiceStatus.CANCELLED());
        expect(result.isCancelled()).toBe(true);
      });

      it('should NOT transition to PENDING', () => {
        expect(() => status.transitionTo(InvoiceStatus.PENDING())).toThrow(DomainError);
      });

      it('should NOT transition to REFUNDED', () => {
        expect(() => status.transitionTo(InvoiceStatus.REFUNDED())).toThrow(DomainError);
      });
    });

    describe('CANCELLED (terminal) transitions', () => {
      const status = InvoiceStatus.CANCELLED();

      it('should NOT transition to any status', () => {
        expect(() => status.transitionTo(InvoiceStatus.PENDING())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.PAID())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.OVERDUE())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.REFUNDED())).toThrow(DomainError);
      });
    });

    describe('REFUNDED (terminal) transitions', () => {
      const status = InvoiceStatus.REFUNDED();

      it('should NOT transition to any status', () => {
        expect(() => status.transitionTo(InvoiceStatus.PENDING())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.PAID())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.OVERDUE())).toThrow(DomainError);
        expect(() => status.transitionTo(InvoiceStatus.CANCELLED())).toThrow(DomainError);
      });
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for allowed transitions', () => {
      expect(InvoiceStatus.PENDING().canTransitionTo(InvoiceStatus.PAID())).toBe(true);
      expect(InvoiceStatus.PAID().canTransitionTo(InvoiceStatus.REFUNDED())).toBe(true);
    });

    it('should return false for disallowed transitions', () => {
      expect(InvoiceStatus.PENDING().canTransitionTo(InvoiceStatus.REFUNDED())).toBe(false);
      expect(InvoiceStatus.CANCELLED().canTransitionTo(InvoiceStatus.PAID())).toBe(false);
      expect(InvoiceStatus.REFUNDED().canTransitionTo(InvoiceStatus.PENDING())).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the enum value as string', () => {
      expect(InvoiceStatus.PENDING().toString()).toBe(InvoiceStatusEnum.PENDING);
      expect(InvoiceStatus.PAID().toString()).toBe(InvoiceStatusEnum.PAID);
    });
  });
});
