import { Platform } from "react-native";

/**
 * Конфигурация приложения из env-переменных.
 *
 * Expo автоматически подставляет `EXPO_PUBLIC_*` переменные на этапе сборки
 * через babel-preset-expo. Локально — из `.env`, в EAS Build — из secrets.
 */

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://futures-tracker-lake.vercel.app";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Лимит сделок для FREE-пользователей. Должен совпадать с серверным. */
export const FREE_TRADE_LIMIT = 50;

/** Дефолтный лимит сделок в одном запросе. */
export const TRADES_PAGE_SIZE = 500;

/**
 * Раннее обнаружение невалидной конфигурации Supabase.
 * На native платформах пустой URL приведёт к непонятной ошибке в runtime —
 * лучше упасть сразу с понятным сообщением в dev-режиме.
 */
if (__DEV__ && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  const env = Platform.OS === "web" ? "browser" : Platform.OS;
  console.warn(
    `[config] SUPABASE_URL или SUPABASE_ANON_KEY не заданы для окружения "${env}". ` +
      "Проверьте .env (локально) или EAS Secrets (для сборки). " +
      "Аутентификация и доступ к данным не будут работать.",
  );
}
