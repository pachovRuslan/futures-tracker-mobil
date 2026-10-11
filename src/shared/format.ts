import { EXCHANGE_LABELS } from "./types";

/**
 * Плюрализация с 2026-10 (i18n) живёт в src/i18n — plural(n, { ru: [one,
 * few, many], en: [one, other] }) — читает текущий язык модуля. Здесь
 * осталась только безопасная метка биржи.
 */

/** Безопасная метка биржи для строковых ключей (фильтр-чипы, подписи). */
export function exchangeLabel(ex: string): string {
  return (EXCHANGE_LABELS as Record<string, string>)[ex] ?? ex;
}
