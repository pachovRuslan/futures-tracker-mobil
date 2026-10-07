import { Ionicons } from "@expo/vector-icons";

import { ExchangeFilterChips } from "@/components/dashboard/ExchangeFilterChips";
import { PnlChart } from "@/components/dashboard/PnlChart";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TrendLoader } from "@/components/TrendLoader";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useSubscription } from "@/hooks/useSubscription";
import { api, isPremiumRequired } from "@/services/api";
import {
  EXCHANGE_CONNECTIONS_ENABLED,
  FREE_TRADE_LIMIT,
} from "@/shared/config";
import { exchangeLabel, plural } from "@/shared/format";
import { fmtPnl } from "@/shared/trade-model";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import type { ApiExchange } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
 * в useDashboardStats, график — PnlChart, сетка статистики — StatsGrid,
 * фильтр бирж — ExchangeFilterChips, список сделок — RecentTrades
 * (всё выделено из этого файла при декомпозиции бог-файла 1385 строк;
 * поведение не менялось). Здесь осталось: шапка, hero-карточка, ручной
 * синк, кнопки действий и early-return-состояния.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium, entitlement, loading: subLoading } = useSubscription();

  const [exchangeFilter, setExchangeFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  /** Идёт ручной синк с биржами (кнопка «Синхрон.»). */
  const [syncBusy, setSyncBusy] = useState(false);
  /** Строка статуса синка (прогресс/итог) под hero-карточкой. */
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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

  // ── Ручной синк с биржами (кнопка «Синхрон.») ─────────────────────────────
  //
  // ⚠️ История бага «кнопка ничего не делает»: с появления (v3.1) кнопка
  // вызывала loadDashboard(true) — ЛОКАЛЬНУЮ перезагрузку тех же данных
  // из Supabase (аналог pull-to-refresh). Новые сделки с бирж при этом
  // не подтягивались никогда: серверный синк не запускался, фидбека не
  // было — «нажал, и тишина». Настоящий синк жил только на экране
  // «Подключения». Теперь кнопка на дашборде делает то же, что «Синк
  // всё» на сайте: последовательно синкает подключённые биржи через
  // серверный мост (Bearer JWT → /api/sync/[exchange]?days=365),
  // до ~60 секунд на биржу, с прогрессом и итогом, затем перезагружает
  // дашборд — свежие сделки появляются сразу.

  const handleSync = useCallback(async () => {
    if (syncBusy) return;

    // FREE-гейт (как у кнопки «Биржа»): авто-синк — премиум-фича мобилки.
    // Пока entitlement грузится, на клиенте не решаем — сервер вернёт
    // 402 PREMIUM_REQUIRED, если подписки нет (ловим ниже).
    if (!subLoading && !isPremium) {
      router.push("/paywall");
      return;
    }

    // Kill-switch фичи подключений выключен — синкить нечем.
    if (!EXCHANGE_CONNECTIONS_ENABLED) {
      setSyncMsg("Синк с биржами временно отключён.");
      return;
    }

    setSyncBusy(true);
    const setMsg = (msg: string | null) => {
      if (mountedRef.current) setSyncMsg(msg);
    };
    setMsg("Загружаю список подключений…");

    try {
      const { connections } = await api.getConnections();
      const connected = (connections ?? [])
        .map((c) => c.exchange)
        .filter((ex) => EXCHANGES.includes(ex));

      if (connected.length === 0) {
        setMsg(
          "Нет подключённых бирж — добавьте API-ключи через кнопку «Биржа».",
        );
        return;
      }

      let upserted = 0;
      const errors: string[] = [];
      for (let i = 0; i < connected.length; i++) {
        const ex = connected[i] as ApiExchange;
        setMsg(`Синк: ${EXCHANGE_LABELS[ex]} (${i + 1}/${connected.length})…`);
        try {
          const data = await api.syncExchange(ex);
          if (data.ok) {
            upserted += data.upserted ?? 0;
          } else {
            errors.push(
              `${EXCHANGE_LABELS[ex]}: ${data.error ?? data.message ?? "сбой"}`,
            );
          }
        } catch (e) {
          // Подписка истекла, пока юзер был на дашборде — сервер отверг синк.
          if (isPremiumRequired(e)) {
            setMsg(null);
            router.push("/paywall");
            return;
          }
          errors.push(
            `${EXCHANGE_LABELS[ex]}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      setMsg(
        errors.length === 0
          ? `Готово — обновлено ${upserted} записей`
          : `Обновлено ${upserted} записей. Ошибки: ${errors.join("; ")}`,
      );

      // Свежие сделки — на дашборд сразу, без ручного pull-to-refresh.
      await loadDashboard();
    } catch (e) {
      if (isPremiumRequired(e)) {
        setMsg(null);
        router.push("/paywall");
        return;
      }
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setSyncBusy(false);
    }
  }, [syncBusy, subLoading, isPremium, router, loadDashboard, mountedRef]);

  const pnlColor = useMemo(() => {
    if (allTime.net > 0) return colors.profit;
    if (allTime.net < 0) return colors.loss;
    return colors.textMuted;
  }, [allTime.net]);

  const premiumBadgeText = useMemo(() => {
    if (subLoading) return "…";
    if (!isPremium) return "FREE";
    if (entitlement?.source === "allowlist") return "PREMIUM · BETA";
    if (entitlement?.source === "manual") return "PREMIUM · GRANT";
    return "PREMIUM";
  }, [isPremium, entitlement, subLoading]);

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
      {/* Шапка: бренд + статус подписки (как заголовок сайта) */}
      <View style={styles.header}>
        <Text style={styles.brand} numberOfLines={1}>
          FUTURES_
          <Text style={{ color: colors.accent }}>TRACKER</Text>
        </Text>
        <View style={[styles.badge, isPremium && styles.badgePremium]}>
          <Text style={[styles.badgeText, isPremium && styles.badgeTextPremium]}>
            {premiumBadgeText}
          </Text>
        </View>
      </View>

      {!isPremium && (
        <Pressable
          style={styles.premiumCard}
          onPress={handlePremiumPress}
          accessibilityRole="button"
        >
          <View style={styles.premiumCardContent}>
            <Text style={styles.premiumCardTitle}>Upgrade to Premium</Text>
            <Text style={styles.premiumCardDesc}>
              Авто-синк сделок с бирж · Безлимит ручных сделок
            </Text>
          </View>
          <Text style={styles.premiumCardArrow}>→</Text>
        </Pressable>
      )}

      {/* Hero: итог по сделкам. Кнопка «Синхрон.» запускает НАСТОЯЩИЙ
          синк с биржами через серверный мост (как «Синк всё» на сайте):
          прогресс — в строке статуса под карточкой, до ~60 с на биржу. */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>ИТОГ ПО СДЕЛКАМ</Text>
          <Pressable
            style={[
              styles.syncButton,
              (syncBusy || state === "refreshing") && styles.syncButtonBusy,
            ]}
            onPress={handleSync}
            disabled={syncBusy || state === "refreshing"}
            accessibilityRole="button"
            accessibilityLabel="Синхронизировать сделки с биржами"
          >
            {syncBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync" size={14} color="#fff" />
            )}
            <Text style={styles.syncText}>
              {syncBusy ? "Синк…" : "Синхрон."}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.heroValue, { color: pnlColor }]}>
          {fmtPnl(allTime.net)}
          <Text style={styles.heroSuffix}> USDT</Text>
        </Text>
        <Text style={styles.heroSub}>
          {exchangeFilter === "all"
            ? `Все биржи · ${allTime.count} ${plural(allTime.count, "сделка", "сделки", "сделок")}`
            : `${exchangeLabel(exchangeFilter)} · ${allTime.count} ${plural(allTime.count, "сделка", "сделки", "сделок")}`}
        </Text>
        {syncMsg && <Text style={styles.syncStatus}>{syncMsg}</Text>}
      </View>

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

      {/* Кнопки действий */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleAddTrade}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.actionButtonTextDark}>Сделка</Text>
        </Pressable>
        {EXCHANGE_CONNECTIONS_ENABLED && (
          <Pressable
            style={[styles.actionButton, !isPremium && styles.actionButtonLocked]}
            onPress={handleAddExchange}
          >
            <Ionicons
              name={isPremium ? "sync" : "lock-closed"}
              size={18}
              color={colors.text}
            />
            <Text style={styles.actionButtonText}>Биржа</Text>
          </Pressable>
        )}
      </View>

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgePremium: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  badgeTextPremium: { color: colors.accent },
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  premiumCardContent: { flex: 1, gap: 4 },
  premiumCardTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  premiumCardDesc: {
    fontSize: 11,
    color: "#fff",
    opacity: 0.9,
    lineHeight: 15,
  },
  premiumCardArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  heroLabel: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  syncButtonBusy: { opacity: 0.7 },
  syncText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  syncStatus: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroSuffix: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  heroSub: { fontSize: 12, color: colors.textMuted },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionButtonLocked: { opacity: 0.7 },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.text },
  actionButtonTextDark: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
