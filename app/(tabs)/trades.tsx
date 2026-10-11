import { TrendLoader } from "@/components/TrendLoader";
import { useI18n } from "@/i18n/I18nContext";
import { useTrades } from "@/hooks/useTrades";
import { getSupabase } from "@/services/auth";
import { fmtDate, fmtPnl, tradeNetPnl } from "@/shared/trade-model";
import { EXCHANGE_LABELS, type TradeRow } from "@/shared/types";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TradesScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { trades, loading, error, reload } = useTrades();
  const router = useRouter();

  // ── Действия по тапу на сделку (волна 2: раньше список был read-only).
  // Семантика — как на сайте: полное редактирование и удаление только
  // для manual (синканные перезапишет следующий синк), заметки — любым.
  // Параметр строки переименован в tr: буква t теперь занята переводом.
  const confirmDelete = useCallback(
    (tr: TradeRow) => {
      Alert.alert(
        t("trades.deleteTitle"),
        t("trades.deleteMsg", { symbol: tr.symbol }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              const { error: deleteError } = await getSupabase()
                .from("trades")
                .delete()
                .eq("id", tr.id);
              if (deleteError) {
                Alert.alert(t("common.error"), deleteError.message);
                return;
              }
              reload();
            },
          },
        ],
      );
    },
    [reload, t],
  );

  const openActions = useCallback(
    (tr: TradeRow) => {
      const title = `${tr.symbol} · ${fmtPnl(tradeNetPnl(tr))}`;
      const message = `${EXCHANGE_LABELS[tr.exchange] ?? tr.exchange} · ${fmtDate(tr.closed_at)}`;
      if (tr.exchange === "manual") {
        // Android показывает максимум 3 кнопки — ровно столько и кладём.
        Alert.alert(title, message, [
          {
            text: t("trades.editAction"),
            onPress: () => router.push(`/trade/edit?id=${tr.id}`),
          },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => confirmDelete(tr),
          },
          { text: t("common.cancel"), style: "cancel" },
        ]);
      } else {
        Alert.alert(title, message, [
          {
            text: t("trades.noteAction"),
            onPress: () => router.push(`/trade/edit?id=${tr.id}`),
          },
          { text: t("common.cancel"), style: "cancel" },
        ]);
      }
    },
    [router, confirmDelete, t],
  );

  const renderItem = useCallback(
    ({ item: tr }: { item: TradeRow }) => {
      const net = tradeNetPnl(tr);
      const isLong = tr.side === "long";
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => openActions(tr)}
        >
          <View style={styles.left}>
            <View
              style={[
                styles.badge,
                isLong ? styles.longBadge : styles.shortBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isLong ? styles.longBadgeText : styles.shortBadgeText,
                ]}
              >
                {isLong ? "LONG" : "SHORT"}
              </Text>
            </View>
            <View style={styles.leftText}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbol}>{tr.symbol}</Text>
                <View style={styles.exchangeTag}>
                  <Text style={styles.exchangeTagText}>
                    {EXCHANGE_LABELS[tr.exchange] ?? tr.exchange}
                  </Text>
                </View>
              </View>
              <Text style={styles.exchange}>{fmtDate(tr.closed_at)}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.pnl,
              { color: net >= 0 ? colors.profit : colors.loss },
            ]}
          >
            {fmtPnl(net)}
          </Text>
        </TouchableOpacity>
      );
    },
    // styles в зависимостях: при смене темы фабрика даёт новый объект —
    // без этого список держал бы цвета прошлой темы.
    [openActions, styles, colors],
  );

  const keyExtractor = useCallback((item: TradeRow) => item.id, []);
  const ListEmptyComponent = useMemo(
    () => <Text style={styles.empty}>{t("trades.empty")}</Text>,
    [styles, t],
  );

  if (loading && trades.length === 0) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>{t("trades.loading")}</Text>
      </View>
    );
  }

  if (error && trades.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t("common.loadFailed")}</Text>
        <Text style={styles.muted}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={reload}>
          <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trades}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onRefresh={reload}
        refreshing={loading}
        contentContainerStyle={{ padding: 16, gap: 4 }}
        ListEmptyComponent={ListEmptyComponent}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    gap: 12,
    padding: 24,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  errorTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  retryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  leftText: { gap: 3 },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  longBadge: { backgroundColor: colors.profitDim },
  shortBadge: { backgroundColor: colors.lossDim },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  longBadgeText: { color: colors.profit },
  shortBadgeText: { color: colors.loss },
  symbol: { fontSize: 14, fontWeight: "600", color: colors.text },
  exchangeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exchangeTagText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textMuted,
  },
  exchange: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  pnl: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  empty: { color: colors.textFaint, textAlign: "center", padding: 40 },
});
