import { getSubscriptionStatus } from "@/services/subscriptions";
import { useCallback, useEffect, useState } from "react";

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    const status = await getSubscriptionStatus();
    setIsPremium(status);
    setLoading(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { isPremium, loading, check };
}
