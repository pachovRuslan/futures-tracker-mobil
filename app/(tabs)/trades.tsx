import { useTrades } from "@/hooks/useTrades";
import { fmtDate, fmtPnl, tradeNetPnl } from "@/shared/trade-model";
import { EXCHANGE_LABELS, type TradeRow } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TradesScreen() {
  const { trades, loading, error, reload } = useTrades();

  const renderItem = useCallback(
    ({ item: t }: { item: TradeRow }) => {
      const net = tradeNetPnl(t);
      return (
        <View style={styles.row}>
          <View style={styles.left}>
            <View
              style={[
                styles.badge,
                t.side === "long" ? styles.longBadge : styles.shortBadge,
              ]}
            >
              <Text style={styles.badgeText}>
                {t.side === "long" ? "LONG" : "SHORT"}
              </Text>
            </View>
            <View>
              <Text style={styles.symbol}>{t.symbol}</Text>
              <Text style={styles.exchange}>
                {EXCHANGE_LABELS[t.exchange] ?? t.exchange} ·{" "}
                {fmtDate(t.closed_at)}
              </Text>
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
        </View>
      );
    },
    [],
  );

  const keyExtractor = useCallback((item: TradeRow) => item.id, []);
  const ListEmptyComponent = useMemo(
    () => <Text style={styles.empty}>Сделок пока нет</Text>,
    [],
  );

  if (loading && trades.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
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
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  longBadge: { backgroundColor: colors.profitDim },
  shortBadge: { backgroundColor: colors.lossDim },
  badgeText: { fontSize: 9, fontWeight: "600", color: colors.text },
  symbol: { fontSize: 14, fontWeight: "500", color: colors.text },
  exchange: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  pnl: { fontSize: 14, fontWeight: "600" },
  empty: { color: colors.textFaint, textAlign: "center", padding: 40 },
});
