import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (e) {
      console.error("Login error:", e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>FUTURES TRACKER</Text>
        <Text style={styles.subtitle}>Личный трекер фьючерсных сделок</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Войти через Google</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Вход только для пользователей из allowlist
        </Text>
      </View>
    </View>
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
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  hint: {
    fontSize: 10,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 8,
  },
});
