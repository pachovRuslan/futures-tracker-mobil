import { Ionicons } from "@expo/vector-icons";
import { EXCHANGE_CONNECTIONS_ENABLED } from "@/shared/config";
import { colors } from "@/theme/colors";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ActionButtonsProps {
  /** «Сделка» — новая ручная сделка (FREE-гейт по лимиту — в экране). */
  onAddTrade: () => void;
  /** «Биржа» — экран подключений (FREE-гейт — в экране). */
  onAddExchange: () => void;
  /** Премиум? Меняет иконку «Биржа» (sync/lock) и залоченность. */
  isPremium: boolean;
}

/**
 * ActionButtons — кнопки действий под графиком: «Сделка» и «Биржа».
 * «Биржа» рисуется только при включённой фиче подключений бирж
 * (kill-switch EXCHANGE_CONNECTIONS_ENABLED).
 *
 * Выделено из app/(tabs)/index.tsx при декомпозиции; разметка и стили
 * перенесены без изменений.
 */
export function ActionButtons({
  onAddTrade,
  onAddExchange,
  isPremium,
}: ActionButtonsProps) {
  return (
    <View style={styles.actionsRow}>
      <Pressable
        style={[styles.actionButton, styles.actionButtonPrimary]}
        onPress={onAddTrade}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.actionButtonTextDark}>Сделка</Text>
      </Pressable>
      {EXCHANGE_CONNECTIONS_ENABLED && (
        <Pressable
          style={[styles.actionButton, !isPremium && styles.actionButtonLocked]}
          onPress={onAddExchange}
        >
          <Ionicons
            name={isPremium ? "sync" : "lock-closed"}
            size={18}
            color={colors.text}
          />
          <Text style={styles.actionButtonText}>Биржа</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionButtonLocked: { opacity: 0.7 },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.text },
  actionButtonTextDark: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
