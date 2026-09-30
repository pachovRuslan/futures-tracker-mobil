import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isPremium } = useSubscription();
  const router = useRouter();

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

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push("/connections")}
      >
        <Text style={styles.menuText}>Подключения бирж</Text>
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
});
