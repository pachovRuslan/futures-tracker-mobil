import { exchangeCodeForSession, supabase } from "@/services/auth";
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

      const match = url.match(/[?&]code=([^&#]+)/);
      if (match) {
        const code = decodeURIComponent(match[1]);
        if (__DEV__) console.log("[Callback] found code, exchanging...");
        handleCode(code);
        return true;
      }

      const errorMatch = url.match(/[?&]error=([^&#]+)/);
      if (errorMatch) {
        redirect("/login");
        return true;
      }

      return false;
    };

    // 1. СНАЧАЛА проверяем существующую сессию (WebBrowser путь уже обменял код)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isHandled.current) return;
      if (session?.user) {
        redirect("/");
        return;
      }

      // 2. Получаем initial URL (когда приложение открылось через intent/deep link)
      Linking.getInitialURL().then((url) => {
        if (isHandled.current) return;
        processUrl(url);
      });
    });

    // 3. Слушаем новые URL (когда приложение уже запущено)
    linkingSub = Linking.addEventListener("url", ({ url }) => {
      if (isHandled.current) return;
      processUrl(url);
    });

    // 4. Fallback через onAuthStateChange
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        redirect("/");
      } else if (event === "SIGNED_OUT") {
        redirect("/login");
      }
    });
    unsub = data.subscription;

    // 5. Timeout fallback
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
