import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import * as LinkingExpo from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);

  useEffect(() => {
    console.log("[Callback] screen mounted, isHandled:", isHandled.current);

    let subscription: { unsubscribe: () => void } | null = null;
    let linkingSubscription: { remove: () => void } | null = null;

    const handle = (next: "/" | "/login") => {
      if (isHandled.current) return;
      isHandled.current = true;
      console.log("[Callback] handle ->", next);
      subscription?.unsubscribe();
      linkingSubscription?.remove();
      setTimeout(() => router.replace(next), 150);
    };

    const exchangeCode = async (code: string): Promise<boolean> => {
      console.log("[Callback] exchanging code for session...");
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("[Callback] exchangeCodeForSession error:", error.message);
          return false;
        }

        if (data.session?.user) {
          console.log("[Callback] session established, user:", data.session.user.email);
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

    const processUrl = async (url: string | null): Promise<boolean> => {
      if (!url) {
        console.log("[Callback] processUrl: url is null");
        return false;
      }

      console.log("[Callback] processUrl:", url);

      try {
        const parsed = LinkingExpo.parse(url);
        console.log("[Callback] parsed:", JSON.stringify(parsed));

        const code = parsed.queryParams?.code;
        const codeStr = Array.isArray(code) ? code[0] : code;
        console.log("[Callback] code from queryParams:", codeStr ? "found" : "not found");

        if (codeStr) {
          return await exchangeCode(codeStr);
        }

        // Попробуем найти code= вручную через regex
        const codeMatch = url.match(/[?&]code=([^&]+)/);
        if (codeMatch) {
          const codeFromRegex = decodeURIComponent(codeMatch[1]);
          console.log("[Callback] code found via regex");
          return await exchangeCode(codeFromRegex);
        }

        return false;
      } catch (e) {
        console.error("[Callback] processUrl error:", e);
        return false;
      }
    };

    console.log("[Callback] calling Linking.getInitialURL()...");
    Linking.getInitialURL()
      .then((url) => {
        console.log("[Callback] getInitialURL returned:", url);
        if (isHandled.current) return;
        return processUrl(url);
      })
      .then((ok) => {
        if (!ok && !isHandled.current) {
          console.log("[Callback] initial URL processing failed, checking session...");
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              console.log("[Callback] session found via getSession");
              handle("/");
            }
          });
        }
      })
      .catch((e) => console.error("[Callback] getInitialURL error:", e));

    linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      console.log("[Callback] Linking event url:", url);
      if (isHandled.current) return;
      processUrl(url);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Callback] auth event:", event, "hasSession:", !!session);

        if (event === "INITIAL_SESSION") return;

        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          session
        ) {
          handle("/");
        } else if (event === "SIGNED_OUT") {
          handle("/login");
        }
      },
    );
    subscription = authListener.subscription;

    const fallbackTimer = setTimeout(async () => {
      if (isHandled.current) return;
      console.log("[Callback] fallback after 5s: checking session");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("[Callback] fallback session:", session?.user?.email ?? "null");
      handle(session ? "/" : "/login");
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
      linkingSubscription?.remove();
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
