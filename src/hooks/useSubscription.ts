import { useAuth } from "@/context/AuthContext";
import { checkPremiumStatus } from "@/services/entitlements";
import type { Entitlement } from "@/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useSubscription — статус Premium-подписки.
 *
 * Подписывается на изменения user через useAuth() (контекст) и обновляет
 * entitlement при смене пользователя.
 */

export interface UseSubscriptionResult {
  isPremium: boolean;
  entitlement: Entitlement | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const status = await checkPremiumStatus();
      // Защита от race: обновляем state только если это последний запрос.
      if (mountedRef.current && requestId === requestIdRef.current) {
        if (__DEV__) {
          console.log("[useSubscription] status:", {
            isPremium: status.isPremium,
            source: status.source,
          });
        }
        setEntitlement(status);
      }
    } catch (e) {
      if (__DEV__) console.error("[useSubscription] refresh error:", e);
      if (mountedRef.current && requestId === requestIdRef.current) {
        setEntitlement(null);
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
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
