import type { PnlFields } from "./types";

/**
 * Чистые функции для расчётов по сделкам.
 * Не имеют side-effects, легко тестируются.
 */

/** Net P&L сделки = realized_pnl − fee + funding. */
export function tradeNetPnl(t: PnlFields): number {
  return t.realized_pnl - t.fee + t.funding;
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
