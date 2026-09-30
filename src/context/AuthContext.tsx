import { supabase } from "@/services/auth";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * AuthContext — единственный источник правды о пользователе в приложении.
 *
 * Раньше useAuth() был обычным hook'ом с внутренним state — каждый компонент
 * создавал свой экземпляр и подписку на supabase.auth.onAuthStateChange.
 * Это приводило к race conditions: 5 параллельных подписок, 5 вызовов
 * getCurrentUser() при mount, рассинхронизация user state.
 *
 * Теперь AuthProvider монтируется один раз в app/_layout.tsx и раздаёт
 * user/loading/login/logout через useContext.
 */

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Первичная загрузка сессии.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mountedRef.current) return;
        setUser(session?.user ?? null);
      })
      .catch((e) => {
        if (__DEV__) console.warn("[AuthProvider] getSession failed:", e);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    // Единая подписка на изменения auth state.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        if (__DEV__) {
          console.log("[AuthProvider] event:", event, "email:", session?.user?.email);
        }
        setUser(session?.user ?? null);
      },
    );

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (mountedRef.current) setUser(data.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      // login/logout импортируются лениво, чтобы избежать циклической зависимости.
      login: async () => {
        const { signInWithGoogle } = await import("@/services/auth");
        await signInWithGoogle();
        // Сессия установится через onAuthStateChange SIGNED_IN.
      },
      logout: async () => {
        const { signOut } = await import("@/services/auth");
        await signOut();
        if (mountedRef.current) setUser(null);
      },
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
