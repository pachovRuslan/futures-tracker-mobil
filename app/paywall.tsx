import { useSubscription } from "@/hooks/useSubscription";
import {
    getOfferings,
    purchasePremium,
    restorePurchases,
} from "@/services/subscriptions";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function PaywallScreen() {
  const { check } = useSubscription();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getOfferings()
      .then(setPackages)
      .catch(() => {});
  }, []);

  const buy = async (pkg: any) => {
    setLoading(true);
    try {
      const success = await purchasePremium(pkg.product.identifier);
      if (success) {
        await check();
        Alert.alert("Готово", "Premium активирован");
        router.back();
      }
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        await check();
        router.back();
      } else Alert.alert("Восстановление", "Активных подписок не найдено");
    } catch (e) {
      Alert.alert("Ошибка", String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Futures Tracker Premium</Text>
      <View style={styles.features}>
        <Text style={styles.feature}>✓ Авто-синк 6 бирж</Text>
        <Text style={styles.feature}>✓ Push-уведомления</Text>
        <Text style={styles.feature}>✓ Экспорт CSV</Text>
        <Text style={styles.feature}>✓ Безлимитные биржи</Text>
      </View>
      {packages.map((pkg) => (
        <TouchableOpacity
          key={pkg.identifier}
          style={styles.package}
          onPress={() => buy(pkg)}
          disabled={loading}
        >
          <Text style={styles.packageTitle}>{pkg.product.title}</Text>
          <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={restore} style={styles.restoreButton}>
        <Text style={styles.restoreText}>Восстановить покупку</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.profit,
    textAlign: "center",
    marginBottom: 24,
  },
  features: { gap: 12, marginBottom: 32 },
  feature: { color: colors.text, fontSize: 15 },
  package: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageTitle: { color: colors.text, fontSize: 15, fontWeight: "500" },
  packagePrice: { color: colors.accent, fontSize: 18, fontWeight: "700" },
  restoreButton: { marginTop: 16, alignItems: "center" },
  restoreText: { color: colors.textFaint, fontSize: 13 },
});
