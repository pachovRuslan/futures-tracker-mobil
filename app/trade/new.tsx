import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/services/auth";
import type { TradeInsert, TradeSide } from "@/shared/types";
import { colors } from "@/theme/colors";
import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Ручное добавление сделки (exchange = "manual").
 *
 * Раньше кнопка «Сделка» на дашборде не делала НИЧЕГО (TODO-заглушка),
 * хотя empty-state обещал «Добавьте первую сделку». Вставка идёт напрямую
 * в Supabase — RLS-политика users_insert_own_trades гарантирует, что
 * юзер может писать только свои строки (user_id = auth.uid()).
 */

function parseNum(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function NewTradeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<TradeSide>("long");
  const [qty, setQty] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [closePrice, setClosePrice] = useState("");
  const [realizedPnl, setRealizedPnl] = useState("");
  const [fee, setFee] = useState("");
  const [funding, setFunding] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;

    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      Alert.alert("Проверьте поля", "Укажите тикер (например, BTCUSDT).");
      return;
    }
    if (!user?.id) return;

    const pnl = parseNum(realizedPnl);
    if (realizedPnl.trim() && pnl == null) {
      Alert.alert("Проверьте поля", "P&L должен быть числом.");
      return;
    }

    setSaving(true);
    try {
      const isOpen = !closePrice.trim();
      const now = new Date().toISOString();

      const payload: TradeInsert = {
        user_id: user.id,
        exchange: "manual",
        external_id: `manual-${Date.now()}`,
        symbol: sym,
        side,
        qty: parseNum(qty),
        entry_price: parseNum(entryPrice),
        close_price: parseNum(closePrice),
        realized_pnl: pnl ?? 0,
        fee: parseNum(fee) ?? 0,
        funding: parseNum(funding) ?? 0,
        opened_at: now,
        closed_at: isOpen ? null : now,
        notes: notes.trim() || null,
      };

      const { error } = await getSupabase().from("trades").insert(payload);
      if (error) throw error;

      router.back();
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Не удалось сохранить сделку",
      );
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    symbol,
    user?.id,
    realizedPnl,
    closePrice,
    qty,
    entryPrice,
    fee,
    funding,
    notes,
    side,
    router,
  ]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Новая сделка", headerShown: true }} />

      <View style={styles.field}>
        <Text style={styles.label}>Тикер *</Text>
        <TextInput
          style={styles.input}
          placeholder="BTCUSDT"
          placeholderTextColor={colors.textFaint}
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Направление</Text>
        <View style={styles.sideRow}>
          {(["long", "short"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.sideButton,
                side === s && styles.sideButtonActive,
                side === s && s === "long" && { backgroundColor: colors.profit },
                side === s && s === "short" && { backgroundColor: colors.loss },
              ]}
              onPress={() => setSide(s)}
            >
              <Text
                style={[styles.sideText, side === s && styles.sideTextActive]}
              >
                {s === "long" ? "LONG" : "SHORT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Кол-во</Text>
          <TextInput
            style={styles.input}
            placeholder="0.01"
            placeholderTextColor={colors.textFaint}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>P&L, USDT *</Text>
          <TextInput
            style={styles.input}
            placeholder="-12.5"
            placeholderTextColor={colors.textFaint}
            value={realizedPnl}
            onChangeText={setRealizedPnl}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Entry</Text>
          <TextInput
            style={styles.input}
            placeholder="42000"
            placeholderTextColor={colors.textFaint}
            value={entryPrice}
            onChangeText={setEntryPrice}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Close</Text>
          <TextInput
            style={styles.input}
            placeholder="пусто = открыта"
            placeholderTextColor={colors.textFaint}
            value={closePrice}
            onChangeText={setClosePrice}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Комиссия</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            value={fee}
            onChangeText={setFee}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Funding</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            value={funding}
            onChangeText={setFunding}
            keyboardType="numeric"
          />
        </View>
      </View>

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
        onPress={handleSave}
        disabled={saving || !symbol.trim()}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Сохранить</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 4 },
  field: { gap: 6 },
  fieldRow: { flexDirection: "row", gap: 12 },
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
  sideRow: { flexDirection: "row", gap: 8 },
  sideButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideButtonActive: { borderColor: "transparent" },
  sideText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  sideTextActive: { color: "#fff" },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
