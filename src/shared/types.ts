/**
 * Доменные типы приложения Futures Tracker.
 *
 * Соответствуют схеме таблиц в Supabase (docs/supabase.sql):
 *   - public.trades
 *   - public.balance_snapshots
 *   - public.user_entitlements
 *   - public.connections (через REST API бэкенда)
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
  /** NULL — позиция ещё открыта (схема БД допускает NULL). */
  closed_at: string | null;
  notes: string | null;
  raw: unknown;
}

/**
 * Строка сделки, которую реально читают экраны приложения.
 * В отличие от Trade, не тянет тяжёлый JSONB `raw` из БД.
 */
export type TradeRow = Pick<
  Trade,
  | "id"
  | "exchange"
  | "symbol"
  | "side"
  | "qty"
  | "entry_price"
  | "close_price"
  | "realized_pnl"
  | "fee"
  | "funding"
  | "opened_at"
  | "closed_at"
  | "notes"
>;

/** Поля, необходимые для расчёта net P&L. */
export type PnlFields = Pick<Trade, "realized_pnl" | "fee" | "funding">;

/** Payload ручной вставки сделки напрямую в Supabase (RLS: user_id = auth.uid()). */
export interface TradeInsert {
  user_id: string;
  exchange: "manual";
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
  closed_at: string | null;
  notes: string | null;
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
// Exchange connections (через REST API бэкенда)
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

export interface ConnectionsResponse {
  connections: Connection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium / entitlement
// ─────────────────────────────────────────────────────────────────────────────

export type EntitlementSource =
  | "allowlist"
  | "manual"
  | "app_store"
  | "play_store"
  | "none";

export interface Entitlement {
  isPremium: boolean;
  isAllowlisted: boolean;
  expiresAt: Date | null;
  note: string | null;
  source: EntitlementSource;
}
