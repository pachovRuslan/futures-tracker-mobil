import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface PremiumBannerProps {
  /** Тап по баннеру — открыть пейволл. */
  onPress: () => void;
}

/**
 * PremiumBanner — карточка «Upgrade to Premium» для FREE-юзеров
 * (рисуется только при !isPremium — условие осталось в экране).
 *
 * Выделено из app/(tabs)/index.tsx при декомпозиции; разметка и стили
 * перенесены без изменений.
 */
export function PremiumBanner({ onPress }: PremiumBannerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <Pressable
      style={styles.premiumCard}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.premiumCardContent}>
        <Text style={styles.premiumCardTitle}>
          {t("premium.bannerTitle")}
        </Text>
        <Text style={styles.premiumCardDesc}>
          {t("premium.bannerDesc")}
        </Text>
      </View>
      <Text style={styles.premiumCardArrow}>→</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  premiumCardContent: { flex: 1, gap: 4 },
  premiumCardTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  premiumCardDesc: {
    fontSize: 11,
    color: "#fff",
    opacity: 0.9,
    lineHeight: 15,
  },
  premiumCardArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
});
