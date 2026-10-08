import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { StyleSheet, Text, View } from "react-native";

/** Только реально существующие возможности Premium (см. REFACTORING.md). */
const FEATURES: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}> = [
  {
    icon: "sync",
    title: "Авто-синк бирж",
    desc: "Подключите API-ключи — Binance, Bybit, Bitget, MEXC, BingX подтянут сделки сами",
  },
  {
    icon: "infinite",
    title: "Безлимит сделок",
    desc: "FREE — до 50 сделок, Premium — без ограничений",
  },
];

/**
 * FeaturesCard — карточка «что входит в Premium». Выделено из
 * app/paywall.tsx при декомпозиции; данные, разметка и стили перенесены
 * без изменений.
 */
export function FeaturesCard() {
  return (
    <View style={styles.featuresCard}>
      {FEATURES.map((f) => (
        <View key={f.title} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name={f.icon} size={20} color={colors.accent} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
