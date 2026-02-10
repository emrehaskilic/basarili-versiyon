import { ExecutionEvent } from '../connectors/executionTypes';

export interface OrchestratorMetricsInput {
  symbol: string;
  canonical_time_ms?: number;
  exchange_event_time_ms?: number | null;
  spread_pct?: number | null;
  prints_per_second?: number | null;
  best_bid?: number | null;
  best_ask?: number | null;
  legacyMetrics?: {
    obiDeep?: number | null;
    deltaZ?: number | null;
    cvdSlope?: number | null;
  } | null;
}

export interface MetricsEventEnvelope {
  kind: 'metrics';
  symbol: string;
  canonical_time_ms: number;
  exchange_event_time_ms: number | null;
  metrics: OrchestratorMetricsInput;
}

export interface ExecutionEventEnvelope {
  kind: 'execution';
  symbol: string;
  event_time_ms: number;
  execution: ExecutionEvent;
}

export type ActorEnvelope = MetricsEventEnvelope | ExecutionEventEnvelope;

export interface SymbolState {
  symbol: string;
  availableBalance: number;
  walletBalance: number;
}

export interface OrchestratorConfig {
  maxLeverage: number;
  loggerQueueLimit: number;
  loggerDropHaltThreshold: number;
}

