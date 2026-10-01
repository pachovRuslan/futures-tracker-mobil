import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getSupabase } from "@/services/auth";
import { FREE_TRADE_LIMIT, TRADES_PAGE_SIZE } from "@/shared/config";
import type { TradeRow } from "@/shared/types";
import {
  calculateTotalNetPnl,
  calculateWinRate,
  tradeNetPnl,
} from "@/shared/trade-model";
import { EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface DashboardStats {
  totalPnl: number;
  avgPnlPerTrade: number;
  winRate: number;
  totalTrades: number;
  activeTrades: number;
  todayPnl: number;
}

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

/** Колонки для агрегатов (P&L, win rate). */
const STATS_SELECT = ["realized_pnl", "fee", "funding", "closed_at"].join(", ");

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, entitlement, loading: subLoading } = useSubscription();

  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
        // занижены для пользователей с >50 сделками, а гейт FREE-лимита
        // срабатывал случайно (50 >= 50). Теперь:
        //  - totalTrades — точный COUNT (head-запрос);
        //  - activeTrades — точный COUNT открытых;
        //  - P&L/win-rate — по последним TRADES_PAGE_SIZE закрытым сделкам
        //    (для >500 сделок нужен серверный агрегат-RPC, см. README).
        const [list, totalCount, openCount, statsRes] = await Promise.all([
          supabase
            .from("trades")
            .select(LIST_SELECT)
            .order("closed_at", { ascending: false, nullsFirst: false })
            .limit(50),
          supabase.from("trades").select("id", { head: true, count: "exact" }),
          supabase
            .from("trades")
            .select("id", { head: true, count: "exact" })
            .is("closed_at", null),
          supabase
            .from("trades")
            .select(STATS_SELECT)
            .not("closed_at", "is", null)
            .order("closed_at", { ascending: false })
            .limit(TRADES_PAGE_SIZE),
        ]);

        const listError = list.error ?? totalCount.error ?? openCount.error ?? statsRes.error;
        if (listError) throw new Error(listError.message);

        if (!mountedRef.current) return;

        const recent: TradeRow[] = (list.data ?? []) as unknown as TradeRow[];
        const closedStats = (statsRes.data ?? []) as unknown as Array<{
          realized_pnl: number;
          fee: number;
          funding: number;
          closed_at: string | null;
        }>;

        setTrades(recent);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayPnl = closedStats
          .filter(
            (t) =>
              t.closed_at != null &&
              new Date(t.closed_at).getTime() >= todayStart.getTime(),
          )
          .reduce((sum, t) => sum + tradeNetPnl(t), 0);

        const totalPnl = calculateTotalNetPnl(closedStats);
        const closedCount = closedStats.length;

        setStats({
          totalPnl,
          avgPnlPerTrade: closedCount > 0 ? totalPnl / closedCount : 0,
          winRate: calculateWinRate(closedStats),
          totalTrades: totalCount.count ?? recent.length,
          activeTrades: openCount.count ?? 0,
          todayPnl,
        });

        setState(
          (totalCount.count ?? recent.length) > 0 || recent.length > 0
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
    if (!isPremium && stats && stats.totalTrades >= FREE_TRADE_LIMIT) {
      router.push("/paywall");
      return;
    }
    router.push("/trade/new");
  }, [isPremium, stats, router]);

  const handleAddExchange = useCallback(() => {
    if (!isPremium) {
      router.push("/paywall");
      return;
    }
    router.push("/connections");
  }, [isPremium, router]);

  const handlePremiumPress = useCallback(() => {
    if (isPremium) return;
    router.push("/paywall");
  }, [isPremium, router]);

  const pnlColor = useMemo(() => {
    if (!stats) return colors.textMuted;
    if (stats.totalPnl > 0) return colors.profit;
    if (stats.totalPnl < 0) return colors.loss;
    return colors.textMuted;
  }, [stats]);

  const premiumBadgeText = useMemo(() => {
    if (subLoading) return "…";
    if (!isPremium) return "FREE";
    if (entitlement?.source === "allowlist") return "PREMIUM · BETA";
    if (entitlement?.source === "manual") return "PREMIUM · GRANT";
    return "PREMIUM";
  }, [isPremium, entitlement, subLoading]);

  const greetingName = useMemo(() => {
    if (!user) return "";
    const meta = user.user_metadata ?? {};
    const fullName: string = meta.full_name || meta.name || "";
    if (fullName) return fullName.split(" ")[0];
    if (user.email) return user.email.split("@")[0];
    return "";
  }, [user]);

  if (state === "loading" && !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Загрузка дашборда…</Text>
      </View>
    );
  }

  if (state === "error" && !stats) {
    return (
      <View style={styles.center}>
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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={state === "refreshing"}
          onRefresh={() => loadDashboard(true)}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {greetingName ? (
            <>
              <Text style={styles.greeting}>Привет,</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {greetingName}
              </Text>
            </>
          ) : (
            <Text style={styles.userName} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
          )}
        </View>
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

      {stats && (
        <View style={styles.pnlCard}>
          <Text style={styles.pnlLabel}>ОБЩИЙ P&L</Text>
          <Text style={[styles.pnlValue, { color: pnlColor }]}>
            {stats.totalPnl >= 0 ? "+" : ""}
            {stats.totalPnl.toFixed(2)} USDT
          </Text>
          <View style={styles.pnlMeta}>
            <View style={styles.pnlMetaItem}>
              <Text style={styles.pnlMetaLabel}>AVG / TRADE</Text>
              <Text style={[styles.pnlMetaValue, { color: pnlColor }]}>
                {stats.avgPnlPerTrade >= 0 ? "+" : ""}
                {stats.avgPnlPerTrade.toFixed(2)} USDT
              </Text>
            </View>
            <View style={styles.pnlMetaDivider} />
            <View style={styles.pnlMetaItem}>
              <Text style={styles.pnlMetaLabel}>Сегодня</Text>
              <Text
                style={[
                  styles.pnlMetaValue,
                  { color: stats.todayPnl >= 0 ? colors.profit : colors.loss },
                ]}
              >
                {stats.todayPnl >= 0 ? "+" : ""}
                {stats.todayPnl.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>WIN RATE</Text>
            <Text style={styles.statCardValue}>
              {stats.winRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>СДЕЛОК</Text>
            <Text style={styles.statCardValue}>{stats.totalTrades}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>АКТИВНЫХ</Text>
            <Text style={styles.statCardValue}>{stats.activeTrades}</Text>
          </View>
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleAddTrade}
        >
          <Text style={styles.actionButtonIcon}>+</Text>
          <Text style={styles.actionButtonTextDark}>Сделка</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, !isPremium && styles.actionButtonLocked]}
          onPress={handleAddExchange}
        >
          <Text style={styles.actionButtonIcon}>{isPremium ? "↻" : "🔒"}</Text>
          <Text style={styles.actionButtonText}>Биржа</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Последние сделки</Text>
          {trades.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/trades")}>
              <Text style={styles.sectionLink}>Все →</Text>
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
          <View style={styles.tradesList}>
            {trades.slice(0, 5).map((trade) => {
              const isLong = trade.side === "long";
              const net = tradeNetPnl(trade);
              const isPositive = net >= 0;
              const isOpen = trade.closed_at == null;
              const rowPnlColor = isPositive ? colors.profit : colors.loss;
              return (
                <View key={trade.id} style={styles.tradeRow}>
                  <View
                    style={[
                      styles.tradeSideIndicator,
                      isLong ? styles.tradeSideLong : styles.tradeSideShort,
                    ]}
                  />
                  <View style={styles.tradeInfo}>
                    <View style={styles.tradeSymbolRow}>
                      <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
                      <View
                        style={[
                          styles.tradeSideBadge,
                          isLong ? styles.tradeSideLong : styles.tradeSideShort,
                        ]}
                      >
                        <Text style={styles.tradeSideText}>
                          {isLong ? "LONG" : "SHORT"}
                        </Text>
                      </View>
                      {isOpen && (
                        <View style={styles.tradeOpenBadge}>
                          <Text style={styles.tradeOpenText}>OPEN</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.tradeMeta}>
                      {EXCHANGE_LABELS[trade.exchange] ?? trade.exchange} ·{" "}
                      {isOpen
                        ? "открыта"
                        : new Date(trade.closed_at!).toLocaleDateString("ru-RU")}
                    </Text>
                  </View>
                  <View style={styles.tradePnl}>
                    <Text style={[styles.tradePnlValue, { color: rowPnlColor }]}>
                      {isPositive ? "+" : ""}
                      {net.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
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
  headerLeft: { flex: 1, gap: 2 },
  greeting: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  userName: { fontSize: 18, fontWeight: "600", color: colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  badgePremium: { backgroundColor: colors.accent },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  badgeTextPremium: { color: "#fff" },
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 16,
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
  pnlCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  pnlLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  pnlValue: { fontSize: 36, fontWeight: "700", letterSpacing: -0.5 },
  pnlMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  pnlMetaItem: { gap: 2 },
  pnlMetaLabel: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1,
  },
  pnlMetaValue: { fontSize: 14, fontWeight: "600" },
  pnlMetaDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.textFaint + "40",
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  statCardLabel: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1,
    fontWeight: "600",
  },
  statCardValue: { fontSize: 18, fontWeight: "700", color: colors.text },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  actionButtonPrimary: { backgroundColor: colors.accent },
  actionButtonLocked: { backgroundColor: colors.surface, opacity: 0.7 },
  actionButtonIcon: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "700",
  },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.text },
  actionButtonTextDark: { fontSize: 14, fontWeight: "600", color: "#fff" },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  sectionLink: { fontSize: 13, color: colors.accent, fontWeight: "500" },
  tradesList: { gap: 8 },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    overflow: "hidden",
  },
  tradeSideIndicator: { width: 3, height: 36, borderRadius: 2 },
  tradeSideLong: { backgroundColor: colors.profit },
  tradeSideShort: { backgroundColor: colors.loss },
  tradeInfo: { flex: 1, gap: 4 },
  tradeSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tradeSymbol: { fontSize: 14, fontWeight: "600", color: colors.text },
  tradeSideBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  tradeSideText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  tradeOpenBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  tradeOpenText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  tradeMeta: { fontSize: 11, color: colors.textMuted },
  tradePnl: { alignItems: "flex-end", gap: 2 },
  tradePnlValue: { fontSize: 14, fontWeight: "700" },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 12,
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
