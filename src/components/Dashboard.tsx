import React, { useEffect, useMemo, useState } from 'react';
import { useTelemetrySocket } from '../services/useTelemetrySocket';
import { MetricsState, MetricsMessage } from '../types/metrics';
import SymbolRow from './SymbolRow';
import MobileSymbolCard from './MobileSymbolCard';

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

interface ExecutionStatus {
  connection: {
    state: ConnectionState;
    executionEnabled: boolean;
    hasCredentials: boolean;
    symbols: string[];
    lastError: string | null;
  };
  selectedSymbol: string | null;
  settings: {
    initialBalanceUsdt: number;
    walletUsagePercent: number;
    leverage: number;
  };
  wallet: {
    totalWalletUsdt: number;
    availableBalanceUsdt: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
  };
  openPosition: {
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    leverage: number;
  } | null;
}

const defaultExecutionStatus: ExecutionStatus = {
  connection: {
    state: 'DISCONNECTED',
    executionEnabled: false,
    hasCredentials: false,
    symbols: [],
    lastError: null,
  },
  selectedSymbol: null,
  settings: {
    initialBalanceUsdt: 1000,
    walletUsagePercent: 10,
    leverage: 10,
  },
  wallet: {
    totalWalletUsdt: 0,
    availableBalanceUsdt: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
  },
  openPosition: null,
};

