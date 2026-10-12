import { TradeNotesForm } from "@/components/trade/TradeNotesForm";
import { TradeSummaryCard } from "@/components/trade/TradeSummaryCard";
import { TradeForm } from "@/components/TradeForm";
import { TrendLoader } from "@/components/TrendLoader";
import { useI18n } from "@/i18n/I18nContext";
import { useEditableTrade } from "@/hooks/useEditableTrade";
import { useTradeMutations } from "@/hooks/useTradeMutations";
import { formatUserDateTime } from "@/shared/datetime";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Редактирование сделки.
 *
 * Семантика — как на сайте:
 *   - manual-сделки: редактируются все поля (синканные всё равно
 *     перезапишет следующий синк);
 *   - прочие биржи: редактируются только заметки;
 *   - удаление — только manual.
 *
 * Запись идёт напрямую в Supabase — RLS-политики update/delete own
 * trades пропускают только строки владельца.
 *
 * Загрузка — useEditableTrade, мутации — useTradeMutations, сводка —
 * TradeSummaryCard, редактор заметки — TradeNotesForm. Здесь осталось:
 * ранние состояния и раскладка.
 */
export default function EditTradeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { trade, loading, loadError, notes, setNotes } = useEditableTrade(
    id ?? "",
  );

  const { saving, handleUpdate, handleSaveNotes, handleDelete } =
    useTradeMutations({ trade, notes });

  const isManual = trade?.exchange === "manual";

  if (loading) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>{t("trade.loading")}</Text>
      </View>
    );
  }

  if (loadError || !trade) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t("common.loadFailed")}</Text>
        <Text style={styles.muted}>
          {loadError ?? t("trade.notFound")}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: t("trade.editTitle"), headerShown: true }}
      />

      {/* Сводка по сделке (для не-manual — единственный контекст). */}
      <TradeSummaryCard trade={trade} />

      {isManual ? (
        <TradeForm
          initial={{
            symbol: trade.symbol,
            side: trade.side,
            qty: trade.qty != null ? String(trade.qty) : "",
            entryPrice: trade.entry_price != null ? String(trade.entry_price) : "",
            closePrice: trade.close_price != null ? String(trade.close_price) : "",
            realizedPnl: String(trade.realized_pnl),
            fee: String(trade.fee),
            funding: String(trade.funding),
            openedAt: formatUserDateTime(trade.opened_at),
            closedAt: formatUserDateTime(trade.closed_at),
            notes: trade.notes ?? "",
          }}
          submitLabel={t("trade.saveChanges")}
          submitting={saving}
          onSubmit={handleUpdate}
        />
      ) : (
        <TradeNotesForm
          notes={notes}
          onChangeNotes={setNotes}
          saving={saving}
          onSave={handleSaveNotes}
        />
      )}

      {isManual && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>{t("trade.deleteButton")}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 4 },
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
  deleteButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.lossDim,
    backgroundColor: colors.surface,
  },
  deleteButtonText: { color: colors.loss, fontSize: 14, fontWeight: "600" },
});
