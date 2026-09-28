export type Exchange =
  | "bybit"
  | "bitunix"
  | "binance"
  | "bitget"
  | "bingx"
  | "mexc"
  | "manual";

export interface Trade {
  id: string;
  user_id: string;
  exchange: Exchange;
  external_id: string;
  symbol: string;
  side: "long" | "short";
  qty: number | null;
  entry_price: number | null;
  close_price: number | null;
  realized_pnl: number;
  fee: number;
  funding: number;
  opened_at: string | null;
  closed_at: string;
  notes: string | null;
  raw: unknown;
}

export interface MonthlySummary {
  month: string;
  totalPnl: number;
  totalFee: number;
  totalFunding: number;
  netPnl: number;
  tradeCount: number;
  // Строка вида "87.5" (рассчитано через toFixed(1)) —
  // соответствует возвращаемому значению calculateMonthStats в trade-model.ts.
  winRate: string;
}

export interface BalanceSnapshot {
  id: string;
  type: "spot" | "futures";
  value_usd: number;
  snapshot_date: string;
  note: string | null;
  created_at: string;
}

export interface UserSettings {
  goal_usd: number | null;
  futures_start_usd: number;
}

export interface Connection {
  exchange: string;
  key_preview: string;
  created_at: string;
}

export const EXCHANGES = [
  "bybit",
  "bitunix",
  "binance",
  "bitget",
  "bingx",
  "mexc",
] as const;

export const EXCHANGE_LABELS: Record<string, string> = {
  bybit: "Bybit",
  bitunix: "Bitunix",
  binance: "Binance",
  bitget: "Bitget",
  bingx: "BingX",
  mexc: "MEXC",
  manual: "Manual",
};
