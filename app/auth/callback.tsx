import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);
  // useLocalSearchParams() даёт query-параметры из URL.
  // Expo Router парсит futurestracker://auth/callback?code=... и делает
  // code доступным через params.code.
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log("[Callback] screen mounted, params:", JSON.stringify(params));

    let subscription: { unsubscribe: () => void } | null = null;

    const handle = (next: "/" | "/login") => {
      if (isHandled.current) return;
      isHandled.current = true;
      console.log("[Callback] handle ->", next);
      subscription?.unsubscribe();
      setTimeout(() => router.replace(next), 150);
    };

    const exchangeCode = async (code: string): Promise<boolean> => {
      console.log(
        "[Callback] exchanging code for session, code length:",
        code.length,
      );
      try {
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error(
            "[Callback] exchangeCodeForSession error:",
            error.message,
          );
          return false;
        }

        if (data.session?.user) {
          console.log(
            "[Callback] session established, user:",
            data.session.user.email,
          );
          handle("/");
          return true;
        }

        console.log("[Callback] no session after exchange");
        return false;
      } catch (e) {
        console.error("[Callback] exchangeCode exception:", e);
        return false;
      }
    };

    // 1. Пытаемся получить code из useLocalSearchParams (основной способ).
    // Expo Router парсит URL futurestracker://auth/callback?code=XXX
    // и делает параметры доступными через useLocalSearchParams().
    const codeFromParams = params.code;
    const codeStr = Array.isArray(codeFromParams)
      ? codeFromParams[0]
      : codeFromParams;

    if (codeStr && typeof codeStr === "string") {
      console.log("[Callback] code found in params");
      exchangeCode(codeStr);
    } else {
      console.log("[Callback] no code in params, waiting for auth event...");
    }

    // 2. Слушаем onAuthStateChange (на случай, если Supabase сам установит сессию)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Callback] auth event:", event, "hasSession:", !!session);

        if (event === "INITIAL_SESSION") return;

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          handle("/");
        } else if (event === "SIGNED_OUT") {
          handle("/login");
        }
      },
    );
    subscription = authListener.subscription;

    // 3. Fallback на 5 секунд
    const fallbackTimer = setTimeout(async () => {
      if (isHandled.current) return;
      console.log("[Callback] fallback after 5s: checking session");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log(
        "[Callback] fallback session:",
        session?.user?.email ?? "null",
      );
      handle(session ? "/" : "/login");
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
    };
  }, [router, params]);

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
