import React from 'react';

interface MetricCardProps {
    label: string;
    value: number;
    format: 'signed' | 'percent' | 'decimal';
    color: 'purple' | 'pink' | 'cyan' | 'yellow' | 'green' | 'red';
    intensity: number;  // [0, 1]
    hint?: string;
}

const colorMap = {
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', bar: 'bg-purple-500' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', bar: 'bg-pink-500' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', bar: 'bg-cyan-500' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', bar: 'bg-yellow-500' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', bar: 'bg-green-500' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', bar: 'bg-red-500' },
};

const formatValue = (value: number, format: string): string => {
    switch (format) {
        case 'signed':
            return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
        case 'percent':
            return `${(value * 100).toFixed(0)}%`;
        default:
            return value.toFixed(3);
    }
};

const getIntensityLabel = (intensity: number): { emoji: string; label: string } => {
    if (intensity > 0.7) return { emoji: '🔴', label: 'High' };
    if (intensity > 0.3) return { emoji: '🟡', label: 'Med' };
    return { emoji: '🟢', label: 'Low' };
};

/**
 * MetricCard - Compact, responsive metric display card
 * Used for Advanced Metrics: Sweep, Breakout, Regime, Absorption
 */
export const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    format,
    color,
    intensity,
    hint,
}) => {
    const colors = colorMap[color];
    const intensityInfo = getIntensityLabel(intensity);

    return (
        <div
            className={`flex flex-col h-20 justify-between p-2.5 rounded-lg border transition-all duration-200 hover:bg-zinc-800/30 ${colors.bg} ${colors.border}`}
        >
            {/* Header: Label + Value */}
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {label}
                </span>
                <span className={`text-sm font-mono font-bold ${colors.text}`}>
                    {formatValue(value, format)}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ease-out ${colors.bar}`}
                    style={{ width: `${Math.min(100, intensity * 100)}%` }}
                />
            </div>

            {/* Footer: Intensity Label or Hint */}
            <div className="flex justify-between items-center">
                <span className="text-[8px] text-zinc-500">
                    {intensityInfo.emoji} {intensityInfo.label}
                </span>
                {hint && (
                    <span className="text-[8px] text-zinc-600 truncate ml-1">
                        {hint}
                    </span>
                )}
            </div>
        </div>
    );
};

export default MetricCard;
