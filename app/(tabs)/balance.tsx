import { api } from "@/services/api";
import type { BalanceSnapshot } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function BalanceScreen() {
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBalance();
      if (mountedRef.current) {
        setSnapshots(data.snapshots ?? []);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  if (loading && snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Загрузка баланса…</Text>
      </View>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось загрузить</Text>
        <Text style={styles.muted}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spot = snapshots.filter((s) => s.type === "spot");
  const futures = snapshots.filter((s) => s.type === "futures");

  const renderItem = (s: BalanceSnapshot) => (
    <View key={s.id} style={styles.row}>
      <View>
        <Text style={styles.value}>${Number(s.value_usd).toFixed(2)}</Text>
        <Text style={styles.date}>{s.snapshot_date}</Text>
      </View>
      {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Спот-баланс</Text>
      {spot.length === 0 ? (
        <Text style={styles.empty}>Нет записей</Text>
      ) : (
        spot.map(renderItem)
      )}

      <Text style={[styles.title, { marginTop: 24 }]}>Фьючерсный депозит</Text>
      {futures.length === 0 ? (
        <Text style={styles.empty}>Нет записей</Text>
      ) : (
        futures.map(renderItem)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
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
  title: {
    fontSize: 11,
    textTransform: "uppercase",
    color: colors.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  value: { fontSize: 16, fontWeight: "600", color: colors.text },
  date: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  note: { fontSize: 11, color: colors.textMuted, maxWidth: 120 },
  empty: { color: colors.textFaint, textAlign: "center", padding: 20 },
});
