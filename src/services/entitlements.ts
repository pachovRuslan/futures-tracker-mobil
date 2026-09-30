import { supabase } from "@/services/auth";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return EMPTY;

    const { data, error } = await supabase.rpc("get_my_entitlement");

    if (error || !data) return EMPTY;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return EMPTY;

    const isExpired =
      row.expires_at && new Date(row.expires_at).getTime() < Date.now();

    return {
      isPremium: Boolean(row.is_premium) && !isExpired,
      isAllowlisted: Boolean(row.is_allowlisted),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      note: row.note ?? null,
      source: row.is_allowlisted ? "allowlist" : "manual",
    };
  } catch (e) {
    if (__DEV__) console.error("[Entitlements] fetchEntitlement error:", e);
    return EMPTY;
  }
}

/**
 * Проверка premium-статуса. Единственный источник правды — БД Supabase.
 *
 * Раньше здесь был также вызов refreshSubscriptionState() из subscriptions.ts
 * (RevenueCat stub), который всегда возвращал false. Убран за ненадобностью.
 */
export async function checkPremiumStatus(): Promise<Entitlement> {
  return fetchEntitlement();
}
