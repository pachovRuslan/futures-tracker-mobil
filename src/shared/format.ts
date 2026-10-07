import { EXCHANGE_LABELS } from "./types";

/** Русская плюрализация: 1 сделка / 2 сделки / 5 сделок. */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Безопасная метка биржи для строковых ключей (фильтр-чипы, подписи). */
export function exchangeLabel(ex: string): string {
  return (EXCHANGE_LABELS as Record<string, string>)[ex] ?? ex;
}
