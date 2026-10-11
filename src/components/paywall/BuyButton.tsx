import type { PaywallBusy } from "@/hooks/usePaywallActions";
import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

interface BuyButtonProps {
  /** Идёт ли сейчас покупка/restore (спиннер + disabled). */
  busy: PaywallBusy;
  /** Выбранный тариф (null — кнопка задизейблена; цена из него). */
  selected: PurchasesPackage | null;
  /** Запуск покупки. */
  onBuy: () => void;
}

/**
 * BuyButton — «Подписаться за <цена>». Выделено из app/paywall.tsx при
 * декомпозиции; разметка и стили перенесены без изменений.
 */
export function BuyButton({ busy, selected, onBuy }: BuyButtonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  return (
    <Pressable
      style={[styles.buyButton, busy === "buy" && styles.buttonDisabled]}
      onPress={onBuy}
      disabled={busy !== null || !selected}
    >
      {busy === "buy" ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buyButtonText}>
          {t("paywall.buyFor", { price: selected?.product.priceString ?? "" })}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  buyButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
