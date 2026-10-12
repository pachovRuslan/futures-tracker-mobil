import { useI18n } from "@/i18n/I18nContext";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "@/shared/config";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * LegalNote — юридическая сноска (требование сторов): условия подписки и
 * ссылки на политику конфиденциальности / условия использования.
 */
export function LegalNote() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <>
      <Text style={styles.legalText}>{t("paywall.legal")}</Text>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.legalLink}>{t("common.privacy")}</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
          <Text style={styles.legalLink}>{t("common.terms")}</Text>
        </Pressable>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  legalText: {
    fontSize: 10,
    color: colors.textFaint,
    lineHeight: 14,
    textAlign: "center",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 10,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  legalDot: { color: colors.textFaint, fontSize: 10 },
});
