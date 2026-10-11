import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { StyleSheet, Text, View } from "react-native";
import type { TranslationKey } from "@/i18n/translations";

/** Только реально существующие возможности Premium (см. REFACTORING.md). */
const FEATURES: ReadonlyArray<{
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  {
    icon: "sync",
    titleKey: "feature.syncTitle",
    descKey: "feature.syncDesc",
  },
  {
    icon: "infinite",
    titleKey: "feature.unlimitedTitle",
    descKey: "feature.unlimitedDesc",
  },
];

/**
 * FeaturesCard — карточка «что входит в Premium». Выделено из
 * app/paywall.tsx при декомпозиции; данные, разметка и стили перенесены
 * без изменений (кроме i18n: тексты теперь по ключам).
 */
export function FeaturesCard() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.featuresCard}>
      {FEATURES.map((f) => (
        <View key={f.titleKey} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name={f.icon} size={20} color={colors.accent} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
            <Text style={styles.featureDesc}>{t(f.descKey)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  featureContent: { flex: 1, gap: 2 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
