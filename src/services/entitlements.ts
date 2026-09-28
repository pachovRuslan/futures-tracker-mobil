import { supabase } from "@/services/auth";
import {
  isPremiumUser as rcIsPremium,
  refreshSubscriptionState,
} from "@/services/subscriptions";

export interface Entitlement {
  isPremium: boolean;
  isAllowlisted: boolean;
  expiresAt: Date | null;
  note: string | null;
  source: "allowlist" | "manual" | "revenuecat" | "none";
}

const EMPTY: Entitlement = {
  isPremium: false,
  isAllowlisted: false,
  expiresAt: null,
  note: null,
  source: "none",
};

export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[Entitlements] user:", user?.id, user?.email);

    if (!user) return EMPTY;

    const { data, error } = await supabase.rpc("get_my_entitlement");

    console.log("[Entitlements] RPC:", {
      data,
      error: error ? { message: error.message, code: error.code } : null,
    });

    if (error || !data) return EMPTY;

    // RPC может вернуть пустой массив (если для пользователя нет записи).
    // Раньше row = data[0] = undefined, и row.expires_at падал с TypeError →
    // catch возвращал EMPTY (FREE). Теперь обрабатываем явно.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.log("[Entitlements] нет записи entitlement для пользователя");
      return EMPTY;
    }

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
    console.error("[Entitlements] exception:", e);
    return EMPTY;
  }
}

export async function checkPremiumStatus(): Promise<Entitlement> {
  const [dbEntitlement] = await Promise.all([
    fetchEntitlement(),
    refreshSubscriptionState().catch(() => null),
  ]);

  const isPremium = dbEntitlement.isPremium || rcIsPremium();

  return {
    ...dbEntitlement,
    isPremium,
    source: isPremium
      ? dbEntitlement.isPremium
        ? dbEntitlement.source
        : "revenuecat"
      : "none",
  };
}

export async function isPremium(): Promise<boolean> {
  return (await checkPremiumStatus()).isPremium;
}
