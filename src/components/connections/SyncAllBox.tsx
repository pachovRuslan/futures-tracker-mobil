import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface SyncAllBoxProps {
  /** Идентификатор активного синка: биржа или "all"; null — не идёт. */
  syncing: string | null;
  /** Строка статуса синка (прогресс/итог) под кнопкой. */
  syncMsg: string | null;
  /** Запуск синка всех подключённых бирж. */
  onSyncAll: () => void;
}

/**
 * SyncAllBox — ручной синк: кнопка «Синк все биржи» + статусная строка.
 * Свежие сделки появятся на дашборде при возврате (он перезагружается
 * по фокусу).
 */
export function SyncAllBox({ syncing, syncMsg, onSyncAll }: SyncAllBoxProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.syncBox}>
      <TouchableOpacity
        style={[
          styles.syncButton,
          syncing && styles.syncButtonDisabled,
        ]}
        onPress={onSyncAll}
        disabled={syncing != null}
      >
        {syncing === "all" ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <>
            <Ionicons name="sync" size={14} color={colors.accent} />
            <Text style={styles.syncButtonText}>{t("conn.syncAll")}</Text>
          </>
        )}
      </TouchableOpacity>
      {syncMsg && <Text style={styles.syncMsg}>{syncMsg}</Text>}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  syncBox: { marginBottom: 12, gap: 8 },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  syncMsg: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
