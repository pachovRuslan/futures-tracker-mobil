import { exchangeCodeForSession, supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

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
        const user = await exchangeCodeForSession(code);
        if (user) {
          if (__DEV__)
            console.log("[Callback] session established:", user.email);
          redirect("/");
        } else {
          redirect("/login");
        }
      } catch (e) {
        if (__DEV__) console.error("[Callback] exchangeCode error:", e);
        redirect("/login");
      }
    };

    const processUrl = (url: string | null) => {
      if (!url) return false;
      if (__DEV__) console.log("[Callback] processing URL:", url.slice(0, 120));

      // Извлекаем code любым способом
      const match = url.match(/[?&]code=([^&#]+)/);
      if (match) {
        const code = decodeURIComponent(match[1]);
        if (__DEV__) console.log("[Callback] found code, exchanging...");
        handleCode(code);
        return true;
      }

      // Проверяем error
      const errorMatch = url.match(/[?&]error=([^&#]+)/);
      if (errorMatch) {
        if (__DEV__) console.warn("[Callback] OAuth error:", errorMatch[1]);
        redirect("/login");
        return true;
      }

      return false;
    };

    // 1. Проверяем, есть ли уже сессия (Expo Go путь через WebBrowser.openAuthSessionAsync)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isHandled.current) return;
      if (session?.user) {
        if (__DEV__)
          console.log("[Callback] session already exists, redirecting");
        redirect("/");
        return;
      }

      // 2. Проверяем useLocalSearchParams (основной путь для standalone APK)
      if (params.code) {
        if (__DEV__) console.log("[Callback] code from params");
        handleCode(params.code);
        return;
      }

      // 3. Проверяем Linking.getInitialURL (когда приложение открылось через intent)
      Linking.getInitialURL().then((url) => {
        if (isHandled.current) return;
        if (!processUrl(url)) {
          if (__DEV__)
            console.log("[Callback] no code in initial URL, waiting...");
        }
      });
    });

    // 4. Слушаем новые URL (когда приложение уже запущено)
    linkingSub = Linking.addEventListener("url", ({ url }) => {
      if (isHandled.current) return;
      processUrl(url);
    });

    // 5. Fallback через onAuthStateChange
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        redirect("/");
      } else if (event === "SIGNED_OUT") {
        redirect("/login");
      }
    });
    unsub = data.subscription;

    // 6. Timeout fallback на 5 секунд
    const timer = setTimeout(async () => {
      if (isHandled.current) return;
      const { data: sd } = await supabase.auth.getSession();
      redirect(sd.session ? "/" : "/login");
    }, 5000);

    return () => {
      clearTimeout(timer);
      unsub?.unsubscribe();
      linkingSub?.remove();
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
