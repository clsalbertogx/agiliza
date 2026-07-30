import { DomainError } from '../errors/domain-error';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface RiskScoreProps {
  level: RiskLevel;
  probability: number;
  reason?: string;
}

export class RiskScore {
  private readonly level: RiskLevel;
  private readonly probability: number;
  private readonly reason?: string;

  private constructor(props: RiskScoreProps) {
    this.level = this.validateLevel(props.level);
    this.probability = this.validateProbability(props.probability);
    this.reason = props.reason;
  }

  private validateLevel(level: RiskLevel): RiskLevel {
    const validLevels = Object.values(RiskLevel);
    if (!validLevels.includes(level)) {
      throw new DomainError(`Invalid risk level: ${level}`);
    }
    return level;
  }

  private validateProbability(probability: number): number {
    if (!Number.isFinite(probability)) {
      throw new DomainError('Probability must be a finite number');
    }
    if (probability < 0 || probability > 1) {
      throw new DomainError(
        `Probability must be between 0 and 1, got ${probability}`
      );
    }
    // Round to 4 decimal places
    return Math.round(probability * 10000) / 10000;
  }

  static create(props: RiskScoreProps): RiskScore {
    return new RiskScore(props);
  }

  get levelValue(): RiskLevel {
    return this.level;
  }

  get probabilityValue(): number {
    return this.probability;
  }

  get reasonValue(): string | undefined {
    return this.reason;
  }

  /**
   * Determines the appropriate RiskLevel based on probability thresholds.
   */
  static fromProbability(probability: number, reason?: string): RiskScore {
    let level: RiskLevel;
    if (probability < 0.3) {
      level = RiskLevel.LOW;
    } else if (probability < 0.6) {
      level = RiskLevel.MEDIUM;
    } else if (probability < 0.85) {
      level = RiskLevel.HIGH;
    } else {
      level = RiskLevel.CRITICAL;
    }
    return new RiskScore({ level, probability, reason });
  }

  toJSON(): { level: RiskLevel; probability: number; reason?: string } {
    return {
      level: this.level,
      probability: this.probability,
      ...(this.reason ? { reason: this.reason } : {}),
    };
  }

  isHighOrCritical(): boolean {
    return this.level === RiskLevel.HIGH || this.level === RiskLevel.CRITICAL;
  }

  isLow(): boolean {
    return this.level === RiskLevel.LOW;
  }

  isMedium(): boolean {
    return this.level === RiskLevel.MEDIUM;
  }

  isHigh(): boolean {
    return this.level === RiskLevel.HIGH;
  }

  isCritical(): boolean {
    return this.level === RiskLevel.CRITICAL;
  }

  equals(other: RiskScore): boolean {
    return (
      this.level === other.level && this.probability === other.probability
    );
  }
}
