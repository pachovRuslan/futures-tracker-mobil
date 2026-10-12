import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getSupabase } from "@/services/auth";
import type { BalanceType } from "@/shared/types";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BalanceFormProps {
  /** Перезагрузка списка снапшотов после успешного сохранения
   *  (экран передаёт load из useBalanceSnapshots). */
  onSaved: () => Promise<void> | void;
}

/**
 * BalanceForm — сворачиваемая карточка записи снапшота: кнопка
 * «+ Записать баланс», выбор типа (спот/фьючерс), сумма, дата,
 * заметка. Запись — upsert по (user_id, type, snapshot_date).
 *
 * Кнопка-переключатель и поля живут в одном компоненте: карточка
 * не размонтируется при сворачивании, поэтому введённые значения
 * (и дата, инициализируемая один раз) не сбрасываются.
 */
export function BalanceForm({ onSaved }: BalanceFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<BalanceType>("spot");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving || !user?.id) return;

    const val = Number(value.trim().replace(",", "."));
    if (!value.trim() || !Number.isFinite(val)) {
      Alert.alert(t("trade.checkFields"), t("balance.vAmount"));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert(t("trade.checkFields"), t("balance.vDate"));
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
      await onSaved();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setFormOpen((v) => !v)}
      >
        <Text style={styles.addButtonText}>
          {formOpen ? t("balance.collapse") : t("balance.add")}
        </Text>
      </TouchableOpacity>

      {formOpen && (
        <View style={styles.form}>
          <View style={styles.sideRow}>
            {(["spot", "futures"] as const).map((ty) => (
              <TouchableOpacity
                key={ty}
                style={[styles.typeButton, type === ty && styles.typeButtonActive]}
                onPress={() => setType(ty)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === ty && styles.typeButtonTextActive,
                  ]}
                >
                  {ty === "spot" ? t("balance.spot") : t("balance.futures")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t("balance.amount")}</Text>
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
              <Text style={styles.fieldLabel}>{t("balance.date")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("balance.datePlaceholder")}
                placeholderTextColor={colors.textFaint}
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("balance.note")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("form.notesPlaceholder")}
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
              <Text style={styles.buttonText}>{t("trade.save")}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
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
