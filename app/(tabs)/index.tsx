import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface TradeRow {
  id: string;
  symbol: string;
  side: "long" | "short";
  pnl: number;
  pnl_percent: number;
  opened_at: string;
  closed_at: string | null;
  exchange: string;
}

interface DashboardStats {
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  activeTrades: number;
  todayPnl: number;
}

type LoadState = "idle" | "loading" | "refreshing" | "error" | "empty";

const FREE_TRADE_LIMIT = 50;
const SUCCESS_COLOR = "#22c55e";
const DANGER_COLOR = "#ef4444";

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, entitlement, loading: subLoading } = useSubscription();

  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      setState(isRefresh ? "refreshing" : "loading");
      setErrorMsg(null);

      try {
        if (!user?.id) {
          setState("empty");
          return;
        }

        const { data, error } = await supabase
          .from("trades")
          .select(
            "id, symbol, side, pnl, pnl_percent, opened_at, closed_at, exchange",
          )
          .eq("user_id", user.id)
          .order("opened_at", { ascending: false })
          .limit(50);

        if (error) throw new Error(error.message);

        const rows: TradeRow[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          symbol: r.symbol ?? "—",
          side: r.side === "short" ? "short" : "long",
          pnl: Number(r.pnl ?? 0),
          pnl_percent: Number(r.pnl_percent ?? 0),
          opened_at: r.opened_at ?? new Date().toISOString(),
          closed_at: r.closed_at ?? null,
          exchange: r.exchange ?? "—",
        }));

        setTrades(rows);

        const closed = rows.filter((t) => t.closed_at);
        const wins = closed.filter((t) => t.pnl > 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTrades = closed.filter(
          (t) => new Date(t.closed_at!).getTime() >= today.getTime(),
        );

        setStats({
          totalPnl: closed.reduce((sum, t) => sum + t.pnl, 0),
          totalPnlPercent:
            closed.length > 0
              ? closed.reduce((sum, t) => sum + t.pnl_percent, 0) /
                closed.length
              : 0,
          winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
          totalTrades: rows.length,
          activeTrades: rows.filter((t) => !t.closed_at).length,
          todayPnl: todayTrades.reduce((sum, t) => sum + t.pnl, 0),
        });

        setState(rows.length > 0 ? "idle" : "empty");
      } catch (e) {
        console.error("[Dashboard] load error:", e);
        setErrorMsg(e instanceof Error ? e.message : "Неизвестная ошибка");
        setState("error");
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAddTrade = useCallback(() => {
    if (!isPremium && stats && stats.totalTrades >= FREE_TRADE_LIMIT) {
      router.push("/paywall");
      return;
    }
    // ЭКРАН /trade/new ЕЩЁ НЕ СОЗДАН — это заглушка.
    // Когда создашь app/trade/new.tsx, замени Alert на router.push("/trade/new").
    Alert.alert(
      "В разработке",
      "Экран добавления сделки ещё не реализован. Создайте app/trade/new.tsx.",
    );
    // router.push("/trade/new");
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
    if (stats.totalPnl > 0) return SUCCESS_COLOR;
    if (stats.totalPnl < 0) return DANGER_COLOR;
    return colors.textMuted;
  }, [stats]);

  const premiumBadgeText = useMemo(() => {
    if (subLoading) return "…";
    if (!isPremium) return "FREE";
    if (entitlement?.source === "allowlist") return "PREMIUM · BETA";
    if (entitlement?.source === "manual") return "PREMIUM · GRANT";
    if (entitlement?.source === "revenuecat") return "PREMIUM";
    return "PREMIUM";
  }, [isPremium, entitlement, subLoading]);

  const greetingName = useMemo(() => {
    if (!user) return "";
    const meta = (user as any).user_metadata ?? {};
    const fullName: string = meta.full_name || meta.name || "";
    if (fullName) {
      return fullName.split(" ")[0];
    }
    if (user.email) {
      return user.email.split("@")[0];
    }
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
          <Text
            style={[styles.badgeText, isPremium && styles.badgeTextPremium]}
          >
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
              Авто-синк бирж · Push-уведомления · Экспорт CSV · Безлимит сделок
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
              <Text style={styles.pnlMetaLabel}>ROI</Text>
              <Text style={[styles.pnlMetaValue, { color: pnlColor }]}>
                {stats.totalPnlPercent >= 0 ? "+" : ""}
                {stats.totalPnlPercent.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.pnlMetaDivider} />
            <View style={styles.pnlMetaItem}>
              <Text style={styles.pnlMetaLabel}>Сегодня</Text>
              <Text
                style={[
                  styles.pnlMetaValue,
                  {
                    color: stats.todayPnl >= 0 ? SUCCESS_COLOR : DANGER_COLOR,
                  },
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
              Добавьте первую сделку, чтобы начать отслеживать P&L
            </Text>
            <Pressable style={styles.emptyStateButton} onPress={handleAddTrade}>
              <Text style={styles.emptyStateButtonText}>+ Добавить сделку</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.tradesList}>
            {trades.slice(0, 5).map((trade) => {
              const isLong = trade.side === "long";
              const isPositive = trade.pnl >= 0;
              const isOpen = !trade.closed_at;
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
                      {trade.exchange} ·{" "}
                      {isOpen
                        ? "открыта"
                        : new Date(trade.closed_at!).toLocaleDateString(
                            "ru-RU",
                          )}
                    </Text>
                  </View>
                  <View style={styles.tradePnl}>
                    <Text
                      style={[
                        styles.tradePnlValue,
                        {
                          color: isPositive ? SUCCESS_COLOR : DANGER_COLOR,
                        },
                      ]}
                    >
                      {isPositive ? "+" : ""}
                      {trade.pnl.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.tradePnlPercent,
                        {
                          color: isPositive ? SUCCESS_COLOR : DANGER_COLOR,
                        },
                      ]}
                    >
                      {isPositive ? "+" : ""}
                      {trade.pnl_percent.toFixed(1)}%
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
  tradeSideLong: { backgroundColor: SUCCESS_COLOR },
  tradeSideShort: { backgroundColor: DANGER_COLOR },
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
  tradePnlPercent: { fontSize: 11, fontWeight: "500" },
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
  emptyStateButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  emptyStateButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
