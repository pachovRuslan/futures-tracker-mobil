import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nContext";
import { exchangeLabel } from "@/shared/types";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface ExchangeFilterChipsProps {
  /** Уникальные биржи с данными (из useDashboardStats). */
  exchanges: string[];
  /** Активный фильтр: "all" или код биржи. */
  exchangeFilter: string;
  /** Выбор фильтра (тап по чипу). */
  onChange: (exchange: string) => void;
}

/**
 * ExchangeFilterChips — чипы фильтра по биржам «БИРЖИ В PNL» (как на вебе).
 */
export function ExchangeFilterChips({
  exchanges,
  exchangeFilter,
  onChange,
}: ExchangeFilterChipsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.chipsBlock}>
      <Text style={styles.chipsLabel}>{t("dash.chipsLabel")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Pressable
          style={[
            styles.chip,
            exchangeFilter === "all" && styles.chipActive,
          ]}
          onPress={() => onChange("all")}
        >
          {exchangeFilter === "all" && (
            <Ionicons name="checkmark" size={13} color={colors.accent} />
          )}
          <Text
            style={[
              styles.chipText,
              exchangeFilter === "all" && styles.chipTextActive,
            ]}
          >
            {t("dash.chipsAll")}
          </Text>
        </Pressable>
        {exchanges.map((ex) => (
          <Pressable
            key={ex}
            style={[
              styles.chip,
              exchangeFilter === ex && styles.chipActive,
            ]}
            onPress={() => onChange(ex)}
          >
            {exchangeFilter === ex && (
              <Ionicons name="checkmark" size={13} color={colors.accent} />
            )}
            <Text
              style={[
                styles.chipText,
                exchangeFilter === ex && styles.chipTextActive,
              ]}
            >
              {exchangeLabel(ex)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  chipsBlock: { gap: 8 },
  chipsLabel: {
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  chipsRow: { flexDirection: "row", gap: 6, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
});
