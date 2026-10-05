import {
  TradeForm,
  parseNum,
  tradeDatesFromForm,
  validateTradeFormValues,
  type TradeFormValues,
} from "@/components/TradeForm";
import { TrendLoader } from "@/components/TrendLoader";
import { getSupabase } from "@/services/auth";
import { formatUserDateTime } from "@/shared/datetime";
import { tradeNetPnl, fmtPnl, fmtDate } from "@/shared/trade-model";
import type { TradeRow } from "@/shared/types";
import { EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Редактирование сделки (волна 2: раньше список сделок был read-only).
 *
 * Семантика — как на сайте (app/api/trades/[id]/route.ts):
 *   - manual-сделки: редактируются все поля (синканные всё равно
 *     перезапишет следующий синк);
 *   - прочие биржи: редактируются только заметки;
 *   - удаление — только manual.
 *
 * Запись идёт напрямую в Supabase — RLS-политики update/delete own
 * trades (миграция 02) пропускают только строки владельца.
 */

const EDIT_SELECT = [
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

export default function EditTradeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [trade, setTrade] = useState<TradeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Заметка для не-manual сделки (у manual — внутри TradeForm). */
  const [notes, setNotes] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("trades")
          .select(EDIT_SELECT)
          .eq("id", String(id))
          .single();
        if (!mountedRef.current) return;
        if (error) throw error;
        // Без codegen-типов supabase возвращает GenericStringError[] —
        // доверяем схеме docs/supabase.sql и приводим через unknown.
        const row = (data ?? null) as unknown as TradeRow | null;
        setTrade(row);
        setNotes(row?.notes ?? "");
      } catch (e) {
        if (!mountedRef.current) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [id]);

  const isManual = trade?.exchange === "manual";

  const handleUpdate = useCallback(
    async (values: TradeFormValues) => {
      if (!trade || saving) return;

      const validationError = validateTradeFormValues(values);
      if (validationError) {
        Alert.alert("Проверьте поля", validationError);
        return;
      }

      const { opened_at, closed_at } = tradeDatesFromForm(values);
      const update = {
        symbol: values.symbol.trim().toUpperCase(),
        side: values.side,
        qty: parseNum(values.qty),
        entry_price: parseNum(values.entryPrice),
        close_price: parseNum(values.closePrice),
        realized_pnl: parseNum(values.realizedPnl) ?? 0,
        fee: parseNum(values.fee) ?? 0,
        funding: parseNum(values.funding) ?? 0,
        opened_at,
        closed_at,
        notes: values.notes.trim() || null,
      };

      setSaving(true);
      try {
        const { error } = await getSupabase()
          .from("trades")
          .update(update)
          .eq("id", trade.id);
        if (error) {
          Alert.alert("Ошибка", error.message);
          return;
        }
        router.back();
      } finally {
        setSaving(false);
      }
    },
    [trade, saving, router],
  );

  const handleSaveNotes = useCallback(async () => {
    if (!trade || saving) return;
    setSaving(true);
    try {
      const { error } = await getSupabase()
        .from("trades")
        .update({ notes: notes.trim() || null })
        .eq("id", trade.id);
      if (error) {
        Alert.alert("Ошибка", error.message);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }, [trade, saving, notes, router]);

  const handleDelete = useCallback(() => {
    if (!trade) return;
    Alert.alert(
      "Удалить сделку?",
      `${trade.symbol} — действие необратимо.`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            const { error } = await getSupabase()
              .from("trades")
              .delete()
              .eq("id", trade.id);
            if (error) {
              Alert.alert("Ошибка", error.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  }, [trade, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>Загрузка сделки…</Text>
      </View>
    );
  }

  if (loadError || !trade) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось загрузить</Text>
        <Text style={styles.muted}>{loadError ?? "Сделка не найдена"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Назад</Text>
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
        options={{ title: "Редактирование сделки", headerShown: true }}
      />

      {/* Сводка по сделке (для не-manual — единственный контекст). */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.symbol}>{trade.symbol}</Text>
          <Text style={styles.exchangeTag}>
            {EXCHANGE_LABELS[trade.exchange] ?? trade.exchange}
          </Text>
        </View>
        <Text style={styles.summaryMeta}>
          {trade.side === "long" ? "LONG" : "SHORT"} · открыта{" "}
          {fmtDate(trade.opened_at)} · закрыта {fmtDate(trade.closed_at)}
        </Text>
        <Text
          style={[
            styles.summaryPnl,
            { color: tradeNetPnl(trade) >= 0 ? colors.profit : colors.loss },
          ]}
        >
          {fmtPnl(tradeNetPnl(trade))}
        </Text>
      </View>

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
          submitLabel="Сохранить изменения"
          submitting={saving}
          onSubmit={handleUpdate}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={styles.hint}>
            Сделка синхронизируется с биржи — следующий синк перезапишет
            поля. Доступно редактирование только заметки.
          </Text>
          <View style={styles.field}>
            <Text style={styles.label}>Заметки</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Опционально"
              placeholderTextColor={colors.textFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSaveNotes}
            disabled={saving}
          >
            <Text style={styles.buttonText}>Сохранить заметку</Text>
          </TouchableOpacity>
        </View>
      )}

      {isManual && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Удалить сделку</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  symbol: { fontSize: 16, fontWeight: "700", color: colors.text },
  exchangeTag: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryMeta: { fontSize: 12, color: colors.textFaint },
  summaryPnl: { fontSize: 18, fontWeight: "700" },
  hint: { fontSize: 12, color: colors.textFaint, lineHeight: 16 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
