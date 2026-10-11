import { fmtDate, fmtPnl, tradeNetPnl } from "@/shared/trade-model";
import { EXCHANGE_LABELS } from "@/shared/types";
import type { TradeRow } from "@/shared/types";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { StyleSheet, Text, View } from "react-native";

interface TradeSummaryCardProps {
  /** Загруженная сделка — сводка показывается над формой редактирования. */
  trade: TradeRow;
}

/**
 * Сводка по сделке: символ, биржа, сторона, даты открытия/закрытия и
 * чистый PnL. Для не-manual сделки — единственный контекст: поля
 * перезапишет следующий синк, редактируется только заметка.
 *
 * Выделено из app/trade/edit.tsx при декомпозиции; разметка и стили
 * перенесены без изменений.
 */
export function TradeSummaryCard({ trade }: TradeSummaryCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <Text style={styles.symbol}>{trade.symbol}</Text>
        <Text style={styles.exchangeTag}>
          {EXCHANGE_LABELS[trade.exchange] ?? trade.exchange}
        </Text>
      </View>
      <Text style={styles.summaryMeta}>
        {trade.side === "long" ? "LONG" : "SHORT"} · открыта{" "}
        {fmtDate(trade.opened_at)} · закрыта {fmtDate(trade.closed_at)}
      </Text>
      <Text
        style={[
          styles.summaryPnl,
          { color: tradeNetPnl(trade) >= 0 ? colors.profit : colors.loss },
        ]}
      >
        {fmtPnl(tradeNetPnl(trade))}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  symbol: { fontSize: 16, fontWeight: "700", color: colors.text },
  exchangeTag: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryMeta: { fontSize: 12, color: colors.textFaint },
  summaryPnl: { fontSize: 18, fontWeight: "700" },
});
