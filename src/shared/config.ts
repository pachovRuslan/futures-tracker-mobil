export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://futures-tracker-lake.vercel.app";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

// Раннее обнаружение невалидной конфигурации —
// иначе Supabase-клиент создаётся с пустым URL и падает
// с непонятной ошибкой при первом же запросе.
function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // На вебе в dev-режиме это нормально (например, storybook),
    // но в нативной сборке должно быть настроено.
    if (typeof window === "undefined") {
      // SSR / Node — молча пропускаем.
      return;
    }
    console.warn(
      "[config] SUPABASE_URL / SUPABASE_ANON_KEY не заданы. " +
        "Проверьте .env: EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
        "Аутентификация и доступ к данным не будут работать.",
    );
  }
}

assertSupabaseConfig();
