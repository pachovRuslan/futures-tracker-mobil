import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/translations";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * LanguageSelect — сегмент выбора языка (Русский / English).
 *
 * Один и тот же компонент на экране входа (первый выбор до
 * авторизации) и в настройках. Названия языков показываются на самих
 * языках — это не переводы. Стиль повторяет сегмент темы из
 * app/(tabs)/settings.tsx.
 */
export function LanguageSelect() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { locale, setLocale } = useI18n();
  return (
    <View style={styles.segment}>
      {LANGUAGES.map(({ value, label }) => {
        const active = locale === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => setLocale(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    segment: {
      flexDirection: "row",
      backgroundColor: colors.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      gap: 3,
      alignSelf: "stretch",
    },
    option: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: "center",
    },
    optionActive: { backgroundColor: colors.accent },
    optionText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    optionTextActive: { color: "#fff" },
  });
