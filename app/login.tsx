import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await login();
      // Сессия установится через onAuthStateChange → AuthProvider обновит user
      // → RootNavigator сделает redirect на "/".
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось войти";
      Alert.alert("Ошибка входа", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>FUTURES TRACKER</Text>
        <Text style={styles.subtitle}>Личный трекер фьючерсных сделок</Text>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти через Google</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>
          Вход только для пользователей из allowlist
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
    maxWidth: 320,
    width: "100%",
  },
  title: {
    fontSize: 14,
    letterSpacing: 2,
    color: colors.textMuted,
    fontWeight: "600",
  },
  subtitle: { fontSize: 12, color: colors.textFaint, textAlign: "center" },
  button: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    minWidth: 180,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  hint: {
    fontSize: 10,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 8,
  },
});
