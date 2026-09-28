import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { initSubscriptions } from "@/services/subscriptions";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initSubscriptions().catch((e) => {
      console.error("Subscriptions init failed (non-fatal):", e);
    });
  }, []);

  useEffect(() => {
    if (loading) return;

    console.log("[RootLayout] segments:", JSON.stringify(segments), "user:", user?.id ?? "null");

    // Не редиректить с callback экрана — там разрулит callback.tsx.
    // useSegments возвращает tuple с variadic-типом; приводим к string[],
    // чтобы безопасно индексировать.
    const seg = segments as readonly string[];

    console.log("[RootLayout] seg.length:", seg.length, "seg[0]:", seg[0], "seg[1]:", seg[1]);

    if (seg.length >= 2 && seg[0] === "auth" && seg[1] === "callback") {
      return;
    }

    const inAuthGroup = seg[0] === "login" || seg[0] === "auth";

    if (!user && !inAuthGroup) {
      console.log("[RootLayout] -> /login (no user, not in auth group)");
      router.replace("/login");
    } else if (user && inAuthGroup) {
      console.log("[RootLayout] -> / (user in auth group)");
      router.replace("/");
    } else {
      console.log("[RootLayout] no redirect");
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
