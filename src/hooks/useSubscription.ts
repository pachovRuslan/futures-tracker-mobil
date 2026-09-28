import { useAuth } from "@/hooks/useAuth";
import { checkPremiumStatus, type Entitlement } from "@/services/entitlements";
import { useCallback, useEffect, useState } from "react";

export function useSubscription() {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
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

  // Перезапускать при смене пользователя
  useEffect(() => {
    if (user?.id) {
      console.log("[useSubscription] user changed, refreshing:", user.id);
      refresh();
    } else {
      setEntitlement(null);
      setLoading(false);
    }
  }, [user?.id, refresh]);

  return {
    isPremium: entitlement?.isPremium ?? false,
    entitlement,
    loading,
    refresh,
  };
}
