import { ActionButtons } from "@/components/dashboard/ActionButtons";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExchangeFilterChips } from "@/components/dashboard/ExchangeFilterChips";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { PnlChart } from "@/components/dashboard/PnlChart";
import { PremiumBanner } from "@/components/dashboard/PremiumBanner";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TrendLoader } from "@/components/TrendLoader";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useDashboardSync } from "@/hooks/useDashboardSync";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_TRADE_LIMIT } from "@/shared/config";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * DashboardScreen — экран «Главная»: каркас дашборда. Данные и агрегаты —
 * в useDashboardStats, ручной синк с биржами — в useDashboardSync, шапка —
 * DashboardHeader, hero-карточка — HeroCard, апгрейд-баннер — PremiumBanner,
 * сетка статистики — StatsGrid, фильтр бирж — ExchangeFilterChips, график —
 * PnlChart, список сделок — RecentTrades, кнопки действий — ActionButtons
 * (бог-файл 1385 строк разбирался в два шага; поведение не менялось).
 * Здесь осталось: ранние состояния, pull-to-refresh и раскладка.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium, entitlement, loading: subLoading } = useSubscription();

  const [exchangeFilter, setExchangeFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const {
    state,
    errorMsg,
    loadDashboard,
    mountedRef,
    trades,
    exchanges,
    filteredRecent,
    allTime,
    month,
    monthTitle,
    monthly,
    totalCount,
  } = useDashboardStats(exchangeFilter, selectedMonth);

  const { syncBusy, syncMsg, handleSync } = useDashboardSync({
    isPremium,
    subLoading,
    loadDashboard,
    mountedRef,
  });

  const handleAddTrade = useCallback(() => {
    if (!isPremium && totalCount >= FREE_TRADE_LIMIT) {
      router.push("/paywall");
      return;
    }
    router.push("/trade/new");
  }, [isPremium, totalCount, router]);

  const handleAddExchange = useCallback(() => {
    // На пейволл отправляем только когда УВЕРЕНЫ, что юзер FREE. Пока
    // entitlement грузится, isPremium === false — без проверки loading'а
    // премиум-юзера зря отбрасывало на пейволл, а тот его отфутболивал
    // обратно («Premium активен, перенаправляем…»). Пока статус грузится —
    // идём на экран: его гейт сам дождётся статуса и примет решение.
    if (!subLoading && !isPremium) {
      router.push("/paywall");
      return;
    }
    router.push("/connections");
  }, [subLoading, isPremium, router]);

  const handlePremiumPress = useCallback(() => {
    if (isPremium) return;
    router.push("/paywall");
  }, [isPremium, router]);

  if (state === "loading" && !trades.length && totalCount === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <TrendLoader />
        <Text style={styles.muted}>Загрузка дашборда…</Text>
      </View>
    );
  }

  if (state === "error" && !trades.length) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.errorTitle}>Не удалось загрузить</Text>
        <Text style={styles.muted}>{errorMsg}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadDashboard()}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={state === "refreshing"}
          onRefresh={() => loadDashboard(true)}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <DashboardHeader
        isPremium={isPremium}
        entitlement={entitlement}
        subLoading={subLoading}
      />

      {!isPremium && <PremiumBanner onPress={handlePremiumPress} />}

      <HeroCard
        net={allTime.net}
        count={allTime.count}
        exchangeFilter={exchangeFilter}
        syncBusy={syncBusy}
        refreshing={state === "refreshing"}
        syncMsg={syncMsg}
        onSync={handleSync}
      />

      {/* Чипы фильтра бирж */}
      {exchanges.length > 1 && (
        <ExchangeFilterChips
          exchanges={exchanges}
          exchangeFilter={exchangeFilter}
          onChange={setExchangeFilter}
        />
      )}

      {/* Сетка статистики 3×3 (месяц + всё время, как на вебе) */}
      <StatsGrid
        month={month}
        allTime={allTime}
        monthTitle={monthTitle}
        selectedMonth={selectedMonth}
        onResetMonth={() => setSelectedMonth(null)}
      />

      {/* Бар-чарт PnL по месяцам: при >6 месяцах — горизонтальный скролл,
          чтобы график «расширялся» как на сайте */}
      <PnlChart
        monthly={monthly}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        tradesCount={allTime.count}
      />

      <ActionButtons
        onAddTrade={handleAddTrade}
        onAddExchange={handleAddExchange}
        isPremium={isPremium}
      />

      {/* Последние сделки */}
      <RecentTrades trades={filteredRecent} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
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
});
