import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);

  useEffect(() => {
    console.log("Callback screen mounted. Waiting for session...");

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Callback] event:", event, "hasSession:", !!session);

        if (event === "INITIAL_SESSION") return;
        if (isHandled.current) return;
        isHandled.current = true;

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          authListener.subscription.unsubscribe();
          setTimeout(() => router.replace("/"), 150);
        } else if (event === "SIGNED_OUT") {
          authListener.subscription.unsubscribe();
          router.replace("/login");
        }
      },
    );

    // Fallback на 5 секунд
    const fallbackTimer = setTimeout(async () => {
      if (isHandled.current) return;
      console.log("[Callback] fallback: checking session");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      isHandled.current = true;
      authListener.subscription.unsubscribe();
      if (session) router.replace("/");
      else router.replace("/login");
    }, 5000);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(fallbackTimer);
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
