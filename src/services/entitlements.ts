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
 * RPC get_my_entitlement() объявлен как SECURITY DEFINER и возвращает
 * запись из public.user_entitlements для текущего auth.uid().
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const supabase = getSupabase();

    // ⚠️ История оптимизации: раньше здесь стоял getUser() — это СЕТЕВОЙ
    // запрос валидации JWT на сервере Supabase (~1 RTT). useSubscription
    // монтируется на КАЖДОМ экране (дашборд, настройки, пейволл,
    // подключения) — на каждом экране статус премиума задерживался на
    // 2 последовательных RTT (getUser → RPC). getSession() читает сессию
    // из локального хранилища (SecureStore) без сети: подлинность токена
    // всё равно проверяет RLS при самом RPC-запросе.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return EMPTY;

    const { data, error } = await supabase.rpc("get_my_entitlement");

    if (error || !data) return EMPTY;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return EMPTY;

    const isExpired =
      row.expires_at && new Date(row.expires_at).getTime() < Date.now();

    // Источник премиума: покупки пишут granted_by = 'revenuecat:<store>',
    // ручные выдачи — что-то другое (или пусто). От этого зависит, куда
    // пейволл отправит управлять подпиской.
    const grantedBy = typeof row.granted_by === "string" ? row.granted_by : "";
    let source: Entitlement["source"] = "manual";
    if (grantedBy.startsWith("revenuecat:")) {
      source = grantedBy.includes("app_store") ? "app_store" : "play_store";
    } else if (row.is_allowlisted) {
      source = "allowlist";
    }

    return {
      isPremium: Boolean(row.is_premium) && !isExpired,
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
