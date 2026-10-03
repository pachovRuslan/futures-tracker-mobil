import { Platform } from "react-native";

/**
 * Конфигурация приложения из env-переменных.
 *
 * Expo автоматически подставляет `EXPO_PUBLIC_*` переменные на этапе сборки
 * через babel-preset-expo. Локально — из `.env`, в EAS Build — из secrets.
 *
 * ⚠️ Переменные встраиваются в бандл В МОМЕНТ СБОРКИ. Если поменяли .env —
 * перезапустите `expo start` с `--clear`, иначе останутся старые значения.
 */

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://futures-tracker-lake.vercel.app";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase сконфигурирован (URL и anon key непустые). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Лимит сделок для FREE-пользователей. Должен совпадать с серверным. */
export const FREE_TRADE_LIMIT = 50;

/** Дефолтный лимит сделок в одном запросе. */
export const TRADES_PAGE_SIZE = 500;

/**
 * Функция «Подключения бирж» (авто-синк сделок по API-ключам).
 *
 * Kill-switch всей фичи: пока флаг выключен, кнопка «Биржа» на дашборде,
 * пункт «Подключения бирж» в настройках и сам экран /connections скрыты
 * (deep link уводит на дашборд).
 *
 * Бэкенд: /api/connections на сайте теперь принимает Bearer-JWT от
 * мобильного приложения (коммит «Bearer-JWT auth for mobile API bridge»).
 * Выключить фичу на случай проблем — поставить false и пересобрать.
 */
export const EXCHANGE_CONNECTIONS_ENABLED = true;

if (__DEV__ && !isSupabaseConfigured) {
  const env = Platform.OS === "web" ? "browser" : Platform.OS;
  console.warn(
    `[config] SUPABASE_URL или SUPABASE_ANON_KEY не заданы для окружения "${env}". ` +
      "Создайте .env (см. README.md) и перезапустите expo start --clear. " +
      "Приложение покажет экран ошибки конфигурации.",
  );
}
