import { BalanceForm } from "@/components/balance/BalanceForm";
import { BalanceRow } from "@/components/balance/BalanceRow";
import { TrendLoader } from "@/components/TrendLoader";
import { useBalanceSnapshots } from "@/hooks/useBalanceSnapshots";
import { colors } from "@/theme/colors";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Экран «Баланс» — снапшоты спот/фьючерс депозитов.
 *
 * ⚠️ История бага: раньше читал данные с несуществующего REST-энда /
 * api/balance (бэкенд отвечал HTML) и не имел формы добавления — экран
 * вечно показывал «Нет записей» без способа их создать. Теперь чтение
 * и запись идут напрямую в Supabase (RLS), добавление — upsert по
 * (user_id, type, snapshot_date), удаление — долгое нажатие на запись.
 *
 * После декомпозиции: данные — useBalanceSnapshots, форма записи —
 * BalanceForm, карточка снапшота — BalanceRow.
 */
export default function BalanceScreen() {
  const { snapshots, loading, error, load, confirmDelete } =
    useBalanceSnapshots();

  if (loading && snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <TrendLoader />
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <BalanceForm onSaved={load} />

      <Text style={styles.title}>Спот-баланс</Text>
      {spot.length === 0 ? (
        <Text style={styles.empty}>Нет записей</Text>
      ) : (
        spot.map((s) => (
          <BalanceRow key={s.id} snapshot={s} onDelete={confirmDelete} />
        ))
      )}

      <Text style={[styles.title, { marginTop: 24 }]}>Фьючерсный депозит</Text>
      {futures.length === 0 ? (
        <Text style={styles.empty}>Нет записей</Text>
      ) : (
        futures.map((s) => (
          <BalanceRow key={s.id} snapshot={s} onDelete={confirmDelete} />
        ))
      )}

      <Text style={styles.hint}>
        Долгое нажатие на записи — удаление. Одна запись на тип и дату
        (повторное сохранение обновляет её).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
    marginTop: 8,
  },
  empty: { color: colors.textFaint, textAlign: "center", padding: 20 },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 16,
  },
});
