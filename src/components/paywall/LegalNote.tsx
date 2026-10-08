import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "@/shared/config";
import { colors } from "@/theme/colors";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * LegalNote — юридическая сноска (требование сторов): условия подписки и
 * ссылки на политику конфиденциальности / условия использования.
 * Выделено из app/paywall.tsx при декомпозиции; разметка и стили
 * перенесены без изменений.
 */
export function LegalNote() {
  return (
    <>
      <Text style={styles.legalText}>
        Оплата списывается с вашего счёта в магазине после подтверждения.
        Подписка продлевается автоматически, пока не отменена в настройках
        Google Play / App Store. Управление подпиской — в аккаунте магазина.
      </Text>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.legalLink}>Политика конфиденциальности</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
          <Text style={styles.legalLink}>Условия использования</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