const formatNum = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export const Dashboard: React.FC = () => {
  const [selectedPair, setSelectedPair] = useState<string>('BTCUSDT');
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isLoadingPairs, setIsLoadingPairs] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [initialBalanceUsdt, setInitialBalanceUsdt] = useState<number>(1000);
  const [walletUsagePercent, setWalletUsagePercent] = useState<number>(10);
  const [leverage, setLeverage] = useState<number>(10);

  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>(defaultExecutionStatus);

  const activeSymbols = useMemo(() => [selectedPair], [selectedPair]);
  const marketData: MetricsState = useTelemetrySocket(activeSymbols);

  const hostname = window.location.hostname;
  const proxyUrl = (import.meta as any).env?.VITE_PROXY_API || `http://${hostname}:8787`;

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const res = await fetch(`${proxyUrl}/api/testnet/exchange-info`);
        const data = await res.json();
        const pairs = Array.isArray(data?.symbols) ? data.symbols : [];
        setAvailablePairs(pairs);
        if (pairs.length > 0 && !pairs.includes(selectedPair)) {
          setSelectedPair(pairs[0]);
        }
      } catch {
        setAvailablePairs(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      } finally {
        setIsLoadingPairs(false);
      }
    };

    fetchPairs();
  }, [proxyUrl]);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch(`${proxyUrl}/api/execution/status`);
        const data = (await res.json()) as ExecutionStatus;
        setExecutionStatus(data);
        setInitialBalanceUsdt(data.settings.initialBalanceUsdt);
        setWalletUsagePercent(data.settings.walletUsagePercent);
        setLeverage(data.settings.leverage);
      } catch {
        // no-op: keep last known state
      }
    };

    pollStatus();
    const timer = window.setInterval(pollStatus, 2000);
    return () => window.clearInterval(timer);
  }, [proxyUrl]);

  useEffect(() => {
    const syncSelectedSymbol = async () => {
      try {
        await fetch(`${proxyUrl}/api/execution/symbol`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: selectedPair }),
        });
      } catch {
        // ignore and retry on next change
      }
    };
    syncSelectedSymbol();
  }, [proxyUrl, selectedPair]);

  const filteredPairs = availablePairs.filter((p) => p.includes(searchTerm.toUpperCase()));

  const connectTestnet = async () => {
    setConnectionError(null);
    try {
      const res = await fetch(`${proxyUrl}/api/execution/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'connect_failed');
      }
      setExecutionStatus(data.status as ExecutionStatus);
    } catch (e: any) {
      setConnectionError(e.message || 'connect_failed');
    }
  };

  const disconnectTestnet = async () => {
    setConnectionError(null);
    try {
      const res = await fetch(`${proxyUrl}/api/execution/disconnect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'disconnect_failed');
      }
      setExecutionStatus(data.status as ExecutionStatus);
    } catch (e: any) {
      setConnectionError(e.message || 'disconnect_failed');
    }
  };

  const toggleExecution = async (enabled: boolean) => {
    const res = await fetch(`${proxyUrl}/api/execution/enabled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (res.ok) {
      setExecutionStatus(data.status as ExecutionStatus);
    }
  };

  const saveSettings = async () => {
    const res = await fetch(`${proxyUrl}/api/execution/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalanceUsdt, walletUsagePercent, leverage }),
    });
    const data = await res.json();
    if (res.ok) {
      setExecutionStatus(data.status as ExecutionStatus);
    }
  };

  const statusColor = executionStatus.connection.state === 'CONNECTED'
    ? 'text-green-400'
    : executionStatus.connection.state === 'ERROR'
    ? 'text-red-400'
    : 'text-zinc-400';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 font-sans p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Orderflow Matrix</h1>
            <p className="text-zinc-500 text-sm mt-1">DATA: MAINNET | EXECUTION: TESTNET</p>
          </div>
          <div className="text-xs rounded border border-zinc-700 px-3 py-2 bg-zinc-900">
            {executionStatus.connection.executionEnabled ? (
              <span className="text-green-400">Execution ON</span>
            ) : (
              <span className="text-amber-300">Execution OFF (orders blocked)</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">API & Execution</h2>
            <input
              type="password"
              placeholder="Testnet API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Testnet API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={connectTestnet} className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs font-semibold">Connect Testnet</button>
              <button onClick={disconnectTestnet} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-semibold">Disconnect</button>
            </div>
            <div className="text-xs">
              Status: <span className={statusColor} title={executionStatus.connection.lastError || ''}>{executionStatus.connection.state}</span>
            </div>
            {connectionError && <div className="text-xs text-red-400">{connectionError}</div>}
            <label className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800">
              <span>Execution Enabled</span>
              <input
                type="checkbox"
                checked={executionStatus.connection.executionEnabled}
                onChange={(e) => toggleExecution(e.target.checked)}
                className="accent-green-500"
              />
            </label>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">Pair Selection</h2>
            <p className="text-[11px] text-zinc-500">Pair list source: TESTNET futures exchangeInfo. Data stream: MAINNET metrics.</p>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            >
              <span>{isLoadingPairs ? 'Loading testnet pairs...' : selectedPair}</span>
              <span>▾</span>
            </button>
            {isDropdownOpen && !isLoadingPairs && (
              <div className="border border-zinc-800 rounded bg-zinc-950 p-2 space-y-2">
                <input
                  type="text"
                  placeholder="Search pair"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                />
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredPairs.map((pair) => (
                    <button
                      key={pair}
                      onClick={() => {
                        setSelectedPair(pair);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-xs ${pair === selectedPair ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-zinc-800 text-zinc-400'}`}
                    >
                      {pair}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">Risk & Capital</h2>
            <label className="text-xs text-zinc-400 block">Initial Balance (USDT)</label>
            <input type="number" value={initialBalanceUsdt} onChange={(e) => setInitialBalanceUsdt(Number(e.target.value || 0))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm" />
            <label className="text-xs text-zinc-400 block">Wallet Usage (%)</label>
            <input type="number" min={0} max={100} value={walletUsagePercent} onChange={(e) => setWalletUsagePercent(Number(e.target.value || 0))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm" />
            <label className="text-xs text-zinc-400 block">Leverage (no hard cap, env MAX_LEVERAGE applies)</label>
            <input type="number" min={1} value={leverage} onChange={(e) => setLeverage(Number(e.target.value || 1))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm" />
            <button onClick={saveSettings} className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-xs font-semibold">Apply Settings</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">Wallet & PnL (Testnet Execution Events)</h2>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-zinc-500">Total Wallet</div><div className="text-right font-mono">{formatNum(executionStatus.wallet.totalWalletUsdt)} USDT</div>
              <div className="text-zinc-500">Available</div><div className="text-right font-mono">{formatNum(executionStatus.wallet.availableBalanceUsdt)} USDT</div>
              <div className="text-zinc-500">Realized PnL</div><div className={`text-right font-mono ${executionStatus.wallet.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNum(executionStatus.wallet.realizedPnl)}</div>
              <div className="text-zinc-500">Unrealized PnL</div><div className={`text-right font-mono ${executionStatus.wallet.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNum(executionStatus.wallet.unrealizedPnl)}</div>
              <div className="text-zinc-500">Total PnL</div><div className={`text-right font-mono ${executionStatus.wallet.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNum(executionStatus.wallet.totalPnl)}</div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">Open Position</h2>
            {executionStatus.openPosition ? (
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-zinc-500">Side</div><div className="text-right font-mono">{executionStatus.openPosition.side}</div>
                <div className="text-zinc-500">Size</div><div className="text-right font-mono">{formatNum(executionStatus.openPosition.size, 6)}</div>
                <div className="text-zinc-500">Entry Price</div><div className="text-right font-mono">{formatNum(executionStatus.openPosition.entryPrice)}</div>
                <div className="text-zinc-500">Leverage</div><div className="text-right font-mono">{formatNum(executionStatus.openPosition.leverage, 1)}x</div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">No open position</div>
            )}
          </div>
        </div>

        <div className="md:hidden space-y-3 mb-4">
          {activeSymbols.map((symbol) => {
            const msg: MetricsMessage | undefined = marketData[symbol];
            if (!msg) return null;
            return <MobileSymbolCard key={symbol} symbol={symbol} metrics={msg} showLatency={false} />;
          })}
        </div>

        <div className="hidden md:block border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/80">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid gap-0 px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider bg-zinc-900/80 border-b border-zinc-700" style={{ gridTemplateColumns: '120px 100px 110px 90px 90px 100px 80px 90px' }}>
                <div>Symbol</div>
                <div className="text-right font-mono">Price</div>
                <div className="text-right font-mono">OI / Δ</div>
                <div className="text-center">OBI (W)</div>
                <div className="text-center">Δ Z-Score</div>
                <div className="text-center">CVD Slope</div>
                <div className="text-center">Signal</div>
                <div className="text-right">Status</div>
              </div>
              <div className="bg-black/20 divide-y divide-zinc-800/50">
                {activeSymbols.map((symbol) => {
                  const msg: MetricsMessage | undefined = marketData[symbol];
                  if (!msg) return null;
                  return <SymbolRow key={symbol} symbol={symbol} data={msg} showLatency={false} />;
                })}
                {Object.keys(marketData).length === 0 && (
                  <div className="p-12 text-center text-zinc-500 animate-pulse">Connecting to MAINNET market data...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-600 text-center">Market data source is always MAINNET. Execution route is always TESTNET.</div>
      </div>
    </div>
  );
};

export default Dashboard;
