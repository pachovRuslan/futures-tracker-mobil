import { colors } from "@/theme/colors";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PACKAGE_TYPE, type PurchasesPackage } from "react-native-purchases";

/** Человекочитаемое название пакета подписки. */
function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.MONTHLY:
      return "1 месяц";
    case PACKAGE_TYPE.ANNUAL:
      return "1 год";
    case PACKAGE_TYPE.WEEKLY:
      return "1 неделя";
    case PACKAGE_TYPE.LIFETIME:
      return "Навсегда";
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
 * PlansCard — тарифы из стора: радио-строки «срок · цена». Выделено из
 * app/paywall.tsx при декомпозиции; packageLabel, разметка и стили
 * перенесены без изменений.
 */
export function PlansCard({ packages, selected, onSelect }: PlansCardProps) {
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
              <Text style={styles.planTitle}>{packageLabel(pkg)}</Text>
              <Text style={styles.planDesc}>
                Автопродление · отмена в любой момент
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

const styles = StyleSheet.create({
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
