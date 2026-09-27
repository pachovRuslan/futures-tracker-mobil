import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { colors } from "@/theme/colors";
import { fmtPnl } from "@/shared/trade-model";

export default function BalanceScreen() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getBalance();
      setSnapshots(data.snapshots ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const spot = snapshots.filter((s) => s.type === "spot");
  const futures = snapshots.filter((s) => s.type === "futures");

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Спот-баланс</Text>
      {spot.length === 0 ? <Text style={styles.empty}>Нет записей</Text> : spot.map((s) => (
        <View key={s.id} style={styles.row}>
          <View>
            <Text style={styles.value}>${Number(s.value_usd).toFixed(2)}</Text>
            <Text style={styles.date}>{s.snapshot_date}</Text>
          </View>
          {s.note && <Text style={styles.note}>{s.note}</Text>}
        </View>
      ))}

      <Text style={[styles.title, { marginTop: 24 }]}>Фьючерсный депозит</Text>
      {futures.length === 0 ? <Text style={styles.empty}>Нет записей</Text> : futures.map((s) => (
        <View key={s.id} style={styles.row}>
          <View>
            <Text style={styles.value}>${Number(s.value_usd).toFixed(2)}</Text>
            <Text style={styles.date}>{s.snapshot_date}</Text>
          </View>
          {s.note && <Text style={styles.note}>{s.note}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontSize: 11, textTransform: "uppercase", color: colors.textFaint, letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 8 },
  value: { fontSize: 16, fontWeight: "600", color: colors.text },
  date: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  note: { fontSize: 11, color: colors.textMuted, maxWidth: 120 },
  empty: { color: colors.textFaint, textAlign: "center", padding: 20 },
});