import type { PaywallBusy } from "@/hooks/usePaywallActions";
import { colors } from "@/theme/colors";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

interface RestoreButtonProps {
  /** Идёт ли сейчас покупка/restore (спиннер + disabled). */
  busy: PaywallBusy;
  /** Запуск восстановления покупок. */
  onRestore: () => void;
}

/**
 * RestoreButton — «Восстановить покупки». Выделено из app/paywall.tsx при
 * декомпозиции; разметка и стили перенесены без изменений.
 */
export function RestoreButton({ busy, onRestore }: RestoreButtonProps) {
  return (
    <Pressable
      style={styles.restoreButton}
      onPress={onRestore}
      disabled={busy !== null}
    >
      {busy === "restore" ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={styles.restoreButtonText}>
          Восстановить покупки
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  restoreButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  restoreButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "500",
  },
});
