import { exchangeCodeForSession, supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * OAuth callback screen.
 *
 * Expo Router парсит URL futurestracker://auth/callback?code=XXX и делает
 * параметры доступными через useLocalSearchParams(). Здесь мы обмениваем
 * код на сессию через supabase.auth.exchangeCodeForSession().
 *
 * ВАЖНО: обмен кода происходит ТОЛЬКО здесь, а не в signInWithGoogle()
 * (которая только открывает браузер). Это устраняет race condition, когда
 * два обработчика параллельно пытались обменять один и тот же код (PKCE
 * код одноразовый — второй вызов падал с invalid_grant).
 */
export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    const redirect = (path: "/" | "/login") => {
      if (isHandled.current) return;
      isHandled.current = true;
      unsub?.unsubscribe();
      // Небольшая задержка, чтобы успел смонтироваться AuthProvider.
      setTimeout(() => router.replace(path), 100);
    };

    // 1. Обработка error в query (Google отменил авторизацию).
    if (params.error) {
      if (__DEV__) console.warn("[Callback] OAuth error:", params.error);
      redirect("/login");
      return;
    }

    // 2. Обработка code — основной путь.
    if (params.code) {
      exchangeCodeForSession(params.code)
        .then((user) => {
          if (user) {
            if (__DEV__) console.log("[Callback] session established:", user.email);
            redirect("/");
          } else {
            if (__DEV__) console.warn("[Callback] no user after exchange");
            redirect("/login");
          }
        })
        .catch((e) => {
          if (__DEV__) console.error("[Callback] exchangeCode error:", e);
          redirect("/login");
        });
    } else if (__DEV__) {
      console.log("[Callback] no code in params, waiting for auth event...");
    }

    // 3. Fallback через onAuthStateChange (если Supabase сам установит сессию).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        redirect("/");
      } else if (event === "SIGNED_OUT") {
        redirect("/login");
      }
    });
    unsub = data.subscription;

    // 4. Timeout fallback на 5 секунд.
    const timer = setTimeout(async () => {
      if (isHandled.current) return;
      const { data: sd } = await supabase.auth.getSession();
      redirect(sd.session ? "/" : "/login");
    }, 5000);

    return () => {
      clearTimeout(timer);
      unsub?.unsubscribe();
    };
  }, [router, params.code, params.error]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>Вход в систему...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  text: {
    color: colors.textMuted,
    marginTop: 16,
  },
});
