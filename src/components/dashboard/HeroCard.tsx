import { Ionicons } from "@expo/vector-icons";
import { exchangeLabel, plural } from "@/shared/format";
import { fmtPnl } from "@/shared/trade-model";
import { colors } from "@/theme/colors";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface HeroCardProps {
  /** Итоговый net P&L (фильтр биржи уже учтён в агрегате). */
  net: number;
  /** Число сделок в том же фильтре (для подписи под суммой). */
  count: number;
  /** Активный фильтр биржи: "all" или код биржи. */
  exchangeFilter: string;
  /** Идёт ручной синк? Кнопка «Синхрон.» занята, спиннер. */
  syncBusy: boolean;
  /** Идёт pull-to-refresh? Кнопка тоже занята. */
  refreshing: boolean;
  /** Строка статуса синка (прогресс/итог) под карточкой. */
  syncMsg: string | null;
  /** Запуск ручного синка (handleSync из useDashboardSync). */
  onSync: () => void;
}

/**
 * HeroCard — итоговая карточка дашборда: «ИТОГ ПО СДЕЛКАМ», кнопка
 * «Синхрон.», net P&L и подпись с фильтром биржи. Кнопка запускает
 * НАСТОЯЩИЙ синк с биржами через серверный мост (как «Синк всё» на
 * сайте): прогресс — в строке статуса под карточкой, до ~60 с на биржу.
 *
 * Выделено из app/(tabs)/index.tsx при декомпозиции; разметка, логика
 * цвета P&L и стили перенесены без изменений.
 */
export function HeroCard({
  net,
  count,
  exchangeFilter,
  syncBusy,
  refreshing,
  syncMsg,
  onSync,
}: HeroCardProps) {
  const pnlColor = useMemo(() => {
    if (net > 0) return colors.profit;
    if (net < 0) return colors.loss;
    return colors.textMuted;
  }, [net]);

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <Text style={styles.heroLabel}>ИТОГ ПО СДЕЛКАМ</Text>
        <Pressable
          style={[
            styles.syncButton,
            (syncBusy || refreshing) && styles.syncButtonBusy,
          ]}
          onPress={onSync}
          disabled={syncBusy || refreshing}
          accessibilityRole="button"
          accessibilityLabel="Синхронизировать сделки с биржами"
        >
          {syncBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sync" size={14} color="#fff" />
          )}
          <Text style={styles.syncText}>
            {syncBusy ? "Синк…" : "Синхрон."}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.heroValue, { color: pnlColor }]}>
        {fmtPnl(net)}
        <Text style={styles.heroSuffix}> USDT</Text>
      </Text>
      <Text style={styles.heroSub}>
        {exchangeFilter === "all"
          ? `Все биржи · ${count} ${plural(count, "сделка", "сделки", "сделок")}`
          : `${exchangeLabel(exchangeFilter)} · ${count} ${plural(count, "сделка", "сделки", "сделок")}`}
      </Text>
      {syncMsg && <Text style={styles.syncStatus}>{syncMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  heroLabel: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  syncButtonBusy: { opacity: 0.7 },
  syncText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  syncStatus: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroSuffix: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  heroSub: { fontSize: 12, color: colors.textMuted },
});
