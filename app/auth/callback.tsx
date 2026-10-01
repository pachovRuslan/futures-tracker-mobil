import {
  exchangeCodeOnce,
  getSupabase,
  parseOAuthParams,
} from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Экран /auth/callback — точка возврата из OAuth-браузера.
 *
 * Обрабатывает redirect двумя путями:
 *  1. Cold start: приложение было закрыто и открыто deep link'ом —
 *     URL доступен через Linking.getInitialURL().
 *  2. Warm start: приложение уже запущено — URL приходит событием
 *     Linking.addEventListener("url").
 *
 * ВАЖНО: обмен кода выполняется через exchangeCodeOnce (не
 * exchangeCodeForSession напрямую), потому что в Expo Go этот redirect
 * параллельно обрабатывает и signInWithGoogle (обещание
 * openAuthSessionAsync). PKCE-код одноразовый — без дедупликации
 * второй обмен падает с 400 и ломает вход (см. REFACTORING.md, баг №3).
 */
export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;
    let linkingSub: { remove: () => void } | null = null;

    const redirect = (path: "/" | "/login") => {
      if (isHandled.current) return;
      isHandled.current = true;
      unsub?.unsubscribe();
      linkingSub?.remove();
      setTimeout(() => router.replace(path), 100);
    };

    const handleCode = async (code: string) => {
      try {
        const user = await exchangeCodeOnce(code);
        redirect(user ? "/" : "/login");
      } catch (e) {
        if (__DEV__) console.error("[Callback] exchangeCode error:", e);
        redirect("/login");
      }
    };

    const processUrl = (url: string | null): boolean => {
      if (!url || isHandled.current) return false;
      if (__DEV__) console.log("[Callback] processing URL:", url.slice(0, 120));

      const params = parseOAuthParams(url);

      if (params.code) {
        handleCode(params.code);
        return true;
      }
      if (params.error) {
        if (__DEV__) {
          console.error(
            "[Callback] OAuth error:",
            params.error,
            params.error_description,
          );
        }
        redirect("/login");
        return true;
      }
      return false;
    };

    // 1. Сначала проверяем существующую сессию — её мог установить
    //    параллельный обработчик (signInWithGoogle в Expo Go).
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (isHandled.current) return;
        if (session?.user) {
          redirect("/");
          return;
        }

        // 2. Cold start: приложение открыто deep link'ом.
        Linking.getInitialURL().then((url) => {
          processUrl(url);
        });
      });

    // 3. Warm start: приложение уже запущено.
    linkingSub = Linking.addEventListener("url", ({ url }) => {
      processUrl(url);
    });

    // 4. Fallback через onAuthStateChange.
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        redirect("/");
      } else if (event === "SIGNED_OUT") {
        redirect("/login");
      }
    });
    unsub = data.subscription;

    // 5. Timeout fallback.
    const timer = setTimeout(async () => {
      if (isHandled.current) return;
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      redirect(session ? "/" : "/login");
    }, 5000);

    return () => {
      clearTimeout(timer);
      unsub?.unsubscribe();
      linkingSub?.remove();
    };
  }, [router]);

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
