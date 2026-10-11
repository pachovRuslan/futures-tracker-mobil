import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface TradeNotesFormProps {
  /** Текущий текст заметки (state из useEditableTrade). */
  notes: string;
  onChangeNotes: (text: string) => void;
  /** Идёт сохранение — кнопка блокируется. */
  saving: boolean;
  onSave: () => void;
}

/**
 * Редактор заметки для синхронизированной с биржи сделки: следующий
 * синк перезапишет остальные поля, поэтому доступна только заметка.
 *
 * Выделено из app/trade/edit.tsx при декомпозиции; разметка и стили
 * перенесены без изменений (onChangeText/onPress привязаны к пропсам).
 */
export function TradeNotesForm({
  notes,
  onChangeNotes,
  saving,
  onSave,
}: TradeNotesFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.hint}>{t("trade.notesHint")}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>{t("form.notes")}</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder={t("form.notesPlaceholder")}
          placeholderTextColor={colors.textFaint}
          value={notes}
          onChangeText={onChangeNotes}
          multiline
        />
      </View>
      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{t("trade.saveNote")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
});
