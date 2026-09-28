import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getOfferings,
  purchaseProduct,
  restorePurchases,
  type OfferingPackage,
} from "@/services/subscriptions";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type LoadState = "idle" | "loading" | "purchasing" | "success" | "error";

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: "↻",
    title: "Авто-синк бирж",
    description:
      "Binance, Bybit, Bitget, MEXC, BingX — сделки подтягиваются сами",
  },
  {
    icon: "↗",
    title: "Push-уведомления",
    description: "Уведомления о закрытии сделок и важных событиях",
  },
  {
    icon: "↧",
    title: "Экспорт CSV",
    description: "Выгрузка истории сделок для Excel и налоговой",
  },
  {
    icon: "∞",
    title: "Безлимит сделок",
    description: "Без ограничений на количество записей",
  },
] as const;

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, refresh } = useSubscription();

  const [packages, setPackages] = useState<OfferingPackage[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── Загрузка offerings ─────────────────────────────────────────────
  const loadOfferings = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg(null);
    try {
      const offerings = await getOfferings();
      const list = offerings.current?.availablePackages ?? [];
      setPackages(list);
      setLoadState(list.length > 0 ? "idle" : "error");
      if (list.length === 0) {
        setErrorMsg(
          "Пакеты подписок пока не настроены. Добавьте их в RevenueCat Dashboard.",
        );
      }
    } catch (e) {
      console.error("[Paywall] loadOfferings error:", e);
      setLoadState("error");
      setErrorMsg("Не удалось загрузить пакеты. Попробуйте позже.");
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // ─── Если уже премиум — редирект на главную ─────────────────────────
  useEffect(() => {
    if (isPremium) {
      const t = setTimeout(() => router.replace("/"), 800);
      return () => clearTimeout(t);
    }
  }, [isPremium, router]);

  // ─── Покупка ────────────────────────────────────────────────────────
  const handlePurchase = useCallback(
    async (pkg: OfferingPackage) => {
      if (purchasingId) return;
      setPurchasingId(pkg.identifier);
      setLoadState("purchasing");
      setErrorMsg(null);

      try {
        const ok = await purchaseProduct(pkg.productIdentifier);
        if (ok) {
          setLoadState("success");
          await refresh();
          Alert.alert("Готово!", "Premium активирован.", [
            { text: "OK", onPress: () => router.replace("/") },
          ]);
        } else {
          setLoadState("idle");
        }
      } catch (e) {
        console.error("[Paywall] purchase error:", e);
        setLoadState("error");
        setErrorMsg("Ошибка покупки. Попробуйте ещё раз.");
      } finally {
        setPurchasingId(null);
      }
    },
    [purchasingId, refresh, router],
  );

  // ─── Восстановление покупок ─────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    setLoadState("purchasing");
    setErrorMsg(null);
    try {
      const ok = await restorePurchases();
      await refresh();
      if (ok && isPremium) {
        Alert.alert("Готово!", "Покупки восстановлены.");
        router.replace("/");
      } else {
        Alert.alert(
          "Нет покупок",
          "Активные подписки не найдены для этого аккаунта.",
        );
        setLoadState("idle");
      }
    } catch (e) {
      console.error("[Paywall] restore error:", e);
      setLoadState("error");
      setErrorMsg("Не удалось восстановить покупки.");
    }
  }, [isPremium, refresh, router]);

  // ─── Memo: featured package (первый или самый дешёвый) ──────────────
  const featuredPackage = useMemo<OfferingPackage | null>(() => {
    if (packages.length === 0) return null;
    // Предпочитаем $rc_annual, потом monthly, потом первый
    const priorityOrder = [
      "$rc_annual",
      "$rc_six_month",
      "$rc_three_month",
      "$rc_two_month",
      "$rc_monthly",
    ];
    for (const id of priorityOrder) {
      const found = packages.find((p) => p.identifier === id);
      if (found) return found;
    }
    return packages[0];
  }, [packages]);

  // ─── Render ─────────────────────────────────────────────────────────
  if (isPremium) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Premium активен. Перенаправляем…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>FUTURES TRACKER</Text>
        <Text style={styles.title}>Premium</Text>
        <Text style={styles.subtitle}>
          Раскрой полный потенциал трекера сделок
        </Text>
      </View>

      {/* Features */}
      <View style={styles.featuresCard}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>{f.icon}</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Pricing */}
      <View style={styles.pricingSection}>
        {loadState === "loading" && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Загрузка пакетов…</Text>
          </View>
        )}

        {loadState === "error" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable style={styles.retryButton} onPress={loadOfferings}>
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {loadState !== "loading" &&
          loadState !== "error" &&
          featuredPackage && (
            <View style={styles.priceCard}>
              <Text style={styles.priceTitle}>{featuredPackage.title}</Text>
              <Text style={styles.priceValue}>
                {featuredPackage.priceString}
              </Text>
              {featuredPackage.description ? (
                <Text style={styles.priceDesc}>
                  {featuredPackage.description}
                </Text>
              ) : null}
            </View>
          )}

        {loadState !== "loading" &&
          loadState !== "error" &&
          packages.length > 1 && (
            <View style={styles.allPackages}>
              {packages.map((pkg) => (
                <Pressable
                  key={pkg.identifier}
                  style={[
                    styles.packageRow,
                    pkg.identifier === featuredPackage?.identifier &&
                      styles.packageRowActive,
                  ]}
                  onPress={() => handlePurchase(pkg)}
                  disabled={purchasingId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Купить ${pkg.title} за ${pkg.priceString}`}
                >
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageTitle}>{pkg.title}</Text>
                    {pkg.description ? (
                      <Text style={styles.packageDesc}>{pkg.description}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.packagePrice}>{pkg.priceString}</Text>
                </Pressable>
              ))}
            </View>
          )}
      </View>

      {/* CTA */}
      {featuredPackage && loadState !== "loading" && loadState !== "error" && (
        <Pressable
          style={[
            styles.ctaButton,
            purchasingId !== null && styles.ctaButtonDisabled,
          ]}
          onPress={() => handlePurchase(featuredPackage)}
          disabled={purchasingId !== null}
          accessibilityRole="button"
          accessibilityLabel="Оформить Premium подписку"
        >
          {purchasingId !== null ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaButtonText}>Оформить Premium</Text>
          )}
        </Pressable>
      )}

      {/* Restore */}
      <Pressable
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={purchasingId !== null}
        accessibilityRole="button"
        accessibilityLabel="Восстановить покупки"
      >
        <Text style={styles.restoreButtonText}>Восстановить покупки</Text>
      </Pressable>

      {/* Footer legal */}
      <Text style={styles.legalText}>
        Оплата списывается с вашего Google Play / App Store аккаунта.{"\n"}
        Подписка автоматически продлевается, если не отменить за 24 часа до
        окончания текущего периода.{"\n"}
        Управление и отмена:{" "}
        {Platform.OS === "ios"
          ? "Настройки → Apple ID"
          : "Google Play → Подписки"}
        .
      </Text>

      {user?.email ? (
        <Text style={styles.accountText}>Аккаунт: {user.email}</Text>
      ) : null}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
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
  featureContent: {
    flex: 1,
    gap: 2,
  },
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
  pricingSection: {
    gap: 12,
  },
  loadingBox: {
    padding: 32,
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  errorBox: {
    padding: 24,
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent + "20",
  },
  retryButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 13,
  },
  priceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  priceTitle: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  priceValue: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.text,
  },
  priceDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  allPackages: {
    gap: 8,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 12,
  },
  packageRowActive: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  packageInfo: {
    flex: 1,
    gap: 2,
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  packageDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  restoreButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  legalText: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
    lineHeight: 16,
  },
  accountText: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
