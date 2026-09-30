import type { Trade } from "./types";

/**
 * Чистые функции для расчётов по сделкам.
 * Не имеют side-effects, легко тестируются.
 */

/** Net P&L сделки = realized_pnl − fee + funding. */
export function tradeNetPnl(t: Trade): number {
  return t.realized_pnl - t.fee + t.funding;
}

/** Фильтр сделок по выбранным биржам. */
export function filterTradesByExchanges(
  trades: Trade[],
  selected: Set<string>,
): Trade[] {
  return trades.filter((t) => selected.has(t.exchange));
}

export interface MonthStats {
  tradesCount: number;
  winCount: number;
  lossCount: number;
  neutralCount: number;
  /** Win rate в процентах (0–100). */
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  fee: number;
  funding: number;
}

/** Сводная статистика по сделкам за конкретный месяц ("YYYY-MM"). */
export function calculateMonthStats(trades: Trade[], month: string): MonthStats {
  const monthTrades = trades.filter(
    (t) => t.closed_at != null && t.closed_at.slice(0, 7) === month,
  );
  const netPnls = monthTrades.map(tradeNetPnl);

  // PnL > 0 — прибыль; PnL < 0 — убыток; PnL === 0 — нейтральная.
  const winCount = netPnls.filter((p) => p > 0).length;
  const lossCount = netPnls.filter((p) => p < 0).length;
  const neutralCount = netPnls.filter((p) => p === 0).length;
  const total = monthTrades.length;

  return {
    tradesCount: total,
    winCount,
    lossCount,
    neutralCount,
    winRate: total > 0 ? (winCount / total) * 100 : 0,
    netPnl: netPnls.reduce((a, b) => a + b, 0),
    grossProfit: netPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0),
    grossLoss: netPnls.filter((p) => p < 0).reduce((a, b) => a + b, 0),
    fee: monthTrades.reduce((acc, t) => acc + t.fee, 0),
    funding: monthTrades.reduce((acc, t) => acc + t.funding, 0),
  };
}

/** Win rate по всем сделкам в процентах (0–100). */
export function calculateAllTimeWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const netPnls = trades.map(tradeNetPnl);
  const winCount = netPnls.filter((p) => p > 0).length;
  return (winCount / netPnls.length) * 100;
}

/** Суммарный net P&L по всем сделкам. */
export function calculateTotalNetPnl(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + tradeNetPnl(t), 0);
}

export interface MonthGroup {
  month: string; // "YYYY-MM"
  netPnl: number;
  trades: number;
}

/** Группировка сделок по месяцам с сортировкой по возрастанию. */
export function groupTradesByMonth(trades: Trade[]): MonthGroup[] {
  const byMonth = new Map<string, { netPnl: number; trades: number }>();
  for (const t of trades) {
    if (t.closed_at == null) continue;
    const month = t.closed_at.slice(0, 7);
    const net = tradeNetPnl(t);
    const existing = byMonth.get(month) ?? { netPnl: 0, trades: 0 };
    existing.netPnl += net;
    existing.trades += 1;
    byMonth.set(month, existing);
  }
  return Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, netPnl: v.netPnl, trades: v.trades }))
    .sort((a, b) => a.month.localeCompare(b.month));
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
