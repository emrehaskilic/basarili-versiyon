import React from 'react';
import { OpenInterestMetrics } from '../../types/metrics';

interface OpenInterestSectionProps {
    metrics: OpenInterestMetrics;
}

export const OpenInterestSection: React.FC<OpenInterestSectionProps> = ({ metrics }) => {
    return (
        <section className="space-y-3 pt-3 border-t border-zinc-800/50">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Open Interest (60s Window)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                {/* OI Value */}
                <div className="flex flex-col h-20 justify-between p-2.5 bg-zinc-900/40 rounded-lg border border-zinc-800/30">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase">Current OI</div>
                    <div className="text-xl font-mono font-bold text-zinc-200 truncate">
                        {(metrics.openInterest / 1_000_000).toFixed(2)}M
                    </div>
                    <div className="text-[8px] text-zinc-600">Contracts (USDT)</div>
                </div>

                {/* OI Change Abs */}
                <div className="flex flex-col h-20 justify-between p-2.5 bg-zinc-900/40 rounded-lg border border-zinc-800/30">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase">OI Change (60s)</div>
                    <div className={`text-xl font-mono font-bold truncate ${metrics.oiChangeAbs > 0 ? 'text-green-400' : metrics.oiChangeAbs < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {metrics.oiChangeAbs > 0 ? '+' : ''}{(metrics.oiChangeAbs / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-zinc-600">Absolute Change</div>
                </div>

                {/* OI Change Pct */}
                <div className="flex flex-col h-20 justify-between p-2.5 bg-zinc-900/40 rounded-lg border border-zinc-800/30">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase">OI Change (%)</div>
                    <div className={`text-xl font-mono font-bold truncate ${metrics.oiChangePct > 0 ? 'text-green-400' : metrics.oiChangePct < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {metrics.oiChangePct > 0 ? '+' : ''}{metrics.oiChangePct.toFixed(2)}%
                    </div>
                    <div className="text-[8px] text-zinc-600">Percentage Change</div>
                </div>
            </div>

            {/* Interpretation */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded p-2.5 text-[10px] text-zinc-400 leading-relaxed">
                <span>
                    <strong>Telemetry Note:</strong> Metrics are calculated over a rolling 60-second window. Positive change indicates net increase in open positions, while negative indicates position closing or liquidation.
                </span>
            </div>
        </section>
    );
};
