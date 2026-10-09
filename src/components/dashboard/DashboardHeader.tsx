import type { Entitlement } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface DashboardHeaderProps {
  isPremium: boolean;
  entitlement: Entitlement | null;
  /** Entitlement ещё грузится? Бейдж показывает «…». */
  subLoading: boolean;
}

/**
 * DashboardHeader — шапка дашборда: бренд FUTURES_TRACKER + бейдж статуса
 * подписки (как заголовок сайта).
 *
 * Выделено из app/(tabs)/index.tsx при декомпозиции; разметка, логика
 * текста бейджа и стили перенесены без изменений.
 */
export function DashboardHeader({
  isPremium,
  entitlement,
  subLoading,
}: DashboardHeaderProps) {
  // Бейдж: PREMIUM · GRANT — ручная выдача, PREMIUM — подписка RC.
  // Ветки «allowlist» (PREMIUM · BETA) больше нет: с миграции 13 allowlist
  // премиум не даёт, source у премиума всегда app_store/play_store/manual
  // (см. src/services/entitlements.ts).
  const premiumBadgeText = useMemo(() => {
    if (subLoading) return "…";
    if (!isPremium) return "FREE";
    if (entitlement?.source === "manual") return "PREMIUM · GRANT";
    return "PREMIUM";
  }, [isPremium, entitlement, subLoading]);

  return (
    <View style={styles.header}>
      <Text style={styles.brand} numberOfLines={1}>
        FUTURES_
        <Text style={{ color: colors.accent }}>TRACKER</Text>
      </Text>
      <View style={[styles.badge, isPremium && styles.badgePremium]}>
        <Text style={[styles.badgeText, isPremium && styles.badgeTextPremium]}>
          {premiumBadgeText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgePremium: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  badgeTextPremium: { color: colors.accent },
});
