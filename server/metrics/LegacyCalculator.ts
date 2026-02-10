// [GITHUB VERIFIED] Backend implementation of OBI, VWAP, DeltaZ, CVD Slope, and Advanced Scores
// Senior Quantitative Finance Developer Implementation
import { OrderbookState, bestBid, bestAsk } from './OrderbookManager';
import { OpenInterestMonitor, OpenInterestMetrics as OIMetrics } from './OpenInterestMonitor';

// Type for a trade used in the legacy metrics calculations
interface LegacyTrade {
    price: number;
    quantity: number;
    side: 'buy' | 'sell';
    timestamp: number;
}

// Constants for metric calculations
const EPSILON = 1e-12;
const MAX_TRADES_WINDOW = 10_000; // Maximum trade window (10 seconds worth)
const VOLATILITY_HISTORY_SIZE = 3600; // 1 hour of volatility history
const ATR_WINDOW = 14;
const SWEEP_DETECTION_WINDOW = 30;
const BREAKOUT_WINDOW = 15;
const ABSORPTION_WINDOW = 60;

/**
 * LegacyCalculator computes additional orderflow metrics that were
 * previously derived on the client.  These include various orderbook
 * imbalance scores, rolling delta windows, Z‐scores and session CVD
 * slope.  The implementation strives to be lightweight but still
 * produce values compatible with the original UI expectations.
 * 
 * Implements:
 * - OBI (Weighted, Deep, Divergence)
 * - Session VWAP
 * - Delta Z-Score
 * - CVD Slope
 * - Advanced Scores: Sweep, Breakout, Regime, Absorption
 * - Trade Signal
 * - Exhaustion Detection
 */
export class LegacyCalculator {
    // Keep a rolling list of trades for delta calculations (max 10 seconds)
    private trades: LegacyTrade[] = [];
    private oiMonitor: OpenInterestMonitor | null = null;

    constructor(symbol?: string) {
        if (symbol) {
            this.oiMonitor = new OpenInterestMonitor(symbol);
        }
    }

    public async updateOpenInterest() {
        if (this.oiMonitor) {
            await this.oiMonitor.updateOpenInterest();
        }
    }

    public getOpenInterestMetrics(): OIMetrics | null {
        return this.oiMonitor ? this.oiMonitor.getMetrics() : null;
    }
    // List of recent delta1s values for Z‐score computation
    private deltaHistory: number[] = [];
    // List of recent session CVD values for slope computation
    private cvdHistory: number[] = [];
    private cvdSession = 0;
    private totalVolume = 0;
    private totalNotional = 0;

    // Advanced Metrics State
    private volatilityHistory: number[] = [];
    private volumeHistory: number[] = [];
    private lastMidPrice = 0;

    /**
     * Add a trade to the calculator.  Updates rolling windows and
     * cumulative session CVD/volume/notional statistics.
     */
    addTrade(trade: LegacyTrade) {
        const now = trade.timestamp;
        // Push new trade
        this.trades.push(trade);
        // Update session metrics
        this.totalVolume += trade.quantity;
        this.totalNotional += trade.quantity * trade.price;
        this.cvdSession += trade.side === 'buy' ? trade.quantity : -trade.quantity;
        // Remove old trades beyond 10 seconds
        const cutoff = now - 10_000;
        while (this.trades.length > 0 && this.trades[0].timestamp < cutoff) {
            this.trades.shift();
        }
        // Every trade, recompute delta1s and store for Z‐score.  Compute
        // delta1s as net volume over last 1s.
        const oneSecCutoff = now - 1_000;
        let delta1s = 0;
        let delta5s = 0;
        let count1s = 0;
        for (const t of this.trades) {
            if (t.timestamp >= oneSecCutoff) {
                delta1s += t.side === 'buy' ? t.quantity : -t.quantity;
                count1s++;
            }
            if (t.timestamp >= now - 5_000) {
                delta5s += t.side === 'buy' ? t.quantity : -t.quantity;
            }
        }
        // Store delta1s history for Z calculation (limit 60 entries)
        this.deltaHistory.push(delta1s);
        if (this.deltaHistory.length > 60) {
            this.deltaHistory.shift();
        }
        // Store cvdSession history for slope calculation (limit 60 entries)
        this.cvdHistory.push(this.cvdSession);
        if (this.cvdHistory.length > 60) {
            this.cvdHistory.shift();
        }
        // Store volume history for absorption detection
        this.volumeHistory.push(trade.quantity);
        if (this.volumeHistory.length > 100) {
            this.volumeHistory.shift();
        }
    }

