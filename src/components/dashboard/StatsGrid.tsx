import { fmt, fmtPnl } from "@/shared/trade-model";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
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
 */
export function StatsGrid({
  month,
  allTime,
  monthTitle,
  selectedMonth,
  onResetMonth,
}: StatsGridProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.gridSection}>
      <View style={styles.gridHeaderRow}>
        <Text style={styles.gridHeaderTitle}>
          {t("dash.statsTitle", { month: monthTitle })}
        </Text>
        {selectedMonth && (
          <Pressable onPress={onResetMonth}>
            <Text style={styles.gridHeaderLink}>{t("dash.resetMonth")}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.trades")}</Text>
            <Text style={styles.cellValue}>{month.count}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.profitLoss")}</Text>
            <Text style={[styles.cellValueSmall, { color: colors.profit }]}>
              +{fmt(month.grossProfit)}
            </Text>
            <Text style={[styles.cellValueSmall, { color: colors.loss }]}>
              −{fmt(Math.abs(month.grossLoss))}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.winRate")}</Text>
            <Text style={styles.cellValue}>{month.winRate.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.monthTotal")}</Text>
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
            <Text style={styles.cellLabel}>{t("stat.totalProfit")}</Text>
            <Text style={[styles.cellValue, { color: colors.profit }]}>
              +{fmt(allTime.grossProfit)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.totalLoss")}</Text>
            <Text style={[styles.cellValue, { color: colors.loss }]}>
              −{fmt(Math.abs(allTime.grossLoss))}
            </Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.fees")}</Text>
            <Text style={[styles.cellValue, { color: colors.loss }]}>
              −{fmt(allTime.fees)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t("stat.funding")}</Text>
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
            <Text style={styles.cellLabel}>{t("stat.winRateAll")}</Text>
            <Text style={styles.cellValue}>{allTime.winRate.toFixed(1)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
