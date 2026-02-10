/**
 * Multi‑timeframe Delta and CVD computation.
 *
 * This module consumes trade events (identical to those used by
 * TimeAndSales) and aggregates them into rolling windows of
 * configurable durations.  For each timeframe it maintains a
 * cumulative volume delta (CVD) and the net delta (buy minus sell)
 * over the window.  It also provides a basic exhaustion indicator
 * which triggers when the CVD continues to rise (or fall) while the
 * last trade price fails to make new highs (or lows).  This
 * exhaustion flag is a heuristic and should be supplemented by
 * additional context (e.g. liquidity levels) before making trading
 * decisions.
 */

import { AggressiveSide, TradeEvent } from './TimeAndSales';

export interface CvdMetrics {
  timeframe: string;
  cvd: number;
  delta: number;
}

interface StoredCvdTrade extends TradeEvent {
  arrival: number;
  price: number;
}

export class CvdCalculator {
  private readonly windows: Map<string, number> = new Map();
  private readonly trades: Map<string, StoredCvdTrade[]> = new Map();

  constructor(timeframes: Record<string, number> = { '1m': 60_000, '5m': 300_000, '15m': 900_000 }) {
    for (const [tf, ms] of Object.entries(timeframes)) {
      this.windows.set(tf, ms);
      this.trades.set(tf, []);
    }
  }

  /**
   * Add a trade event to all tracked timeframes.  The `price` field
   * should represent the trade price.  The `timestamp` should be the
   * event time as reported by the exchange.
   */
  public addTrade(event: TradeEvent & { price: number }): void {
    const arrival = Date.now();
    // Normalise side to numeric delta: buy=+quantity, sell=−quantity
    const signedQty = event.side === 'buy' ? event.quantity : -event.quantity;
    for (const [tf, ms] of this.windows.entries()) {
      const arr = this.trades.get(tf)!;
      arr.push({ ...event, quantity: signedQty, arrival, price: event.price });
      // Remove expired trades based on trade timestamp
      const cutoff = event.timestamp - ms;
      const filtered = arr.filter(t => t.timestamp >= cutoff);
      this.trades.set(tf, filtered);
    }
  }

  /**
   * Get trade counts for each timeframe (for debugging)
   * Also returns warmup percentage showing how "full" each timeframe is
   */
  public getTradeCounts(): Record<string, { count: number; warmUpPct: number }> {
    const counts: Record<string, { count: number; warmUpPct: number }> = {};
    const now = Date.now();

    for (const [tf, ms] of this.windows.entries()) {
      const arr = this.trades.get(tf) ?? [];
      const count = arr.length;

      // Calculate warmup: how much of the timeframe window is filled with data
      let warmUpPct = 100;
      if (arr.length > 0) {
        const oldest = arr[0].timestamp;
        const span = now - oldest;
        warmUpPct = Math.min(100, Math.round((span / ms) * 100));
      } else {
        warmUpPct = 0;
      }

      counts[tf] = { count, warmUpPct };
    }
    return counts;
  }

  /**
   * Compute CVD metrics for all timeframes.  If no trades exist
   * within a timeframe the corresponding metrics will be zero.
   */
  public computeMetrics(): CvdMetrics[] {
    const results: CvdMetrics[] = [];
    for (const [tf, _ms] of this.windows.entries()) {
      const arr = this.trades.get(tf)!;
      let cvd = 0;
      for (const t of arr) {
        cvd += t.quantity;
      }
      const delta = cvd;
      results.push({ timeframe: tf, cvd, delta });
    }
    return results;
  }
}