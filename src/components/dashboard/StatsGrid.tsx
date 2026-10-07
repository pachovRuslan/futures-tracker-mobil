import { fmt, fmtPnl } from "@/shared/trade-model";
import { colors } from "@/theme/colors";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AllTimeAggregate, MonthAggregate } from "@/hooks/useDashboardStats";

interface StatsGridProps {
  /** Агрегат выбранного месяца (или текущего, если ничего не выбрано). */
  month: MonthAggregate;
  /** Агрегат «всё время» (с учётом фильтра по бирже). */
  allTime: AllTimeAggregate;
  /** Заголовок секции: активный месяц «YYYY-MM». */
  monthTitle: string;
  /** Выбранный на графике месяц (null — показываем текущий). */
  selectedMonth: string | null;
  /** Сброс выбора месяца. */
  onResetMonth: () => void;
}

/**
 * StatsGrid — сетка статистики 3×3 (месяц + всё время, как на вебе).
 * Выделена из app/(tabs)/index.tsx при декомпозиции; разметка и
 * стили перенесены без изменений.
 */
export function StatsGrid({
  month,
  allTime,
  monthTitle,
  selectedMonth,
  onResetMonth,
}: StatsGridProps) {
  return (
    <View style={styles.gridSection}>
      <View style={styles.gridHeaderRow}>
        <Text style={styles.gridHeaderTitle}>СТАТИСТИКА {monthTitle}</Text>
        {selectedMonth && (
          <Pressable onPress={onResetMonth}>
            <Text style={styles.gridHeaderLink}>Сбросить месяц</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>СДЕЛОК</Text>
            <Text style={styles.cellValue}>{month.count}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>ПРИБЫЛЬ / УБЫТОК</Text>
            <Text style={[styles.cellValueSmall, { color: colors.profit }]}>
              +{fmt(month.grossProfit)}
            </Text>
            <Text style={[styles.cellValueSmall, { color: colors.loss }]}>
              −{fmt(Math.abs(month.grossLoss))}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>WIN-RATE</Text>
            <Text style={styles.cellValue}>{month.winRate.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>ИТОГ МЕСЯЦА</Text>
            <Text
              style={[
                styles.cellValue,
                {
                  color:
                    month.net > 0
                      ? colors.profit
                      : month.net < 0
                        ? colors.loss
                        : colors.textMuted,
                },
              ]}
            >
              {fmtPnl(month.net)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>ОБЩАЯ ПРИБЫЛЬ</Text>
            <Text style={[styles.cellValue, { color: colors.profit }]}>
              +{fmt(allTime.grossProfit)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>ОБЩИЙ УБЫТОК</Text>
            <Text style={[styles.cellValue, { color: colors.loss }]}>
              −{fmt(Math.abs(allTime.grossLoss))}
            </Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>КОМИССИИ</Text>
            <Text style={[styles.cellValue, { color: colors.loss }]}>
              −{fmt(allTime.fees)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>ФАНДИНГ</Text>
            <Text
              style={[
                styles.cellValue,
                {
                  color:
                    allTime.funding > 0
                      ? colors.profit
                      : allTime.funding < 0
                        ? colors.loss
                        : colors.textMuted,
                },
              ]}
            >
              {fmtPnl(allTime.funding)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>WIN-RATE ЗА ВСЁ ВРЕМЯ</Text>
            <Text style={styles.cellValue}>{allTime.winRate.toFixed(1)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridSection: { gap: 8 },
  gridHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  gridHeaderLink: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  gridHeaderTitle: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  grid: { gap: 6 },
  gridRow: { flexDirection: "row", gap: 6 },
  cell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minHeight: 56,
  },
  cellLabel: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  cellValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  cellValueSmall: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
