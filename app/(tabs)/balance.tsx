import { BalanceForm } from "@/components/balance/BalanceForm";
import { BalanceRow } from "@/components/balance/BalanceRow";
import { TrendLoader } from "@/components/TrendLoader";
import { useBalanceSnapshots } from "@/hooks/useBalanceSnapshots";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Экран «Баланс» — снапшоты спот/фьючерс депозитов.
 *
 * Чтение и запись идут напрямую в Supabase (RLS), добавление — upsert
 * по (user_id, type, snapshot_date), удаление — долгое нажатие на запись.
 *
 * Данные — useBalanceSnapshots, форма записи — BalanceForm, карточка
 * снапшота — BalanceRow.
 */
export default function BalanceScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { snapshots, loading, error, load, confirmDelete } =
    useBalanceSnapshots();

  if (loading && snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>{t("balance.loading")}</Text>
      </View>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t("common.loadFailed")}</Text>
        <Text style={styles.muted}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
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

      <Text style={styles.title}>{t("balance.spotTitle")}</Text>
      {spot.length === 0 ? (
        <Text style={styles.empty}>{t("balance.empty")}</Text>
      ) : (
        spot.map((s) => (
          <BalanceRow key={s.id} snapshot={s} onDelete={confirmDelete} />
        ))
      )}

      <Text style={[styles.title, { marginTop: 24 }]}>
        {t("balance.futuresTitle")}
      </Text>
      {futures.length === 0 ? (
        <Text style={styles.empty}>{t("balance.empty")}</Text>
      ) : (
        futures.map((s) => (
          <BalanceRow key={s.id} snapshot={s} onDelete={confirmDelete} />
        ))
      )}

      <Text style={styles.hint}>{t("balance.hint")}</Text>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
