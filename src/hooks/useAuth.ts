import { getCurrentUser, signInWithGoogle, signOut } from "@/services/auth";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async () => {
    try {
      const u = await signInWithGoogle();
      if (u) setUser(u);
    } catch (e) {
      console.error("Login error:", e);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
