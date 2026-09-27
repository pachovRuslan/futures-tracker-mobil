import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // В Expo Router параметры URL доступны в useLocalSearchParams
      const code = params.code as string;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace("/");
          return;
        }
      }
      // Если ошибка или нет кода — возвращаем на логин
      router.replace("/login");
    };

    handleCallback();
  }, [params, router]);

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
