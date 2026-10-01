import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Только реально существующие возможности Premium (см. REFACTORING.md). */
const FEATURES = [
  { icon: "↻", title: "Авто-синк бирж", desc: "Подключите API-ключи — Binance, Bybit, Bitget, MEXC, BingX подтянут сделки сами" },
  { icon: "∞", title: "Безлимит сделок", desc: "FREE — до 50 сделок, Premium — без ограничений" },
] as const;

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  // Если уже премиум — редирект на главную.
  useEffect(() => {
    if (isPremium) {
      const t = setTimeout(() => router.replace("/"), 600);
      return () => clearTimeout(t);
    }
  }, [isPremium, router]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  if (isPremium) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Premium активен. Перенаправляем…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FUTURES TRACKER</Text>
          <Text style={styles.title}>Premium</Text>
          <Text style={styles.subtitle}>
            Раскрой полный потенциал трекера сделок
          </Text>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>{f.icon}</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Как получить Premium</Text>
          <Text style={styles.noticeText}>
            Покупка внутри приложения появится позже. Сейчас Premium выдаётся
            вручную через админ-панель Supabase (таблица user_entitlements).
          </Text>
          {user?.email ? (
            <Text style={styles.noticeAccount}>Аккаунт: {user.email}</Text>
          ) : null}
        </View>

        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 48, paddingBottom: 48, gap: 24 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    gap: 16,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  header: { alignItems: "center", gap: 8 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textMuted,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  featureIconText: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: "700",
  },
  featureContent: { flex: 1, gap: 2 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  noticeText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  noticeAccount: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
