import { ClientRiskScore } from '../contracts/enums';
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
    this.level = props.level;
    this.probability = Math.round(props.probability * 10000) / 10000;
    this.reason = props.reason;
  }

  static create(props: RiskScoreProps): RiskScore {
    if (!Object.values(RiskLevel).includes(props.level)) {
      throw new DomainError(`Invalid risk level: ${props.level}`);
    }
    if (!Number.isFinite(props.probability) || props.probability < 0 || props.probability > 1) {
      throw new DomainError('Probability must be a number between 0 and 1');
    }
    return new RiskScore(props);
  }

  static fromClientRiskScore(score: string): RiskScore {
    switch (score) {
      case ClientRiskScore.GREEN: return RiskScore.GREEN;
      case ClientRiskScore.YELLOW: return RiskScore.YELLOW;
      case ClientRiskScore.RED: return RiskScore.RED;
      default:
        throw new DomainError(`Invalid client risk score: ${String(score)}`);
    }
  }

  get clientRiskScore(): ClientRiskScore {
    switch (this.level) {
      case RiskLevel.LOW: return ClientRiskScore.GREEN;
      case RiskLevel.MEDIUM: return ClientRiskScore.YELLOW;
      case RiskLevel.HIGH:
      case RiskLevel.CRITICAL: return ClientRiskScore.RED;
    }
  }

  static fromProbability(probability: number, reason?: string): RiskScore {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new DomainError('Probability must be a number between 0 and 1');
    }

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

  // Legacy static properties for backward compatibility with tests
  static get GREEN(): RiskScore {
    return new RiskScore({ level: RiskLevel.LOW, probability: 0.1 });
  }

  static get YELLOW(): RiskScore {
    return new RiskScore({ level: RiskLevel.MEDIUM, probability: 0.4 });
  }

  static get RED(): RiskScore {
    return new RiskScore({ level: RiskLevel.HIGH, probability: 0.7 });
  }

  // Legacy static methods
  static green(): RiskScore {
    return RiskScore.GREEN;
  }

  static yellow(): RiskScore {
    return RiskScore.YELLOW;
  }

  static red(): RiskScore {
    return RiskScore.RED;
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

  isHighOrCritical(): boolean {
    return this.level === RiskLevel.HIGH || this.level === RiskLevel.CRITICAL;
  }

  equals(other: RiskScore): boolean {
    return this.level === other.level && this.probability === other.probability;
  }

  toJSON(): RiskScoreProps {
    return {
      level: this.level,
      probability: this.probability,
      reason: this.reason,
    };
  }

  toString(): string {
    return this.level;
  }
}
