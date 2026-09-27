import { PnlValue } from "@/components/PnlValue";
import { StatCard } from "@/components/StatCard";
import { useSubscription } from "@/hooks/useSubscription";
import { useTrades } from "@/hooks/useTrades";
import { api } from "@/services/api";
import {
  calculateAllTimeWinRate,
  calculateMonthStats,
  calculateTotalNetPnl,
  fmtDate,
  fmtPnl,
  groupTradesByMonth
} from "@/shared/trade-model";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function DashboardScreen() {
  const { trades, loading, reload } = useTrades();
  const { isPremium } = useSubscription();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const totalNet = calculateTotalNetPnl(trades);
  const chartData = groupTradesByMonth(trades);
  const activeMonth = chartData[chartData.length - 1]?.month ?? null;
  const monthStats = activeMonth
    ? calculateMonthStats(trades, activeMonth)
    : null;
  const totalWinRate = calculateAllTimeWinRate(trades);
  const recentTrades = trades.slice(0, 10);

  const syncAll = useCallback(async () => {
    setSyncing("syncing");
    setSyncMsg(null);
    let upserted = 0;
    for (const ex of EXCHANGES) {
      try {
        const res = await api.syncExchange(ex);
        if (res.ok) upserted += res.upserted ?? 0;
      } catch (e) {
        // ignore individual exchange errors
      }
    }
    setSyncing(null);
    setSyncMsg(`Обновлено ${upserted} записей`);
    await reload();
  }, [reload]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={reload}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Итог по сделкам</Text>
          <PnlValue value={totalNet} size={32} />
          <Text style={styles.hint}>{trades.length} сделок</Text>
        </View>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={isPremium ? syncAll : undefined}
          disabled={!!syncing}
        >
          <Text style={styles.syncButtonText}>
            {syncing ? "Синк..." : isPremium ? "Синк всё" : "Premium"}
          </Text>
        </TouchableOpacity>
      </View>

      {syncMsg && <Text style={styles.syncMsg}>{syncMsg}</Text>}

      {!isPremium && (
        <TouchableOpacity
          style={styles.premiumBanner}
          onPress={() => router.push("/paywall")}
        >
          <Text style={styles.premiumText}>
            Premium — авто-синк бирж, push-уведомления, экспорт CSV
          </Text>
        </TouchableOpacity>
      )}

      {monthStats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Статистика {activeMonth}</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Сделок" value={String(monthStats.tradesCount)} />
            <StatCard label="Win-rate" value={`${monthStats.winRate}%`} />
            <StatCard
              label="Итог"
              value={<PnlValue value={monthStats.netPnl} size={16} />}
            />
            <StatCard
              label="Прибыль"
              value={<PnlValue value={monthStats.grossProfit} size={16} />}
            />
            <StatCard
              label="Убыток"
              value={<PnlValue value={monthStats.grossLoss} size={16} />}
            />
            <StatCard label="Win-rate всего" value={`${totalWinRate}%`} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Последние сделки</Text>
        {recentTrades.map((t) => {
          const net = t.realized_pnl - t.fee + t.funding;
          return (
            <View key={t.id} style={styles.tradeRow}>
              <View style={styles.tradeLeft}>
                <View
                  style={[
                    styles.sideBadge,
                    t.side === "long" ? styles.longBadge : styles.shortBadge,
                  ]}
                >
                  <Text style={styles.sideText}>
                    {t.side === "long" ? "LONG" : "SHORT"}
                  </Text>
                </View>
                <Text style={styles.symbol}>{t.symbol}</Text>
                <Text style={styles.exchange}>
                  {EXCHANGE_LABELS[t.exchange] ?? t.exchange}
                </Text>
              </View>
              <View style={styles.tradeRight}>
                <Text style={styles.date}>{fmtDate(t.closed_at)}</Text>
                <Text
                  style={[
                    styles.pnl,
                    { color: net >= 0 ? colors.profit : colors.loss },
                  ]}
                >
                  {fmtPnl(net)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

import { useRouter } from "expo-router";
const router = useRouter();

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.textFaint,
    letterSpacing: 1,
    marginBottom: 4,
  },
  hint: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  syncButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  syncMsg: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  premiumBanner: {
    backgroundColor: colors.profitDim,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  premiumText: { color: colors.profit, fontSize: 12 },
  statsSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    color: colors.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: { marginBottom: 20 },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  tradeRight: { alignItems: "flex-end", gap: 4 },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  longBadge: { backgroundColor: colors.profitDim },
  shortBadge: { backgroundColor: colors.lossDim },
  sideText: { fontSize: 9, fontWeight: "600", color: colors.text },
  symbol: { fontSize: 13, fontWeight: "500", color: colors.text },
  exchange: { fontSize: 10, color: colors.textFaint },
  date: { fontSize: 10, color: colors.textFaint },
  pnl: { fontSize: 13, fontWeight: "600" },
});
