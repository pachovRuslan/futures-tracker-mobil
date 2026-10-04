import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getPremiumPackages,
  isBillingAvailable,
  purchasePremium,
  restorePremium,
  syncEntitlementToServer,
} from "@/services/purchases";
import { colors } from "@/theme/colors";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "@/shared/config";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
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
import {
  PACKAGE_TYPE,
  type PurchasesPackage,
} from "react-native-purchases";

/** Только реально существующие возможности Premium (см. REFACTORING.md). */
const FEATURES: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}> = [
  {
    icon: "sync",
    title: "Авто-синк бирж",
    desc: "Подключите API-ключи — Binance, Bybit, Bitget, MEXC, BingX подтянут сделки сами",
  },
  {
    icon: "infinite",
    title: "Безлимит сделок",
    desc: "FREE — до 50 сделок, Premium — без ограничений",
  },
];

/** Человекочитаемое название пакета подписки. */
function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.MONTHLY:
      return "1 месяц";
    case PACKAGE_TYPE.ANNUAL:
      return "1 год";
    case PACKAGE_TYPE.WEEKLY:
      return "1 неделя";
    case PACKAGE_TYPE.LIFETIME:
      return "Навсегда";
    default:
      return pkg.product.title ?? "Premium";
  }
}

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, refresh } = useSubscription();

  const billingReady = isBillingAvailable();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  /** Покупка/restore → сверка с сервером → принудительный refresh статуса. */
  const finalize = useCallback(async () => {
    try {
      await syncEntitlementToServer();
    } catch (e) {
      if (__DEV__) console.warn("[paywall] sync entitlement error:", e);
      // Покупка могла пройти, а сверка — нет (сеть). Всё равно
      // перечитаем entitlement: сервер мог увидеть её другим путём.
    }
    await refresh(true);
    // Редирект сделает effect выше, когда isPremium станет true.
  }, [refresh]);

  const handleBuy = useCallback(async () => {
    if (!selected || busy) return;
    setBusy("buy");
    setError(null);
    try {
      await purchasePremium(selected);
      await finalize();
    } catch (e) {
      const cancelled =
        typeof e === "object" && e !== null && "userCancelled" in e
          ? Boolean((e as { userCancelled: boolean | null }).userCancelled)
          : false;
      if (!cancelled) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }, [selected, busy, finalize]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy("restore");
    setError(null);
    try {
      await restorePremium();
      await finalize();
      // Если после restore премиума нет — честно скажем, а не промолчим.
      setError("Покупки восстановлены. Если Premium не активировался — проверьте аккаунт стора.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }, [busy, finalize]);

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

        <View style={styles.featuresCard}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

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
          <View style={styles.plansCard}>
            {packages.map((pkg) => {
              const active = pkg.identifier === selected.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  style={[styles.planRow, active && styles.planRowActive]}
                  onPress={() => setSelected(pkg)}
                >
                  <View style={styles.planRadio}>
                    {active ? <View style={styles.planRadioDot} /> : null}
                  </View>
                  <View style={styles.planContent}>
                    <Text style={styles.planTitle}>{packageLabel(pkg)}</Text>
                    <Text style={styles.planDesc}>
                      Автопродление · отмена в любой момент
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>
                    {pkg.product.priceString}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {showPlans ? (
          <Pressable
            style={[styles.buyButton, busy === "buy" && styles.buttonDisabled]}
            onPress={handleBuy}
            disabled={busy !== null || !selected}
          >
            {busy === "buy" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buyButtonText}>
                Подписаться за {selected?.product.priceString ?? ""}
              </Text>
            )}
          </Pressable>
        ) : null}

        {billingReady ? (
          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={busy !== null}
          >
            {busy === "restore" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.restoreButtonText}>
                Восстановить покупки
              </Text>
            )}
          </Pressable>
        ) : null}

        {/* ─── Юридическая сноска (требование сторов) ─────────────────── */}
        <Text style={styles.legalText}>
          Оплата списывается с вашего счёта в магазине после подтверждения.
          Подписка продлевается автоматически, пока не отменена в настройках
          Google Play / App Store. Управление подпиской — в аккаунте магазина.
        </Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={styles.legalLink}>Политика конфиденциальности</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
            <Text style={styles.legalLink}>Условия использования</Text>
          </Pressable>
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
  plansCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    gap: 4,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planRowActive: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accent,
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textFaint,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  planContent: { flex: 1, gap: 2 },
  planTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  planDesc: {
    fontSize: 11,
    color: colors.textFaint,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  },
  buyButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  restoreButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "500",
  },
  legalText: {
    fontSize: 10,
    color: colors.textFaint,
    lineHeight: 14,
    textAlign: "center",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 10,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  legalDot: { color: colors.textFaint, fontSize: 10 },
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
