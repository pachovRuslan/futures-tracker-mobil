import { BuyButton } from "@/components/paywall/BuyButton";
import { FeaturesCard } from "@/components/paywall/FeaturesCard";
import { LegalNote } from "@/components/paywall/LegalNote";
import { PlansCard } from "@/components/paywall/PlansCard";
import { RestoreButton } from "@/components/paywall/RestoreButton";
import { useAuth } from "@/context/AuthContext";
import { usePaywallActions } from "@/hooks/usePaywallActions";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getPremiumPackages,
  isBillingAvailable,
} from "@/services/purchases";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, refresh } = useSubscription();

  const billingReady = isBillingAvailable();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);

  // Если уже премиум — редирект на главную.
  useEffect(() => {
    if (isPremium) {
      const t = setTimeout(() => router.replace("/"), 600);
      return () => clearTimeout(t);
    }
  }, [isPremium, router]);

  // Загружаем офферинги RC (цены приходят из стора).
  useEffect(() => {
    if (!billingReady || isPremium) return;
    let mounted = true;
    getPremiumPackages()
      .then((pkgs) => {
        if (!mounted) return;
        setPackages(pkgs);
        setSelected(pkgs[0] ?? null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        if (__DEV__) console.warn("[paywall] offerings error:", e);
        setPackages([]);
      });
    return () => {
      mounted = false;
    };
  }, [billingReady, isPremium]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  const { busy, error, handleBuy, handleRestore } = usePaywallActions(
    selected,
    refresh,
  );

  if (isPremium) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Premium активен. Перенаправляем…</Text>
      </View>
    );
  }

  const showPlans = billingReady && packages !== null && packages.length > 0;
  const loadingPlans = billingReady && packages === null;

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

        <FeaturesCard />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Биллинг не сконфигурирован (нет RC-ключей в сборке) ─────── */}
        {!billingReady ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Покупка недоступна</Text>
            <Text style={styles.noticeText}>
              В этой сборке не заданы ключи магазина (EXPO_PUBLIC_REVENUECAT_*).
              Premium можно активировать в сборке с настроенным биллингом.
            </Text>
            {user?.email ? (
              <Text style={styles.noticeAccount}>Аккаунт: {user.email}</Text>
            ) : null}
          </View>
        ) : null}

        {/* ─── Ключи есть, офферинги грузятся ─────────────────────────── */}
        {loadingPlans ? (
          <View style={styles.noticeCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.noticeText}>Загружаем тарифы…</Text>
          </View>
        ) : null}

        {/* ─── Офферинги пришли пустыми (продукты не настроены в RC) ──── */}
        {billingReady && packages !== null && packages.length === 0 ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Тарифы настраиваются</Text>
            <Text style={styles.noticeText}>
              Подписка скоро появится в магазине. Уже покупали? Восстановите
              покупку кнопкой ниже.
            </Text>
          </View>
        ) : null}

        {/* ─── Планы из стора ─────────────────────────────────────────── */}
        {showPlans && selected ? (
          <PlansCard
            packages={packages}
            selected={selected}
            onSelect={setSelected}
          />
        ) : null}

        {showPlans ? (
          <BuyButton busy={busy} selected={selected} onBuy={handleBuy} />
        ) : null}

        {billingReady ? (
          <RestoreButton busy={busy} onRestore={handleRestore} />
        ) : null}

        <LegalNote />

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
  errorCard: {
    backgroundColor: colors.lossDim,
    borderRadius: 12,
    padding: 14,
  },
  errorText: { color: colors.loss, fontSize: 12, lineHeight: 17 },
  noticeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: "center",
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
    textAlign: "center",
  },
  noticeAccount: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
  },
});
