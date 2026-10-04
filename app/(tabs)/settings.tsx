import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getSupabase } from "@/services/auth";
import { resetPurchases } from "@/services/purchases";
import {
  EXCHANGE_CONNECTIONS_ENABLED,
  PRIVACY_POLICY_URL,
  TERMS_OF_USE_URL,
} from "@/shared/config";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  // ─── Удаление аккаунта (Google Play Account Deletion / App Review 5.1.1(v)) ──
  //
  // RPC delete_my_account() (миграция 10 на сайте) сносит auth.users;
  // trades / balance_snapshots / user_entitlements / exchange_connections
  // удаляются каскадом. Перед удалением выходим из RevenueCat и из сессии.
  const confirmDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await getSupabase().rpc("delete_my_account");
      if (error) throw error;

      try {
        await resetPurchases();
      } catch {
        // RC-logout не критичен: подписка отвяжется при следующем logIn.
      }

      // Сессия уже мертва (auth.users удалён) — logout очищает локальный
      // state даже если network-вызов signOut упадёт.
      await logout();
      // Дальше RootNavigator сам уведёт на /login (user = null).
    } catch (e) {
      Alert.alert(
        "Не удалось удалить аккаунт",
        e instanceof Error ? e.message : String(e),
      );
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Удалить аккаунт?",
      "Будут безвозвратно удалены: профиль, все сделки, снимки баланса, подключения бирж и подписка Premium. Это действие нельзя отменить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить навсегда",
          style: "destructive",
          onPress: () => {
            void confirmDeleteAccount();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        <View
          style={[
            styles.badge,
            isPremium ? styles.premiumBadge : styles.freeBadge,
          ]}
        >
          <Text style={styles.badgeText}>{isPremium ? "PREMIUM" : "FREE"}</Text>
        </View>
      </View>

      {!isPremium && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => router.push("/paywall")}
        >
          <Text style={styles.upgradeText}>Перейти на Premium</Text>
        </TouchableOpacity>
      )}

      {EXCHANGE_CONNECTIONS_ENABLED && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            // FREE — сразу пейволл, без мелькания экрана «Подключения»
            // (экранный гейт при этом всё равно остаётся — он защищает и
            // deep link). Пока статус ещё грузится, решение принимает гейт
            // самого экрана, а не эта кнопка.
            if (!subLoading && !isPremium) {
              router.push("/paywall");
            } else {
              router.push("/connections");
            }
          }}
        >
          <Text style={styles.menuText}>Подключения бирж</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
      >
        <Text style={styles.menuText}>Политика конфиденциальности</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
      >
        <Text style={styles.menuText}>Условия использования</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={async () => {
          try {
            await logout();
          } catch (e) {
            if (__DEV__) console.error("Logout error:", e);
          }
        }}
      >
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator size="small" color={colors.loss} />
        ) : (
          <Text style={styles.deleteText}>Удалить аккаунт</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  email: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  premiumBadge: { backgroundColor: colors.profitDim },
  freeBadge: { backgroundColor: colors.surfaceHover },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.text },
  upgradeButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  upgradeText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  menuText: { fontSize: 14, color: colors.text },
  arrow: { color: colors.textFaint, fontSize: 16 },
  logoutButton: { marginTop: 24, padding: 16, alignItems: "center" },
  logoutText: { color: colors.loss, fontSize: 14 },
  deleteButton: { marginTop: 4, padding: 16, alignItems: "center" },
  deleteText: { color: colors.loss, fontSize: 12, opacity: 0.8 },
});
