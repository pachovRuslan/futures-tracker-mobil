import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    console.log("Callback screen mounted. Waiting for session...");

    // Подписываемся на изменения сессии
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth event:", event);

        if (event === "SIGNED_IN" && session) {
          console.log("User signed in:", session.user?.email);
          authListener.subscription.unsubscribe();
          router.replace("/");
        } else if (event === "SIGNED_OUT") {
          authListener.subscription.unsubscribe();
          router.replace("/login");
        }
      },
    );

    // Очистка подписки при размонтировании
    return () => {
      authListener.subscription.unsubscribe();
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
