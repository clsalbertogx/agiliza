import { describe, it, expect } from 'vitest';
import { ProrationService } from '@/domain/services/proration.service';

describe('ProrationService', () => {
  describe('calculateProratedAmount', () => {
    it('should calculate correct prorated amount for half-used cycle', () => {
      // $100 over 30 days, 15 days used => $50 credit
      const result = ProrationService.calculateProratedAmount(100, 15, 30);
      expect(result).toBe(50);
    });

    it('should return full amount when no days used', () => {
      const result = ProrationService.calculateProratedAmount(100, 0, 30);
      expect(result).toBe(100);
    });

    it('should return 0 when all days used', () => {
      const result = ProrationService.calculateProratedAmount(100, 30, 30);
      expect(result).toBe(0);
    });

    it('should return 0 when days used exceeds cycle', () => {
      const result = ProrationService.calculateProratedAmount(100, 35, 30);
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // $99.99 over 30 days, 1 day used => 29/30 * 99.99 = 96.657 => 96.66
      const result = ProrationService.calculateProratedAmount(99.99, 1, 30);
      expect(result).toBe(96.66);
    });

    it('should throw when totalDaysInCycle is 0', () => {
      expect(() => ProrationService.calculateProratedAmount(100, 5, 0)).toThrow(
        'totalDaysInCycle must be positive',
      );
    });

    it('should throw when daysUsed is negative', () => {
      expect(() => ProrationService.calculateProratedAmount(100, -1, 30)).toThrow(
        'daysUsed must be non-negative',
      );
    });

    it('should handle monthly billing cycle correctly', () => {
      // $49.99 monthly, 10 days used out of 30 => 20/30 * 49.99 = 33.3267 => 33.33
      const result = ProrationService.calculateProratedAmount(49.99, 10, 30);
      expect(result).toBe(33.33);
    });

    it('should handle annual billing cycle correctly', () => {
      // $999.99 annually, 100 days used out of 365 => 265/365 * 999.99 = 726.02
      const result = ProrationService.calculateProratedAmount(999.99, 100, 365);
      expect(result).toBe(726.02);
    });
  });
});
