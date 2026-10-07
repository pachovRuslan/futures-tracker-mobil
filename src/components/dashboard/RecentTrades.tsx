import { useRouter } from "expo-router";
import { fmtDate, fmtPnl, tradeNetPnl } from "@/shared/trade-model";
import { colors } from "@/theme/colors";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EXCHANGE_LABELS } from "@/shared/types";
import type { TradeRow } from "@/shared/types";

interface RecentTradesProps {
  /** Уже отфильтрованный по бирже список (дашборд показывает первые 6). */
  trades: TradeRow[];
}

/**
 * RecentTrades — секция «ПОСЛЕДНИЕ СДЕЛКИ» дашборда: до 6 строк с
 * empty-state. Выделена из app/(tabs)/index.tsx при декомпозиции;
 * разметка и стили перенесены без изменений.
 */
export function RecentTrades({ trades }: RecentTradesProps) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>ПОСЛЕДНИЕ СДЕЛКИ</Text>
        {trades.length > 0 && (
          <Pressable onPress={() => router.push("/(tabs)/trades")}>
            <Text style={styles.sectionLink}>Все сделки →</Text>
          </Pressable>
        )}
      </View>

      {trades.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Пока нет сделок</Text>
          <Text style={styles.emptyStateDesc}>
            Нажмите «Сделка», чтобы добавить первую и начать отслеживать P&L
          </Text>
        </View>
      ) : (
        <View style={styles.tradesPanel}>
          {trades.slice(0, 6).map((trade, i, arr) => {
            const isLong = trade.side === "long";
            const net = tradeNetPnl(trade);
            const isPositive = net >= 0;
            const isOpen = trade.closed_at == null;
            return (
              <View
                key={trade.id}
                style={[
                  styles.tradeRow,
                  i < arr.length - 1 && styles.tradeRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.tradeSideBadge,
                    isLong ? styles.tradeSideLong : styles.tradeSideShort,
                  ]}
                >
                  <Text
                    style={[
                      styles.tradeSideText,
                      isLong ? styles.tradeSideTextLong : styles.tradeSideTextShort,
                    ]}
                  >
                    {isLong ? "LONG" : "SHORT"}
                  </Text>
                </View>
                <View style={styles.tradeInfo}>
                  <View style={styles.tradeSymbolRow}>
                    <Text style={styles.tradeSymbol} numberOfLines={1}>
                      {trade.symbol}
                    </Text>
                    <View style={styles.tradeExchangeTag}>
                      <Text style={styles.tradeExchangeText}>
                        {EXCHANGE_LABELS[trade.exchange] ?? trade.exchange}
                      </Text>
                    </View>
                    {isOpen && (
                      <View style={styles.tradeOpenBadge}>
                        <Text style={styles.tradeOpenText}>OPEN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tradeMeta}>
                    {isOpen
                      ? "открыта"
                      : fmtDate(trade.closed_at)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tradePnlValue,
                    { color: isPositive ? colors.profit : colors.loss },
                  ]}
                >
                  {fmtPnl(net)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  sectionLink: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  tradesPanel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tradeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeSideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tradeSideLong: { backgroundColor: colors.profitDim },
  tradeSideShort: { backgroundColor: colors.lossDim },
  tradeSideText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tradeSideTextLong: { color: colors.profit },
  tradeSideTextShort: { color: colors.loss },
  tradeInfo: { flex: 1, gap: 3 },
  tradeSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tradeSymbol: { fontSize: 14, fontWeight: "600", color: colors.text },
  tradeExchangeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeExchangeText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tradeOpenBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.accentDim,
  },
  tradeOpenText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  tradeMeta: { fontSize: 11, color: colors.textFaint },
  tradePnlValue: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyStateTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  emptyStateDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
