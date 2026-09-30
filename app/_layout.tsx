import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { initSubscriptions } from "@/services/subscriptions";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initSubscriptions().catch((e) => {
      if (__DEV__) console.error("Subscriptions init failed (non-fatal):", e);
    });
  }, []);

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
      <Stack.Screen name="paywall" />
      <Stack.Screen name="connections" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
