export interface SizingRampConfig {
  startingMarginUsdt: number;
  minMarginUsdt: number;
  rampStepPct: number;
  rampDecayPct: number;
  rampMaxMult: number;
}

export interface SizingRampState {
  currentMarginBudgetUsdt: number;
  rampMult: number;
  successCount: number;
  failCount: number;
}

export function computeRampBounds(config: SizingRampConfig): { min: number; max: number } {
  const min = Math.max(0, config.minMarginUsdt);
  const max = Math.max(min, config.startingMarginUsdt * Math.max(1, config.rampMaxMult));
  return { min, max };
}

export class SizingRamp {
  private state: SizingRampState;

  constructor(private config: SizingRampConfig) {
    this.state = {
      currentMarginBudgetUsdt: Math.max(0, config.startingMarginUsdt),
      rampMult: 1,
      successCount: 0,
      failCount: 0,
    };
  }

  getState(): SizingRampState {
    return { ...this.state };
  }

  updateConfig(next: Partial<SizingRampConfig>) {
    this.config = {
      ...this.config,
      ...next,
    };
    this.state.currentMarginBudgetUsdt = this.clamp(this.state.currentMarginBudgetUsdt);
    this.state.rampMult = this.config.startingMarginUsdt > 0
      ? this.state.currentMarginBudgetUsdt / this.config.startingMarginUsdt
      : 0;
  }

  getCurrentMarginBudgetUsdt(): number {
    return this.state.currentMarginBudgetUsdt;
  }

  onTradeClosed(realizedPnl: number): SizingRampState {
    if (realizedPnl > 0) {
      this.state.successCount += 1;
      this.state.currentMarginBudgetUsdt = this.clamp(
        this.state.currentMarginBudgetUsdt * (1 + this.config.rampStepPct / 100)
      );
    } else {
      this.state.failCount += 1;
      this.state.currentMarginBudgetUsdt = this.clamp(
        this.state.currentMarginBudgetUsdt * (1 - this.config.rampDecayPct / 100)
      );
    }

    this.state.rampMult = this.config.startingMarginUsdt > 0
      ? this.state.currentMarginBudgetUsdt / this.config.startingMarginUsdt
      : 0;

    return this.getState();
  }

  private clamp(value: number): number {
    const { min, max } = computeRampBounds(this.config);
    return Math.max(min, Math.min(max, value));
  }
}
