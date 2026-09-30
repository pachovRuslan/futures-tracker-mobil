/**
 * Доменные типы приложения Futures Tracker.
 *
 * Соответствуют схеме таблиц в Supabase:
 *   - public.trades
 *   - public.balance_snapshots
 *   - public.user_entitlements
 *   - public.connections (через REST API)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Exchanges
// ─────────────────────────────────────────────────────────────────────────────

/** Все поддерживаемые биржи + "manual" для сделок, заведённых вручную. */
export type Exchange =
  | "bybit"
  | "bitunix"
  | "binance"
  | "bitget"
  | "bingx"
  | "mexc"
  | "manual";

/** Биржи, которые можно подключить через API-ключи (без manual). */
export const EXCHANGES = [
  "bybit",
  "bitunix",
  "binance",
  "bitget",
  "bingx",
  "mexc",
] as const satisfies readonly Exchange[];

export type ApiExchange = (typeof EXCHANGES)[number];

/** Человекочитаемые названия бирж. */
export const EXCHANGE_LABELS: Record<Exchange, string> = {
  bybit: "Bybit",
  bitunix: "Bitunix",
  binance: "Binance",
  bitget: "Bitget",
  bingx: "BingX",
  mexc: "MEXC",
  manual: "Manual",
};

// ─────────────────────────────────────────────────────────────────────────────
// Trade
// ─────────────────────────────────────────────────────────────────────────────

export type TradeSide = "long" | "short";

export interface Trade {
  id: string;
  user_id: string;
  exchange: Exchange;
  external_id: string;
  symbol: string;
  side: TradeSide;
  qty: number | null;
  entry_price: number | null;
  close_price: number | null;
  realized_pnl: number;
  fee: number;
  funding: number;
  opened_at: string | null;
  /** closed_at может быть null для открытых позиций, несмотря на схему NOT NULL. */
  closed_at: string | null;
  notes: string | null;
  raw: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregates
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlySummary {
  month: string; // "YYYY-MM"
  totalPnl: number;
  totalFee: number;
  totalFunding: number;
  netPnl: number;
  tradeCount: number;
  winRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance snapshots
// ─────────────────────────────────────────────────────────────────────────────

export type BalanceType = "spot" | "futures";

export interface BalanceSnapshot {
  id: string;
  type: BalanceType;
  value_usd: number;
  snapshot_date: string; // "YYYY-MM-DD"
  note: string | null;
  created_at: string; // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// User settings
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSettings {
  goal_usd: number | null;
  futures_start_usd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exchange connections (через REST API)
// ─────────────────────────────────────────────────────────────────────────────

export interface Connection {
  exchange: ApiExchange;
  key_preview: string;
  created_at: string; // ISO timestamp
}

export interface CreateConnectionPayload {
  exchange: ApiExchange;
  apiKey: string;
  apiSecret: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium / entitlement
// ─────────────────────────────────────────────────────────────────────────────

export type EntitlementSource = "allowlist" | "manual" | "none";

export interface Entitlement {
  isPremium: boolean;
  isAllowlisted: boolean;
  expiresAt: Date | null;
  note: string | null;
  source: EntitlementSource;
}
