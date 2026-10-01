import type { PnlFields, TradeRow } from "./types";

/**
 * Чистые функции для расчётов по сделкам.
 * Не имеют side-effects, легко тестируются.
 */

/** Net P&L сделки = realized_pnl − fee + funding. */
export function tradeNetPnl(t: PnlFields): number {
  return t.realized_pnl - t.fee + t.funding;
}

/** Суммарный net P&L по списку сделок. */
export function calculateTotalNetPnl<T extends PnlFields>(trades: T[]): number {
  return trades.reduce((acc, t) => acc + tradeNetPnl(t), 0);
}

/** Win rate в процентах (0–100) по net P&L. */
export function calculateWinRate<T extends PnlFields>(trades: T[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => tradeNetPnl(t) > 0).length;
  return (wins / trades.length) * 100;
}

/** Признак закрытой сделки (для фильтров). */
export function isClosedTrade(t: Pick<TradeRow, "closed_at">): boolean {
  return t.closed_at != null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Форматирование
// ─────────────────────────────────────────────────────────────────────────────

const RU_LOCALE = "ru-RU";

/** Форматирование числа с разделителями тысяч и 2 знаками после запятой. */
export function fmt(n: number): string {
  return n.toLocaleString(RU_LOCALE, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

/** Форматирование P&L с ведущим "+" для положительных значений. */
export function fmtPnl(n: number): string {
  return (n >= 0 ? "+" : "") + fmt(n);
}

/** Форматирование даты ISO в "DD.MM.YY". Безопасно для null. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(RU_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
