export type RiskLevel = 'green' | 'yellow' | 'red';

/**
 * Normalizes the UPPERCASE risk score level returned by the API (e.g. 'GREEN')
 * to the lowercase union expected by UI components such as ClientCard.
 * Falls back to 'green' defensively for unknown values.
 */
export function mapRiskScore(riskScore: string | null | undefined): RiskLevel {
  const normalized = (riskScore ?? '').toLowerCase();
  if (normalized === 'yellow' || normalized === 'red') {
    return normalized;
  }
  return 'green';
}
