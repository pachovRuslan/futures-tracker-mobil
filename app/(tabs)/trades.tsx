import { useTrades } from "@/hooks/useTrades";
import { fmtDate, fmtPnl } from "@/shared/trade-model";
import { EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import {
    FlatList,
    StyleSheet,
    Text,
    View
} from "react-native";

export default function TradesScreen() {
  const { trades, loading, reload } = useTrades();

  const renderItem = ({ item: t }: { item: any }) => {
    const net = t.realized_pnl - t.fee + t.funding;
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
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={trades}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={reload}
        refreshing={loading}
        contentContainerStyle={{ padding: 16, gap: 4 }}
        ListEmptyComponent={<Text style={styles.empty}>Сделок пока нет</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
