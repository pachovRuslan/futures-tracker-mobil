import { CHART_MIN_MONTHS } from "@/hooks/useDashboardStats";
import { plural } from "@/shared/format";
import { fmtPnl } from "@/shared/trade-model";
import { colors } from "@/theme/colors";
import { useMemo, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MonthlyBar } from "@/hooks/useDashboardStats";

/** Высота области баров, px (совпадает со стилями chartBars/chartScroll). */
const CHART_HEIGHT_PX = 110;
/** Запас под подпись месяца (gap + строка 9pt), px. */
const CHART_LABEL_RESERVE_PX = 20;
/** Ширина бара в режиме скролла (>6 месяцев), px. */
const CHART_BAR_WIDTH_PX = 44;

interface PnlChartProps {
  /** Ряд «PnL по месяцам» из useDashboardStats. */
  monthly: MonthlyBar[];
  /** Выбранный месяц (подсветка бара) или null. */
  selectedMonth: string | null;
  /** Тап по бару: выбрать месяц или снять выбор (toggle). */
  onSelectMonth: (key: string | null) => void;
  /** Число сделок для подзаголовка (allTime.count с учётом фильтра). */
  tradesCount: number;
}

/**
 * PnlChart — бар-чарт «PNL ПО МЕСЯЦАМ». Выделен из бог-файла
 * app/(tabs)/index.tsx при декомпозиции; разметка, логика подсветки
 * и стили перенесены без изменений.
 */
export function PnlChart({
  monthly,
  selectedMonth,
  onSelectMonth,
  tradesCount,
}: PnlChartProps) {
  /** >6 месяцев — включаем горизонтальный скролл (график «расширяется»). */
  const isWideChart = monthly.length > CHART_MIN_MONTHS;
  const chartScrollRef = useRef<ScrollView>(null);

  const maxAbsMonthly = useMemo(
    () => Math.max(1, ...monthly.map((m) => Math.abs(m.value))),
    [monthly],
  );

  const selectedBar = useMemo(
    () => monthly.find((m) => m.key === selectedMonth) ?? null,
    [monthly, selectedMonth],
  );

  const chartSubtitle = selectedBar
    ? `${selectedBar.label}: ${fmtPnl(selectedBar.value)}`
    : `${tradesCount} ${plural(tradesCount, "сделка", "сделки", "сделок")} · ${monthly.filter((m) => m.value !== 0).length || 1} мес.`;

  /**
   * Отрисовка одного бара месячного графика (общая для обоих режимов).
   *
   * Высота бара — в пикселях, а не в %: при фиксированной высоте области
   * (CHART_HEIGHT_PX) это ведёт себя одинаково и в обычном flex-режиме, и в
   * горизонтальном скролле.
   */
  const renderChartBar = (m: MonthlyBar) => {
    // Высота бара — от максимума по модулю; минус запас под подпись месяца.
    const h = Math.max(
      3,
      (Math.abs(m.value) / maxAbsMonthly) *
        (CHART_HEIGHT_PX - CHART_LABEL_RESERVE_PX),
    );
    // Палитра веба: исторические месяцы — teal, текущий — cyan;
    // убыточные месяцы остаются красными (семантика важнее копии).
    const barColor =
      m.value === 0
        ? colors.border
        : m.value < 0
          ? colors.loss
          : m.isCurrent
            ? colors.chartCurrent
            : colors.chartTeal;
    return (
      <Pressable
        key={m.key}
        style={[
          styles.chartBarWrap,
          isWideChart && styles.chartBarWrapFixed,
        ]}
        onPress={() =>
          onSelectMonth(selectedMonth === m.key ? null : m.key)
        }
      >
        <View
          style={[
            styles.chartBar,
            {
              height: m.value === 0 ? 3 : h,
              backgroundColor: barColor,
            },
            selectedMonth === m.key && styles.chartBarSelected,
          ]}
        />
        <Text
          style={[
            styles.chartBarLabel,
            m.isCurrent && { color: colors.textMuted },
          ]}
        >
          {m.label}
        </Text>
      </Pressable>
    );
  };

  // Бар-чарт PnL по месяцам: при >6 месяцах — горизонтальный скролл,
  // чтобы график «расширялся» как на сайте
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>PNL ПО МЕСЯЦАМ</Text>
        <Text style={styles.chartSubtitle} numberOfLines={1}>
          {chartSubtitle}
        </Text>
      </View>
      {isWideChart ? (
        <ScrollView
          ref={chartScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chartScroll}
          contentContainerStyle={styles.chartBarsContent}
          onContentSizeChange={() =>
            chartScrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {monthly.map(renderChartBar)}
        </ScrollView>
      ) : (
        <View style={styles.chartBars}>{monthly.map(renderChartBar)}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  chartTitle: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  chartSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: CHART_HEIGHT_PX,
  },
  // Вьюпорт горизонтального скролла графика (при >6 месяцев).
  chartScroll: { height: CHART_HEIGHT_PX },
  // Контент скролла: flexDirection row задан самим ScrollView.
  chartBarsContent: { gap: 8, paddingRight: 8, alignItems: "flex-end" },
  // Фикс «графика вверх ногами»: без justifyContent: "flex-end" бары
  // прижимались к ВЕРХУ контейнера и свисали вниз, а подписи месяцев
  // прыгали по высоте. Теперь бары растут от базовой линии вверх,
  // как на сайте.
  chartBarWrap: {
    flex: 1,
    gap: 6,
    height: "100%",
    justifyContent: "flex-end",
  },
  // Режим скролла: фикс ширина/высота вместо flex:1/100%.
  chartBarWrapFixed: {
    flex: 0,
    width: CHART_BAR_WIDTH_PX,
    height: CHART_HEIGHT_PX,
  },
  chartBar: {
    width: "100%",
    borderRadius: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartBarSelected: { opacity: 0.75 },
  chartBarLabel: {
    fontSize: 9,
    color: colors.textFaint,
    fontWeight: "600",
    textAlign: "center",
  },
});
