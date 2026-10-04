import { useAuth } from "@/context/AuthContext";
import { getAppleAuthentication } from "@/services/auth";
import { colors } from "@/theme/colors";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Экран входа.
 *
 * Кнопка Apple (системный компонент AppleAuthenticationButton — со
 * официальной иконкой и стилями Human Interface Guidelines) показывается
 * только на iOS и только если устройство поддерживает Sign in with Apple.
 * На Android/web ленивый require модуля вообще не выполняется.
 */

// null на Android/web — модуль iOS-only, не вычисляем его там вовсе.
const AppleAuth = getAppleAuthentication();

export default function LoginScreen() {
  const { login, loginApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (!AppleAuth) return;
    let mounted = true;
    AppleAuth.isAvailableAsync()
      .then((v) => {
        if (mounted) setAppleAvailable(v);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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

  const handleAppleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loginApple();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Отмена нативного шита Apple — не ошибка, молча выходим
      // (поведение как у отмены браузера в Google-флоу).
      if (msg.includes("ERR_REQUEST_CANCELED")) return;
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

        {AppleAuth && appleAvailable ? (
          <View
            style={[styles.appleWrap, loading && styles.buttonDisabled]}
            pointerEvents={loading ? "none" : "auto"}
          >
            <AppleAuth.AppleAuthenticationButton
              buttonType={
                AppleAuth.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={AppleAuth.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          </View>
        ) : null}

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
  appleWrap: {
    width: "100%",
    minHeight: 44,
    justifyContent: "center",
  },
  appleButton: {
    width: "100%",
    height: 44,
  },
  hint: {
    fontSize: 10,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 8,
  },
});
