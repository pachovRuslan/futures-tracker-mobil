import { api } from "@/services/api";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ВАЖНО: НЕ используем @react-native-picker/picker — это нативный модуль,
// который не работает в Expo Go и вызывает краш при загрузке бандла.
// Вместо этого — горизонтальный скролл с кнопками бирж.
// Это работает на всех платформах (Expo Go, dev build, web, standalone).

export default function ConnectionsScreen() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<(typeof EXCHANGES)[number]>(EXCHANGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConnections();
      setConnections(data.connections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!apiKey || !apiSecret) return;
    setSaving(true);
    try {
      await api.addConnection({ exchange, apiKey, apiSecret });
      setApiKey("");
      setApiSecret("");
      await load();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = (ex: string) => {
    Alert.alert("Отключить", `Отключить ${EXCHANGE_LABELS[ex] ?? ex}?`, [
      { text: "Отмена" },
      {
        text: "Да",
        onPress: async () => {
          try {
            await api.deleteConnection(ex);
            await load();
          } catch (e) {
            Alert.alert(
              "Ошибка",
              e instanceof Error ? e.message : String(e),
            );
          }
        },
      },
    ]);
  };

  if (loading && connections.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Загрузка подключений…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Подключения</Text>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}
      {EXCHANGES.map((ex) => {
        const conn = connections.find((c) => c.exchange === ex);
        return (
          <View key={ex} style={styles.row}>
            <View>
              <Text style={styles.exchangeName}>{EXCHANGE_LABELS[ex]}</Text>
              {conn ? (
                <Text style={styles.connected}>✓ {conn.key_preview}</Text>
              ) : (
                <Text style={styles.notConnected}>не подключено</Text>
              )}
            </View>
            {conn && (
              <TouchableOpacity onPress={() => disconnect(ex)}>
                <Text style={styles.disconnect}>Отключить</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <Text style={[styles.title, { marginTop: 24 }]}>Добавить</Text>
      <View style={styles.form}>
        {/* Селектор биржи — горизонтальный скролл с кнопками.
            Заменяет @react-native-picker/picker, который не работает в Expo Go. */}
        <View>
          <Text style={styles.fieldLabel}>Биржа</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exchangeSelector}
          >
            {EXCHANGES.map((ex) => {
              const selected = ex === exchange;
              return (
                <TouchableOpacity
                  key={ex}
                  style={[
                    styles.exchangeChip,
                    selected && styles.exchangeChipActive,
                  ]}
                  onPress={() => setExchange(ex)}
                >
                  <Text
                    style={[
                      styles.exchangeChipText,
                      selected && styles.exchangeChipTextActive,
                    ]}
                  >
                    {EXCHANGE_LABELS[ex]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.fieldLabel}>API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Введите API Key"
            placeholderTextColor={colors.textFaint}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>API Secret</Text>
          <TextInput
            style={styles.input}
            placeholder="Введите API Secret"
            placeholderTextColor={colors.textFaint}
            value={apiSecret}
            onChangeText={setApiSecret}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (saving || !apiKey || !apiSecret) && styles.buttonDisabled]}
          onPress={submit}
          disabled={saving || !apiKey || !apiSecret}
        >
          <Text style={styles.buttonText}>
            {saving ? "Проверка..." : "Сохранить"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    gap: 12,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  title: {
    fontSize: 11,
    textTransform: "uppercase",
    color: colors.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  exchangeName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  connected: { fontSize: 11, color: colors.profit, marginTop: 4 },
  notConnected: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  disconnect: { fontSize: 12, color: colors.loss },
  form: { gap: 14 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textFaint,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exchangeSelector: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  exchangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exchangeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  exchangeChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
  exchangeChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: { color: colors.loss, fontSize: 13 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  retryButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
