import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Link, Stack } from "expo-router";
import { SafeAreaView, StyleSheet, Text } from "react-native";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <Text style={styles.text}>{t("notFound.text")}</Text>
      <Link href="/" style={styles.link}>
        {t("notFound.back")}
      </Link>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  text: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 16,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
  },
});
