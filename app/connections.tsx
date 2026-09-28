import { api } from "@/services/api";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// В React Native 0.86 Picker удалён из ядра.
// Используем @react-native-picker/picker — установите его:
//   npx expo install @react-native-picker/picker
import { Picker } from "@react-native-picker/picker";

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
    <View style={styles.container}>
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
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={exchange}
            onValueChange={(v) => setExchange(v as (typeof EXCHANGES)[number])}
            style={styles.picker}
            dropdownIconColor={colors.text}
            itemStyle={{ color: colors.text }}
          >
            {EXCHANGES.map((ex) => (
              <Picker.Item
                key={ex}
                label={EXCHANGE_LABELS[ex]}
                value={ex}
                color={colors.text}
              />
            ))}
          </Picker>
        </View>
        <TextInput
          style={styles.input}
          placeholder="API Key"
          placeholderTextColor={colors.textFaint}
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="API Secret"
          placeholderTextColor={colors.textFaint}
          value={apiSecret}
          onChangeText={setApiSecret}
          secureTextEntry
          autoCapitalize="none"
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
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
  form: { gap: 12 },
  pickerWrap: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    color: colors.text,
    height: 50,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
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
