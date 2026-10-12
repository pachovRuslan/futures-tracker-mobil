import type { PaywallBusy } from "@/hooks/usePaywallActions";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

interface RestoreButtonProps {
  /** Идёт ли сейчас покупка/restore (спиннер + disabled). */
  busy: PaywallBusy;
  /** Запуск восстановления покупок. */
  onRestore: () => void;
}

/** RestoreButton — «Восстановить покупки». */
export function RestoreButton({ busy, onRestore }: RestoreButtonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
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
          {t("paywall.restore")}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
