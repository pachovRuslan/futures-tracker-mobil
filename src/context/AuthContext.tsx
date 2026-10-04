import {
  signInWithApple,
  signInWithGoogle,
  getSupabase,
  signOut,
} from "@/services/auth";
import { initPurchases, resetPurchases } from "@/services/purchases";
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
 * AuthProvider монтируется один раз в app/_layout.tsx и раздаёт
 * user/loading/login/logout через useContext.
 */

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginApple: () => Promise<void>;
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
    const supabase = getSupabase();

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
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (__DEV__) {
        console.log(
          "[AuthProvider] event:",
          event,
          "email:",
          session?.user?.email,
        );
      }
      setUser(session?.user ?? null);
    });

    return () => {
      mountedRef.current = false;
      authListener.unsubscribe();
    };
  }, []);

  // RevenueCat: привязываем покупки к аккаунту. logIn(userId) делает
  // app_user_id RC равным supabase user id — именно по нему сервер
  // сверяет подписку в /api/billing/sync-entitlement. При выходе — logOut.
  useEffect(() => {
    if (user?.id) {
      void initPurchases(user.id);
    } else {
      void resetPurchases();
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    const { data } = await getSupabase().auth.getUser();
    if (mountedRef.current) setUser(data.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      login: async () => {
        await signInWithGoogle();
        // Сессия установится через onAuthStateChange SIGNED_IN
        // (или уже установлена обменом кода внутри signInWithGoogle).
      },
      loginApple: async () => {
        await signInWithApple();
        // Сессию устанавливает signInWithIdToken — onAuthStateChange
        // SIGNED_IN обновит user и RootNavigator сделает redirect.
      },
      logout: async () => {
        await signOut();
        if (mountedRef.current) setUser(null);
      },
    }),
    [user, loading, refresh],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
