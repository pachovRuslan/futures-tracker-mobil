import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/services/auth";
import type { BalanceSnapshot, BalanceType } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * Экран «Баланс» — снапшоты спот/фьючерс депозитов.
 *
 * ⚠️ История бага: раньше читал данные с несуществующего REST-энда /
 * api/balance (бэкенд отвечал HTML) и не имел формы добавления — экран
 * вечно показывал «Нет записей» без способа их создать. Теперь чтение
 * и запись идут напрямую в Supabase (RLS), добавление — upsert по
 * (user_id, type, snapshot_date), удаление — долгое нажатие на запись.
 */

const BALANCE_SELECT = "id,type,value_usd,snapshot_date,note,created_at";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BalanceScreen() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<BalanceType>("spot");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await getSupabase()
        .from("balance_snapshots")
        .select(BALANCE_SELECT)
        .order("snapshot_date", { ascending: false });
      if (dbError) throw new Error(dbError.message);
      if (mountedRef.current) setSnapshots((data ?? []) as BalanceSnapshot[]);
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

  const submit = useCallback(async () => {
    if (saving || !user?.id) return;

    const val = Number(value.trim().replace(",", "."));
    if (!value.trim() || !Number.isFinite(val)) {
      Alert.alert("Проверьте поля", "Сумма должна быть числом.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert("Проверьте поля", "Дата должна быть в формате ГГГГ-ММ-ДД.");
      return;
    }

    setSaving(true);
    try {
      const { error: upsertError } = await getSupabase()
        .from("balance_snapshots")
        .upsert(
          {
            user_id: user.id,
            type,
            value_usd: val,
            snapshot_date: date.trim(),
            note: note.trim() || null,
          },
          { onConflict: "user_id,type,snapshot_date" },
        );
      if (upsertError) throw upsertError;

      setValue("");
      setNote("");
      setFormOpen(false);
      await load();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [saving, user?.id, value, date, note, type, load]);

  const confirmDelete = useCallback(
    (s: BalanceSnapshot) => {
      Alert.alert("Удалить запись", `$${s.value_usd} от ${s.snapshot_date}?`, [
        { text: "Отмена" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              const { error: delError } = await getSupabase()
                .from("balance_snapshots")
                .delete()
                .eq("id", s.id);
              if (delError) throw delError;
              await load();
            } catch (e) {
              Alert.alert(
                "Ошибка",
                e instanceof Error ? e.message : String(e),
              );
            }
          },
        },
      ]);
    },
    [load],
  );

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
    <TouchableOpacity
      key={s.id}
      style={styles.row}
      onLongPress={() => confirmDelete(s)}
      delayLongPress={400}
    >
      <View>
        <Text style={styles.value}>${Number(s.value_usd).toFixed(2)}</Text>
        <Text style={styles.date}>{s.snapshot_date}</Text>
      </View>
      {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setFormOpen((v) => !v)}
      >
        <Text style={styles.addButtonText}>
          {formOpen ? "Свернуть форму" : "+ Записать баланс"}
        </Text>
      </TouchableOpacity>

      {formOpen && (
        <View style={styles.form}>
          <View style={styles.sideRow}>
            {(["spot", "futures"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, type === t && styles.typeButtonActive]}
                onPress={() => setType(t)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === t && styles.typeButtonTextActive,
                  ]}
                >
                  {t === "spot" ? "Спот" : "Фьючерс"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Сумма, USD</Text>
              <TextInput
                style={styles.input}
                placeholder="1000"
                placeholderTextColor={colors.textFaint}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Дата</Text>
              <TextInput
                style={styles.input}
                placeholder="ГГГГ-ММ-ДД"
                placeholderTextColor={colors.textFaint}
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Заметка</Text>
            <TextInput
              style={styles.input}
              placeholder="Опционально"
              placeholderTextColor={colors.textFaint}
              value={note}
              onChangeText={setNote}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Сохранить</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 16,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  sideRow: { flexDirection: "row", gap: 8 },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeButtonText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  typeButtonTextActive: { color: "#fff" },
  fieldRow: { flexDirection: "row", gap: 12 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
