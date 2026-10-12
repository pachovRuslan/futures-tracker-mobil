import { getSupabase } from "@/services/auth";
import type { Entitlement } from "@/shared/types";

const EMPTY: Entitlement = {
  isPremium: false,
  isAllowlisted: false,
  expiresAt: null,
  note: null,
  source: "none",
};

/**
 * Получение entitlement пользователя из БД через Supabase RPC.
 *
 * RPC get_my_entitlement() (docs/supabase.sql §3c) объявлен как
 * SECURITY DEFINER, LEFT JOIN-ит auth.users и возвращает ровно одну
 * строку для текущего auth.uid() — включая юзеров без записи в
 * user_entitlements.
 *
 * Ключевое поле — is_effective_premium: сервер вычисляет его той же
 * функцией ft_is_effective_premium(), что использует сайт:
 *   is_premium (не истёк) — ТОЛЬКО подписка или ручная выдача.
 * Allowlist премиумом НЕ считается: он даёт вход на сайт и освобождение
 * от FREE-лимита 50 сделок, но не премиум-статус в приложении.
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const supabase = getSupabase();

    // getSession() читает сессию из локального хранилища (SecureStore)
    // без сети — useSubscription монтируется на каждом экране, и сетевой
    // getUser() добавил бы лишний RTT. Подлинность токена проверяет RLS
    // при самом RPC-запросе.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return EMPTY;

    const { data, error } = await supabase.rpc("get_my_entitlement");

    if (error || !data) return EMPTY;

    // RPC RETURNS TABLE — supabase-js всегда возвращает массив.
    // Берём первую (и единственную) строку для текущего auth.uid().
    const row = data[0] ?? null;
    if (!row) return EMPTY;

    const isExpired =
      row.expires_at && new Date(row.expires_at).getTime() < Date.now();

    // «Эффективный премиум» от сервера (поле is_effective_premium в RPC).
    // Fallback: если поле отсутствует (старая БД без миграции) — считаем
    // сами по is_premium и сроку.
    const isPremium =
      typeof row.is_effective_premium === "boolean"
        ? row.is_effective_premium
        : Boolean(row.is_premium) && !isExpired;

    // Источник статуса:
    //   подписка RC      -> granted_by = 'revenuecat:<store>' -> app_store / play_store;
    //   премиум без RC   -> ручная выдача -> manual (даже если юзер заодно
    //                       в allowlist — is_allowlisted источник премиума
    //                       больше не является);
    //   FREE + приглашён -> allowlist (для бейджа значения не имеет);
    //   FREE, открытая регистрация -> none.
    const grantedBy = typeof row.granted_by === "string" ? row.granted_by : "";
    let source: Entitlement["source"] = "none";
    if (grantedBy.startsWith("revenuecat:")) {
      source = grantedBy.includes("app_store") ? "app_store" : "play_store";
    } else if (isPremium) {
      source = "manual";
    } else if (row.is_allowlisted) {
      source = "allowlist";
    }

    return {
      isPremium,
      isAllowlisted: Boolean(row.is_allowlisted),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      note: row.note ?? null,
      source,
    };
  } catch (e) {
    if (__DEV__) console.error("[Entitlements] fetchEntitlement error:", e);
    return EMPTY;
  }
}

/**
 * Проверка premium-статуса с кэшем (TTL 60 секунд).
 *
 * Статус премиума меняется редко (выдаётся вручную), а useSubscription
 * монтируется на каждом экране — без кэша каждый переход по табам
 * выполнял RPC-запрос заново. 60 секунд максимума устаревания
 * self-healing: следующая навигация через минуту всё увидит.
 *
 * force=true — обход кэша (для явного refresh после покупки/выдачи).
 */
const ENTITLEMENT_CACHE_TTL_MS = 60_000;
let entitlementCache: { at: number; value: Entitlement } | null = null;

export async function checkPremiumStatus(
  force = false,
): Promise<Entitlement> {
  if (
    !force &&
    entitlementCache &&
    Date.now() - entitlementCache.at < ENTITLEMENT_CACHE_TTL_MS
  ) {
    return entitlementCache.value;
  }
  const value = await fetchEntitlement();
  entitlementCache = { at: Date.now(), value };
  return value;
}
