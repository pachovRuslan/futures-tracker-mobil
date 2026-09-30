import { exchangeCodeForSession, supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * OAuth callback screen.
 *
 * **Standalone APK**: Expo Router парсит URL futurestracker://auth/callback?code=XXX
 * и делает параметры доступными через useLocalSearchParams(). Здесь мы обмениваем
 * код на сессию через supabase.auth.exchangeCodeForSession().
 *
 * **Expo Go**: код обменивается в signInWithGoogle() через WebBrowser.openAuthSessionAsync.
 * Этот экран может смонтироваться как fallback, но сессия уже установлена —
 * поэтому СНАЧАЛА проверяем существующую сессию, чтобы избежать двойного обмена
 * (PKCE код одноразовый, второй вызов упадёт с invalid_grant).
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
      setTimeout(() => router.replace(path), 100);
    };

    // 0. СНАЧАЛА проверяем, есть ли уже сессия (Expo Go путь уже обменял код).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isHandled.current) return;
      if (session?.user) {
        if (__DEV__)
          console.log("[Callback] session already exists, redirecting");
        redirect("/");
        return;
      }

      // 1. Обработка error в query (Google отменил авторизацию).
      if (params.error) {
        if (__DEV__) console.warn("[Callback] OAuth error:", params.error);
        redirect("/login");
        return;
      }

      // 2. Обработка code — основной путь для standalone APK.
      if (params.code) {
        exchangeCodeForSession(params.code)
          .then((user) => {
            if (user) {
              if (__DEV__)
                console.log("[Callback] session established:", user.email);
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
    });

    // 3. Fallback через onAuthStateChange.
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
