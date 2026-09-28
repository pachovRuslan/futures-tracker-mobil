import type { Trade } from "./types";

export function tradeNetPnl(t: Trade): number {
  return t.realized_pnl - t.fee + t.funding;
}

export function filterTradesByExchanges(
  trades: Trade[],
  selected: Set<string>,
): Trade[] {
  return trades.filter((t) => selected.has(t.exchange));
}

export function calculateMonthStats(trades: Trade[], month: string) {
  const monthTrades = trades.filter((t) => t.closed_at.slice(0, 7) === month);
  const netPnls = monthTrades.map(tradeNetPnl);
  // PnL > 0 — прибыль; PnL < 0 — убыток; PnL === 0 — ни то, ни другое
  // (в нейтральные сделки не включаем ни в winCount, ни в lossCount).
  const winCount = netPnls.filter((p) => p > 0).length;
  const lossCount = netPnls.filter((p) => p < 0).length;
  const neutralCount = netPnls.filter((p) => p === 0).length;
  const total = monthTrades.length;
  return {
    tradesCount: total,
    winCount,
    lossCount,
    neutralCount,
    winRate: total > 0 ? ((winCount / total) * 100).toFixed(1) : "0",
    netPnl: netPnls.reduce((a, b) => a + b, 0),
    grossProfit: netPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0),
    grossLoss: netPnls.filter((p) => p < 0).reduce((a, b) => a + b, 0),
    fee: monthTrades.reduce((acc, t) => acc + t.fee, 0),
    funding: monthTrades.reduce((acc, t) => acc + t.funding, 0),
  };
}

export function calculateAllTimeWinRate(trades: Trade[]): string {
  if (trades.length === 0) return "0";
  const netPnls = trades.map(tradeNetPnl);
  const winCount = netPnls.filter((p) => p > 0).length;
  return ((winCount / netPnls.length) * 100).toFixed(1);
}

export function calculateTotalNetPnl(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + tradeNetPnl(t), 0);
}

export function groupTradesByMonth(trades: Trade[]) {
  const byMonth = new Map<string, { netPnl: number; trades: number }>();
  for (const t of trades) {
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

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function fmtPnl(n: number): string {
  return (
    (n >= 0 ? "+" : "") +
    n.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
  );
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
