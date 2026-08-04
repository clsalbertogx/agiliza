export class ProrationService {
  static calculateProratedAmount(currentAmount: number, daysUsed: number, totalDaysInCycle: number): number {
    if (totalDaysInCycle <= 0) {
      throw new Error('totalDaysInCycle must be positive');
    }
    if (daysUsed < 0) {
      throw new Error('daysUsed must be non-negative');
    }
    if (daysUsed >= totalDaysInCycle) {
      return 0;
    }
    const dailyRate = currentAmount / totalDaysInCycle;
    return Math.round(dailyRate * (totalDaysInCycle - daysUsed) * 100) / 100;
  }
}
