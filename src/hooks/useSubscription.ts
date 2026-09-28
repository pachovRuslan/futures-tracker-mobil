import { supabase } from "@/services/auth";
import { checkPremiumStatus, type Entitlement } from "@/services/entitlements";
import { useCallback, useEffect, useState } from "react";

/**
 * useSubscription — подписка на статус премиума.
 *
 * ВАЖНО: мы НЕ используем useAuth() здесь, потому что useAuth — это hook
 * с внутренним state. Каждый компонент, вызывающий useAuth(), получает
 * свой собственный state, и обновления в одном экземпляре не видны другому.
 *
 * Вместо этого мы напрямую подписываемся на supabase.auth.onAuthStateChange
 * и получаем userId из сессии. Это даёт единый источник истины.
 */
export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  // Подписка на изменения auth state напрямую через supabase
  useEffect(() => {
    let mounted = true;

    // Получаем текущую сессию при монтировании
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        const id = session?.user?.id ?? null;
        console.log("[useSubscription] initial session, user?.id:", id ?? "null");
        setUserId(id);
        if (!id) setLoading(false);
      }
    });

    // Подписываемся на все изменения auth state
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        const id = session?.user?.id ?? null;
        console.log(
          "[useSubscription] auth event:",
          event,
          "user?.id:",
          id ?? "null",
        );
        setUserId(id);
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[useSubscription] refresh() started, calling checkPremiumStatus...");
      const status = await checkPremiumStatus();
      console.log("[useSubscription] status:", {
        isPremium: status.isPremium,
        source: status.source,
        note: status.note,
      });
      setEntitlement(status);
    } catch (e) {
      console.error("[useSubscription] refresh error:", e);
      setEntitlement(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Перезапускать при смене userId
  useEffect(() => {
    console.log("[useSubscription] effect fired, userId:", userId ?? "null");
    if (userId) {
      console.log("[useSubscription] user changed, refreshing:", userId);
      refresh();
    } else {
      setEntitlement(null);
      setLoading(false);
    }
  }, [userId, refresh]);

  return {
    isPremium: entitlement?.isPremium ?? false,
    entitlement,
    loading,
    refresh,
  };
}
