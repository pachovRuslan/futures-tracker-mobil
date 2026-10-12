import { useI18n } from "@/i18n/I18nContext";
import type { TFunction } from "@/i18n";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PACKAGE_TYPE, type PurchasesPackage } from "react-native-purchases";

/** Человекочитаемое название пакета подписки (перевод передаёт
 *  вызывающий компонент). */
function packageLabel(pkg: PurchasesPackage, t: TFunction): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.MONTHLY:
      return t("plan.month");
    case PACKAGE_TYPE.ANNUAL:
      return t("plan.year");
    case PACKAGE_TYPE.WEEKLY:
      return t("plan.week");
    case PACKAGE_TYPE.LIFETIME:
      return t("plan.forever");
    default:
      return pkg.product.title ?? "Premium";
  }
}

interface PlansCardProps {
  /** Офферинги RC (тарифы с ценами из стора). */
  packages: PurchasesPackage[];
  /** Выбранный тариф (карточка рендерится только при наличии выбора). */
  selected: PurchasesPackage;
  /** Выбор тарифа (тап по строке). */
  onSelect: (pkg: PurchasesPackage) => void;
}

/**
 * PlansCard — тарифы из стора: радио-строки «срок · цена».
 */
export function PlansCard({ packages, selected, onSelect }: PlansCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.plansCard}>
      {packages.map((pkg) => {
        const active = pkg.identifier === selected.identifier;
        return (
          <Pressable
            key={pkg.identifier}
            style={[styles.planRow, active && styles.planRowActive]}
            onPress={() => onSelect(pkg)}
          >
            <View style={styles.planRadio}>
              {active ? <View style={styles.planRadioDot} /> : null}
            </View>
            <View style={styles.planContent}>
              <Text style={styles.planTitle}>{packageLabel(pkg, t)}</Text>
              <Text style={styles.planDesc}>
                {t("paywall.autoRenew")}
              </Text>
            </View>
            <Text style={styles.planPrice}>
              {pkg.product.priceString}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  plansCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    gap: 4,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planRowActive: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accent,
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textFaint,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  planContent: { flex: 1, gap: 2 },
  planTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  planDesc: {
    fontSize: 11,
    color: colors.textFaint,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  },
});