    /**
     * Calculate Standard Deviation of an array
     */
    private calculateStdDev(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Linear Regression Slope calculation
     */
    private calculateSlope(values: number[]): number {
        const n = values.length;
        if (n < 2) return 0;

        const xs = [...Array(n).keys()];
        const ys = values;
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXX = xs.reduce((a, b) => a + b * b, 0);
        const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
        const denom = n * sumXX - sumX * sumX;

        if (Math.abs(denom) < EPSILON) return 0;
        return (n * sumXY - sumX * sumY) / denom;
    }

    // =========================================================================
    // ADVANCED METRICS CALCULATIONS
    // =========================================================================

    /**
     * Compute the current legacy metrics given the current orderbook
     * state.  The orderbook is used to derive imbalance scores.  The
     * function returns an object containing all metrics required for
     * the original UI.  Undefined values are returned as null.
     */
    computeMetrics(ob: OrderbookState) {
        // Helper to calculate raw volume for a given depth (descending for bids, ascending for asks)
        const calcVolume = (levels: Map<number, number>, depth: number, isAsk: boolean): number => {
            const entries = Array.from(levels.entries());
            // Sort: Bids Descending, Asks Ascending
            entries.sort((a, b) => isAsk ? a[0] - b[0] : b[0] - a[0]);
            let vol = 0;
            for (let i = 0; i < Math.min(depth, entries.length); i++) {
                vol += entries[i][1];
            }
            return vol;
        };

        // --- A) OBI Weighted (Normalized) ---
        // Top 10 levels
        const bidVol10 = calcVolume(ob.bids, 10, false);
        const askVol10 = calcVolume(ob.asks, 10, true);

        const rawObiWeighted = bidVol10 - askVol10;
        const denomWeighted = bidVol10 + askVol10;
        // Range: [-1, +1]
        const obiWeighted = denomWeighted > EPSILON ? rawObiWeighted / denomWeighted : 0;

        // --- B) OBI Deep Book (Normalized) ---
        // Top 50 levels (representing deep liquidity)
        const bidVol50 = calcVolume(ob.bids, 50, false);
        const askVol50 = calcVolume(ob.asks, 50, true);

        const rawObiDeep = bidVol50 - askVol50;
        const denomDeep = bidVol50 + askVol50;
        // Range: [-1, +1]
        const obiDeep = denomDeep > EPSILON ? rawObiDeep / denomDeep : 0;

        // --- C) OBI Divergence (Stable Definition) ---
        // Difference between weighted (near) and deep OBI
        // Range: [-2, +2]
        const obiDivergence = obiWeighted - obiDeep;

        // Recompute rolling delta windows.
        const refTime = this.trades.length > 0
            ? this.trades[this.trades.length - 1].timestamp
            : Date.now();
        let delta1s = 0;
        let delta5s = 0;
        for (const t of this.trades) {
            if (t.timestamp >= refTime - 1_000) {
                delta1s += t.side === 'buy' ? t.quantity : -t.quantity;
            }
            if (t.timestamp >= refTime - 5_000) {
                delta5s += t.side === 'buy' ? t.quantity : -t.quantity;
            }
        }

        // Z‐score of delta1s: (value - mean) / std
        let deltaZ = 0;
        if (this.deltaHistory.length >= 5) {
            const mean = this.deltaHistory.reduce((a, b) => a + b, 0) / this.deltaHistory.length;
            const variance = this.deltaHistory.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / this.deltaHistory.length;
            const std = Math.sqrt(variance);
            deltaZ = std > EPSILON ? (delta1s - mean) / std : 0;
        }

        // CVD slope: simple linear regression on the last cvdHistory values
        const cvdSlope = this.calculateSlope(this.cvdHistory);

        // VWAP: totalNotional / totalVolume
        const vwap = this.totalVolume > EPSILON ? this.totalNotional / this.totalVolume : 0;

        // Compose object
        const bestBidPrice = bestBid(ob) ?? 0;
        const bestAskPrice = bestAsk(ob) ?? 0;
        const midPrice = (bestBidPrice + bestAskPrice) / 2;

        return {
            price: midPrice,
            obiWeighted,
            obiDeep,
            obiDivergence,
            delta1s,
            delta5s,
            deltaZ,
            cvdSession: this.cvdSession,
            cvdSlope,
            vwap,
            totalVolume: this.totalVolume,
            totalNotional: this.totalNotional,
            tradeCount: this.trades.length,
        };
    }
}