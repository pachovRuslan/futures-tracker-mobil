import {
  getCurrentUser,
  signInWithGoogle,
  signOut,
  supabase,
} from "@/services/auth";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[useAuth] event:", event, "email:", session?.user?.email);
        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      },
    );

    return () => authListener.subscription.unsubscribe();
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
