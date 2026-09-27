import { api } from "@/services/api";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Picker,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

export default function ConnectionsScreen() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchange, setExchange] = useState(EXCHANGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getConnections();
      setConnections(data.connections ?? []);
    } catch {
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
    Alert.alert("Отключить", `Отключить ${ex}?`, [
      { text: "Отмена" },
      {
        text: "Да",
        onPress: async () => {
          await api.deleteConnection(ex);
          await load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Подключения</Text>
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
        <Picker
          selectedValue={exchange}
          onValueChange={setExchange}
          style={styles.picker}
          itemStyle={{ color: colors.text }}
        >
          {EXCHANGES.map((ex) => (
            <Picker.Item key={ex} label={EXCHANGE_LABELS[ex]} value={ex} />
          ))}
        </Picker>
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
          style={styles.button}
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
  picker: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    color: colors.text,
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
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});
