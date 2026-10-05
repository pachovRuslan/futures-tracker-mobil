import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/shared/config";
import { colors } from "@/theme/colors";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";

/**
 * Экран ошибки конфигурации.
 *
 * Раньше при пустых EXPO_PUBLIC_SUPABASE_* клиент Supabase создавался на
 * уровне модуля и бросал "supabaseUrl is required" при импорте — до
 * монтирования ErrorBoundary. Приложение падало белым экраном без
 * объяснений. Теперь клиент ленивый (getSupabase), а вместо крэша —
 * этот экран с инструкцией.
 */
function ConfigErrorScreen() {
  return (
    <SafeAreaView style={styles.configContainer}>
      <ScrollView contentContainerStyle={styles.configContent}>
        <Text style={styles.configTitle}>Требуется настройка</Text>
        <Text style={styles.configText}>
          Не заданы переменные окружения Supabase:
        </Text>
        <Text style={styles.configCode}>EXPO_PUBLIC_SUPABASE_URL</Text>
        <Text style={styles.configCode}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
        <Text style={styles.configText}>
          Создайте файл .env в корне проекта (см. README.md), затем
          перезапустите dev-сервер:{"\n"}
          <Text style={styles.configCode}>npx expo start --clear</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const seg = segments as readonly string[];

    // Не редиректить с callback экрана — там разруливает callback.tsx.
    if (seg.length >= 2 && seg[0] === "auth" && seg[1] === "callback") {
      return;
    }

    const inAuthGroup = seg[0] === "login" || seg[0] === "auth";

    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, loading, segments]);

  if (loading) return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trade/new" />
      <Stack.Screen name="trade/edit" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="connections" />
    </Stack>
  );
}

export default function RootLayout() {
  if (!isSupabaseConfigured) {
    // Ошибка конфигурации видна без ErrorBoundary — читаемо и в dev, и в prod.
    return (
      <ErrorBoundary>
        <ConfigErrorScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  configContainer: { flex: 1, backgroundColor: colors.bg },
  configContent: {
    padding: 24,
    gap: 12,
    justifyContent: "center",
    flexGrow: 1,
  },
  configTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  configText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  configCode: {
    fontSize: 12,
    color: colors.accent,
    textAlign: "center",
    fontFamily: "monospace",
  },
});
