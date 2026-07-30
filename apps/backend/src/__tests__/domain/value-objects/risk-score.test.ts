import { describe, it, expect } from 'vitest';
import { RiskScore, RiskLevel } from '../../../domain/value-objects/risk-score';
import { DomainError } from '../../../domain/errors/domain-error';

describe('RiskScore Value Object', () => {
  describe('creation', () => {
    it('should create a RiskScore with valid props', () => {
      const risk = RiskScore.create({
        level: RiskLevel.LOW,
        probability: 0.1,
      });

      expect(risk.levelValue).toBe(RiskLevel.LOW);
      expect(risk.probabilityValue).toBe(0.1);
    });

    it('should create a RiskScore with reason', () => {
      const risk = RiskScore.create({
        level: RiskLevel.HIGH,
        probability: 0.75,
        reason: 'Multiple overdue invoices',
      });

      expect(risk.reasonValue).toBe('Multiple overdue invoices');
    });

    it('should round probability to 4 decimal places', () => {
      const risk = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.12345,
      });

      expect(risk.probabilityValue).toBe(0.1235);
    });
  });

  describe('validation', () => {
    it('should throw DomainError for probability > 1', () => {
      expect(() =>
        RiskScore.create({ level: RiskLevel.HIGH, probability: 1.5 })
      ).toThrow(DomainError);
    });

    it('should throw DomainError for probability < 0', () => {
      expect(() =>
        RiskScore.create({ level: RiskLevel.LOW, probability: -0.1 })
      ).toThrow(DomainError);
    });

    it('should throw DomainError for NaN probability', () => {
      expect(() =>
        RiskScore.create({ level: RiskLevel.LOW, probability: NaN })
      ).toThrow(DomainError);
    });

    it('should throw DomainError for Infinity probability', () => {
      expect(() =>
        RiskScore.create({ level: RiskLevel.LOW, probability: Infinity })
      ).toThrow(DomainError);
    });

    it('should throw DomainError for invalid RiskLevel', () => {
      expect(() =>
        RiskScore.create({
          level: 'INVALID' as RiskLevel,
          probability: 0.5,
        })
      ).toThrow(DomainError);
    });
  });

  describe('fromProbability', () => {
    it('should create LOW risk for probability < 0.3', () => {
      const risk = RiskScore.fromProbability(0.1);
      expect(risk.levelValue).toBe(RiskLevel.LOW);
    });

    it('should create MEDIUM risk for probability 0.3 to < 0.6', () => {
      const risk = RiskScore.fromProbability(0.3);
      expect(risk.levelValue).toBe(RiskLevel.MEDIUM);
    });

    it('should create MEDIUM risk for probability 0.5', () => {
      const risk = RiskScore.fromProbability(0.5);
      expect(risk.levelValue).toBe(RiskLevel.MEDIUM);
    });

    it('should create HIGH risk for probability 0.6 to < 0.85', () => {
      const risk = RiskScore.fromProbability(0.6);
      expect(risk.levelValue).toBe(RiskLevel.HIGH);
    });

    it('should create HIGH risk for probability 0.8', () => {
      const risk = RiskScore.fromProbability(0.8);
      expect(risk.levelValue).toBe(RiskLevel.HIGH);
    });

    it('should create CRITICAL risk for probability >= 0.85', () => {
      const risk = RiskScore.fromProbability(0.85);
      expect(risk.levelValue).toBe(RiskLevel.CRITICAL);
    });

    it('should create CRITICAL risk for probability 1', () => {
      const risk = RiskScore.fromProbability(1);
      expect(risk.levelValue).toBe(RiskLevel.CRITICAL);
    });

    it('should pass reason through fromProbability', () => {
      const risk = RiskScore.fromProbability(0.9, 'Very high risk');
      expect(risk.reasonValue).toBe('Very high risk');
      expect(risk.levelValue).toBe(RiskLevel.CRITICAL);
    });
  });

  describe('toJSON', () => {
    it('should serialize correctly without reason', () => {
      const risk = RiskScore.create({
        level: RiskLevel.LOW,
        probability: 0.1,
      });

      expect(risk.toJSON()).toEqual({
        level: RiskLevel.LOW,
        probability: 0.1,
      });
    });

    it('should serialize correctly with reason', () => {
      const risk = RiskScore.create({
        level: RiskLevel.HIGH,
        probability: 0.75,
        reason: 'Late payments',
      });

      expect(risk.toJSON()).toEqual({
        level: RiskLevel.HIGH,
        probability: 0.75,
        reason: 'Late payments',
      });
    });
  });

  describe('level queries', () => {
    it('should identify LOW risk', () => {
      const risk = RiskScore.create({
        level: RiskLevel.LOW,
        probability: 0.1,
      });
      expect(risk.isLow()).toBe(true);
      expect(risk.isMedium()).toBe(false);
      expect(risk.isHigh()).toBe(false);
      expect(risk.isCritical()).toBe(false);
      expect(risk.isHighOrCritical()).toBe(false);
    });

    it('should identify MEDIUM risk', () => {
      const risk = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.4,
      });
      expect(risk.isMedium()).toBe(true);
      expect(risk.isLow()).toBe(false);
      expect(risk.isHighOrCritical()).toBe(false);
    });

    it('should identify HIGH risk', () => {
      const risk = RiskScore.create({
        level: RiskLevel.HIGH,
        probability: 0.7,
      });
      expect(risk.isHigh()).toBe(true);
      expect(risk.isHighOrCritical()).toBe(true);
    });

    it('should identify CRITICAL risk', () => {
      const risk = RiskScore.create({
        level: RiskLevel.CRITICAL,
        probability: 0.95,
      });
      expect(risk.isCritical()).toBe(true);
      expect(risk.isHighOrCritical()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for identical risk scores', () => {
      const a = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.5,
      });
      const b = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.5,
      });
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different levels', () => {
      const a = RiskScore.create({
        level: RiskLevel.LOW,
        probability: 0.1,
      });
      const b = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.1,
      });
      expect(a.equals(b)).toBe(false);
    });

    it('should return false for different probabilities', () => {
      const a = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.4,
      });
      const b = RiskScore.create({
        level: RiskLevel.MEDIUM,
        probability: 0.5,
      });
      expect(a.equals(b)).toBe(false);
    });
  });
});
