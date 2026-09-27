import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { initRevenueCat } from "@/services/subscriptions";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initRevenueCat();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "login" || segments[0] === "auth";
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
