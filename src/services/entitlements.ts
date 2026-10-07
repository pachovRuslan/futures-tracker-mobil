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
 * RPC get_my_entitlement() (миграция 12) объявлен как SECURITY DEFINER,
 * LEFT JOIN-ит auth.users и возвращает ровно одну строку для текущего
 * auth.uid() — включая юзеров без записи в user_entitlements.
 *
 * Ключевое поле — is_effective_premium: сервер вычисляет его той же
 * функцией ft_is_effective_premium(), что использует сайт:
 *   is_premium (не истёк) OR is_allowlisted OR email в allowed_emails.
 * Единая правда для обеих платформ — до этого клиент считал только
 * is_premium, и allowlist-юзеры сайта видели в приложении пейволл.
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

    // «Эффективный премиум» от сервера (миграция 12). Fallback — старая
    // форма ответа (до миграции поле отсутствует → undefined): считаем
    // сами по is_premium и сроку. Порядок деплоя SQL/клиента не важен.
    const isPremium =
      typeof row.is_effective_premium === "boolean"
        ? row.is_effective_premium
        : Boolean(row.is_premium) && !isExpired;

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
