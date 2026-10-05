import { TrendLoader } from "@/components/TrendLoader";
import { useTrades } from "@/hooks/useTrades";
import { getSupabase } from "@/services/auth";
import { fmtDate, fmtPnl, tradeNetPnl } from "@/shared/trade-model";
import { EXCHANGE_LABELS, type TradeRow } from "@/shared/types";
import { colors } from "@/theme/colors";
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
  const { trades, loading, error, reload } = useTrades();
  const router = useRouter();

  // ── Действия по тапу на сделку (волна 2: раньше список был read-only).
  // Семантика — как на сайте: полное редактирование и удаление только
  // для manual (синканные перезапишет следующий синк), заметки — любым.
  const confirmDelete = useCallback(
    (t: TradeRow) => {
      Alert.alert("Удалить сделку?", `${t.symbol} — действие необратимо.`, [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await getSupabase()
              .from("trades")
              .delete()
              .eq("id", t.id);
            if (deleteError) {
              Alert.alert("Ошибка", deleteError.message);
              return;
            }
            reload();
          },
        },
      ]);
    },
    [reload],
  );

  const openActions = useCallback(
    (t: TradeRow) => {
      const title = `${t.symbol} · ${fmtPnl(tradeNetPnl(t))}`;
      const message = `${EXCHANGE_LABELS[t.exchange] ?? t.exchange} · ${fmtDate(t.closed_at)}`;
      if (t.exchange === "manual") {
        // Android показывает максимум 3 кнопки — ровно столько и кладём.
        Alert.alert(title, message, [
          {
            text: "Редактировать",
            onPress: () => router.push(`/trade/edit?id=${t.id}`),
          },
          {
            text: "Удалить",
            style: "destructive",
            onPress: () => confirmDelete(t),
          },
          { text: "Отмена", style: "cancel" },
        ]);
      } else {
        Alert.alert(title, message, [
          {
            text: "Изменить заметку",
            onPress: () => router.push(`/trade/edit?id=${t.id}`),
          },
          { text: "Отмена", style: "cancel" },
        ]);
      }
    },
    [router, confirmDelete],
  );

  const renderItem = useCallback(
    ({ item: t }: { item: TradeRow }) => {
      const net = tradeNetPnl(t);
      const isLong = t.side === "long";
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => openActions(t)}
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
                <Text style={styles.symbol}>{t.symbol}</Text>
                <View style={styles.exchangeTag}>
                  <Text style={styles.exchangeTagText}>
                    {EXCHANGE_LABELS[t.exchange] ?? t.exchange}
                  </Text>
                </View>
              </View>
              <Text style={styles.exchange}>{fmtDate(t.closed_at)}</Text>
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
    [openActions],
  );

  const keyExtractor = useCallback((item: TradeRow) => item.id, []);
  const ListEmptyComponent = useMemo(
    () => <Text style={styles.empty}>Сделок пока нет</Text>,
    [],
  );

  if (loading && trades.length === 0) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>Загрузка сделок…</Text>
      </View>
    );
  }

  if (error && trades.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось загрузить</Text>
        <Text style={styles.muted}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={reload}>
          <Text style={styles.retryButtonText}>Повторить</Text>
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

const styles = StyleSheet.create({
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
