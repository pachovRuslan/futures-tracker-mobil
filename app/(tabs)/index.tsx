import { Ionicons } from "@expo/vector-icons";

import { TrendLoader } from "@/components/TrendLoader";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getSupabase } from "@/services/auth";
import {
  EXCHANGE_CONNECTIONS_ENABLED,
  FREE_TRADE_LIMIT,
  TRADES_PAGE_SIZE,
} from "@/shared/config";
import type { TradeRow } from "@/shared/types";
import {
  fmt,
  fmtDate,
  fmtPnl,
  tradeNetPnl,
} from "@/shared/trade-model";
import { EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LoadState = "idle" | "loading" | "refreshing" | "error" | "empty";

/** Колонки, нужные списку «Последние сделки» (без тяжёлого JSONB raw). */
const LIST_SELECT = [
  "id",
  "exchange",
  "symbol",
  "side",
  "qty",
  "entry_price",
  "close_price",
  "realized_pnl",
  "fee",
  "funding",
  "opened_at",
  "closed_at",
  "notes",
].join(", ");

/**
 * Колонки для агрегатов: P&L, win-rate, комиссии, фандинг, месячный ряд.
 * exchange — для клиентского фильтра по биржам (чипы «БИРЖИ В PNL»).
 */
const STATS_SELECT = [
  "exchange",
  "realized_pnl",
  "fee",
  "funding",
  "closed_at",
].join(", ");

type ClosedRow = {
  exchange: string;
  realized_pnl: number;
  fee: number;
  funding: number;
  closed_at: string | null;
};

/**
 * Строка RPC get_trade_stats() (миграция 11): агрегаты биржа × месяц
 * по ВСЕМ закрытым сделкам — вместо клиентского расчёта по последним
 * TRADES_PAGE_SIZE, который занижал итог у трейдеров с >500 сделками.
 */
interface StatsRow {
  exchange: string;
  /** "YYYY-MM" */
  month: string;
  trades: number;
  wins: number;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  fee: number;
  funding: number;
}

/**
 * Fallback-расчёт (RPC недоступен — миграция 11 не применена):
 * те же строки StatsRow, посчитанные на клиенте по последним N
 * закрытым сделкам. Форма данных идентична — весь код ниже
 * не различает источник.
 */
function aggregateClosedToStats(rows: ClosedRow[]): StatsRow[] {
  const map = new Map<string, StatsRow>();
  for (const t of rows) {
    if (t.closed_at == null) continue;
    const month = t.closed_at.slice(0, 7);
    const key = `${t.exchange}|${month}`;
    const row =
      map.get(key) ??
      {
        exchange: t.exchange,
        month,
        trades: 0,
        wins: 0,
        net_pnl: 0,
        gross_profit: 0,
        gross_loss: 0,
        fee: 0,
        funding: 0,
      };
    const pnl = tradeNetPnl(t);
    row.trades += 1;
    if (pnl > 0) row.wins += 1;
    row.net_pnl += pnl;
    if (pnl > 0) row.gross_profit += pnl;
    else row.gross_loss += pnl;
    row.fee += t.fee;
    row.funding += t.funding;
    map.set(key, row);
  }
  return Array.from(map.values());
}

const MONTH_LABELS = [
  "ЯНВ",
  "ФЕВ",
  "МАР",
  "АПР",
  "МАЙ",
  "ИЮН",
  "ИЮЛ",
  "АВГ",
  "СЕН",
  "ОКТ",
  "НОЯ",
  "ДЕК",
];

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Минимум месяцев на графике — окно «последние 6» даже без данных. */
const CHART_MIN_MONTHS = 6;
/** Максимум месяцев: при большей истории график скроллится (как расширяющийся на сайте),
 *  но не рисует сотни баров — сейчас кап 2 года. */
const CHART_MAX_MONTHS = 24;
/** Высота области баров, px (совпадает со стилями chartBars/chartScroll). */
const CHART_HEIGHT_PX = 110;
/** Запас под подпись месяца (gap + строка 9pt), px. */
const CHART_LABEL_RESERVE_PX = 20;
/** Ширина бара в режиме скролла (>6 месяцев), px. */
const CHART_BAR_WIDTH_PX = 44;

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPremium, entitlement, loading: subLoading } = useSubscription();

  const [trades, setTrades] = useState<TradeRow[]>([]);
  /** Агрегаты биржа × месяц: из RPC get_trade_stats (по ВСЕМ сделкам)
 *  либо fallback-расчёт по последним TRADES_PAGE_SIZE закрытым. */
  const [statRows, setStatRows] = useState<StatsRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exchangeFilter, setExchangeFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setState("empty");
        return;
      }

      setState(isRefresh ? "refreshing" : "loading");
      setErrorMsg(null);

      try {
        const supabase = getSupabase();

        // ⚠️ История бага: раньше ВСЯ статистика считалась по последним 50
        // сделкам (.limit(50)) — из-за этого «ОБЩИЙ P&L» и «СДЕЛОК» были
        // занижены для пользователей с >50 сделками. Волна 2: агрегаты
        // берутся из серверного RPC get_trade_stats (миграция 11) по ВСЕМ
        // закрытым сделкам; totalTrades — точный COUNT (head-запрос).
        // Если RPC недоступен (миграция не применена) — fallback на
        // клиентский расчёт по последним TRADES_PAGE_SIZE, как в волне 1.
        const [list, countRes, rpcRes] = await Promise.all([
          supabase
            .from("trades")
            .select(LIST_SELECT)
            .order("closed_at", { ascending: false, nullsFirst: false })
            .limit(50),
          supabase.from("trades").select("id", { head: true, count: "exact" }),
          supabase.rpc("get_trade_stats"),
        ]);

        const listError = list.error ?? countRes.error;
        if (listError) throw new Error(listError.message);

        let rows: StatsRow[];
        if (rpcRes.error || !rpcRes.data) {
          if (__DEV__) {
            console.warn(
              "[Dashboard] get_trade_stats RPC недоступен, fallback на последние",
              TRADES_PAGE_SIZE,
              "сделок:",
              rpcRes.error?.message,
            );
          }
          const legacy = await supabase
            .from("trades")
            .select(STATS_SELECT)
            .not("closed_at", "is", null)
            .order("closed_at", { ascending: false })
            .limit(TRADES_PAGE_SIZE);
          if (legacy.error) throw new Error(legacy.error.message);
          rows = aggregateClosedToStats(
            (legacy.data ?? []) as unknown as ClosedRow[],
          );
        } else {
          rows = rpcRes.data as unknown as StatsRow[];
        }

        if (!mountedRef.current) return;

        setTrades((list.data ?? []) as unknown as TradeRow[]);
        setStatRows(rows);
        setTotalCount(countRes.count ?? list.data?.length ?? 0);
        setState(
          (countRes.count ?? 0) > 0 || (list.data?.length ?? 0) > 0
            ? "idle"
            : "empty",
        );
      } catch (e) {
        if (!mountedRef.current) return;
        if (__DEV__) console.error("[Dashboard] load error:", e);
        setErrorMsg(e instanceof Error ? e.message : "Неизвестная ошибка");
        setState("error");
      }
    },
    [user?.id],
  );

  // Перезагрузка при каждом появлении экрана (после добавления сделки,
  // возврата с других табов) вместо одноразового mount-эффекта.
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      loadDashboard();
      return () => {
        mountedRef.current = false;
      };
    }, [loadDashboard]),
  );

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
  }, [isPremium]);

  // ── Фильтр по биржам (чипы «БИРЖИ В PNL», как на вебе) ───────────────────

  const exchanges = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) set.add(t.exchange);
    for (const r of statRows) set.add(r.exchange);
    return Array.from(set).sort();
  }, [trades, statRows]);

  const filteredRows = useMemo(
    () =>
      exchangeFilter === "all"
        ? statRows
        : statRows.filter((r) => r.exchange === exchangeFilter),
    [statRows, exchangeFilter],
  );

  const filteredRecent = useMemo(
    () =>
      exchangeFilter === "all"
        ? trades
        : trades.filter((t) => t.exchange === exchangeFilter),
    [trades, exchangeFilter],
  );

  // ── Агрегаты: всё время + текущий месяц (сетка статистики 3×3) ───────────

  const now = useMemo(() => new Date(), []);
  const curMonthKey = monthKey(now);
  /** Месяц в сетке статистики: выбранный на графике или текущий. */
  const activeMonthKey = selectedMonth ?? curMonthKey;

  const allTime = useMemo(() => {
    let net = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let fees = 0;
    let funding = 0;
    let count = 0;
    let wins = 0;
    for (const r of filteredRows) {
      net += r.net_pnl;
      grossProfit += r.gross_profit;
      grossLoss += r.gross_loss;
      fees += r.fee;
      funding += r.funding;
      count += r.trades;
      wins += r.wins;
    }
    return {
      net,
      grossProfit,
      grossLoss,
      fees,
      funding,
      // Семантика wins — как на сайте и в RPC: net_pnl > 0.
      winRate: count > 0 ? (wins / count) * 100 : 0,
      // При фильтре «все» показываем totalCount (включая открытые
      // позиции) — это же число гейтит FREE-лимит.
      count: exchangeFilter === "all" ? totalCount : count,
    };
  }, [filteredRows, totalCount, exchangeFilter]);

  const month = useMemo(() => {
    let net = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let count = 0;
    let wins = 0;
    for (const r of filteredRows) {
      if (r.month !== activeMonthKey) continue;
      net += r.net_pnl;
      grossProfit += r.gross_profit;
      grossLoss += r.gross_loss;
      count += r.trades;
      wins += r.wins;
    }
    return {
      net,
      grossProfit,
      grossLoss,
      count,
      winRate: count > 0 ? (wins / count) * 100 : 0,
    };
  }, [filteredRows, activeMonthKey]);

  // ── Ряд для бар-чарта «PnL по месяцам» (последние 6 месяцев) ─────────────

  const monthly = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const r of filteredRows) {
      byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.net_pnl);
    }

    // Диапазон графика: от самого старого месяца с данными до текущего.
    // Как на сайте — график «расширяется», когда истории больше полугода;
    // при >CHART_MAX_MONTHS месяцев рисуем последнее окно (кап — чтобы не
    // строить сотни баров). Минимум — окно в 6 месяцев, как было раньше.
    let monthsBack = CHART_MIN_MONTHS - 1;
    if (byMonth.size > 0) {
      // Формат "YYYY-MM" сортируется лексикографически как дата.
      const oldestKey = [...byMonth.keys()].sort()[0];
      const [y, m] = oldestKey.split("-").map(Number);
      const back =
        (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
      monthsBack = Math.min(
        Math.max(back, CHART_MIN_MONTHS - 1),
        CHART_MAX_MONTHS - 1,
      );
    }

    const series: Array<{ key: string; label: string; value: number; isCurrent: boolean }> = [];
    for (let i = monthsBack; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      series.push({
        key,
        label: MONTH_LABELS[d.getMonth()],
        value: byMonth.get(key) ?? 0,
        isCurrent: key === curMonthKey,
      });
    }
    return series;
  }, [filteredRows, now, curMonthKey]);

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
    : `${allTime.count} ${plural(allTime.count, "сделка", "сделки", "сделок")} · ${monthly.filter((m) => m.value !== 0).length || 1} мес.`;

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

  const monthTitle = activeMonthKey;

  /**
   * Отрисовка одного бара месячного графика (общая для обоих режимов).
   *
   * Высота бара — в пикселях, а не в %: при фиксированной высоте области
   * (CHART_HEIGHT_PX) это ведёт себя одинаково и в обычном flex-режиме, и в
   * горизонтальном скролле.
   */
  const renderChartBar = (m: {
    key: string;
    label: string;
    value: number;
    isCurrent: boolean;
  }) => {
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
          setSelectedMonth(selectedMonth === m.key ? null : m.key)
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

      {/* Hero: итог по сделкам (кнопка «Синхрон.» — как на вебе) */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>ИТОГ ПО СДЕЛКАМ</Text>
          <Pressable
            style={styles.syncButton}
            onPress={() => loadDashboard(true)}
            disabled={state === "refreshing"}
            accessibilityRole="button"
            accessibilityLabel="Синхронизировать"
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.syncText}>Синхрон.</Text>
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
      </View>

      {/* Чипы фильтра бирж */}
      {exchanges.length > 1 && (
        <View style={styles.chipsBlock}>
          <Text style={styles.chipsLabel}>БИРЖИ В PNL</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <Pressable
              style={[
                styles.chip,
                exchangeFilter === "all" && styles.chipActive,
              ]}
              onPress={() => setExchangeFilter("all")}
            >
              {exchangeFilter === "all" && (
                <Ionicons name="checkmark" size={13} color={colors.accent} />
              )}
              <Text
                style={[
                  styles.chipText,
                  exchangeFilter === "all" && styles.chipTextActive,
                ]}
              >
                Все
              </Text>
            </Pressable>
            {exchanges.map((ex) => (
              <Pressable
                key={ex}
                style={[
                  styles.chip,
                  exchangeFilter === ex && styles.chipActive,
                ]}
                onPress={() => setExchangeFilter(ex)}
              >
                {exchangeFilter === ex && (
                  <Ionicons name="checkmark" size={13} color={colors.accent} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    exchangeFilter === ex && styles.chipTextActive,
                  ]}
                >
                  {exchangeLabel(ex)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Сетка статистики 3×3 (месяц + всё время, как на вебе) */}
      <View style={styles.gridSection}>
        <View style={styles.gridHeaderRow}>
          <Text style={styles.gridHeaderTitle}>СТАТИСТИКА {monthTitle}</Text>
          {selectedMonth && (
            <Pressable onPress={() => setSelectedMonth(null)}>
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

      {/* Бар-чарт PnL по месяцам: при >6 месяцах — горизонтальный скролл,
          чтобы график «расширялся» как на сайте */}
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ПОСЛЕДНИЕ СДЕЛКИ</Text>
          {filteredRecent.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/trades")}>
              <Text style={styles.sectionLink}>Все сделки →</Text>
            </Pressable>
          )}
        </View>

        {filteredRecent.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Пока нет сделок</Text>
            <Text style={styles.emptyStateDesc}>
              Нажмите «Сделка», чтобы добавить первую и начать отслеживать P&L
            </Text>
          </View>
        ) : (
          <View style={styles.tradesPanel}>
            {filteredRecent.slice(0, 6).map((trade, i, arr) => {
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
    </ScrollView>
  );
}

/** Русская плюрализация: 1 сделка / 2 сделки / 5 сделок. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Безопасная метка биржи для строковых ключей (фильтр-чипы). */
function exchangeLabel(ex: string): string {
  return (EXCHANGE_LABELS as Record<string, string>)[ex] ?? ex;
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
  syncText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  heroValue: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroSuffix: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  heroSub: { fontSize: 12, color: colors.textMuted },
  chipsBlock: { gap: 8 },
  chipsLabel: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  chipsRow: { flexDirection: "row", gap: 6, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
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
